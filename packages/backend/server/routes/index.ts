import { H3Event, sendRedirect } from "h3";

export default eventHandler((event: H3Event) => {
  return sendRedirect(event, "https://github.com/stackblitz-labs/pkg.pr.new");
});
