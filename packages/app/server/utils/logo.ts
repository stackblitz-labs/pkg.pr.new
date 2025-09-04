import { readFileSync } from "fs";
import { resolve } from "path";

let logoBase64Cache: string | null = null;

export function getPkgPrNewLogoBase64(): string {
  if (logoBase64Cache) {
    return logoBase64Cache;
  }

  try {
    const logoPath = resolve(process.cwd(), "public", "pkg-pr-new-logo.svg");
    const logoSvg = readFileSync(logoPath, "utf-8");

    logoBase64Cache = Buffer.from(logoSvg).toString("base64");
    return logoBase64Cache;
  } catch (error) {
    console.error("Failed to load logo SVG:", error);
    const fallbackSvg =
      '<svg width="71" height="73"><rect width="71" height="73" fill="#999"/></svg>';
    return Buffer.from(fallbackSvg).toString("base64");
  }
}
