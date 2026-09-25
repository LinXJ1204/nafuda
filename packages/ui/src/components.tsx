// Small shared building blocks (Tailwind classes over the theme tokens in theme.css).

import { createContext, useContext, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router'
import { graderByLabel } from '@nafuda/core/deployment.ts'
import { paletteOf } from '@nafuda/core/slab.ts'
import { formatTime, nameOf, scan, short, timeAgo } from './format.ts'

////////////////////////////////////////////////////////////////////////
// Where links go: each app decides (the grader console links into the collector app)
////////////////////////////////////////////////////////////////////////

export type Links = {
  collector: (address: string) => string
  title: (grader: string, cert: string) => string
  grader: (label: string) => string
  /// true: use react-router <Link>; false: plain <a> (another origin)
  internal: boolean
}
const LinksCtx = createContext<Links>({
  collector: (a) => `/collector/${a}`,
  title: (g, c) => `/title/${g}/${c}`,
  grader: (l) => `/graders/${l}`,
  internal: true,
})
export const LinksProvider = LinksCtx.Provider
export const useLinks = () => useContext(LinksCtx)

export function AppLink({ to, className, children, title }: { to: string; className?: string; children: ReactNode; title?: string }) {
  const { internal } = useLinks()
  return internal ? (
    <Link to={to} className={className} title={title}>
      {children}
    </Link>
  ) : (
    <a href={to} className={className} title={title}>
      {children}
    </a>
  )
}

export function ExtLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`underline decoration-line underline-offset-2 hover:decoration-ink ${className}`}>
      {children}
    </a>
  )
}

////////////////////////////////////////////////////////////////////////
// People, graders, transactions
////////////////////////////////////////////////////////////////////////

export function Avatar({ address, size = 24 }: { address: string; size?: number }) {
  const { hue, hue2 } = paletteOf(address.toLowerCase())
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full ring-1 ring-black/10"
      style={{ width: size, height: size, background: `conic-gradient(from ${hue}deg, hsl(${hue} 65% 55%), hsl(${hue2} 65% 45%), hsl(${hue} 65% 55%))` }}
    />
  )
}

/// A collector: avatar + name (or short address), linking to their profile.
export function Addr({ address, avatar = true, className = '' }: { address: string | null | undefined; avatar?: boolean; className?: string }) {
  const links = useLinks()
  if (!address) return <span className="text-muted">—</span>
  const name = nameOf(address)
  return (
    <AppLink to={links.collector(address)} title={address} className={`inline-flex items-center gap-1.5 font-medium hover:text-accent ${className}`}>
      {avatar && <Avatar address={address} size={18} />}
      <span className={name ? '' : 'font-mono text-[13px]'}>{name ?? short(address)}</span>
    </AppLink>
  )
}

export function TxLink({ hash, label }: { hash: string; label?: string }) {
  return (
    <ExtLink href={scan('tx', hash)} className="font-mono text-[12px] text-muted">
      {label ?? short(hash)}
    </ExtLink>
  )
}

export function AddressLink({ address }: { address: string }) {
  return (
    <ExtLink href={scan('address', address)} className="font-mono text-[12px]">
      {short(address)}
    </ExtLink>
  )
}

export function GraderBadge({ label, size = 'sm' }: { label: string; size?: 'sm' | 'md' }) {
  const g = graderByLabel(label)
  const links = useLinks()
  return (
    <AppLink
      to={links.grader(label)}
      className={`inline-flex items-center gap-1 rounded-full border font-bold tracking-wide ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'}`}
    >
      <span className="size-2 rounded-full" style={{ background: g?.color }} />
      <span style={{ color: g?.color }}>{g?.short ?? label}</span>
    </AppLink>
  )
}

export function TimeAgo({ date }: { date: string | Date | null | undefined }) {
  return (
    <time title={formatTime(date)} dateTime={date ? new Date(date).toISOString() : undefined} className="whitespace-nowrap">
      {timeAgo(date)}
    </time>
  )
}

////////////////////////////////////////////////////////////////////////
// Layout pieces
////////////////////////////////////////////////////////////////////////

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card ${className}`}>{children}</div>
}

export function Section({ title, sub, action, children, className = '' }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-10 ${className}`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Stat({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-3">
      <div className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">{children}</div>
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-bad/40 bg-bad/5 px-4 py-3 text-sm text-bad">{children}</div>
}

export function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: 'ok' | 'warn' | 'bad' | 'muted' | 'accent' }) {
  const tones = {
    ok: 'text-ok border-ok/40 bg-ok/10',
    warn: 'text-warn border-warn/40 bg-warn/10',
    bad: 'text-bad border-bad/40 bg-bad/10',
    muted: 'text-muted border-line bg-raised',
    accent: 'text-accent border-accent/40 bg-accent/10',
  }
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-wide ${tones[tone]}`}>{children}</span>
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; size?: 'sm' | 'md' | 'lg' }
export function Button({ variant = 'secondary', size = 'md', className = '', ...rest }: ButtonProps) {
  const variants = {
    primary: 'bg-accent text-on-accent border-accent hover:brightness-110',
    secondary: 'bg-card text-ink border-line hover:border-ink',
    ghost: 'bg-transparent text-muted border-transparent hover:text-ink hover:bg-raised',
  }
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-2 text-sm', lg: 'px-5 py-3 text-base' }
  return (
    <button
      {...rest}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    />
  )
}

export function Seal({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-lg bg-shu font-serif font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      名札
    </span>
  )
}
