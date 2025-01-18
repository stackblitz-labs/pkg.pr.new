import { prefixStorage, createStorage, joinKeys } from "unstorage";
import cloudflareR2BindingDriver from "unstorage/drivers/cloudflare-r2-binding";
import { getR2Binding } from "unstorage/drivers/utils/cloudflare";
import { WorkflowData, Cursor } from "../types";
import type { H3EventContext } from "h3";

type Binary = Parameters<R2Bucket["put"]>[1];
type Event = { context: { cloudflare: H3EventContext["cloudflare"] } };

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

  return createStorage<Binary>({
    driver: cloudflareR2BindingDriver({
      base: useBucket.key,
      // @ts-ignore TODO(upstream): fix type mismatch
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

export function usePullRequestNumbersBucket(event: Event) {
  const storage = useBucket(event);
  // TODO: this is a huge mistake, we should use usePullRequestNumbersBucket.key instead of useDownloadedAtBucket.key
  return prefixStorage<number>(storage, useDownloadedAtBucket.key);
}
usePullRequestNumbersBucket.key = "pr-number";
usePullRequestNumbersBucket.base = joinKeys(
  useBucket.base,
  usePullRequestNumbersBucket.key,
);
