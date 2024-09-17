export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook("error", async (error, { event }) => {
    console.log(`${event?.path} Application error:`, error);
  });
});
