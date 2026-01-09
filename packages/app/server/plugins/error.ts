import type { H3Error } from "h3";

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook("error", async (error, { event }) => {
    const statusCode = (error as H3Error)?.statusCode || 500;
    const method = event?.method || "-";
    const path = event?.path || "-";
    const matchedRoute = event?.context?.matchedRoute?.path;
    const routePath = matchedRoute === "/**" ? "pages/**" : matchedRoute || "-";
    const prefix = `[${method}] ${path} (${routePath}) [${statusCode}]`;

    if (statusCode >= 400 && statusCode < 500) {
      console.log(prefix, error?.message || "");
      return;
    }

    console.error(prefix, "Application error:", error);
  });
});
