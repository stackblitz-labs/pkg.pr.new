export type WorkflowData = {
  owner: string;
  repo: string;
  sha: string;
  ref: string;
};

export type Cursor = {
  timestamp: number;
  sha: string;
};
