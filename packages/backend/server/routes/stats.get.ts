import { useBinding } from "~/utils/bucket";

export default eventHandler(async (event) => {
  try {
    const binding = useBinding(event);

    let truncated = true;
    let cursor: string | undefined;
    let totalObjects = 0;
    const orgs = new Set<string>();
    const packages = new Set<string>();

    while (truncated) {
      const list = await binding.list({ cursor });

      totalObjects += list.objects.length;

      for (const object of list.objects) {
        const [org, pkg] = object.key.split(":");
        orgs.add(org);
        packages.add(pkg);
      }

      truncated = list.truncated;
      cursor = list.cursor;
    }

    console.log("All objects:", list.objects);

    return {
      ok: true,
      totalObjects,
      totalOrgs: orgs.size,
      totalPackages: packages.size,
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: "Failed to fetch R2 stats",
    });
  }
});