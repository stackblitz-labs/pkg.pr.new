import { R2Bucket } from "@cloudflare/workers-types"

export type WorkflowData = {
  orgOrAuthor: string,
  repo: string,
  sha: string,
  ref: string // branch
}

export type Cursor = {
  timestamp: number
  sha: string
}
