import {
  createError,
  defineEventHandler,
  getRouterParams,
  setHeader,
} from "h3";
import { hasRepoReleases } from "../../../utils/bucket";

export default defineEventHandler(async (event) => {
  const { owner, repo } = getRouterParams(event) as {
    owner?: string;
    repo?: string;
  };

  if (!owner || !repo) {
    throw createError({
      statusCode: 400,
      statusMessage: "Owner and repo are required",
    });
  }

  const normalizedOwner = owner.trim();
  const normalizedRepo = repo.trim();

  if (!normalizedOwner || !normalizedRepo) {
    throw createError({
      statusCode: 400,
      statusMessage: "Owner and repo are required",
    });
  }

  const exactMatch = await hasRepoReleases(
    event,
    normalizedOwner,
    normalizedRepo,
  );
  const hasReleases =
    exactMatch ||
    (await hasRepoReleases(
      event,
      normalizedOwner.toLowerCase(),
      normalizedRepo.toLowerCase(),
    ));

  setHeader(
    event,
    "Cache-Control",
    "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
  );
  setHeader(event, "x-has-releases", hasReleases ? "1" : "0");

  if (!hasReleases) {
    throw createError({
      statusCode: 404,
      statusMessage: "No releases found",
    });
  }

  return null;
});
