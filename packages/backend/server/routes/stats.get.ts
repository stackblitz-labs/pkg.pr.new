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
        try {
          const [org, pkg] = object.key.split(":");
          if (org) orgs.add(org);
          if (pkg) packages.add(pkg);
        } catch (err) {
          console.error(`Error processing object key: ${object.key}`, err);
        }
      }

      truncated = list.truncated;
      cursor = list.cursor;
    }

    console.log(`Total objects processed: ${totalObjects}`);
    console.log(`Total unique orgs: ${orgs.size}`);
    console.log(`Total unique packages: ${packages.size}`);

    return {
      ok: true,
      totalObjects,
      totalOrgs: orgs.size,
      totalPackages: packages.size,
    };
  } catch (error) {
    console.error("Failed to fetch R2 stats", error);
    throw createError({
      statusCode: 500,
      message: "Failed to fetch R2 stats",
    });
  }
});