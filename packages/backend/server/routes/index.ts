import { sendRedirect } from "h3";

export default eventHandler((event) => {
  return sendRedirect(
    event,
    "https://github.com/stackblitz-labs/stackblitz-ci",
  );
});
