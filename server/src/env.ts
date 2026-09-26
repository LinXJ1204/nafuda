// Server configuration from the environment.

function required(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`${key} is not set`)
  return v
}

export const env = {
  databaseUrl: () => required('DATABASE_URL'),
  /// Server-side RPCs, in order. Public endpoints first; the configured (keyed) RPC is the last
  /// resort, so the indexer never burns through a provider's daily quota. The key stays on the
  /// server, never in a browser bundle.
  rpcUrls: () =>
    [
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://sepolia.gateway.tenderly.co',
      'https://rpc.sepolia.ethpandaops.io',
      process.env.INDEXER_RPC_URL ?? process.env.SEPOLIA_RPC_URL,
    ].filter((u): u is string => !!u),
  port: Number(process.env.PORT ?? 3000),
  confirmations: BigInt(process.env.CONFIRMATIONS ?? 2),
  /// one Sepolia block
  pollMs: Number(process.env.POLL_MS ?? 12000),
  batchBlocks: BigInt(process.env.BATCH_BLOCKS ?? 1000),
  /// Signing secret of the MultiBaas webhook (second witness). Unset: the witness is off.
  webhookSecret: () => process.env.MULTIBAAS_WEBHOOK_SECRET || null,
}
