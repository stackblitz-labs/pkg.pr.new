export type WorkflowData = {
  owner: string,
  repo: string,
  sha: string,
  ref: string // branch
  isPullRequest?: true
}

export type Cursor = {
  timestamp: number
  sha: string
}
