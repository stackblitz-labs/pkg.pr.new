import { H3Event } from "h3";
import {
  R2Repository,
  R2Commit,
  R2CheckRun,
  R2IndexMetadata,
  R2SearchIndex,
} from "./r2-models";
import { useOctokitInstallation, useGithubREST } from "./octokit";
import { useStorage } from "#imports";

// Prefix keys for different data types
const REPO_PREFIX = "repo:";
const COMMIT_PREFIX = "commit:";
const CHECK_RUN_PREFIX = "check-run:";
const INDEX_METADATA_KEY = "index-metadata";
const SEARCH_INDEX_KEY = "search-index";

/**
 * R2 Storage Service for GitHub data
 * This service handles storing and retrieving GitHub-like data from R2
 */
export class R2GitHubService {
  private storage: ReturnType<typeof useStorage>;
  private event?: H3Event;
  private debugEnabled: boolean = true;

  constructor(
    storage: ReturnType<typeof useStorage>,
    debugEnabled = true,
    event?: H3Event,
  ) {
    this.storage = storage;
    this.debugEnabled = debugEnabled;
    this.event = event;
    this.log("Initialized R2GitHubService");
  }

  private log(message: string, isError: boolean = false): void {
    if (isError) {
      console.error(`[R2Service] ${message}`);
    } else if (this.debugEnabled) {
      console.log(`[R2Service] ${message}`);
    }
  }

  // Repository methods
  async getRepository(
    owner: string,
    repo: string,
  ): Promise<R2Repository | null> {
    const key = `${REPO_PREFIX}${owner}/${repo}`;
    this.log(
      `Attempting to fetch repository ${owner}/${repo} from R2 storage with key "${key}"`,
    );

    try {
      const data = await this.storage.getItem(key);
      if (data) {
        this.log(`Found repository ${owner}/${repo} in R2 storage`);
        const parsedData = JSON.parse(data as string) as R2Repository;
        this.log(
          `Repository details: name=${parsedData.name}, default_branch=${parsedData.default_branch}, indexed_at=${parsedData.indexed_at}`,
        );
        return parsedData;
      } else {
        this.log(
          `Repository ${owner}/${repo} not found in R2 storage (key: ${key})`,
        );
        return null;
      }
    } catch (error) {
      this.log(
        `Error fetching repository ${owner}/${repo} from R2 storage: ${error}`,
        true,
      );
      return null;
    }
  }

  async storeRepository(repository: R2Repository): Promise<void> {
    const key = `${REPO_PREFIX}${repository.owner.login}/${repository.name}`;
    this.log(
      `Storing repository ${repository.owner.login}/${repository.name} in R2 storage with key: ${key}`,
    );
    await this.storage.setItem(key, JSON.stringify(repository));

    // Update search index
    await this.updateSearchIndex(
      "repositories",
      [repository.name, repository.owner.login, repository.description || ""],
      repository.id,
    );
  }

  async searchRepositories(query: string, limit = 10): Promise<R2Repository[]> {
    this.log(`Searching for repositories matching query: "${query}"`);

    try {
      // Get the search index
      const indexData = await this.storage.getItem("search-index");
      if (!indexData) {
        this.log("Search index not found in R2 storage", true);
        return [];
      }

      const searchIndex = JSON.parse(indexData as string) as R2SearchIndex;
      this.log(
        `Retrieved search index with ${Object.keys(searchIndex.repositories).length} terms`,
      );

      // Normalize the query
      const terms = query
        .toLowerCase()
        .split(/\W+/)
        .filter((term) => term.length > 1);

      this.log(`Searching for terms: ${terms.join(", ")}`);

      // Find repository IDs matching any of the terms
      const repoIds = new Set<string>();
      for (const term of terms) {
        const matchingTerms = Object.keys(searchIndex.repositories).filter(
          (indexTerm) => indexTerm.includes(term),
        );

        this.log(
          `Term "${term}" matched ${matchingTerms.length} indexed terms`,
        );

        for (const matchingTerm of matchingTerms) {
          const ids = searchIndex.repositories[matchingTerm] || [];
          for (const id of ids) {
            repoIds.add(id);
          }
        }
      }

      this.log(
        `Found ${repoIds.size} unique repositories matching the search terms`,
      );

      // Get full repository details
      const keys = await this.storage.getKeys();
      const repos: R2Repository[] = [];

      for (const key of keys) {
        if (key.startsWith("repo:")) {
          const data = await this.storage.getItem(key);
          if (data) {
            const repo = JSON.parse(data as string) as R2Repository;
            if (repoIds.has(repo.id)) {
              this.log(
                `Adding repository to search results: ${repo.owner.login}/${repo.name}`,
              );
              repos.push(repo);

              if (repos.length >= limit) {
                this.log(`Reached result limit of ${limit}, stopping search`);
                break;
              }
            }
          }
        }
      }

      this.log(
        `Returning ${repos.length} repositories matching search query "${query}"`,
      );
      return repos;
    } catch (error) {
      this.log(`Error searching repositories: ${error}`, true);
      return [];
    }
  }

