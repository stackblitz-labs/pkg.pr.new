import { z } from "zod";
import { App } from "@octokit/app";

const querySchema = z.object({
  text: z.string(),
});

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1,
        );
      }
    }
  }
  return matrix[a.length][b.length];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
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

    (async () => {
      const app = new App({
        appId: process.env.NITRO_APP_ID as string,
        privateKey: (process.env.NITRO_PRIVATE_KEY || "").replace(/\n/g, "\n"),
        clientId: process.env.NITRO_CLIENT_ID,
        clientSecret: process.env.NITRO_CLIENT_SECRET,
        webhookSecret: process.env.NITRO_WEBHOOK_SECRET,
      });

      const searchText = query.text.toLowerCase();
      const matches: any[] = [];
      const searchTimeout = setTimeout(
        () => writer.close().catch(() => {}),
        15000,
      );

      await app.eachRepository(async ({ repository }) => {
        if (signal.aborted) return;
        if (repository.private) return;
        const idStr = String(repository.id);
        if (seenIds.has(idStr)) return;
        seenIds.add(idStr);

        const repoName = repository.name.toLowerCase();
        const ownerLogin = repository.owner.login.toLowerCase();

        const nameScore = similarity(repoName, searchText);
        const ownerScore = similarity(ownerLogin, searchText);
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
