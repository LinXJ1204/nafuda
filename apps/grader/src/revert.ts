import { BaseError, ContractFunctionRevertedError } from 'viem'

/// The custom error name of a reverted call (e.g. "AlreadyIssued"), if viem decoded one.
export function revertName(e: unknown): string | null {
  if (!(e instanceof BaseError)) return null
  const revert = e.walk((err) => err instanceof ContractFunctionRevertedError)
  return revert instanceof ContractFunctionRevertedError ? (revert.data?.errorName ?? null) : null
}
