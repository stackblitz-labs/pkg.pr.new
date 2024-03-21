import { type NitroPreset } from "nitropack";
import { fileURLToPath } from "url";

export default <NitroPreset>{
  extends: "cloudflare-pages",
  entry: fileURLToPath(new URL('./entry.ts', import.meta.url)),
};
