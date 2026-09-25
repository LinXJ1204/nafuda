import { useState } from 'react'
import { useNavigate } from 'react-router'
import { GRADERS } from '@nafuda/core/deployment.ts'
import { useTitles } from '@nafuda/ui/api.ts'
import { Button, Card } from '@nafuda/ui/components.tsx'
import { SlabArt } from '@nafuda/ui/SlabArt.tsx'

export function VerifyStart() {
  const navigate = useNavigate()
  const [grader, setGrader] = useState(GRADERS[0]?.label ?? 'psa-sim')
  const [cert, setCert] = useState('')
  const sample = useTitles({ sort: 'traded', limit: 4 })
  const go = (g: string, c: string) => navigate(`/title/${g}/${c}#verify`)

  return (
    <>
      <div className="mx-auto mt-10 max-w-3xl text-center">
        <h1 className="font-serif text-4xl font-semibold">Check a slab</h1>
        <p className="mt-3 text-muted">
          Read the grader and cert number off the label. Nafuda looks the title up on ENS, lets you tap the slab's chip, and checks the seller against
          the holder.
        </p>
      </div>
      <Card className="mx-auto mt-8 max-w-3xl p-6">
        <div className="grid gap-3 md:grid-cols-[auto_1fr_auto]">
          <select value={grader} onChange={(e) => setGrader(e.target.value)} className="rounded-xl border border-line bg-paper px-3 py-2.5">
            {GRADERS.map((g) => (
              <option key={g.label} value={g.label}>
                {g.short}
              </option>
            ))}
          </select>
          <input
            value={cert}
            onChange={(e) => setCert(e.target.value.trim())}
            onKeyDown={(e) => e.key === 'Enter' && cert && go(grader, cert)}
            placeholder="Cert number on the label"
            inputMode="numeric"
            className="rounded-xl border border-line bg-paper px-3 py-2.5 font-mono outline-none focus:border-accent"
          />
          <Button variant="primary" size="lg" disabled={!cert} onClick={() => go(grader, cert)}>
            Look up
          </Button>
        </div>
        <div className="mt-6 grid gap-3 text-sm md:grid-cols-3">
          {[
            ['1', 'Is there a title?', 'The name <cert>.<grader>.nafuda.eth must exist on ENS. No title: Nafuda cannot tell.'],
            ['2', 'Is it the sealed slab?', "The chip signs a fresh challenge; the signer must be slab.chip on ENS. A clone's chip can't."],
            ['3', 'Is the seller the owner?', 'The name must resolve to the seller. If not, ask for the transfer first, or walk away.'],
          ].map(([n, h, b]) => (
            <div key={n} className="rounded-xl border border-line bg-raised p-3">
              <div className="font-bold">
                <span className="text-accent">{n}</span> {h}
              </div>
              <p className="mt-1 text-xs text-muted">{b}</p>
            </div>
          ))}
        </div>
      </Card>
      <div className="mx-auto mt-10 max-w-3xl">
        <p className="mb-3 text-sm text-muted">Or pick a slab from the demo:</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {sample.data?.items.map((t) => (
            <button key={`${t.grader}:${t.cert}`} onClick={() => go(t.grader, t.cert)} className="cursor-pointer rounded-2xl border border-line bg-card p-3 transition hover:border-accent">
              <SlabArt grader={t.grader} cert={t.cert} card={t.card} grade={t.grade} attributes={t.attributes} />
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
