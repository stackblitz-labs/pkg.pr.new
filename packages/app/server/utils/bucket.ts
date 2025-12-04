import type { H3EventContext } from "h3";
import type { Cursor, WorkflowData, WebhookDebugData } from "../types";
import type { Storage } from "unstorage";
import { createStorage, joinKeys, prefixStorage } from "unstorage";
import cloudflareR2BindingDriver from "unstorage/drivers/cloudflare-r2-binding";
import { getR2Binding } from "unstorage/drivers/utils/cloudflare";

interface Event {
  context: { cloudflare: H3EventContext["cloudflare"] };
}

export const baseKey = "bucket";

export function useBinding(event: Event) {
  return getR2Binding(
    event.context.cloudflare.env.ENV === "production"
      ? "PROD_CR_BUCKET"
      : "CR_BUCKET",
  );
}

export async function setItemStream(
  event: Event,
  base: string,
  key: string,
  stream: ReadableStream,
  opts?: R2PutOptions,
) {
  const binding = useBinding(event);
  key = joinKeys(base, key);

  await binding.put(key, stream, opts);
}

export async function getItemStream(
  event: Event,
  base: string,
  key: string,
  opts?: R2GetOptions,
) {
  const binding = useBinding(event);
  key = joinKeys(base, key);

  const value = await binding.get(key, opts);
  return value?.body;
}

export function useBucket(event: Event) {
  const binding = useBinding(event);

  return createStorage({
    driver: cloudflareR2BindingDriver({
      base: useBucket.key,
      binding,
    }),
  });
}

useBucket.key = "bucket";
useBucket.base = useBucket.key;

export function useWorkflowsBucket(event: Event) {
  const storage = useBucket(event);
  return prefixStorage<WorkflowData>(storage, useWorkflowsBucket.key);
}

useWorkflowsBucket.key = "workflow";
useWorkflowsBucket.base = joinKeys(useBucket.base, useWorkflowsBucket.key);

export function usePackagesBucket(event: Event) {
  const storage = useBucket(event);
  return prefixStorage<Uint8Array>(storage, usePackagesBucket.key);
}

usePackagesBucket.key = "package";
usePackagesBucket.base = joinKeys(useBucket.base, usePackagesBucket.key);

export function useTemplatesBucket(event: Event) {
  const storage = useBucket(event);
  return prefixStorage<Uint8Array>(storage, useTemplatesBucket.key);
}

useTemplatesBucket.key = "template";
useTemplatesBucket.base = joinKeys(useBucket.base, useTemplatesBucket.key);

export function useCursorsBucket(event: Event) {
  const storage = useBucket(event);
  return prefixStorage<Cursor>(storage, useCursorsBucket.key);
}

useCursorsBucket.key = "cursor";
useCursorsBucket.base = joinKeys(useBucket.base, useCursorsBucket.key);

export function useDownloadedAtBucket(event: Event) {
  const storage = useBucket(event);
  return prefixStorage<number>(storage, useDownloadedAtBucket.key);
}

useDownloadedAtBucket.key = "downloaded-at";
useDownloadedAtBucket.base = joinKeys(
  useBucket.base,
  useDownloadedAtBucket.key,
);

export function usePullRequestNumbersBucket(event: Event): Storage<number> {
  const storage = useBucket(event);
  const newStorage = prefixStorage<number>(
    storage,
    usePullRequestNumbersBucket.key,
  );
  const oldStorage = prefixStorage<number>(storage, useDownloadedAtBucket.key);

  return {
    async hasItem(key: string) {
      return (await newStorage.hasItem(key)) || (await oldStorage.hasItem(key));
    },
    async getItem(key: string) {
      const newValue = await newStorage.getItem(key);
      return newValue !== null ? newValue : await oldStorage.getItem(key);
    },
    async setItem(key: string, value: number) {
      await newStorage.setItem(key, value);
      await oldStorage.removeItem(key);
    },
    async removeItem(key: string) {
      await newStorage.removeItem(key);
      await oldStorage.removeItem(key);
    },
  };
}
usePullRequestNumbersBucket.key = "pr-number";
usePullRequestNumbersBucket.base = joinKeys(
  useBucket.base,
  usePullRequestNumbersBucket.key,
);

export function useDebugBucket(event: Event) {
  const storage = useBucket(event);
  return prefixStorage<WebhookDebugData>(storage, useDebugBucket.key);
}

useDebugBucket.key = "debug";
useDebugBucket.base = joinKeys(useBucket.base, useDebugBucket.key);

export async function getRepoReleaseCount(
  event: Event,
  owner: string,
  repo: string,
): Promise<number> {
  try {
    const binding = useBinding(event);
    const prefix = `${usePackagesBucket.base}:${owner}:${repo}:`;

    const uniqueCommitShas = new Set<string>();
    let cursor: string | undefined;

    do {
      const response = await binding.list({
        cursor,
        limit: 1000,
        prefix,
      } as any);

      for (const { key } of response.objects) {
        if (!key.startsWith(prefix)) continue;

        const trimmedKey = key.slice(prefix.length);
        const [sha] = trimmedKey.split(":");
        if (sha) uniqueCommitShas.add(sha);
      }

      cursor = response.truncated ? response.cursor : undefined;
    } while (cursor);

    return uniqueCommitShas.size;
  } catch (error) {
    console.error(`Error counting releases for ${owner}/${repo}:`, error);
    return 0;
  }
}
