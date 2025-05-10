import { z } from "zod";

const querySchema = z.object({
  text: z.string(),
});

export default defineEventHandler(async (event) => {
  const r2Binding = useBinding(event);
  const request = toWebRequest(event);
  const signal = request.signal;

  try {
    const query = await getValidatedQuery(event, (data) =>
      querySchema.parse(data),
    );

    if (!query.text) {
      return { nodes: [] };
    }

    const searchText = query.text.toLowerCase();

    // Internal pagination: iterate until uniqueNodes is filled or no more objects
    let cursor: string | undefined;
    const seen = new Set<string>();
    const uniqueNodes = [];
    const maxNodes = 10;
    let keepGoing = true;

    while (uniqueNodes.length < maxNodes && keepGoing && !signal.aborted) {
      const listResult = await r2Binding.list({
        prefix: usePackagesBucket.base,
        limit: 1000,
        cursor,
      });
      const { objects, truncated } = listResult;
      cursor = truncated ? listResult.cursor : undefined;

      for (const obj of objects) {
        const parts = parseKey(obj.key);
        const orgRepo = `${parts.org}/${parts.repo}`.toLowerCase();
        const applies = (
          parts.org.toLowerCase().includes(searchText) ||
          parts.repo.toLowerCase().includes(searchText) ||
          orgRepo.includes(searchText)
        )
        if (!applies) continue;

        const key = `${parts.org}/${parts.repo}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueNodes.push({
            name: parts.repo,
            owner: {
              login: parts.org,
              avatarUrl: `https://github.com/${parts.org}.png`,
            },
          });
          if (uniqueNodes.length >= maxNodes) break;
        }
      }

      if (!truncated || uniqueNodes.length >= maxNodes) {
        keepGoing = false;
      }
    }

    return {
      nodes: uniqueNodes,
    };
  } catch (error) {
    console.error("Error in repository search:", error);
    return {
      nodes: [],
      error: true,
      message: (error as Error).message,
    };
  }
});

function parseKey(key: string) {
  const parts = key.split(":");
  return {
    org: parts[2],
    repo: parts[3]
  };
}
