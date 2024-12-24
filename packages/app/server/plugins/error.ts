export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('error', async (error, { event }) => {
    console.error(`${event?.path} Application error:`, error)
  })
})
