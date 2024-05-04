export type WorkflowData = {
  owner: string;
  repo: string;
  sha: string;
  isPullRequest?: true;
  ref: string;
};

export type Cursor = {
  timestamp: number;
  sha: string;
};
