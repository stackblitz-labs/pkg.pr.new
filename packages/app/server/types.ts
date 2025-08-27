export interface WorkflowData {
  owner: string;
  repo: string;
  sha: string;
  ref: string;
}

export interface PullRequestData {
  full_name: string;
  ref: string;
}

export interface Cursor {
  timestamp: number;
  sha: string;
}

export interface WebhookDebugData {
  webhookAction: string;
  originalHeadBranch: string | null;
  originalHeadRepository: string | null;
  originalRepositoryFullName: string | null;

  isPullRequest: boolean;
  prNumber: number | null;
  prNumberType: string;
  prNumberIsNull: boolean;
  prNumberIsUndefined: boolean;
  isNewPullRequest: boolean;
  isOldPullRequest: boolean;

  prKey: string;
  oldPrDataHash: string;
  lookupKey: string;
  bucketHasNewKey: boolean;
  bucketHasOldKey: boolean;
}
