import { R2Bucket } from "@cloudflare/workers-types";

type Binary = Parameters<R2Bucket["put"]>[1];

export function useBucket() {
  return useStorage<Binary>("bucket");
}
