import { z } from "zod";
// Temporarily disabled to avoid a full R2 scan on every repo page load.
// import { getRepoReleaseCount } from "../../utils/bucket";

const querySchema = z.object({
  owner: z.string(),
  repo: z.string(),
});

export default defineEventHandler(async (event) => {
  try {
    const query = await getValidatedQuery(event, (data) =>
      querySchema.parse(data),
    );
    // Temporarily disabled: computing the release count scans every package
    // object for the repo on each page load.
    const releaseCount = 0;
    // try {
    //   releaseCount = await getRepoReleaseCount(event, query.owner, query.repo);
    // } catch (error) {
    //   console.error(
    //     `Error counting releases for ${query.owner}/${query.repo}:`,
    //     error,
    //   );
    // }

    setHeader(
      event,
      "Cache-Control",
      "public, max-age=30, s-maxage=120, stale-while-revalidate=300",
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
