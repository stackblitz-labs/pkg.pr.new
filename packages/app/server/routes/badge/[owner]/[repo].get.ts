import {
  defineEventHandler,
  setHeader,
  getRouterParams,
  createError,
} from "h3";
// Temporarily disabled to avoid a full R2 scan on every badge hit (hot path).
// import { getRepoReleaseCount } from "../../../utils/bucket";
import { LOGO_BASE64 } from "../../../../shared/constants";

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

  // Temporarily disabled: computing the release count scans every package
  // object for the repo on each (hot) badge request.
  // const releaseCount = await getRepoReleaseCount(event, owner, repo);

  const style = "flat";
  const color = "000";
  const message = `pkg.pr.new`;
  // const message = `${releaseCount} | pkg.pr.new`;

  const shieldsUrl =
    `https://img.shields.io/static/v1?` +
    `label=&message=${encodeURIComponent(message)}` +
    `&color=${color}` +
    `&style=${style}` +
    `&logo=data:image/svg+xml;base64,${LOGO_BASE64}` +
    `&logoSize=auto`;

  const res = await fetch(shieldsUrl);
  const svg = await res.text();

  setHeader(event, "Content-Type", "image/svg+xml");
  setHeader(event, "Cache-Control", "public, max-age=86400, immutable");
  return svg;
});
