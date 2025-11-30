import { z } from "zod";
import { useOctokitApp } from "../../utils/octokit";
import stringSimilarity from "string-similarity";
import type { RepoNode } from "../../utils/types";

const querySchema = z.object({
  text: z.string(),
});

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, (data) =>
    querySchema.parse(data),
  );

  if (!query.text) {
    return { nodes: [] };
  }

  // Set SSE headers
  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const app = useOctokitApp(event);
  const searchText = query.text.toLowerCase();
  const seen = new Set<number>();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendResult = (repo: Omit<RepoNode, "score">) => {
        if (seen.has(repo.id)) return;
        seen.add(repo.id);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(repo)}\n\n`));
      };

      const sendDone = () => {
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      };

      try {
        for await (const { installation } of app.eachInstallation.iterator()) {
          try {
            const octokit = await app.getInstallationOctokit(installation.id);

            const { data } = await octokit.request(
              "GET /installation/repositories",
              { per_page: 100 },
            );

            for (const repo of data.repositories) {
              if (repo.private) continue;

              const nameScore = stringSimilarity.compareTwoStrings(
                repo.name.toLowerCase(),
                searchText,
              );
              const ownerScore = stringSimilarity.compareTwoStrings(
                repo.owner.login.toLowerCase(),
                searchText,
              );
              const score = Math.max(nameScore, ownerScore);

              // Only send if it's a decent match
              if (
                score > 0.3 ||
                repo.name.toLowerCase().includes(searchText) ||
                repo.owner.login.toLowerCase().includes(searchText)
              ) {
                sendResult({
                  id: repo.id,
                  name: repo.name,
                  owner: {
                    login: repo.owner.login,
                    avatarUrl: repo.owner.avatar_url,
                  },
                  stars: repo.stargazers_count || 0,
                });
              }
            }
          } catch {
            // Skip suspended installations
          }
        }

        sendDone();
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: (err as Error).message })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });

  return stream;
});
