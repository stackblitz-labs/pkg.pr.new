const url = "https://events.baselime.io/v1/logs";
const apiKey = "76740dd3171dedb44ce3a8429da9c9e902dac764"; // Your API key

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook("error", async (error, { event }) => {
    console.error(`${event?.path} Application error:`, error);

    const payload = [
      {
        path: event?.path,
        name: error.name,
        message: error.message,
        error: error.stack,
      },
    ];

    fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "x-service": "my-service",
      },
      body: JSON.stringify(payload),
    });
  });
});
