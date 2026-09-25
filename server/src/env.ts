// Server configuration from the environment.

function required(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`${key} is not set`)
  return v
}

export const env = {
  databaseUrl: () => required('DATABASE_URL'),
  /// Server-side RPC: the key stays on the server, never in a browser bundle.
  rpcUrl: () => process.env.INDEXER_RPC_URL ?? required('SEPOLIA_RPC_URL'),
  port: Number(process.env.PORT ?? 3000),
  confirmations: BigInt(process.env.CONFIRMATIONS ?? 2),
  pollMs: Number(process.env.POLL_MS ?? 6000),
  batchBlocks: BigInt(process.env.BATCH_BLOCKS ?? 1000),
}
