import { z } from "zod";
import {
  defineEventHandler,
  getValidatedQuery,
  setResponseHeader,
  toWebRequest,
} from "h3";
import { Readable } from "node:stream";

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

    setResponseHeader(event, "Content-Type", "application/json");
    setResponseHeader(event, "Cache-Control", "no-cache");
    setResponseHeader(event, "Connection", "keep-alive");

    const stream = new Readable({
      objectMode: true,
      read() {},
    });

    stream.push(JSON.stringify({ nodes: [], streaming: true }) + "\n");

    processSearchAsync();

    return stream;

    async function processSearchAsync() {
      try {
        let cursor: string | undefined;
        const seen = new Set<string>();
        const maxNodes = 10;
        let count = 0;
        let keepGoing = true;

        // Debug: Log the base prefix we're using to search
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
            stream.push(
              JSON.stringify({ nodes: batchResults, streaming: true }) + "\n",
            );
          }

          if (!truncated || count >= maxNodes) {
            keepGoing = false;
          }
        }

        console.log(`Search complete, found ${count} results`);
        stream.push(
          JSON.stringify({ streaming: false, complete: true }) + "\n",
        );
        stream.push(null);
      } catch (error) {
        console.error("Error processing search:", error);
        stream.push(
          JSON.stringify({ error: true, message: (error as Error).message }) +
            "\n",
        );
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
