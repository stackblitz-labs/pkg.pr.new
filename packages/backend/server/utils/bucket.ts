import type { R2Bucket } from "@cloudflare/workers-types";
import { prefixStorage, createStorage } from "unstorage";
import cloudflareR2BindingDriver from "unstorage/drivers/cloudflare-r2-binding";
import { WorkflowData, Cursor } from "../types";
import type { H3Event } from "h3";

type Binary = Parameters<R2Bucket["put"]>[1];

export function useBucket(event: H3Event) {
  return createStorage<Binary>({
    driver: cloudflareR2BindingDriver({
      base: "bucket",
      // @ts-ignore TODO(upstream): fix type mismatch
      binding: event.context.cloudflare.env.CR_BUCKET,
    }),
  });
}

export function useWorkflowsBucket(event: H3Event) {
  const storage = useBucket(event);
  return prefixStorage<WorkflowData>(storage, "workflow");
}

export function usePackagesBucket(event: H3Event) {
  const storage = useBucket(event);
  return prefixStorage<ArrayBuffer>(storage, "package");
}

export function useCursorsBucket(event: H3Event) {
  const storage = useBucket(event);
  return prefixStorage<Cursor>(storage, "cursor");
}

export function useCheckRunsBucket(event: H3Event) {
  const storage = useBucket(event);
  return prefixStorage<number>(storage, "check-run");
}

export function usePullRequestCommentsBucket(event: H3Event) {
  const storage = useBucket(event);
  return prefixStorage<number>(storage, "pr-comment");
}
