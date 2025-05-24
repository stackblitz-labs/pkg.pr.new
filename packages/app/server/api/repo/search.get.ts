import { z } from "zod";
import { useOctokitApp } from "../../utils/octokit";

const querySchema = z.object({
  text: z.string(),
});

function repoRelevanceScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const setA = new Set(a.toLowerCase());
  const setB = new Set(b.toLowerCase());
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  return intersection.size / Math.max(setA.size, setB.size);
}

export default defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const signal = request.signal;

  try {
    const query = await getValidatedQuery(event, (data) =>
      querySchema.parse(data),
    );
    if (!query.text) return { nodes: [] };

    const seenIds = new Set<string>();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    setResponseHeader(event, "Transfer-Encoding", "chunked");

    (async () => {
      const app = useOctokitApp(event, { ignoreBaseUrl: true });

      const searchText = query.text.toLowerCase();
      const matches: any[] = [];
      const searchTimeout = setTimeout(
        () => writer.close().catch(() => {}),
        15000,
      );

      // Measure repo iteration time
      const start = Date.now();
      let repoCount = 0;

      await app.eachRepository(async ({ repository }) => {
        if (signal.aborted) return;
        if (repository.private) return;
        const idStr = String(repository.id);
        if (seenIds.has(idStr)) return;
        seenIds.add(idStr);
        repoCount++;

        const repoName = repository.name.toLowerCase();
        const ownerLogin = repository.owner.login.toLowerCase();

        const nameScore = repoRelevanceScore(repoName, searchText);
        const ownerScore = repoRelevanceScore(ownerLogin, searchText);
        const includes =
          repoName.includes(searchText) || ownerLogin.includes(searchText);

        if (includes || nameScore > 0.5 || ownerScore > 0.5) {
          matches.push({
            id: idStr,
            name: repository.name,
            owner: {
              login: repository.owner.login,
              avatarUrl: repository.owner.avatar_url,
            },
            stars: repository.stargazers_count || 0,
            score: Math.max(nameScore, ownerScore, includes ? 1 : 0),
          });
        }
      });

      const elapsed = Date.now() - start;
      console.log(`[repo-search] Iterated ${repoCount} repos in ${elapsed}ms`);

      // Send meta info to client
      await writer.write(
        new TextEncoder().encode(
          JSON.stringify({
            meta: true,
            repoCount,
            elapsed,
          }) + "\n",
        ),
      );

      clearTimeout(searchTimeout);
      matches.sort((a, b) =>
        b.score !== a.score ? b.score - a.score : b.stars - a.stars,
      );

      const top = matches.slice(0, 10);
      for (const node of top) {
        await writer.write(
          new TextEncoder().encode(
            JSON.stringify({
              id: node.id,
              name: node.name,
              owner: node.owner,
              stars: node.stars,
            }) + "\n",
          ),
        );
      }

      if (top.length === 0) {
        await writer.write(
          new TextEncoder().encode(
            JSON.stringify({
              error: true,
              message: "No matching repositories found.",
            }) + "\n",
          ),
        );
      }

      await writer.close();
    })();

    return readable;
  } catch (error) {
    return { nodes: [], error: true, message: (error as Error).message };
  }
});
