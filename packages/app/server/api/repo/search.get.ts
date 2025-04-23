import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { z } from "zod";
import { useGithubREST } from "../../../server/utils/octokit";

const querySchema = z.object({
  text: z.string(),
});

export default defineEventHandler(async (event) => {
  try {
    const query = await getValidatedQuery(event, (data) =>
      querySchema.parse(data),
    );

    if (!query.text) {
      return { nodes: [] };
    }

    const octokit = useGithubREST(event);

    const { data } = await octokit.request("GET /search/repositories", {
      q: query.text,
      per_page: 10,
    });

    return {
      nodes: data.items.map(
        (
          repo: RestEndpointMethodTypes["search"]["repos"]["response"]["data"]["items"][0],
        ) => ({
          id: repo.id.toString(),
          name: repo.name,
          owner: repo.owner
            ? {
                id: repo.owner.id.toString(),
                login: repo.owner.login,
                avatarUrl: repo.owner.avatar_url,
              }
            : null,
        }),
      ),
    };
  } catch (error) {
    console.error("Error in repository search:", error);
    return {
      nodes: [],
      error: true,
      message: (error as Error).message,
    };
  }
});
