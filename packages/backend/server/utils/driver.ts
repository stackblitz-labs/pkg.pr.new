// copied from https://github.com/unjs/unstorage/blob/main/src/drivers/cloudflare-r2-binding.ts

/// <reference types="@cloudflare/workers-types" />

import { defineDriver, joinKeys } from "unstorage";

export interface CloudflareR2Options {
  binding?: string | R2Bucket;
  base?: string;
}

export function createUnstorageError(
  driver: string,
  message: string,
  opts?: ErrorOptions,
) {
  const err = new Error(`[unstorage] [${driver}] ${message}`, opts);
  return err;
}

export function getBinding(binding: KVNamespace | R2Bucket | string) {
  let bindingName = "[binding]";

  if (typeof binding === "string") {
    bindingName = binding;
    binding = ((globalThis as any)[bindingName] ||
      (globalThis as any).__env__?.[bindingName]) as KVNamespace | R2Bucket;
  }

  if (!binding) {
    throw createUnstorageError(
      "cloudflare",
      `Invalid binding \`${bindingName}\`: \`${binding}\``,
    );
  }

  for (const key of ["get", "put", "delete"]) {
    if (!(key in binding)) {
      throw createUnstorageError(
        "cloudflare",
        `Invalid binding \`${bindingName}\`: \`${key}\` key is missing`,
      );
    }
  }

  return binding;
}

export function getR2Binding(binding: R2Bucket | string = "BUCKET") {
  return getBinding(binding) as R2Bucket;
}

type TransactionOptions = Record<string, any>;

type MaybePromise<T> = T | Promise<T>;

declare module "unstorage" {
  interface Driver {
    getItemStream?: (
      key: string,
      opts: TransactionOptions,
    ) => MaybePromise<ReadableStream | undefined>;
    setItemStream?: (
      key: string,
      value: ReadableStream,
      opts: TransactionOptions,
    ) => MaybePromise<void>;
  }
  interface Storage<T> {
    getItemStream: <U extends T>(
      key: string,
      opts?: TransactionOptions,
    ) => MaybePromise<ReadableStream<U> | undefined>;
    setItemStream: <U extends T>(
      key: string,
      value: ReadableStream<U>,
      opts?: TransactionOptions,
    ) => MaybePromise<void>;
  }
}

// https://developers.cloudflare.com/r2/api/workers/workers-api-reference/

const DRIVER_NAME = "cloudflare-r2-binding";

export default defineDriver((opts: CloudflareR2Options = {}) => {
  const r = (key: string = "") => (opts.base ? joinKeys(opts.base, key) : key);

  const getKeys = async (base?: string) => {
    const binding = getR2Binding(opts.binding);
    const kvList = await binding.list(
      base || opts.base ? { prefix: r(base) } : undefined,
    );
    return kvList.objects.map((obj) => obj.key);
  };

  return {
    name: DRIVER_NAME,
    options: opts,
    getInstance: () => getR2Binding(opts.binding),
    async hasItem(key) {
      key = r(key);
      const binding = getR2Binding(opts.binding);
      return (await binding.head(key)) !== null;
    },
    async getMeta(key) {
      key = r(key);
      const binding = getR2Binding(opts.binding);
      const obj = await binding.head(key);
      if (!obj) return null;
      return {
        mtime: obj.uploaded,
        atime: obj.uploaded,
        ...obj,
      };
    },
    getItem(key, topts) {
      key = r(key);
      const binding = getR2Binding(opts.binding);
      return binding.get(key, topts).then((r) => r?.text());
    },
    getItemRaw(key, topts) {
      key = r(key);
      const binding = getR2Binding(opts.binding);
      return binding.get(key, topts).then((r) => r?.arrayBuffer());
    },
    getItemStream(key, topts) {
      key = r(key);
      const binding = getR2Binding(opts.binding);
      return binding.get(key, topts as R2GetOptions).then((r) => r?.body);
    },
    async setItem(key, value, topts) {
      key = r(key);
      const binding = getR2Binding(opts.binding);
      await binding.put(key, value, topts);
    },
    async setItemRaw(key, value, topts) {
      key = r(key);
      const binding = getR2Binding(opts.binding);
      await binding.put(key, value, topts);
    },
    async setItemStream(key, value: ReadableStream, topts) {
      key = r(key);
      const binding = getR2Binding(opts.binding);
      await binding.put(key, value, topts);
    },
    async removeItem(key) {
      key = r(key);
      const binding = getR2Binding(opts.binding);
      await binding.delete(key);
    },
    getKeys(base) {
      return getKeys(base).then((keys) =>
        opts.base ? keys.map((key) => key.slice(opts.base!.length)) : keys,
      );
    },
    async clear(base) {
      const binding = getR2Binding(opts.binding);
      const keys = await getKeys(base);
      await binding.delete(keys);
    },
  };
});
