// copied from https://github.com/unjs/unstorage/blob/main/src/drivers/cloudflare-r2-binding.ts

export interface CloudflareR2Options {
  binding?: string | R2Bucket
  base?: string
}

export function createUnstorageError(
  driver: string,
  message: string,
  opts?: ErrorOptions,
) {
  const err = new Error(`[unstorage] [${driver}] ${message}`, opts)
  return err
}

export function getBinding(binding: KVNamespace | R2Bucket | string) {
  let bindingName = '[binding]'

  if (typeof binding === 'string') {
    bindingName = binding
    binding = ((globalThis as any)[bindingName]
      || (globalThis as any).__env__?.[bindingName]) as KVNamespace | R2Bucket
  }

  if (!binding) {
    throw createUnstorageError(
      'cloudflare',
      `Invalid binding \`${bindingName}\`: \`${binding}\``,
    )
  }

  for (const key of ['get', 'put', 'delete']) {
    if (!(key in binding)) {
      throw createUnstorageError(
        'cloudflare',
        `Invalid binding \`${bindingName}\`: \`${key}\` key is missing`,
      )
    }
  }

  return binding
}

export function getR2Binding(binding: R2Bucket | string = 'BUCKET') {
  return getBinding(binding) as R2Bucket
}
