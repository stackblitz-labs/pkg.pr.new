// This plugin ensures runtime config is properly initialized early in the request lifecycle
export default defineNitroPlugin((nitro) => {
    nitro.hooks.hook("request", async (event) => {
        try {
            // Pre-load the configuration to ensure it's initialized
            const config = useRuntimeConfig(event);
            // eslint-disable-next-line no-console
            console.log(
                "Runtime config initialized successfully:",
                Object.keys(config),
            );
        } catch (error) {
            console.error("Failed to initialize runtime config:", error);
        }
    });
});