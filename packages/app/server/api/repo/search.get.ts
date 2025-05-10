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
      const prefix = `${usePackagesBucket.base}:`;
      const listResult = await r2Binding.list({
        prefix,
        limit: 1000,
        cursor,
      });
      const { objects, truncated } = listResult;
      cursor = truncated ? listResult.cursor : undefined;

      const repoMap = new Map<string, { org: string; repo: string }>();

      for (const obj of objects) {
        const parts = obj.key.split(":");
        // bucket:package:org:repo:sha:packageName
        if (parts.length >= 4) {
          const org = parts[2];
          const repo = parts[3];

          if (org.includes("/") || repo.includes("/")) {
            continue;
          }

          const key = `${org}/${repo}`;
          if (!repoMap.has(key)) {
            repoMap.set(key, { org, repo });
          }
        }
      }

      const filteredRepos = Array.from(repoMap.values()).filter(
        ({ org, repo }) => {
          const orgRepo = `${org}/${repo}`.toLowerCase();
          return (
            org.toLowerCase().includes(searchText) ||
            repo.toLowerCase().includes(searchText) ||
            orgRepo.includes(searchText)
          );
        },
      );

      for (const { org, repo } of filteredRepos) {
        const key = `${org}/${repo}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueNodes.push({
            name: repo,
            owner: {
              login: org,
              avatarUrl: `https://github.com/${org}.png`,
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
    repo: parts[3],
    hash: parts[4],
    suffix: parts[5],
    key,
  };
}
