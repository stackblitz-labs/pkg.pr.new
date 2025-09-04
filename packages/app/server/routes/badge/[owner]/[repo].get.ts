import {
  defineEventHandler,
  setHeader,
  getRouterParams,
  createError,
  getQuery,
} from "h3";
import { getRepoReleaseCount } from "../../../utils/bucket";

export default defineEventHandler(async (event) => {
  const { owner, repo } = getRouterParams(event) as {
    owner: string;
    repo: string;
  };
  if (!owner || !repo) {
    throw createError({
      statusCode: 400,
      statusMessage: "Owner and repo are required",
    });
  }

  const releaseCount = await getRepoReleaseCount(event, owner, repo);

  const { style = "flat", color = "000" } = getQuery(event) as Record<
    string,
    string
  >;
  const origin = getRequestURL(event).origin;
  const logoUrl = `${origin}/pkg-pr-new-logo.svg`;

  const shieldsUrl =
    `https://img.shields.io/static/v1?` +
    `label=&message=${encodeURIComponent(`${releaseCount} | pkg.pr.new`)}` +
    `&color=${color}` +
    `&style=${style}` +
    `&logo=${encodeURIComponent(logoUrl)}` +
    `&logoSize=auto`;

  const res = await fetch(shieldsUrl);
  const svg = await res.text();

  setHeader(event, "Content-Type", "image/svg+xml");
  setHeader(event, "Cache-Control", "public, max-age=86400");
  return svg;
});
