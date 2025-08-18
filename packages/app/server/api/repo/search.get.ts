import { z } from "zod";
import { useOctokitApp } from "../../utils/octokit";
import stringSimilarity from "string-similarity";
import type { RepoNode } from "../../utils/types";

const querySchema = z.object({
  text: z.string(),
});

interface SearchDebugInfo {
  startTime: string;
  endTime: string;
  totalElapsedMs: number;
  processedRepositories: number;
  matchesFound: number;
  averageProcessingTimePerRepo: number;
  repositoriesPerSecond: number;
  searchQuery: string;
  status: "completed" | "aborted" | "error";
  flowErrors: Array<{
    stage: string;
    error: string;
    timestamp: string;
    repositoryContext?: string;
  }>;
  flowStages: Array<{
    stage: string;
    timestamp: string;
    details?: string;
  }>;
}

export default defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const signal = request.signal;

  const flowErrors: SearchDebugInfo["flowErrors"] = [];
  const flowStages: SearchDebugInfo["flowStages"] = [];

  const addFlowStage = (stage: string, details?: string) => {
    flowStages.push({
      stage,
      timestamp: new Date().toISOString(),
      details,
    });
  };

  const addFlowError = (
    stage: string,
    error: string,
    repositoryContext?: string,
  ) => {
    flowErrors.push({
      stage,
      error,
      timestamp: new Date().toISOString(),
      repositoryContext,
    });
  };

  try {
    addFlowStage("query_validation", "Starting query validation");

    const query = await getValidatedQuery(event, (data) =>
      querySchema.parse(data),
    );

    if (!query.text) {
      addFlowStage("early_return", "Empty query text");
      return { nodes: [], debug: null };
    }

    addFlowStage("query_validated", `Query: "${query.text}"`);

    let app;
    try {
      addFlowStage("octokit_init", "Initializing Octokit app");
      app = useOctokitApp(event);
      addFlowStage("octokit_ready", "Octokit app initialized successfully");
    } catch (err: any) {
      addFlowError("octokit_init", err.message);
      throw new Error(`Failed to initialize Octokit: ${err.message}`);
    }

    const searchText = query.text.toLowerCase();
    const matches: RepoNode[] = [];
    const startTime = Date.now();
    let processedRepositories = 0;
    let status: SearchDebugInfo["status"] = "completed";
    let skippedRepositories = 0;
    let suspendedErrors = 0;

    addFlowStage(
      "repository_iteration_start",
      `Starting to iterate repositories for search: "${searchText}"`,
    );

    try {
      await app.eachRepository(async ({ repository }) => {
        try {
          if (signal.aborted) {
            addFlowStage(
              "search_aborted",
              `Aborted at repository: ${repository.full_name}`,
            );
            status = "aborted";
            return;
          }

          if (repository.private) {
            skippedRepositories++;
            return;
          }

          processedRepositories++;

          // Add periodic progress tracking
          if (processedRepositories % 100 === 0) {
            const elapsed = Date.now() - startTime;
            addFlowStage(
              "progress_checkpoint",
              `Processed ${processedRepositories} repositories in ${elapsed}ms`,
            );
          }

          const repoName = repository.name.toLowerCase();
          const ownerLogin = repository.owner.login.toLowerCase();

          let nameScore, ownerScore;
          try {
            nameScore = stringSimilarity.compareTwoStrings(
              repoName,
              searchText,
            );
            ownerScore = stringSimilarity.compareTwoStrings(
              ownerLogin,
              searchText,
            );
          } catch (err: any) {
            addFlowError(
              "string_similarity",
              err.message,
              repository.full_name,
            );
            // Use fallback scoring
            nameScore = repoName.includes(searchText) ? 0.5 : 0;
            ownerScore = ownerLogin.includes(searchText) ? 0.5 : 0;
          }

          try {
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
            addFlowError("match_creation", err.message, repository.full_name);
          }
        } catch (err: any) {
          if (
            err.message?.includes("suspended") ||
            err.message?.includes("Installation")
          ) {
            suspendedErrors++;
            addFlowError(
              "repository_suspended",
              err.message,
              repository.full_name,
            );
            return;
          }
          addFlowError(
            "repository_processing",
            err.message,
            repository.full_name,
          );
          throw err;
        }
      });

      addFlowStage(
        "repository_iteration_complete",
        `Completed repository iteration`,
      );
    } catch (err: any) {
      if (
        err.message?.includes("suspended") ||
        err.message?.includes("Installation")
      ) {
        addFlowError(
          "iteration_suspended",
          `Installation suspended after processing ${processedRepositories} repositories: ${err.message}`,
        );
        status = "completed";
      } else {
        addFlowError("iteration_failed", err.message);
        status = "error";
        throw err;
      }
    }

    const totalElapsed = Date.now() - startTime;

    addFlowStage("sorting_matches", `Sorting ${matches.length} matches`);

    try {
      matches.sort((a, b) =>
        b.score !== a.score ? b.score - a.score : b.stars - a.stars,
      );
      addFlowStage("sorting_complete", "Matches sorted successfully");
    } catch (err: any) {
      addFlowError("sorting", err.message);
    }

    const top = matches.slice(0, 10).map((node) => ({
      id: node.id,
      name: node.name,
      owner: node.owner,
      stars: node.stars,
    }));

    addFlowStage("response_preparation", `Prepared ${top.length} top results`);

    const debugInfo: SearchDebugInfo = {
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      totalElapsedMs: totalElapsed,
      processedRepositories,
      matchesFound: matches.length,
      averageProcessingTimePerRepo:
        processedRepositories > 0 ? totalElapsed / processedRepositories : 0,
      repositoriesPerSecond: processedRepositories / (totalElapsed / 1000),
      searchQuery: query.text,
      status,
      flowErrors,
      flowStages,
    };

    return { nodes: top, debug: debugInfo };
  } catch (error) {
    addFlowError("global_error", (error as Error).message);

    return {
      nodes: [],
      error: true,
      message: (error as Error).message,
      debug: {
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        totalElapsedMs: 0,
        processedRepositories: 0,
        matchesFound: 0,
        averageProcessingTimePerRepo: 0,
        repositoriesPerSecond: 0,
        searchQuery: "",
        status: "error" as const,
        flowErrors,
        flowStages,
      },
    };
  }
});