import {
  defineEventHandler,
  setHeader,
  getRouterParams,
  createError,
  getQuery,
} from "h3";

async function getRepoReleaseCount(
  event: any,
  owner: string,
  repo: string,
): Promise<number> {
  try {
    const binding = useBinding(event);
    const packagesPrefix = `${usePackagesBucket.base}:`;

    let releaseCount = 0;
    let cursor: string | undefined;

    do {
      const response = await binding.list({ cursor, limit: 1000 });

      for (const { key } of response.objects) {
        if (key.startsWith(packagesPrefix)) {
          const trimmedKey = key.slice(packagesPrefix.length);
          const [keyOrg, keyRepo] = trimmedKey.split(":");

          if (keyOrg === owner && keyRepo === repo) {
            releaseCount++;
          }
        }
      }

      cursor = response.truncated ? response.cursor : undefined;
    } while (cursor);

    return releaseCount;
  } catch (error) {
    console.error(`Error counting releases for ${owner}/${repo}:`, error);
    return 0;
  }
}

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
  console.log(`Repository ${owner}/${repo} has ${releaseCount} releases`);

  const {
    style = "flat",
    color = "000",
    showCount,
  } = getQuery(event) as Record<string, string>;
  const logoBase64 = getPkgPrNewLogoBase64();

  const message =
    showCount === "true" ? `pkg.pr.new (${releaseCount})` : "pkg.pr.new";

  const shieldsUrl =
    `https://img.shields.io/static/v1?` +
    `label=&message=${encodeURIComponent(message)}` +
    `&color=${color}` +
    `&style=${style}` +
    `&logo=data:image/svg+xml;base64,${logoBase64}` +
    `&logoSize=auto`;

  const res = await fetch(shieldsUrl);
  const svg = await res.text();

  setHeader(event, "Content-Type", "image/svg+xml");
  setHeader(event, "Cache-Control", "public, max-age=86400");
  setHeader(event, "X-Release-Count", releaseCount.toString());
  setHeader(event, "X-Repository", `${owner}/${repo}`);
  return svg;
});

function getPkgPrNewLogoBase64(): string {
  const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="71" height="73" viewBox="0 0 71 73" fill="none">
    <g transform="translate(0,7)">
  <g filter="url(#filter0_di_18_22)">
    <path d="M29.6539 2.52761C26.8827 3.91317 24.6248 5.06781 24.6248 5.10629C24.6248 5.14478 31.2447 8.57019 39.3399 12.7269C47.448 16.8707 54.1706 20.3731 54.2988 20.4886C54.5169 20.681 54.5298 21.1942 54.5298 28.9046C54.5298 36.6149 54.5169 37.1281 54.2988 37.3847C54.1706 37.5386 52.7208 38.3597 51.0915 39.2193C49.4494 40.0788 47.9612 40.7716 47.7816 40.7716C47.5891 40.7716 47.3839 40.6562 47.2684 40.4894C47.1016 40.2328 47.076 39.1166 47.076 32.2402L47.0632 24.286L16.9914 8.80112C5.66316 14.446 4.62399 15.0105 4.35458 15.3825L4.03385 15.8187C3.98253 41.7723 3.99536 49.4314 4.03385 49.5981C4.07233 49.7521 4.25194 50.06 4.45721 50.2781C4.7138 50.586 8.54974 52.5617 19.7882 58.1681C31.0266 63.7873 34.8754 65.6604 35.2089 65.6604C35.5425 65.6604 38.1725 64.4159 45.3184 60.8879C50.6169 58.2579 57.5062 54.8453 60.6108 53.2801C65.9863 50.586 66.2685 50.432 66.538 49.9445L66.833 49.4314C66.833 17.1273 66.8202 16.0496 66.6021 15.6263C66.3968 15.2029 65.4988 14.7282 51.1813 7.58234C36.928 0.474933 35.9402 -0.0125789 35.3372 0.000250395C34.7727 0.0130796 34.0928 0.320982 29.6539 2.52761Z" fill="url(#paint0_linear_18_22)"/>
  </g>
  <defs>
    <filter id="filter0_di_18_22" x="0.460111" y="1.52588e-05" width="69.9128" height="72.7401" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
      <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
      <feOffset dy="3.53989"/>
      <feGaussianBlur stdDeviation="1.76994"/>
      <feComposite in2="hardAlpha" operator="out"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
      <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_18_22"/>
      <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_18_22" result="shape"/>
      <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
      <feOffset dy="1.76994"/>
      <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
      <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.95 0"/>
      <feBlend mode="normal" in2="shape" result="effect2_innerShadow_18_22"/>
    </filter>
    <linearGradient id="paint0_linear_18_22" x1="35.4165" y1="1.52588e-05" x2="35.4165" y2="66.8238" gradientUnits="userSpaceOnUse">
      <stop stop-color="white"/>
      <stop offset="1" stop-color="#999999"/>
    </linearGradient>
  </defs>
  </g>
</svg>`;

  return Buffer.from(logo).toString("base64");
}
