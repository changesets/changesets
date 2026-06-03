// based on https://github.com/pnpm/pnpm/blob/2b788d53fd66f9e3798f7b629f110ccb5e0ea831/config/reader/src/concurrency.ts
import os from 'node:os'

const MAX_DEFAULT_WORKSPACE_CONCURRENCY = 4

let availableParallelism: number | undefined

function getAvailableParallelism () {
    return availableParallelism ??= Math.max(1, os.availableParallelism())

}

export function getDefaultWorkspaceConcurrency () {
  return Math.min(MAX_DEFAULT_WORKSPACE_CONCURRENCY, getAvailableParallelism())
}
