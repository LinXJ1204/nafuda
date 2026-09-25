// ABIs for the calls the web app makes (human-readable, only what is used).

import { BaseError, ContractFunctionRevertedError, parseAbi } from 'viem'

export const controllerAbi = parseAbi([
  'function GRADER() view returns (address)',
  'function holderOf(string cert) view returns (address)',
  'function issue(string cert, address holder, address chip, string card, string grade) returns (uint256 tokenId)',
  'error NotGrader(address caller)',
  'error InvalidCert(string cert)',
  'error InvalidHolder()',
  'error InvalidChip()',
  'error AlreadyIssued(string cert)',
])

export const registryAbi = parseAbi([
  'function getTokenId(uint256 anyId) view returns (uint256)',
  'function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes data)',
  'function isEmancipated() view returns (bool)',
  'function roles(uint256 anyId, address account) view returns (uint256)',
  'function hasRootRoles(uint256 roleBitmap, address account) view returns (bool)',
  'function getParent() view returns (address parent, string label)',
  'function getOwner(uint256 anyId) view returns (address)',
])

/// The custom error name of a reverted call (e.g. "AlreadyIssued"), if viem decoded one.
export function revertName(e: unknown): string | null {
  if (!(e instanceof BaseError)) return null
  const revert = e.walk((err) => err instanceof ContractFunctionRevertedError)
  return revert instanceof ContractFunctionRevertedError ? (revert.data?.errorName ?? null) : null
}
