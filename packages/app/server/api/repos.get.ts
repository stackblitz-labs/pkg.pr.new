import { useR2GitHubService } from "../utils/r2-service";

export default defineEventHandler(async (event) => {
  try {
    console.log("[R2API] List all repositories endpoint called");

    // Use R2 service
    const r2Service = useR2GitHubService(event);

    // First, dump all storage keys for debugging
    console.log("[R2API] Dumping R2 storage structure for debugging");
    const storageKeys = await r2Service.dumpStorageKeys();
    console.log(`[R2API] R2 storage has ${storageKeys.total_keys} total keys`);

    // Get sample values to understand the data structure
    const sampleValues = await r2Service.getSampleValues();
    console.log(
      `[R2API] Got ${sampleValues.sample_count || 0} sample values from R2`,
    );

    // Try to get all repositories directly from storage keys
    console.log("[R2API] Attempting to scan all keys for repositories");
    // Use the getStorageAccess method to access storage safely
    const storageAccess = r2Service.getStorageAccess();
    const allKeys = await storageAccess.getKeys();
    const repoKeys = allKeys.filter((key) => key.startsWith("repo:"));
    console.log(`[R2API] Found ${repoKeys.length} repository keys`);

    // Directly load repositories from keys
    const loadedRepositories = [];
    for (const key of repoKeys) {
      try {
        const data = await storageAccess.getItem(key);
        if (data) {
          const repo = typeof data === "string" ? JSON.parse(data) : data;
          console.log(
            `[R2API] Successfully loaded repository from key: ${key}`,
          );
          loadedRepositories.push(repo);
        }
      } catch (error) {
        console.error(
          `[R2API] Error loading repository from key ${key}:`,
          error,
        );
      }
    }

    console.log(
      `[R2API] Directly loaded ${loadedRepositories.length} repositories from keys`,
    );

    // Also try the original method
    const repositories = await r2Service.listAllRepositories();
    console.log(
      `[R2API] Found ${repositories.length} repositories using listAllRepositories()`,
    );

    // Determine which set of repositories to use
    const effectiveRepositories =
      loadedRepositories.length > 0 ? loadedRepositories : repositories;
    console.log(
      `[R2API] Using ${effectiveRepositories.length} repositories for response`,
    );

    // Get latest commit for each repository
    const reposWithLatestCommit = await Promise.all(
      effectiveRepositories.map(async (repo) => {
        try {
          const commits = await r2Service.listCommits(
            repo.owner.login,
            repo.name,
            1,
            1,
          );
          const latestCommit = commits.length > 0 ? commits[0] : null;

          return {
            id: repo.id,
            name: repo.name,
            owner: {
              login: repo.owner.login,
              avatar_url: repo.owner.avatar_url,
            },
            full_name: `${repo.owner.login}/${repo.name}`,
            description: repo.description,
            default_branch: repo.default_branch,
            html_url: repo.html_url,
            stargazers_count: repo.stargazers_count,
            watchers_count: repo.watchers_count,
            forks_count: repo.forks_count,
            indexed_at: repo.indexed_at,
            latest_commit: latestCommit
              ? {
                  sha: latestCommit.sha,
                  message: latestCommit.commit.message,
                  date: latestCommit.commit.author.date,
                }
              : null,
          };
        } catch (error) {
          console.error(
            `[R2API] Error fetching commits for ${repo.owner.login}/${repo.name}:`,
            error,
          );
          return {
            id: repo.id,
            name: repo.name,
            owner: {
              login: repo.owner.login,
              avatar_url: repo.owner.avatar_url,
            },
            full_name: `${repo.owner.login}/${repo.name}`,
            description: repo.description,
            default_branch: repo.default_branch,
            html_url: repo.html_url,
            stargazers_count: repo.stargazers_count,
            watchers_count: repo.watchers_count,
            forks_count: repo.forks_count,
            indexed_at: repo.indexed_at,
            latest_commit: null,
          };
        }
      }),
    );

    // Add debug info for client
    const clientDebugInfo = {
      timestamp: new Date().toISOString(),
      storage_info: r2Service.getStorageInfo(),
      repository_count: effectiveRepositories.length,
      repository_names: effectiveRepositories.map(
        (repo) => `${repo.owner.login}/${repo.name}`,
      ),
      storage_structure: {
        total_keys: storageKeys.total_keys,
        key_counts: storageKeys.key_counts,
        key_samples: storageKeys.key_samples,
      },
      sample_values: sampleValues,
    };

    return {
      repositories: reposWithLatestCommit,
      debug_info: clientDebugInfo,
    };
  } catch (error) {
    console.error("[R2API] Error listing repositories:", error);

    // Return error with debug info for client
    return {
      repositories: [],
      error: true,
      message: `Failed to load repositories: ${error instanceof Error ? error.message : "Unknown error"}`,
      debug_info: {
        timestamp: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Unknown error",
        error_name: error instanceof Error ? error.name : "Unknown",
        r2_connection: "Failed",
      },
    };
  }
});
