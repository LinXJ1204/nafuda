// ABIs used by the apps and the server (human-readable, only what is used).

import { parseAbi, parseAbiItem } from 'viem'

export const titleIssuedEvent = parseAbiItem(
  'event TitleIssued(uint256 indexed labelId, string cert, address indexed holder, address indexed chip, string card, string grade)',
)
export const titleAttributeEvent = parseAbiItem('event TitleAttribute(uint256 indexed labelId, string key, string value)')
export const transferSingleEvent = parseAbiItem(
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
)

export const controllerAbi = parseAbi([
  'function GRADER() view returns (address)',
  'function holderOf(string cert) view returns (address)',
  'function issue(string cert, address holder, address chip, string card, string grade) returns (uint256 tokenId)',
  'function issueWithAttributes(string cert, address holder, address chip, string card, string grade, string[] keys, string[] values) returns (uint256 tokenId)',
  'function attributesOf(string cert) view returns (string[] keys, string[] values)',
  'error NotGrader(address caller)',
  'error InvalidCert(string cert)',
  'error InvalidHolder()',
  'error InvalidChip()',
  'error AlreadyIssued(string cert)',
  'error InvalidAttributes()',
  'error InvalidAttributeKey(string key)',
  'error InvalidAttributeValue(string key)',
])

export const registryAbi = parseAbi([
  'function getTokenId(uint256 anyId) view returns (uint256)',
  'function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes data)',
  'function isEmancipated() view returns (bool)',
  'function roles(uint256 anyId, address account) view returns (uint256)',
  'function hasRootRoles(uint256 roleBitmap, address account) view returns (bool)',
  'function getParent() view returns (address parent, string label)',
  'function getOwner(uint256 anyId) view returns (address)',
  'function getResolver(string label) view returns (address)',
  'function getSubregistry(string label) view returns (address)',
  'function getAssigneeCount(uint256 anyId, uint256 roleBitmap) view returns (uint256 counts, uint256 mask)',
])

/// ENSv2 token ids carry a version in the low 32 bits; the canonical id zeroes them.
export const canonicalId = (id: bigint) => id & ~0xffffffffn
