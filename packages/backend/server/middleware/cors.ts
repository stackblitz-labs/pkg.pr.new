export default defineEventHandler((event) => {
  if (handleCors(event, {})) {
    return;
  }
});