  async listAllRepositories(): Promise<R2Repository[]> {
    const keys = await this.storage.getKeys();
    const repoKeys = keys.filter((key) => key.startsWith(REPO_PREFIX));

    const repositories: R2Repository[] = [];
    for (const key of repoKeys) {
      const repoData = await this.storage.getItem(key);
      if (repoData) {
        const repo = JSON.parse(repoData as string) as R2Repository;
        repositories.push(repo);
      }
    }

    return repositories;
  }

  // Commit methods
  async getCommit(
    owner: string,
    repo: string,
    sha: string,
  ): Promise<R2Commit | null> {
    const key = `${COMMIT_PREFIX}${owner}/${repo}/${sha}`;
    this.log(`Fetching commit ${sha} from R2 storage with key: ${key}`);
    const data = await this.storage.getItem(key);
    if (data) {
      this.log(`Found commit ${sha} in R2 storage`);
      return JSON.parse(data as string) as R2Commit;
    } else {
      this.log(`Commit ${sha} not found in R2 storage`);
      return null;
    }
  }

  async storeCommit(
    owner: string,
    repo: string,
    commit: R2Commit,
  ): Promise<void> {
    const key = `${COMMIT_PREFIX}${owner}/${repo}/${commit.sha}`;
    this.log(`Storing commit ${commit.sha} in R2 storage with key: ${key}`);
    await this.storage.setItem(key, JSON.stringify(commit));

    // Update search index
    await this.updateSearchIndex(
      "commits",
      [
        commit.sha,
        commit.commit.message,
        commit.commit.author.name,
        commit.commit.author.email,
      ],
      commit.sha,
    );
  }

  async listCommits(
    owner: string,
    repo: string,
    page = 1,
    per_page = 10,
  ): Promise<R2Commit[]> {
    this.log(
      `Listing commits for repository ${owner}/${repo} (page=${page}, per_page=${per_page}) from R2 storage`,
    );

    try {
      // Get repository first to verify it exists
      const repository = await this.getRepository(owner, repo);
      if (!repository) {
        this.log(
          `Cannot list commits: Repository ${owner}/${repo} not found in R2 storage`,
          true,
        );
        return [];
      }

      // List all keys matching the commit pattern for this repo
      const pattern = `commit:${owner}/${repo}/`;
      this.log(`Looking for commit keys matching pattern: ${pattern}`);

      const keys = await this.storage.getKeys();
      const commitKeys = keys.filter((key) => key.startsWith(pattern));

      this.log(
        `Found ${commitKeys.length} total commits for ${owner}/${repo} in R2 storage`,
      );

      // Get commits and sort by date (most recent first)
      const commits: R2Commit[] = [];
      for (const key of commitKeys) {
        const data = await this.storage.getItem(key);
        if (data) {
          commits.push(JSON.parse(data as string) as R2Commit);
        }
      }

      commits.sort((a, b) => {
        const dateA = new Date(a.commit.author.date).getTime();
        const dateB = new Date(b.commit.author.date).getTime();
        return dateB - dateA;
      });

      // Paginate results
      const start = (page - 1) * per_page;
      const end = start + per_page;
      const paginatedCommits = commits.slice(start, end);

      this.log(
        `Returning ${paginatedCommits.length} commits for page ${page} (offset ${start})`,
      );
      if (paginatedCommits.length > 0) {
        this.log(
          `First commit in response: ${paginatedCommits[0].sha.substring(0, 7)} - "${paginatedCommits[0].commit.message.split("\n")[0]}"`,
        );
        this.log(
          `Last commit in response: ${paginatedCommits[paginatedCommits.length - 1].sha.substring(0, 7)} - "${paginatedCommits[paginatedCommits.length - 1].commit.message.split("\n")[0]}"`,
        );
      }

      return paginatedCommits;
    } catch (error) {
      this.log(`Error listing commits for ${owner}/${repo}: ${error}`, true);
      return [];
    }
  }

