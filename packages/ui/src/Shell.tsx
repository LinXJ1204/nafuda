// Page chrome shared by both apps: header (brand, nav, network, wallet), the demo notice, footer.

import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import { ErrorBoundary } from './ErrorBoundary.tsx'
import { GRADERS, NAFUDA_REGISTRY } from '@nafuda/core/deployment.ts'
import { AddressLink, ExtLink, Seal } from './components.tsx'
import { useStatus } from './api.ts'
import { LangToggle, useT } from './i18n.tsx'
import { WalletButton } from './WalletButton.tsx'

export type NavItem = { to: string; label: string; end?: boolean }

export function Shell({
  brand,
  tagline,
  nav,
  cross,
  walletLabel,
  children,
}: {
  brand: ReactNode
  tagline: string
  nav: NavItem[]
  cross: { href: string; label: string }
  walletLabel?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const { t, lang } = useT()
  const status = useStatus()
  const location = useLocation()
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2.5 no-underline">
            <Seal size={38} />
            <span className="leading-tight">
              <strong className="block text-[17px] whitespace-nowrap">{brand}</strong>
              <small className="hidden text-xs text-muted 2xl:block">{t(tagline)}</small>
            </span>
          </NavLink>
          <nav className={`${open ? 'flex' : 'hidden'} absolute top-full right-0 left-0 flex-col gap-1 border-b border-line bg-card p-3 lg:static lg:flex lg:flex-row lg:border-0 lg:bg-transparent lg:p-0`}>
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap no-underline ${isActive ? 'bg-raised font-semibold text-accent' : 'text-muted hover:bg-raised hover:text-ink'}`
                }
              >
                {t(n.label)}
              </NavLink>
            ))}
            <a href={cross.href} className="rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap text-muted italic no-underline hover:text-ink">
              {t(cross.label)}
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs whitespace-nowrap text-muted xl:inline-flex" title={status.data?.indexedBlock ? `Indexed to block ${status.data.indexedBlock}` : 'Indexer status'}>
              <span className={`size-1.5 rounded-full ${status.isError ? 'bg-bad' : 'bg-ok'}`} />
              Sepolia · ENSv2
            </span>
            <LangToggle />
            <WalletButton label={t(walletLabel ?? 'Connect wallet')} />
            <button className="rounded-lg border border-line px-2 py-1.5 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
              ☰
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4">
        <p className="mt-4 rounded-lg border-l-4 border-shu bg-card px-3 py-2 text-xs text-muted">
          {lang === 'ja' ? t('notice') : <>Demo on Sepolia. <strong>PSA-Sim, BGS-Sim and CGC-Sim</strong> are simulated graders modeled after PSA, Beckett and CGC; they are not affiliated
          with or endorsed by those companies. Slab chips are <strong>simulated</strong> in the browser; in production the grader seals an NFC chip (such as
          Arx HaLo) inside the slab. Cards and collectors are fictional.</>}
        </p>
        <main className="pb-20">
          <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>
        </main>
        <footer className="border-t border-line py-8 text-xs text-muted">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <span>
              Titles: <span className="font-mono">{'<cert>.<grader>.nafuda.eth'}</span> · {GRADERS.length} graders under <AddressLink address={NAFUDA_REGISTRY} />
            </span>
            <span>
              Source: <ExtLink href="https://github.com/LinXJ1204/nafuda">github.com/LinXJ1204/nafuda</ExtLink> · Built at ETHGlobal Tokyo 2026
            </span>
            {status.data?.indexedBlock && <span>Index at block {status.data.indexedBlock}</span>}
          </div>
        </footer>
      </div>
    </div>
  )
}
