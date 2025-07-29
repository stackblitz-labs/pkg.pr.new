import { defineEventHandler, H3Event } from "h3";
import { useOctokitInstallation } from "../utils/octokit";
import { unzipSync, strFromU8 } from "fflate";

function extractCountsBlock(content: string): any | null {
  const lines = content.split("\n");
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Counts: {")) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return null;
  // Collect lines until closing }
  const blockLines = [];
  for (let i = startIdx; i < lines.length; i++) {
    blockLines.push(lines[i]);
    if (lines[i].trim().endsWith("}")) break;
  }
  // Join and clean up
  let block = blockLines.join("\n");
  // Remove the leading 'Counts: ' and timestamps
  block = block.replace(/.*Counts: /, "");
  block = block.replace(/^[^\{]*\{/, "{"); // Remove anything before first {
  // Remove timestamps at the start of each line
  block = block.replace(/^[0-9TZ\-:\.]+Z /gm, "");
  // Convert JS object to JSON (add quotes)
  block = block.replace(/([a-zA-Z0-9_]+):/g, '"$1":');
  try {
    return JSON.parse(block);
  } catch (e) {
    return null;
  }
}

let cachedData: any = null;
let lastFetch = 0;
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week in ms

export default defineEventHandler(async (event: H3Event) => {
  try {
    if (cachedData && Date.now() - lastFetch < CACHE_DURATION) {
      return cachedData;
    }
    const owner = "stackblitz-labs";
    const repo = "pkg.pr.new";
    const workflowId = "stats.yml";

    const octokit = await useOctokitInstallation(event, owner, repo);

    const runs = await octokit.paginate(octokit.rest.actions.listWorkflowRuns, {
      owner,
      repo,
      workflow_id: workflowId,
      per_page: 100,
      status: "success",
    });

    // Only process the latest 100 runs for performance
    const latestRuns = runs.slice(0, 100);

    // 4. For each run, download logs, unzip, and extract Counts
    const results = [];
    for (const run of latestRuns) {
      let stats = null;
      try {
        const logsResponse = await octokit.rest.actions.downloadWorkflowRunLogs(
          {
            owner,
            repo,
            run_id: run.id,
          },
        );
        if (!logsResponse.data) {
        } else {
          let zipData;
          if (logsResponse.data instanceof ArrayBuffer) {
            zipData = new Uint8Array(logsResponse.data);
          } else if (logsResponse.data instanceof Uint8Array) {
            zipData = logsResponse.data;
          } else if (
            typeof Buffer !== "undefined" &&
            Buffer.isBuffer(logsResponse.data)
          ) {
            zipData = new Uint8Array(
              logsResponse.data.buffer,
              logsResponse.data.byteOffset,
              logsResponse.data.byteLength,
            );
          } else {
            throw new Error("logsResponse.data is not a supported binary type");
          }
          let files;
          try {
            files = unzipSync(zipData);
          } catch (e) {
            continue;
          }
          let found = false;
          for (const [, fileData] of Object.entries(files)) {
            let content;
            try {
              content = strFromU8(fileData);
            } catch (e) {
              continue;
            }
            if (typeof content !== "string" || !content) {
              continue;
            }
            let extracted;
            try {
              extracted = extractCountsBlock(content);
            } catch (e) {
              continue;
            }
            if (extracted) {
              stats = extracted;
              found = true;
              break;
            }
          }
        }
      } catch (e) {
        if (
          e instanceof Error &&
          e.message &&
          e.message.includes("Server Error")
        ) {
          // skip
        }
      }
      if (stats) {
        results.push({
          run_number: run.run_number,
          created_at: run.created_at,
          stats,
        });
      }
    }
    // 5. Return JSON
    cachedData = { runs: results };
    lastFetch = Date.now();
    return cachedData;
  } catch (err) {
    return { error: true, message: String(err), stack: (err as any)?.stack };
  }
});
