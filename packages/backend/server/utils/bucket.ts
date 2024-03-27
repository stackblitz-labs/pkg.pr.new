import type { R2Bucket } from "@cloudflare/workers-types";
import { prefixStorage, createStorage } from "unstorage";
import cloudflareR2BindingDriver from "unstorage/drivers/cloudflare-r2-binding";
import { WorkflowData, Cursor } from "../types";
import type { H3Event } from "h3";

type Binary = Parameters<R2Bucket["put"]>[1];

export function useBucket(event: H3Event) {
  console.log(event.context.cloudflare.env)
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
  return prefixStorage<WorkflowData>(storage, "workflows");
}

export function usePackagesBucket(event: H3Event) {
  const storage = useBucket(event);
  return prefixStorage<ArrayBuffer>(storage, "packages");
}

export function useCursorBucket(event: H3Event) {
  const storage = useBucket(event);
  return prefixStorage<Cursor>(storage, "cursor");
}