  // Check Run methods
  async getCheckRuns(
    owner: string,
    repo: string,
    commitSha: string,
  ): Promise<R2CheckRun[]> {
    const keys = await this.storage.getKeys();
    const checkRunPrefix = `${CHECK_RUN_PREFIX}${owner}/${repo}/${commitSha}/`;
    const checkRunKeys = keys.filter((key) => key.startsWith(checkRunPrefix));

    const checkRuns: R2CheckRun[] = [];
    for (const key of checkRunKeys) {
      const checkRunData = await this.storage.getItem(key);
      if (checkRunData) {
        const checkRun = JSON.parse(checkRunData as string) as R2CheckRun;
        checkRuns.push(checkRun);
      }
    }

    return checkRuns;
  }

  async storeCheckRun(
    owner: string,
    repo: string,
    commitSha: string,
    checkRun: R2CheckRun,
  ): Promise<void> {
    const key = `${CHECK_RUN_PREFIX}${owner}/${repo}/${commitSha}/${checkRun.id}`;
    this.log(`Storing check run ${checkRun.id} in R2 storage with key: ${key}`);
    await this.storage.setItem(key, JSON.stringify(checkRun));
  }

  // Search index methods
  private async getSearchIndex(): Promise<R2SearchIndex> {
    const indexData = await this.storage.getItem(SEARCH_INDEX_KEY);
    if (!indexData) {
      return {
        repositories: {},
        commits: {},
      };
    }
    return JSON.parse(indexData as string) as R2SearchIndex;
  }

  private async updateSearchIndex(
    type: "repositories" | "commits",
    searchableTerms: string[],
    id: string,
  ): Promise<void> {
    const index = await this.getSearchIndex();

    // Extract keywords from searchable terms
    const keywords = this.extractKeywords(searchableTerms);

    // Add or update index entries
    for (const keyword of keywords) {
      if (!index[type][keyword]) {
        index[type][keyword] = [];
      }

      if (!index[type][keyword].includes(id)) {
        index[type][keyword].push(id);
      }
    }

    await this.storage.setItem(SEARCH_INDEX_KEY, JSON.stringify(index));
  }

  private extractKeywords(terms: string[]): string[] {
    // Join all terms, split by non-alphanumeric characters, convert to lowercase
    const allTerms = terms.join(" ").toLowerCase();
    const keywords = allTerms.split(/[^a-z0-9]+/).filter(Boolean);

    // Remove common words and ensure minimum length
    const stopWords = [
      "the",
      "and",
      "or",
      "a",
      "an",
      "in",
      "on",
      "at",
      "to",
      "for",
      "with",
      "by",
    ];
    return keywords.filter(
      (word) => word.length > 2 && !stopWords.includes(word),
    );
  }

  private findMatchingIds(
    indexSection: Record<string, string[]>,
    searchTerms: string[],
  ): string[] {
    if (searchTerms.length === 0) {
      return [];
    }

    // Find all IDs that match each search term
    const matchesByTerm: Set<string>[] = [];

    for (const term of searchTerms) {
      const matchingIds = new Set<string>();

      // Look for any keyword that contains this term
      for (const [keyword, ids] of Object.entries(indexSection)) {
        if (keyword.includes(term)) {
          ids.forEach((id) => matchingIds.add(id));
        }
      }

      matchesByTerm.push(matchingIds);
    }

    // Find intersection of all matching IDs (IDs that match all search terms)
    if (matchesByTerm.length === 0) {
      return [];
    }

    // Start with all IDs from the first term
    const result = new Set<string>(matchesByTerm[0]);

    // Filter to IDs that are in all other term matches
    for (let i = 1; i < matchesByTerm.length; i++) {
      const currentMatches = matchesByTerm[i];
      for (const id of result) {
        if (!currentMatches.has(id)) {
          result.delete(id);
        }
      }
    }

    return Array.from(result);
  }

  // Utility methods

  // Get information about the storage for debugging
  getStorageInfo(): object {
    try {
      // Return a simple diagnostic representation without accessing potentially non-existent properties
      return {
        hasKeys: typeof this.storage.getKeys === "function",
        hasGetItem: typeof this.storage.getItem === "function",
        hasSetItem: typeof this.storage.setItem === "function",
        storageType: this.storage.constructor?.name || "Unknown",
        debugEnabled: this.debugEnabled,
      };
    } catch (error) {
      this.log(`Error getting storage info: ${error}`, true);
      return { error: "Could not retrieve storage information" };
    }
  }

