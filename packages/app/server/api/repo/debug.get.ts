import { z } from "zod";
import { useBinding, usePackagesBucket } from "../../utils/bucket";
import {
  getReleaseCount,
  isReleaseIndexReady,
  readBackfillStatus,
  useReleaseIndexBucket,
} from "../../utils/release-index";

const querySchema = z.object({
  owner: z.string(),
  repo: z.string(),
});

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, (data) =>
    querySchema.parse(data),
  );
  const { owner, repo } = query;

  const bindingEvent = event as Parameters<typeof getReleaseCount>[0];
  const binding = useBinding(bindingEvent);

  const [indexReady, releaseCount, status] = await Promise.all([
    isReleaseIndexReady(bindingEvent, owner, repo),
    getReleaseCount(bindingEvent, owner, repo),
    readBackfillStatus(bindingEvent, owner, repo),
  ]);

  const packagePrefix = `${usePackagesBucket.base}:${owner}:${repo}:`;
  const indexPrefix = `${useReleaseIndexBucket.base}:${owner}:${repo}:`;

  const [packageList, indexList] = await Promise.all([
    binding.list({ prefix: packagePrefix, limit: 5 } as any),
    binding.list({ prefix: indexPrefix, limit: 5 } as any),
  ]);

  setHeader(event, "Cache-Control", "no-store");

  return {
    owner,
    repo,
    indexReady,
    releaseCount,
    status,
    packageObjects: {
      exist: packageList.objects.length > 0,
      sampleKeys: packageList.objects.map((o) => o.key),
    },
    indexObjects: {
      // sorted lexicographically by R2 = newest-first via inverted timestamp
      sampleKeys: indexList.objects.map((o) => o.key),
    },
  };
});
