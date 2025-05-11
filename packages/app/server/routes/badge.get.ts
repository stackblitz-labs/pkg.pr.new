import { defineEventHandler, setHeader, getQuery, createError } from "h3";

const BASE_URL = "https://pkg.pr.new";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const owner = query.owner as string;
  const repo = query.repo as string;
  const style = (query.style as string) || "flat";
  const label = (query.label as string) || "pkg.pr.new";
  const color = (query.color as string) || "0ea5e9";

  if (!owner || !repo) {
    throw createError({
      statusCode: 400,
      statusMessage: "Owner and repo parameters are required",
    });
  }

  const logoBase64 = getPkgPrNewLogoBase64();
  const shieldsUrl = `https://img.shields.io/static/v1?label=${encodeURIComponent(label)}&message=${encodeURIComponent(repo)}&color=${color}&style=${style}&logo=data:image/svg+xml;base64,${logoBase64}`;

  setHeader(event, "Content-Type", "image/svg+xml");
  setHeader(event, "Cache-Control", "public, max-age=86400");

  const response = await fetch(shieldsUrl);
  const svg = await response.text();

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <a xlink:href="${BASE_URL}/~/${owner}/${repo}">
      ${svg}
    </a>
  </svg>`;
});

function getPkgPrNewLogoBase64(): string {
  const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 216 216">
    <path fill="#0ea5e9" d="M193.76 49.65l-88-48.18a12 12 0 0 0-11.52 0l-88 48.18a12 12 0 0 0-6.24 10.52v95.64a12 12 0 0 0 6.24 10.52l88 48.18a11.95 11.95 0 0 0 11.52 0l88-48.18a12 12 0 0 0 6.24-10.52V60.17a12 12 0 0 0-6.24-10.52"/>
  </svg>`;

  return Buffer.from(logo).toString("base64");
}
