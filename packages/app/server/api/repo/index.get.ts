import type { H3Event } from "h3";
import { z } from "zod";
import { getRepoReleaseRows } from "../../utils/repo-releases";

const querySchema = z.object({
  owner: z.string(),
  repo: z.string(),
});

const getRepoInfo = defineCachedFunction(
  async (owner: string, repo: string, event: H3Event) => {
    try {
      const releaseRows = await getRepoReleaseRows(event, owner, repo);
      const releaseCount = releaseRows.length;

      return {
        id: `${owner}/${repo}`,
        name: repo,
        owner: {
          id: owner,
          avatarUrl: `https://github.com/${owner}.png`,
          login: owner,
        },
        url: `https://github.com/${owner}/${repo}`,
        homepageUrl: "",
        description: "",
        releaseCount,
      };
    } catch (error) {
      console.error(
        `Error fetching repository info for ${owner}/${repo}:`,
        error,
      );
      throw error;
    }
  },
  {
    getKey: (owner: string, repo: string, _event?: H3Event) =>
      `${owner}/${repo}`,
    maxAge: 60 * 30, // 30 minutes
    swr: true,
  },
);

export default defineCachedEventHandler(
  async (event) => {
    try {
      const query = await getValidatedQuery(event, (data) =>
        querySchema.parse(data),
      );
      setHeader(
        event,
        "CDN-Cache-Control",
        "public, max-age=300, stale-while-revalidate=3600",
      );
      return getRepoInfo(query.owner, query.repo, event);
    } catch (error) {
      console.error("Error in repo info endpoint:", error);
      return {
        error: true,
        message: (error as Error).message,
        id: "error",
        name: "error",
        owner: {
          id: "error",
          avatarUrl: "",
          login: "error",
        },
        url: "",
        homepageUrl: "",
        description: "Error fetching repository data",
        releaseCount: 0,
      };
    }
  },
  {
    name: "api-repo",
    getKey: (event) => {
      const q = getQuery(event) as Record<string, string | undefined>;
      return `${q.owner ?? ""}:${q.repo ?? ""}`;
    },
    maxAge: 60 * 5,
    swr: true,
    staleMaxAge: 60 * 60,
  },
);
