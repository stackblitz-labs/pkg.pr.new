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
    console.log('Counts block before JSON parse:', block)
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
        console.log('Serving /api/chart from cache')
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
            console.log(`Requesting logs for run #${run.run_number} (id: ${run.id})`)
            const logsResponse = await octokit.rest.actions.downloadWorkflowRunLogs({
                owner,
                repo,
                run_id: run.id
            })
            console.log(`logsResponse.status for run #${run.run_number}:`, logsResponse.status)
            console.log(`logsResponse.headers for run #${run.run_number}:`, logsResponse.headers)
            if (logsResponse.status === 302) {
                console.log(`302 redirect location for run #${run.run_number}:`, logsResponse.headers['location'] || logsResponse.headers['Location'])
            }
            if (!logsResponse.data) {
                console.log(`No data received for run #${run.run_number} (id: ${run.id})`)
            } else {
                console.log('logsResponse.data instanceof Buffer:', Buffer.isBuffer(logsResponse.data))
                console.log('logsResponse.data constructor:', logsResponse.data?.constructor?.name)
                console.log('typeof logsResponse.data:', typeof logsResponse.data)
                let buffer
                if (Buffer.isBuffer(logsResponse.data)) {
                    buffer = logsResponse.data
                } else if (logsResponse.data instanceof ArrayBuffer) {
                    buffer = Buffer.from(new Uint8Array(logsResponse.data))
                } else {
                    throw new Error('logsResponse.data is not a Buffer or ArrayBuffer')
                }
                console.log(`Buffer size for run #${run.run_number} (id: ${run.id}): ${buffer.length} bytes`)
                const zip = new AdmZip(buffer)
                const entries = zip.getEntries()
                console.log(`Run #${run.run_number} (id: ${run.id}) log files:`, entries.map(e => e.entryName))
                console.log(`Run #${run.run_number} (id: ${run.id}) zip entry count: ${entries.length}`)
                if (entries.length === 0) {
                    console.log(`No log entries found in zip for run #${run.run_number} (id: ${run.id})`)
                }
                let found = false
                for (const entry of entries) {
                    const content = entry.getData().toString('utf8')
                    const extracted = extractCountsBlock(content)
                    if (extracted) {
                        console.log(`Found Counts block in ${entry.entryName} for run #${run.run_number} (id: ${run.id}):`, extracted)
                        stats = extracted
                        found = true
                        break
                    }
                }
                if (!found) {
                    console.log(`No Counts block found in any log file for run #${run.run_number} (id: ${run.id})`)
                }
            }
        } catch (e) {
            if (e?.message && e.message.includes('Server Error')) {
                console.warn(`Logs missing for run #${run.run_number} (id: ${run.id}) - likely due to retention policy. Skipping.`)
            } else {
                console.error(`Failed to fetch, unzip, or parse logs for run #${run.run_number} (id: ${run.id}):`, e)
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

    console.log('Extracted stats:', JSON.stringify(results, null, 2))

    // 5. Return JSON
    cachedData = { runs: results };
    lastFetch = Date.now();
    return cachedData;
}) 