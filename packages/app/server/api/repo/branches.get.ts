import { z } from "zod";

const querySchema = z.object({
  owner: z.string(),
  repo: z.string(),
});

export default defineEventHandler(async (event) => {
  try {
    const query = await getValidatedQuery(event, (data) =>
      querySchema.parse(data),
    );
    const installation = await useOctokitInstallation(
      event,
      query.owner,
      query.repo,
    );

    const per_page = 100;
    const branches: string[] = [];
    let page = 1;

    while (true) {
      const { data } = await installation.request("GET /repos/{owner}/{repo}/branches", {
        owner: query.owner,
        repo: query.repo,
        per_page,
        page,
      });

      branches.push(...data.map((branch) => branch.name));

      if (data.length < per_page) {
        break;
      }

      page += 1;
    }

    const { data: repo } = await installation.request("GET /repos/{owner}/{repo}", {
      owner: query.owner,
      repo: query.repo,
    });

    const defaultBranch = repo.default_branch;
    const uniqueBranches = [...new Set(branches)];
    const sortedBranches = [
      defaultBranch,
      ...uniqueBranches.filter((branch) => branch !== defaultBranch).sort(),
    ];

    return {
      defaultBranch,
      branches: sortedBranches,
    };
  } catch (error) {
    console.error("Error fetching repository branches:", error);
    return {
      error: true,
      message: (error as Error).message,
      defaultBranch: "main",
      branches: ["main"],
    };
  }
});
