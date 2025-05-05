import { useR2GitHubService } from "../utils/r2-service";

export default defineEventHandler(async (event) => {
  try {
    console.log("[R2API] List all repositories endpoint called");
    
    // Use R2 service
    const r2Service = useR2GitHubService(event);
    
    // Get all repositories from R2
    const repositories = await r2Service.listAllRepositories();
    
    console.log(`[R2API] Found ${repositories.length} repositories in R2 storage`);
    
    // Get latest commit for each repository
    const reposWithLatestCommit = await Promise.all(
      repositories.map(async (repo) => {
        try {
          const commits = await r2Service.listCommits(repo.owner.login, repo.name, 1, 1);
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
            latest_commit: latestCommit ? {
              sha: latestCommit.sha,
              message: latestCommit.commit.message,
              date: latestCommit.commit.author.date,
            } : null,
          };
        } catch (error) {
          console.error(`[R2API] Error fetching commits for ${repo.owner.login}/${repo.name}:`, error);
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
      })
    );
    
    // Add debug info for client
    const clientDebugInfo = {
      timestamp: new Date().toISOString(),
      storage_info: r2Service.getStorageInfo(),
      repository_count: repositories.length,
      repository_names: repositories.map(repo => `${repo.owner.login}/${repo.name}`),
    };
    
    return { 
      repositories: reposWithLatestCommit,
      debug_info: clientDebugInfo
    };
  } catch (error) {
    console.error("[R2API] Error listing repositories:", error);
    
    // Return error with debug info for client
    return {
      repositories: [],
      error: true,
      message: `Failed to load repositories: ${error instanceof Error ? error.message : 'Unknown error'}`,
      debug_info: {
        timestamp: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_name: error instanceof Error ? error.name : 'Unknown',
        r2_connection: 'Failed'
      }
    };
  }
});
