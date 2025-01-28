export default defineEventHandler((event) => {
  if (handleCors(event, {})) {
    console.log("CORS was successfully handled");
  }
});
