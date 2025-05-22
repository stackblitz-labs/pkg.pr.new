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

    // Always use streaming now
    console.log(`[SEARCH-STREAM] Starting search for "${query.text}"`);

    return streamResponse(event, async (stream) => {
      const searchText = query.text.toLowerCase();
      let cursor: string | undefined;
      const seen = new Set<string>();
      const maxNodes = 10;
      let sentCount = 0;
      let keepGoing = true;
      let batchCount = 0;
      let totalScanned = 0;

      console.log(
        `[SEARCH-STREAM] Streaming response initiated for "${query.text}"`,
      );
      stream.write(JSON.stringify({ type: "start" }) + "\n");

      while (sentCount < maxNodes && keepGoing && !signal.aborted) {
        batchCount++;
        const listResult = await r2Binding.list({
          prefix: usePackagesBucket.base,
          limit: 1000,
          cursor,
        });
        const { objects, truncated } = listResult;
        totalScanned += objects.length;
        cursor = truncated ? listResult.cursor : undefined;

        console.log(
          `[SEARCH-STREAM] Batch ${batchCount}: Scanned ${objects.length} objects, total ${totalScanned}`,
        );

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

            console.log(`[SEARCH-STREAM] Match found: ${key}`);
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

      console.log(
        `[SEARCH-STREAM] Search completed for "${query.text}". Found ${sentCount} results after scanning ${totalScanned} items in ${batchCount} batches.`,
      );
      stream.write(
        JSON.stringify({
          type: "end",
          total: sentCount,
          stats: {
            totalScanned,
            batchCount,
            query: query.text,
          },
        }) + "\n",
      );
      stream.end();
    });
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
