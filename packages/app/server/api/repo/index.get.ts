import { useR2GitHubService } from "../../../server/utils/r2-service";
import { z } from "zod";

const querySchema = z.object({
  owner: z.string(),
  repo: z.string(),
});

export default defineEventHandler(async (event) => {
  try {
    console.log("[R2API] Repository index endpoint called");
    
    const query = await getValidatedQuery(event, (data) => querySchema.parse(data));
    console.log(`[R2API] Fetching repository data for ${query.owner}/${query.repo}`);
    
    // Use R2 service exclusively
    const r2Service = useR2GitHubService(event);
    
    // Log storage info for debugging
    console.log(`[R2API] R2 storage configuration: ${JSON.stringify(r2Service.getStorageInfo())}`);
    
    // Get repository from R2
    const repository = await r2Service.getRepository(query.owner, query.repo);
    
    if (!repository) {
      console.log(`[R2API] Repository ${query.owner}/${query.repo} not found in R2 storage`);
      throw new Error(`Repository ${query.owner}/${query.repo} not found in R2 storage`);
    }
    
    console.log(`[R2API] Successfully retrieved repository from R2: ${query.owner}/${query.repo}`);
    console.log(`[R2API] Repository details: id=${repository.id}, default_branch=${repository.default_branch}, indexed_at=${repository.indexed_at}`);
    
    return {
      id: repository.id,
      name: repository.name,
      full_name: `${repository.owner.login}/${repository.name}`,
      owner: {
        id: repository.owner.id,
        login: repository.owner.login,
        avatar_url: repository.owner.avatar_url,
      },
      default_branch: repository.default_branch,
      description: repository.description,
      html_url: repository.html_url,
      homepage: repository.homepage || null,
      watchers_count: repository.watchers_count,
      stargazers_count: repository.stargazers_count,
      forks_count: repository.forks_count,
      open_issues_count: repository.open_issues_count,
      r2_source: true, // Flag to indicate source of data
      indexed_at: repository.indexed_at || null,
    };
  } catch (error) {
    console.error("[R2API] Error in repository index endpoint:", error);
    
    throw createError({
      statusCode: 404,
      statusMessage: `Repository not found or could not be accessed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});
