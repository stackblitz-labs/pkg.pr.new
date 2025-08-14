import { z } from "zod";
import { useOctokitApp } from "../../utils/octokit";
import stringSimilarity from "string-similarity";
import type { RepoNode } from "../../utils/types";

const querySchema = z.object({
  text: z.string(),
});

export default defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const signal = request.signal;

  try {
    const query = await getValidatedQuery(event, (data) =>
      querySchema.parse(data),
    );
    if (!query.text) return { nodes: [] };

    const app = useOctokitApp(event);
    const searchText = query.text.toLowerCase();
    const matches: RepoNode[] = [];

    await app.eachInstallation(async ({ octokit, installation }) => {
      if (signal.aborted) return;
      
      if (installation.suspended_at) {
        console.warn(`Skipping suspended installation ${installation.id}`);
        return;
      }

      try {
        const repos = await octokit.paginate("GET /installation/repositories");

        for (const repository of repos) {
          if (signal.aborted) return;
          if (repository.private) continue;

          const repoName = repository.name.toLowerCase();
          const ownerLogin = repository.owner.login.toLowerCase();

          const nameScore = stringSimilarity.compareTwoStrings(
            repoName,
            searchText,
          );
          const ownerScore = stringSimilarity.compareTwoStrings(
            ownerLogin,
            searchText,
          );

          matches.push({
            id: repository.id,
            name: repository.name,
            owner: {
              login: repository.owner.login,
              avatarUrl: repository.owner.avatar_url,
            },
            stars: repository.stargazers_count || 0,
            score: Math.max(nameScore, ownerScore),
          });
        }
      } catch (error) {
        console.warn(`Error fetching repositories for installation ${installation.id}:`, error);
      }
    });

    matches.sort((a, b) =>
      b.score !== a.score ? b.score - a.score : b.stars - a.stars,
    );

    const top = matches.slice(0, 10).map((node) => ({
      id: node.id,
      name: node.name,
      owner: node.owner,
      stars: node.stars,
    }));

    return { nodes: top };
  } catch (error) {
    return { nodes: [], error: true, message: (error as Error).message };
  }
});
