/**
 * Data models for storing GitHub-like data in Cloudflare R2
 */

// Repository model that mimics GitHub repo structure
export interface R2Repository {
  id: string;
  name: string;
  owner: {
    id: string;
    login: string;
    avatar_url: string;
  };
  description: string | null;
  default_branch: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  html_url: string;
  homepage?: string; // Added homepage URL
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  // Add any additional fields you need
  indexed_at: string; // When this repo was last indexed
}

// Commit model that mimics GitHub commit structure
export interface R2Commit {
  repo_id: string; // Reference to the repository
  sha: string;
  node_id: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  html_url: string;
  // Add additional fields as needed
  indexed_at: string; // When this commit was last indexed
}

// Check run model that mimics GitHub check runs
export interface R2CheckRun {
  id: string;
  commit_sha: string; // Reference to the commit
  name: string;
  status: string;
  conclusion: string | null;
  output?: {
    summary: string;
    text: string;
  };
  details_url: string;
  url: string;
  html_url: string;
  // Add additional fields as needed
  indexed_at: string; // When this check run was last indexed
}

// Index metadata
export interface R2IndexMetadata {
  lastFullIndexTime: string;
  status: "idle" | "indexing";
}

// Search index structure for efficient searching
export interface R2SearchIndex {
  repositories: {
    [searchTerm: string]: string[]; // Maps search terms to repository IDs
  };
  commits: {
    [searchTerm: string]: string[]; // Maps search terms to commit SHAs
  };
}
