export type WorkflowData = {
  owner: string;
  repo: string;
  sha: string;
  ref: string;
};

export type PullRequestData = {
  full_name: string;
  ref: string;
};

export type Cursor = {
  timestamp: number;
  sha: string;
};
