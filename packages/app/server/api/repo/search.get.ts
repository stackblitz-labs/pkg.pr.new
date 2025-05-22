import { z } from "zod";
import { createError, getQuery, H3Event } from "h3";

const querySchema = z.object({
  text: z.string(),
});

async function streamResponse(
  event: H3Event,
  cb: (stream: {
    write: (data: string) => void;
    end: () => void;
  }) => Promise<void>,
) {
  const res = event.node.res;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const stream = {
    write: (data: string) => {
      res.write(data);
    },
    end: () => {
      res.end();
    },
  };

  await cb(stream);

  return undefined;
}

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

    const wantsStream = getQuery(event).stream === "true";

    if (wantsStream) {
      return streamResponse(event, async (stream) => {
        const searchText = query.text.toLowerCase();
        let cursor: string | undefined;
        const seen = new Set<string>();
        const maxNodes = 10;
        let sentCount = 0;
        let keepGoing = true;

        stream.write(JSON.stringify({ type: "start" }) + "\n");

        while (sentCount < maxNodes && keepGoing && !signal.aborted) {
          const listResult = await r2Binding.list({
            prefix: usePackagesBucket.base,
            limit: 1000,
            cursor,
          });
          const { objects, truncated } = listResult;
          cursor = truncated ? listResult.cursor : undefined;

          for (const obj of objects) {
            if (signal.aborted) break;

            const parts = parseKey(obj.key);
            const orgRepo = `${parts.org}/${parts.repo}`.toLowerCase();
            const applies =
              parts.org.toLowerCase().includes(searchText) ||
              parts.repo.toLowerCase().includes(searchText) ||
              orgRepo.includes(searchText);

            if (!applies) continue;

            const key = `${parts.org}/${parts.repo}`;
            if (!seen.has(key)) {
              seen.add(key);
              const node = {
                id: key,
                name: parts.repo,
                owner: {
                  login: parts.org,
                  avatarUrl: `https://github.com/${parts.org}.png`,
                },
              };

              // Send each result as it's found
              stream.write(JSON.stringify({ type: "result", node }) + "\n");
              sentCount++;

              if (sentCount >= maxNodes) break;
            }
          }

          if (!truncated || sentCount >= maxNodes) {
            keepGoing = false;
          }
        }

        stream.write(JSON.stringify({ type: "end", total: sentCount }) + "\n");
        stream.end();
      });
    } else {
      const searchText = query.text.toLowerCase();
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
          const applies =
            parts.org.toLowerCase().includes(searchText) ||
            parts.repo.toLowerCase().includes(searchText) ||
            orgRepo.includes(searchText);
          if (!applies) continue;

          const key = `${parts.org}/${parts.repo}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueNodes.push({
              id: key,
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
    }
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
  };
}
