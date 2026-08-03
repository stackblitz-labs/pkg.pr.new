import { z } from "zod";
import { hasRepoReleases } from "../../utils/bucket";

const querySchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, (data) =>
    querySchema.parse(data),
  );
  const owner = query.owner.trim();
  const repo = query.repo.trim();

  const exactMatch = await hasRepoReleases(event, owner, repo);
  const normalizedMatch =
    exactMatch ||
    (await hasRepoReleases(event, owner.toLowerCase(), repo.toLowerCase()));

  setHeader(
    event,
    "Cache-Control",
    "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
  );

  return {
    id: `${owner}/${repo}`,
    exists: normalizedMatch,
  };
});
