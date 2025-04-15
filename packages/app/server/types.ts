export interface WorkflowData {
  owner: string
  repo: string
  sha: string
  ref: string
}

export interface PullRequestData {
  full_name: string
  ref: string
}

export interface Cursor {
  timestamp: number
  sha: string
}
