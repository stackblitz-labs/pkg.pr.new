export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook("error", (error, { event }) => {
    console.error(`${event?.path} Application error:`, error);
  });
});
