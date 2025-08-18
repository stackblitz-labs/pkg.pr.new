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

    const startTime = Date.now();
    let processedRepositories = 0;

    console.log(`Starting repository search for query: "${query.text}"`);
    console.log(`Search started at: ${new Date(startTime).toISOString()}`);

    try {
      await app.eachRepository(async ({ repository }) => {
        try {
          if (signal.aborted) {
            console.log(`Search aborted at repository ${repository.full_name}`);
            return;
          }

          if (repository.private) return;

          processedRepositories++;

          if (processedRepositories % 100 === 0) {
            const elapsed = Date.now() - startTime;
            console.log(`Processed ${processedRepositories} repositories in ${elapsed}ms`);
          }

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
        } catch (err: any) {
          if (err.message?.includes("suspended") || err.message?.includes("Installation")) {
            console.warn(`Skipping repository due to suspended installation: ${err.message}`);
            return;
          }
          throw err;
        }
      });
    } catch (err: any) {
      if (err.message?.includes("suspended") || err.message?.includes("Installation")) {
        console.warn(`eachRepository failed due to suspended installation: ${err.message}`);
        console.warn(`Processed ${processedRepositories} repositories before suspension error`);
      } else {
        console.error(`Unexpected error in eachRepository:`, err);
        throw err;
      }
    }

    const totalElapsed = Date.now() - startTime;
    console.log(`Search completed in ${totalElapsed}ms`);
    console.log(`Final stats:`);
    console.log(`   - Total repositories processed: ${processedRepositories}`);
    console.log(`   - Final matches found: ${matches.length}`);
    console.log(`   - Average processing time per repo: ${(totalElapsed / processedRepositories).toFixed(2)}ms`);
    console.log(`   - Repositories per second: ${(processedRepositories / (totalElapsed / 1000)).toFixed(2)}`);

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
