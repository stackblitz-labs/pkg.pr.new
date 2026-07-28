import { z } from "zod";
import {
  getReleaseCount,
  scheduleReleaseIndexBackfill,
} from "../../utils/release-index";

const querySchema = z.object({
  owner: z.string(),
  repo: z.string(),
});

export default defineEventHandler(async (event) => {
  try {
    const query = await getValidatedQuery(event, (data) =>
      querySchema.parse(data),
    );
    let releaseIndexReady = false;
    let releaseCount = 0;
    try {
      releaseIndexReady = await scheduleReleaseIndexBackfill(
        event,
        query.owner,
        query.repo,
      );
      releaseCount = await getReleaseCount(event, query.owner, query.repo);
    } catch (error) {
      // Repository identity is derived from the route and does not depend on
      // the index. Keep the page available if R2 is temporarily unavailable.
      console.error(
        `Error reading release index for ${query.owner}/${query.repo}:`,
        error,
      );
    }

    // Never cache an incomplete migration result.
    setHeader(
      event,
      "Cache-Control",
      releaseIndexReady
        ? "public, max-age=30, s-maxage=120, stale-while-revalidate=300"
        : "no-store",
    );

    return {
      id: `${query.owner}/${query.repo}`,
      name: query.repo,
      owner: {
        id: query.owner,
        avatarUrl: `https://github.com/${query.owner}.png`,
        login: query.owner,
      },
      url: `https://github.com/${query.owner}/${query.repo}`,
      homepageUrl: "",
      description: "",
      releaseCount,
      releaseIndexReady,
    };
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
});
