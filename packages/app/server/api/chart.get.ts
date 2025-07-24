import { defineEventHandler, H3Event } from 'h3'
import { useOctokitInstallation } from '../utils/octokit'
import AdmZip from 'adm-zip'

function extractCountsBlock(content: string): any | null {
    const lines = content.split('\n')
    let startIdx = -1
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Counts: {')) {
            startIdx = i
            break
        }
    }
    if (startIdx === -1) return null
    // Collect lines until closing }
    const blockLines = []
    for (let i = startIdx; i < lines.length; i++) {
        blockLines.push(lines[i])
        if (lines[i].trim().endsWith('}')) break
    }
    // Join and clean up
    let block = blockLines.join('\n')
    // Remove the leading 'Counts: ' and timestamps
    block = block.replace(/.*Counts: /, '')
    block = block.replace(/^[^\{]*\{/, '{') // Remove anything before first {
    // Remove timestamps at the start of each line
    block = block.replace(/^[0-9TZ\-:\.]+Z /gm, '')
    // Convert JS object to JSON (add quotes)
    block = block.replace(/([a-zA-Z0-9_]+):/g, '"$1":')
    try {
        return JSON.parse(block)
    } catch (e) {
        console.error('Failed to parse Counts block as JSON:', block, e)
        return null
    }
}

let cachedData: any = null;
let lastFetch = 0;
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week in ms

export default defineEventHandler(async (event: H3Event) => {
    if (cachedData && Date.now() - lastFetch < CACHE_DURATION) {
        return cachedData;
    }
    const owner = 'stackblitz-labs'
    const repo = 'pkg.pr.new'
    const workflowId = 'stats.yml'

    const octokit = await useOctokitInstallation(event, owner, repo)

    const runs = await octokit.paginate(
        octokit.rest.actions.listWorkflowRuns,
        {
            owner,
            repo,
            workflow_id: workflowId,
            per_page: 100,
            status: 'success',
        }
    )

    // Only process the latest 100 runs for performance
    const latestRuns = runs.slice(0, 100)

    // 4. For each run, download logs, unzip, and extract Counts
    const results = []
    for (const run of latestRuns) {
        let stats = null
        try {
            const logsResponse = await octokit.rest.actions.downloadWorkflowRunLogs({
                owner,
                repo,
                run_id: run.id
            })
            if (logsResponse.status === 302) {
            }
            if (!logsResponse.data) {
            } else {
                let buffer
                if (Buffer.isBuffer(logsResponse.data)) {
                    buffer = logsResponse.data
                } else if (logsResponse.data instanceof ArrayBuffer) {
                    buffer = Buffer.from(new Uint8Array(logsResponse.data))
                } else {
                    throw new Error('logsResponse.data is not a Buffer or ArrayBuffer')
                }
                const zip = new AdmZip(buffer)
                const entries = zip.getEntries()
                if (entries.length === 0) {
                }
                let found = false
                for (const entry of entries) {
                    const content = entry.getData().toString('utf8')
                    const extracted = extractCountsBlock(content)
                    if (extracted) {
                        stats = extracted
                        found = true
                        break
                    }
                }
                if (!found) {
                }
            }
        } catch (e) {
            if (e instanceof Error && e.message && e.message.includes('Server Error')) {
                // skip
            } else {
                // console.error(e)
            }
        }
        if (stats) {
            results.push({
                run_number: run.run_number,
                created_at: run.created_at,
                stats
            })
        }
    }
    // 5. Return JSON
    cachedData = { runs: results };
    lastFetch = Date.now();
    return cachedData;
}) 