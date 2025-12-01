import { z } from "zod";
import { useOctokitApp } from "../../utils/octokit";
import stringSimilarity from "string-similarity";

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

  const { signal } = toWebRequest(event);

  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const app = useOctokitApp(event);
  const searchText = query.text.toLowerCase();
  const seen = new Set<number>();
  const encoder = new TextEncoder();

  const send = (data: string) => encoder.encode(`data: ${data}\n\n`);

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const { installation } of app.eachInstallation.iterator()) {
          if (signal.aborted) break;

          try {
            const octokit = await app.getInstallationOctokit(installation.id);
            const { data } = await octokit.request(
              "GET /installation/repositories",
              { per_page: 100 },
            );

            for (const repo of data.repositories) {
              if (repo.private || seen.has(repo.id)) continue;

              const name = repo.name.toLowerCase();
              const owner = repo.owner.login.toLowerCase();
              const score = Math.max(
                stringSimilarity.compareTwoStrings(name, searchText),
                stringSimilarity.compareTwoStrings(owner, searchText),
              );

              if (
                score > 0.3 ||
                name.includes(searchText) ||
                owner.includes(searchText)
              ) {
                seen.add(repo.id);
                controller.enqueue(
                  send(
                    JSON.stringify({
                      id: repo.id,
                      name: repo.name,
                      owner: {
                        login: repo.owner.login,
                        avatarUrl: repo.owner.avatar_url,
                      },
                      stars: repo.stargazers_count || 0,
                    }),
                  ),
                );
              }
            }
          } catch {
            // Skip suspended installations
          }
        }

        controller.enqueue(send("[DONE]"));
      } catch (err) {
        controller.enqueue(
          send(JSON.stringify({ error: (err as Error).message })),
        );
      } finally {
        controller.close();
      }
    },
  });
});
