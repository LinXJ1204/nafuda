// Charts (Recharts). Colors come from the theme's CSS variables.

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { compactJpy, formatTime, jpy } from '@nafuda/ui/format.ts'

const axis = { stroke: 'var(--faint)', fontSize: 11, tickLine: false, axisLine: false }
const tooltip = { contentStyle: { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }, labelStyle: { color: 'var(--muted)' } }
const hourLabel = (h: string) => new Date(h).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true, month: 'short', day: 'numeric' } as Intl.DateTimeFormatOptions)

export function ActivityChart({ data }: { data: { hour: string; issued: number; transfers: number }[] }) {
  return (
    <div className="h-56">
      <div className="mb-2 flex gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-accent" /> Issued</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-ink" /> Transfers</span>
        <span className="ml-auto">per hour</span>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="hour" tickFormatter={hourLabel} {...axis} />
          <YAxis allowDecimals={false} width={28} {...axis} />
          <Tooltip labelFormatter={(h) => formatTime(h as string)} {...tooltip} />
          <Bar dataKey="issued" stackId="a" fill="var(--accent)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="transfers" stackId="a" fill="var(--ink)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function GradeChart({ data, color }: { data: { grade: string; n: number }[]; color: string }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <XAxis type="number" allowDecimals={false} {...axis} />
          <YAxis type="category" dataKey="grade" width={110} {...axis} />
          <Tooltip {...tooltip} />
          <Bar dataKey="n" name="titles" radius={[0, 6, 6, 0]}>
            {data.map((d) => (
              <Cell key={d.grade} fill={color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PriceChart({ data }: { data: { time: string; priceJpy: number }[] }) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="time" tickFormatter={(t) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} {...axis} />
          <YAxis tickFormatter={(v) => compactJpy(v)} width={52} {...axis} />
          <Tooltip labelFormatter={(t) => formatTime(t as string)} formatter={(v) => [jpy(v as number), 'declared']} {...tooltip} />
          <Line type="monotone" dataKey="priceJpy" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--accent)' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/// Second witness: events per hour as the Nafuda index and Curvegrid MultiBaas each saw them.
export function WitnessChart({ data }: { data: { hour: string; witnessed: number; indexed: number }[] }) {
  return (
    <div className="h-56">
      <div className="mb-2 flex gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-ink" /> Nafuda index</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-ok" /> Curvegrid MultiBaas</span>
        <span className="ml-auto">issuances and transfers per hour</span>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="hour" tickFormatter={hourLabel} {...axis} />
          <YAxis allowDecimals={false} width={28} {...axis} />
          <Tooltip labelFormatter={(h) => formatTime(h as string)} {...tooltip} />
          <Bar dataKey="indexed" name="Nafuda index" fill="var(--ink)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="witnessed" name="Curvegrid" fill="var(--ok)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