  // Index methods - fetching data from GitHub and storing in R2
  async indexRepository(owner: string, repo: string): Promise<void> {
    try {
      // Get GitHub data using Octokit
      const octokit = useGithubREST(this.event);

      // Fetch repository data
      const { data: repoData } = await octokit.request(
        "GET /repos/{owner}/{repo}",
        {
          owner,
          repo,
        },
      );

      // Convert to R2Repository format
      const r2Repo: R2Repository = {
        id: repoData.id.toString(),
        name: repoData.name,
        owner: {
          id: repoData.owner.id.toString(),
          login: repoData.owner.login,
          avatar_url: repoData.owner.avatar_url,
        },
        description: repoData.description,
        default_branch: repoData.default_branch,
        created_at: repoData.created_at,
        updated_at: repoData.updated_at,
        pushed_at: repoData.pushed_at,
        html_url: repoData.html_url,
        stargazers_count: repoData.stargazers_count,
        watchers_count: repoData.watchers_count,
        forks_count: repoData.forks_count,
        open_issues_count: repoData.open_issues_count,
        indexed_at: new Date().toISOString(),
      };

      // Store repository
      await this.storeRepository(r2Repo);

      // Index commits (latest 100)
      await this.indexCommits(owner, repo);

      console.log(`Indexed repository ${owner}/${repo}`);
    } catch (error) {
      console.error(`Error indexing repository ${owner}/${repo}:`, error);
      throw error;
    }
  }

  async indexCommits(
    owner: string,
    repo: string,
    maxCommits = 100,
  ): Promise<void> {
    try {
      const octokit = useGithubREST(this.event);

      // Get repository to find default branch
      const repository = await this.getRepository(owner, repo);
      if (!repository) {
        throw new Error(`Repository ${owner}/${repo} not found`);
      }

      // Fetch commits
      const { data: commits } = await octokit.request(
        "GET /repos/{owner}/{repo}/commits",
        {
          owner,
          repo,
          sha: repository.default_branch,
          per_page: maxCommits,
        },
      );

      // Store each commit
      for (const commit of commits) {
        const r2Commit: R2Commit = {
          repo_id: repository.id,
          sha: commit.sha,
          node_id: commit.node_id || "",
          commit: {
            message: commit.commit.message,
            author: {
              name: commit.commit.author?.name || "",
              email: commit.commit.author?.email || "",
              date: commit.commit.author?.date || new Date().toISOString(),
            },
          },
          html_url: commit.html_url,
          indexed_at: new Date().toISOString(),
        };

        await this.storeCommit(owner, repo, r2Commit);

        // Index check runs for this commit
        await this.indexCheckRuns(owner, repo, commit.sha);
      }

      console.log(`Indexed ${commits.length} commits for ${owner}/${repo}`);
    } catch (error) {
      console.error(`Error indexing commits for ${owner}/${repo}:`, error);
      throw error;
    }
  }

  async indexCheckRuns(
    owner: string,
    repo: string,
    commitSha: string,
  ): Promise<void> {
    try {
      const octokit = useGithubREST(this.event);

      // Fetch check runs
      const { data: checkRunsData } = await octokit.request(
        "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
        {
          owner,
          repo,
          ref: commitSha,
        },
      );

      // Store each check run
      for (const checkRun of checkRunsData.check_runs) {
        const r2CheckRun: R2CheckRun = {
          id: checkRun.id.toString(),
          commit_sha: commitSha,
          name: checkRun.name,
          status: checkRun.status,
          conclusion: checkRun.conclusion,
          output: checkRun.output
            ? {
                summary: checkRun.output.summary || "",
                text: checkRun.output.text || "",
              }
            : undefined,
          details_url: checkRun.details_url || "",
          url: checkRun.url || "",
          html_url: checkRun.html_url || "",
          indexed_at: new Date().toISOString(),
        };

        await this.storeCheckRun(owner, repo, commitSha, r2CheckRun);
      }

      console.log(
        `Indexed ${checkRunsData.check_runs.length} check runs for commit ${commitSha}`,
      );
    } catch (error) {
      console.error(
        `Error indexing check runs for commit ${commitSha}:`,
        error,
      );
      // Don't throw the error, just log it - check runs might not exist for all commits
    }
  }
}

export function useR2GitHubService(event: H3Event): R2GitHubService {
  if (!event) {
    throw new Error("H3Event is required for R2GitHubService");
  }
  console.log("[R2Service] Creating new R2GitHubService instance");
  return new R2GitHubService(useStorage("r2"), true, event);
}
