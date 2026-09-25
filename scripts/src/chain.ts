// Minimal ABIs for the v3 scripts (seed, market). Human-readable, so these scripts need no
// build artifacts or submodule: they also run on the Mac mini from a plain clone.

import { parseAbi } from 'viem'

export const controllerAbi = parseAbi([
  'function GRADER() view returns (address)',
  'function holderOf(string cert) view returns (address)',
  'function issue(string cert, address holder, address chip, string card, string grade) returns (uint256)',
  'function issueWithAttributes(string cert, address holder, address chip, string card, string grade, string[] keys, string[] values) returns (uint256)',
])

export const registryAbi = parseAbi([
  'function getTokenId(uint256 anyId) view returns (uint256)',
  'function getOwner(uint256 anyId) view returns (address)',
  'function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes data)',
])
