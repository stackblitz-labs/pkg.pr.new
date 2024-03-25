import { R2Bucket } from "@cloudflare/workers-types";
import {prefixStorage} from 'unstorage'
import { WorkflowData } from "../types";

type Binary = Parameters<R2Bucket["put"]>[1];

export function useBucket() {
  return useStorage<Binary>("bucket");
}

export function useWorkflowsBucket() {
  const storage = useBucket()
  return prefixStorage<WorkflowData>(storage, 'workflows')
}

export function usePackagesBucket() {
  const storage = useBucket()
  return prefixStorage<ArrayBuffer>(storage, 'packages')
}
