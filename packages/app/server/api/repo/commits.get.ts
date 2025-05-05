import { z } from "zod";
import { useR2GitHubService } from "../../../server/utils/r2-service";

const querySchema = z.object({
  owner: z.string(),
  repo: z.string(),
  page: z.coerce.number().default(1),
  per_page: z.coerce.number().default(10),
});

export default defineEventHandler(async (event) => {
  try {
    console.log("[R2API] Commits endpoint called");
    const query = await getValidatedQuery(event, (data) =>
      querySchema.parse(data),
    );

    console.log(`[R2API] Fetching commits for ${query.owner}/${query.repo} (page=${query.page}, per_page=${query.per_page})`);

    // Use R2 service exclusively
    const r2Service = useR2GitHubService(event);
    
    // Log storage configuration for debugging
    console.log(`[R2API] R2 storage configuration: ${JSON.stringify(r2Service.getStorageInfo())}`);

    // Verify repository exists first
    const repository = await r2Service.getRepository(query.owner, query.repo);
    if (!repository) {
      console.log(`[R2API] Repository ${query.owner}/${query.repo} not found in R2 storage`);
      throw new Error(`Repository ${query.owner}/${query.repo} not found in R2 storage`);
    }
    
    console.log(`[R2API] Found repository in R2: ${query.owner}/${query.repo} (id: ${repository.id})`);

    // Get commits from R2 storage
    console.log(`[R2API] Fetching commits from R2 storage for ${query.owner}/${query.repo}`);
    const commits = await r2Service.listCommits(query.owner, query.repo, query.page, query.per_page);
    
    if (commits.length === 0) {
      console.log(`[R2API] No commits found for ${query.owner}/${query.repo} in R2 storage`);
      return {
        data: [],
        message: `No commits found for ${query.owner}/${query.repo} in storage`,
      };
    }
    
    console.log(`[R2API] Found ${commits.length} commits in R2 storage`);
    
    // Format response with detailed logging
    const responseData = commits.map((commit) => {
      console.log(`[R2API] Processing commit: ${commit.sha.substring(0, 7)} - "${commit.commit.message.split('\n')[0]}"`);
      
      // For each commit, check if we have check runs
      return {
        sha: commit.sha,
        commit: {
          message: commit.commit.message,
          author: commit.commit.author,
        },
        html_url: commit.html_url,
        author: null, // In R2 storage we might not have author details
        r2_source: true, // Flag to indicate source of data
        indexed_at: commit.indexed_at || null,
      };
    });
    
    console.log(`[R2API] Returning ${responseData.length} commits`);
    return { data: responseData };
  } catch (error) {
    console.error("[R2API] Error in commits endpoint:", error);
    
    throw createError({
      statusCode: 404,
      statusMessage: `Commits could not be accessed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});
