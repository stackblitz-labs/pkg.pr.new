import { usePackagesBucket } from "~/utils/bucket";

export default eventHandler(async (event) => {
  try {
    const packagesBucket = usePackagesBucket(event);

    const keys = await packagesBucket.getKeys();

    return {
      ok: true,
      totalObjects: keys.length,
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: "Failed to fetch R2 stats",
    });
  }
}); 