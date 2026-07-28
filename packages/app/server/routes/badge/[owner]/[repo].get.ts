import {
  defineEventHandler,
  setHeader,
  getRouterParams,
  createError,
} from "h3";
import {
  getReleaseCount,
  scheduleReleaseIndexBackfill,
} from "../../../utils/release-index";
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

  const releaseIndexReady = await scheduleReleaseIndexBackfill(
    event,
    owner,
    repo,
  );
  const releaseCount = await getReleaseCount(event, owner, repo);

  const style = "flat";
  const color = "000";
  const message = releaseIndexReady
    ? `${releaseCount} | pkg.pr.new`
    : "indexing | pkg.pr.new";

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
  setHeader(
    event,
    "Cache-Control",
    releaseIndexReady ? "public, max-age=86400, immutable" : "no-store",
  );
  return svg;
});
