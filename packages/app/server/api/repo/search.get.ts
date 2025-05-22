import { z } from "zod";
import { App } from "@octokit/app";
import type { Octokit } from "@octokit/core";

const querySchema = z.object({
  text: z.string(),
});

// Interface for GitHub repository
interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  private: boolean;
  description: string | null;
  language: string | null;
}

export default defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const signal = request.signal;

  try {
    const query = await getValidatedQuery(event, (data) =>
      querySchema.parse(data),
    );

    if (!query.text) {
      return { nodes: [] };
    }

    // Initialize GitHub App inside the handler to avoid initialization timing issues
    const initGitHubApp = () => {
      const appId = process.env.NITRO_APP_ID;
      const privateKey = process.env.NITRO_PRIVATE_KEY?.replace(/\\n/g, "\n");
      const clientId = process.env.NITRO_CLIENT_ID;
      const clientSecret = process.env.NITRO_CLIENT_SECRET;
      const webhookSecret = process.env.NITRO_WEBHOOK_SECRET;

      if (!appId || !privateKey) {
        throw new Error("GitHub App credentials not configured properly");
      }

      return new App({
        appId: appId,
        privateKey: privateKey,
        clientId,
        clientSecret,
        webhookSecret,
        // Set request timeout to handle slow connections better
        request: {
          timeout: 30000 // 30 seconds
        }
      });
    };

    // Create a transform stream for the response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Process in background
    (async () => {
      try {
        console.log(`[SEARCH-STREAM] Searching GitHub App installations for "${query.text}"`);
        const searchText = query.text.toLowerCase();

        // Initialize GitHub App
        const app = initGitHubApp();

        const seenIds = new Set<number>();
        const maxResults = 10;
        let resultsFound = 0;
        let installationsChecked = 0;
        let installationsFailed = 0;

        // Ensure we don't hang indefinitely on GitHub API issues
        const searchTimeout = setTimeout(() => {
          if (resultsFound === 0) {
            console.log("[SEARCH-STREAM] Search timed out after 45 seconds");
            const message = {
              error: true,
              message: "Search timed out. GitHub API may be experiencing issues."
            };
            writer.write(new TextEncoder().encode(JSON.stringify(message) + "\n"))
              .catch(e => console.error("Failed to write timeout message", e));
          }
          writer.close().catch(e => console.error("Failed to close writer on timeout", e));
        }, 45000); // 45 second timeout

        // Iterate through each installation
        try {
          await app.eachInstallation(async ({ octokit, installation }) => {
            if (signal.aborted || resultsFound >= maxResults) return;

            console.log(`[SEARCH-STREAM] Checking installation: ${installation.id} (${installation.account?.login || 'unknown'})`);
            installationsChecked++;

            try {
              // Get repos for this installation with a timeout
              const { data: repos } = await Promise.race([
                octokit.request('GET /installation/repositories', {
                  per_page: 100,
                  headers: {
                    'X-GitHub-Api-Version': '2022-11-28'
                  }
                }),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error("Installation repository request timed out")), 15000)
                )
              ]) as any;

              // Process repositories
              for (const repo of repos.repositories) {
                if (signal.aborted || resultsFound >= maxResults) break;

                const repository = repo as unknown as Repository;
                const repoName = repository.name.toLowerCase();
                const ownerLogin = repository.owner.login.toLowerCase();
                const fullName = `${ownerLogin}/${repoName}`;

                if (repoName.includes(searchText) ||
                  ownerLogin.includes(searchText) ||
                  fullName.includes(searchText)) {

                  // Skip duplicates
                  if (seenIds.has(repository.id)) continue;
                  seenIds.add(repository.id);

                  const node = {
                    id: String(repository.id),
                    name: repository.name,
                    owner: {
                      login: repository.owner.login,
                      avatarUrl: repository.owner.avatar_url,
                    },
                  };

                  console.log(`[SEARCH-STREAM] Match found: ${fullName}`);
                  await writer.write(new TextEncoder().encode(JSON.stringify(node) + "\n"));
                  resultsFound++;
                }
              }
            } catch (error) {
              installationsFailed++;
              console.error(`[SEARCH-STREAM] Error with installation ${installation.id}:`, error);
              // Continue with next installation
            }
          });
        } catch (appError) {
          console.error("[SEARCH-STREAM] Error during installation iteration:", appError);
          // Continue to report any results we did find
        }

        clearTimeout(searchTimeout);

        // If no results found, send a message
        if (resultsFound === 0) {
          const message = {
            error: true,
            message: `No matching repositories found. Checked ${installationsChecked} installations (${installationsFailed} failed).`
          };
          await writer.write(new TextEncoder().encode(JSON.stringify(message) + "\n"));
        }

        console.log(`[SEARCH-STREAM] Search completed for "${query.text}". Found ${resultsFound} results from ${installationsChecked - installationsFailed} successful installations.`);
      } catch (error) {
        console.error("[SEARCH-STREAM] Error during GitHub App search:", error);

        const errorObj = {
          error: true,
          message: error instanceof Error
            ? error.message
            : "Error searching repositories. Make sure your GitHub App is configured correctly."
        };
        await writer.write(new TextEncoder().encode(JSON.stringify(errorObj) + "\n"));
      } finally {
        await writer.close();
      }
    })();

    // Return the readable stream directly
    return readable;
  } catch (error) {
    console.error("Error in repository search:", error);
    return {
      nodes: [],
      error: true,
      message: (error as Error).message,
    };
  }
});
