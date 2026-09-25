import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatTime } from '@nafuda/ui/format.ts'

export function IssuedChart({ data, color }: { data: { hour: string; n: number }[]; color: string }) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="hour" tickFormatter={(h) => new Date(h).toLocaleTimeString('en-US', { hour: 'numeric' })} stroke="var(--faint)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} width={24} stroke="var(--faint)" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip labelFormatter={(h) => formatTime(h as string)} contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }} />
          <Bar dataKey="n" name="issued" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
