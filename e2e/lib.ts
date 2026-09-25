// End-to-end helpers: a real Chrome (puppeteer-core) and, when a key is given, a wallet that the
// page sees as window.ethereum but that signs in Node with that key (personal_sign, EIP-712,
// transactions on Sepolia). Nothing here touches MetaMask.

import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { createPublicClient, createWalletClient, fallback, http, type Hex } from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

export const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export const COLLECTOR = process.env.COLLECTOR_URL ?? 'https://nafuda.sololin.xyz'
export const GRADER = process.env.GRADER_URL ?? 'https://nafuda-grader.sololin.xyz'
const RPC = fallback([http(process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com'), http('https://ethereum-sepolia-rpc.publicnode.com')])
export const chain = createPublicClient({ chain: sepolia, transport: RPC })

let failed = 0
export function check(ok: boolean, label: string, detail = '') {
  if (!ok) failed++
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? `  (${detail})` : ''}`)
}
export function done(): never {
  console.log(failed ? `\n${failed} failed` : '\nall passed')
  process.exit(failed ? 1 : 0)
}

export async function launch(): Promise<Browser> {
  const extra = process.env.CHROME_ARGS ? [process.env.CHROME_ARGS] : []
  return puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', ...extra] })
}

export type Opened = { page: Page; errors: string[] }

/// A page, optionally with a wallet that signs with `key`.
export async function open(browser: Browser, url: string, key?: Hex): Promise<Opened> {
  const page = await browser.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${(e as Error).message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200))
  })
  await page.setViewport({ width: 1280, height: 900 })
  if (key) await attachWallet(page, privateKeyToAccount(key))
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 })
  return { page, errors }
}

async function attachWallet(page: Page, account: PrivateKeyAccount) {
  const wallet = createWalletClient({ account, chain: sepolia, transport: RPC })
  await page.exposeFunction('__nafudaWallet', async (method: string, params: unknown[] = []) => {
    switch (method) {
      case 'eth_requestAccounts':
      case 'eth_accounts':
        return [account.address]
      case 'eth_chainId':
        return '0xaa36a7'
      case 'wallet_switchEthereumChain':
        return null
      case 'personal_sign':
        return account.signMessage({ message: { raw: params[0] as Hex } })
      case 'eth_signTypedData_v4': {
        const { domain, types, primaryType, message } = JSON.parse(params[1] as string)
        delete types.EIP712Domain
        return account.signTypedData({ domain, types, primaryType, message })
      }
      case 'eth_sendTransaction': {
        const tx = params[0] as { to: Hex; data?: Hex; value?: Hex; gas?: Hex }
        return wallet.sendTransaction({ to: tx.to, data: tx.data, value: tx.value ? BigInt(tx.value) : undefined })
      }
      default:
        return chain.request({ method: method as never, params: params as never })
    }
  })
  await page.evaluateOnNewDocument(() => {
    const call = (window as unknown as { __nafudaWallet: (m: string, p?: unknown[]) => Promise<unknown> }).__nafudaWallet
    ;(window as unknown as { ethereum: unknown }).ethereum = {
      on() {},
      removeListener() {},
      request: ({ method, params }: { method: string; params?: unknown[] }) => call(method, params),
    }
  })
}

export async function text(page: Page, selector = 'body') {
  return page.$eval(selector, (e) => e.textContent ?? '').catch(() => '')
}

export async function waitFor(page: Page, re: RegExp, timeout = 30_000, selector = 'body') {
  await page.waitForFunction((sel, src) => new RegExp(src).test(document.querySelector(sel)?.textContent ?? ''), { timeout, polling: 500 }, selector, re.source)
}

export async function clickText(page: Page, re: RegExp, tag = 'button') {
  const ok = await page.evaluate(
    (t, src) => {
      const el = [...document.querySelectorAll(t)].find((e) => new RegExp(src).test(e.textContent ?? '') && !(e as HTMLButtonElement).disabled)
      if (el) (el as HTMLElement).click()
      return !!el
    },
    tag,
    re.source,
  )
  if (!ok) throw new Error(`no ${tag} matching ${re}`)
}
