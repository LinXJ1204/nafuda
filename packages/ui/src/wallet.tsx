// Injected wallet (MetaMask and friends) as React state. No wagmi: this app only needs an
// injected EIP-1193 provider, so viem's wallet client over it is enough. Wallets announce
// themselves with EIP-6963; window.ethereum is the fallback.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createWalletClient, custom, getAddress, type Address, type EIP1193Provider, type WalletClient } from 'viem'
import { sepolia } from 'viem/chains'

type Announced = { info: { uuid: string; name: string; icon: string; rdns: string }; provider: EIP1193Provider }

type WalletState = {
  account: Address | null
  providers: Announced[]
  connecting: boolean
  error: string | null
  connect: (rdns?: string) => Promise<Address>
  disconnect: () => void
  /// A wallet client on Sepolia for the connected account (switches chain if needed).
  client: () => Promise<{ wallet: WalletClient; account: Address }>
}

const Ctx = createContext<WalletState | null>(null)
const STORAGE_KEY = 'nafuda.wallet'

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}
function writeStored(v: string | null) {
  try {
    if (v) localStorage.setItem(STORAGE_KEY, v)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage unavailable: the connection just is not remembered
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [providers, setProviders] = useState<Announced[]>([])
  const [provider, setProvider] = useState<EIP1193Provider | null>(null)
  const [account, setAccount] = useState<Address | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // EIP-6963 discovery
  useEffect(() => {
    const onAnnounce = (e: Event) => {
      const detail = (e as CustomEvent<Announced>).detail
      setProviders((list) => (list.some((p) => p.info.uuid === detail.info.uuid) ? list : [...list, detail]))
    }
    window.addEventListener('eip6963:announceProvider', onAnnounce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    return () => window.removeEventListener('eip6963:announceProvider', onAnnounce)
  }, [])

  const pick = useCallback(
    (rdns?: string | null): EIP1193Provider | null => {
      const announced = providers.find((p) => p.info.rdns === rdns) ?? providers[0]
      return announced?.provider ?? (window as unknown as { ethereum?: EIP1193Provider }).ethereum ?? null
    },
    [providers],
  )

  // Restore a previous connection silently (eth_accounts never prompts)
  useEffect(() => {
    const stored = readStored()
    if (stored === null || account) return
    const p = pick(stored)
    if (!p) return
    p.request({ method: 'eth_accounts' })
      .then((accounts) => {
        if ((accounts as string[])[0]) {
          setProvider(p)
          setAccount(getAddress((accounts as string[])[0]))
        }
      })
      .catch(() => undefined)
  }, [pick, account])

  useEffect(() => {
    if (!provider?.on) return
    const onAccounts = (accounts: string[]) => setAccount(accounts[0] ? getAddress(accounts[0]) : null)
    provider.on('accountsChanged', onAccounts as never)
    return () => provider.removeListener?.('accountsChanged', onAccounts as never)
  }, [provider])

  const connect = useCallback(
    async (rdns?: string) => {
      const p = pick(rdns)
      if (!p) throw new Error('No browser wallet found. Install MetaMask to connect.')
      setConnecting(true)
      setError(null)
      try {
        const accounts = (await p.request({ method: 'eth_requestAccounts' })) as string[]
        const a = getAddress(accounts[0])
        setProvider(p)
        setAccount(a)
        writeStored(rdns ?? providers[0]?.info.rdns ?? 'injected')
        return a
      } catch (e) {
        setError((e as Error).message.split('\n')[0])
        throw e
      } finally {
        setConnecting(false)
      }
    },
    [pick, providers],
  )

  const disconnect = useCallback(() => {
    setAccount(null)
    writeStored(null)
  }, [])

  const client = useCallback(async () => {
    const p = provider ?? pick(readStored())
    if (!p) throw new Error('No browser wallet found.')
    const wallet = createWalletClient({ chain: sepolia, transport: custom(p) })
    const [a] = await wallet.requestAddresses()
    if ((await wallet.getChainId()) !== sepolia.id) await wallet.switchChain({ id: sepolia.id })
    setAccount(a)
    return { wallet, account: a }
  }, [provider, pick])

  const value = useMemo(() => ({ account, providers, connecting, error, connect, disconnect, client }), [account, providers, connecting, error, connect, disconnect, client])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWallet(): WalletState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useWallet outside WalletProvider')
  return v
}
