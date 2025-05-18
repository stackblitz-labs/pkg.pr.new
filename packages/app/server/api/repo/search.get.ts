import { z } from "zod";
import {
  defineEventHandler,
  getValidatedQuery,
  setResponseHeader,
  toWebRequest,
} from "h3";

import { useBinding } from "../../../server/utils/bucket";
import { usePackagesBucket } from "../../../server/utils/bucket";

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

    // Set up response headers for streaming
    setResponseHeader(event, "Content-Type", "application/json");
    setResponseHeader(event, "Cache-Control", "no-cache");
    setResponseHeader(event, "Connection", "keep-alive");
    setResponseHeader(event, "Transfer-Encoding", "chunked");

    // Get direct access to the response object
    const res = event.node.res;

    // Write initial response to start the stream
    res.write(JSON.stringify({ nodes: [], streaming: true }) + "\n");

    // Process search in the background
    processSearch().catch((error) => {
      console.error("Unhandled search error:", error);
    });

    // Return nothing to keep the connection open
    return;

    async function processSearch() {
      try {
        let cursor: string | undefined;
        const seen = new Set<string>();
        const maxNodes = 10;
        let count = 0;
        let keepGoing = true;

        console.log(`Searching with base prefix: ${usePackagesBucket.base}`);

        while (count < maxNodes && keepGoing && !signal.aborted) {
          const prefix = usePackagesBucket.base;

          console.log(
            `Fetching batch with prefix: ${prefix}, cursor: ${cursor || "initial"}`,
          );

          const listResult = await r2Binding.list({
            prefix: prefix,
            limit: 1000,
            cursor,
          });

          console.log(
            `Fetched ${listResult.objects.length} objects, truncated: ${listResult.truncated}`,
          );

          const { objects, truncated } = listResult;
          cursor = truncated ? listResult.cursor : undefined;

          const batchResults = [];

          for (const obj of objects) {
            console.log(`Examining key: ${obj.key}`);

            try {
              const parts = parseKey(obj.key);

              if (!parts.org || !parts.repo) {
                console.log(`Skipping malformed key: ${obj.key}`);
                continue;
              }

              const orgRepo = `${parts.org}/${parts.repo}`.toLowerCase();

              console.log(`Matching ${orgRepo} against search: ${searchText}`);

              const applies =
                parts.org.toLowerCase().includes(searchText) ||
                parts.repo.toLowerCase().includes(searchText) ||
                orgRepo.includes(searchText);

              if (!applies) continue;

              const key = `${parts.org}/${parts.repo}`;
              if (!seen.has(key)) {
                seen.add(key);
                const node = {
                  name: parts.repo,
                  owner: {
                    login: parts.org,
                    avatarUrl: `https://github.com/${parts.org}.png`,
                  },
                };
                batchResults.push(node);
                count++;
                console.log(`Found match: ${key}`);
                if (count >= maxNodes) break;
              }
            } catch (err) {
              console.error(`Error parsing key ${obj.key}:`, err);
              continue;
            }
          }

          if (batchResults.length > 0) {
            console.log(`Streaming batch of ${batchResults.length} results`);
            // Directly write to the response
            res.write(
              JSON.stringify({ nodes: batchResults, streaming: true }) + "\n",
            );
          }

          if (!truncated || count >= maxNodes) {
            keepGoing = false;
          }
        }

        console.log(`Search complete, found ${count} results`);
        // Final message to indicate completion
        res.write(JSON.stringify({ streaming: false, complete: true }) + "\n");
        res.end();
      } catch (error) {
        console.error("Error processing search:", error);
        res.write(
          JSON.stringify({
            error: true,
            message: (error as Error).message,
          }) + "\n",
        );
        res.end();
      }
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
  try {
    const parts = key.split(":");
    if (parts.length < 4) {
      console.warn(`Key format unexpected: ${key}, parts: ${parts.length}`);
      return { org: "", repo: "" };
    }
    return {
      org: parts[2] || "",
      repo: parts[3] || "",
    };
  } catch (err) {
    console.error(`Failed to parse key: ${key}`, err);
    return { org: "", repo: "" };
  }
}
