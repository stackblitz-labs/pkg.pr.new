import type { R2Bucket } from "@cloudflare/workers-types";
import { prefixStorage, createStorage, joinKeys } from "unstorage";
import cloudflareR2BindingDriver from "unstorage/drivers/cloudflare-r2-binding";
import { WorkflowData, Cursor } from "../types";
import type { H3Event, H3EventContext } from "h3";

type Binary = Parameters<R2Bucket["put"]>[1];
type Event = { context: { cloudflare: H3EventContext["cloudflare"] } };

export const baseKey = "bucket";

export function useBucket(event: Event) {
  return createStorage<Binary>({
    driver: cloudflareR2BindingDriver({
      base: useBucket.key,
      // @ts-ignore TODO(upstream): fix type mismatch
      binding: event.context.cloudflare.env.CR_BUCKET,
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
  return prefixStorage<ArrayBuffer>(storage, usePackagesBucket.key);
}

usePackagesBucket.key = "package";
usePackagesBucket.base = joinKeys(useBucket.base, usePackagesBucket.key);

export function useCursorsBucket(event: Event) {
  const storage = useBucket(event);
  return prefixStorage<Cursor>(storage, useCursorsBucket.key);
}

useCursorsBucket.key = "cursor";
useCursorsBucket.base = joinKeys(useBucket.base, useCursorsBucket.key);

export function useCheckRunsBucket(event: Event) {
  const storage = useBucket(event);
  return prefixStorage<number>(storage, useCheckRunsBucket.key);
}

useCheckRunsBucket.key = "check-run";
useCheckRunsBucket.base = joinKeys(useBucket.base, useCheckRunsBucket.key);

export function usePullRequestCommentsBucket(event: Event) {
  const storage = useBucket(event);
  return prefixStorage<number>(storage, usePullRequestCommentsBucket.key);
}

usePullRequestCommentsBucket.key = "pr-comment";
usePullRequestCommentsBucket.base = joinKeys(
  useBucket.base,
  usePullRequestCommentsBucket.key
);

export function useDownloadedAtBucket(event: Event) {
  const storage = useBucket(event);
  return prefixStorage<number>(storage, useDownloadedAtBucket.key);
} 

useDownloadedAtBucket.key = "downloaded-at";
useDownloadedAtBucket.base = joinKeys(
  useBucket.base,
  useDownloadedAtBucket.key
);

export function usePullRequestNumbersBucket(event: Event) {
  const storage = useBucket(event);
  return prefixStorage<number>(storage, useDownloadedAtBucket.key);
}
usePullRequestNumbersBucket.key = "pr-number";
usePullRequestNumbersBucket.base = joinKeys(
  useBucket.base,
  usePullRequestNumbersBucket.key
);
