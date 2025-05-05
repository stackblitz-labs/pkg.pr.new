import { z } from "zod";
import { useR2GitHubService } from "../../../server/utils/r2-service";

const querySchema = z.object({
  text: z.string(),
});

export default defineEventHandler(async (event) => {
  try {
    console.log("[R2API] Search endpoint called");
    const query = await getValidatedQuery(event, (data) =>
      querySchema.parse(data),
    );

    if (!query.text) {
      console.log("[R2API] Empty search query, returning empty results");
      return { nodes: [] };
    }

    // Use R2 service exclusively for searching
    console.log(`[R2API] Searching repositories with query: "${query.text}"`);
    const r2Service = useR2GitHubService(event);

    // Log R2 storage configuration for debugging
    console.log(
      `[R2API] R2 storage configuration: ${JSON.stringify(r2Service.getStorageInfo())}`,
    );

    // Get search results
    const repositories = await r2Service.searchRepositories(query.text, 10);

    console.log(
      `[R2API] Found ${repositories.length} repositories matching the query in R2 storage`,
    );

    if (repositories.length === 0) {
      console.log(
        "[R2API] No repositories found in R2 storage matching the query",
      );
      return {
        nodes: [],
        message: "No matching repositories found in storage",
      };
    }

    // Format the response with detailed logging
    const formattedResponse = {
      nodes: repositories.map((repo) => {
        console.log(
          `[R2API] Including repository in results: ${repo.owner.login}/${repo.name} (ID: ${repo.id})`,
        );
        return {
          id: repo.id,
          name: repo.name,
          owner: {
            id: repo.owner.id,
            login: repo.owner.login,
            avatarUrl: repo.owner.avatar_url,
          },
        };
      }),
    };

    console.log(
      `[R2API] Search response prepared with ${formattedResponse.nodes.length} repositories`,
    );
    return formattedResponse;
  } catch (error) {
    console.error("[R2API] Error in repository search:", error);

    return {
      nodes: [],
      error: true,
      message: "Search failed. Only data in storage can be searched.",
    };
  }
});
