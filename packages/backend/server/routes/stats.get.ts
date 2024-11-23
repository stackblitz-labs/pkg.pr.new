import { useBinding } from "~/utils/bucket";

export default eventHandler(async (event) => {
  try {
    const binding = useBinding(event);

    let truncated = true;
    let cursor: string | undefined;
    let totalObjects = 0;

    while (truncated) {
      const list = await binding.list({ cursor });

      totalObjects += list.objects.length;
      truncated = list.truncated;
      cursor = list.cursor;
    }

    return {
      ok: true,
      totalObjects,
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: "Failed to fetch R2 stats",
    });
  }
});