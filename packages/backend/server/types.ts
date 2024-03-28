export type WorkflowData = {
  owner: string,
  repo: string,
  sha: string,
  ref: string // branch
}

export type Cursor = {
  timestamp: number
  sha: string
}
