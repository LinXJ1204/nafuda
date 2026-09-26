import { Link } from 'react-router'
import { useActivity, useGraders, useStats, useTitles } from '@nafuda/ui/api.ts'
import { ActivityFeed } from '@nafuda/ui/ActivityFeed.tsx'
import { Button, Section, Skeleton, Stat } from '@nafuda/ui/components.tsx'
import { compactJpy } from '@nafuda/ui/format.ts'
import { SlabArt } from '@nafuda/ui/SlabArt.tsx'
import { TitleGrid } from '@nafuda/ui/TitleCard.tsx'
import { useT } from '@nafuda/ui/i18n.tsx'
import { Lifecycle } from '../components/Lifecycle.tsx'
import { WitnessBanner } from '@nafuda/ui/Witness.tsx'
import { GraderCards } from './Graders.tsx'

export function HomePage() {
  const stats = useStats()
  const recent = useTitles({ sort: 'recent', limit: 10 })
  const activity = useActivity({ limit: 8 })
  const graders = useGraders()
  const hero = recent.data?.items.slice(0, 3) ?? []
  const { t, lang } = useT()

  return (
    <>
      <section className="grid items-center gap-10 py-10 md:grid-cols-[1.2fr_1fr] md:py-16">
        <div>
          <p className="text-sm font-bold tracking-widest text-accent uppercase">{t('ENSv2 titles for graded cards')}</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight font-semibold md:text-6xl">{t('Every slab wears its name.')}</h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            {lang === 'ja'
              ? t('heroLede')
              : 'Cloned slabs copy a real cert number, and the official lookup still says it exists. With Nafuda, the grader seals a chip into each slab and issues its title as an ENS name. Tap the slab to prove it is the one the grader sealed; check the name to see who owns it; transfer the name when you sell it.'}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/verify">
              <Button variant="primary" size="lg">
                {t('Check a slab')}
              </Button>
            </Link>
            <Link to="/explore">
              <Button size="lg">{t('Explore titles')}</Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted">
            {t('No account, no app: any ENS client can read a title.')} <Link to="/developers" className="underline">How →</Link>
          </p>
        </div>
        <div className="relative mx-auto h-[380px] w-full max-w-md">
          {hero.length === 0 && <Skeleton className="absolute inset-x-16 inset-y-0" />}
          {hero.map((t, i) => (
            <Link
              key={`${t.grader}:${t.cert}`}
              to={`/title/${t.grader}/${t.cert}`}
              className="absolute top-0 w-[46%] transition hover:z-20 hover:-translate-y-2"
              style={{ left: `${8 + i * 23}%`, transform: `rotate(${(i - 1) * 7}deg) translateY(${i === 1 ? 0 : 24}px)`, zIndex: i === 1 ? 10 : 1 }}
            >
              <SlabArt grader={t.grader} cert={t.cert} card={t.card} grade={t.grade} attributes={t.attributes} />
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t('Titles')} value={stats.data?.titles ?? '…'} sub={`${graders.data?.length ?? '…'} graders`} />
        <Stat label={t('Collectors')} value={stats.data?.holders ?? '…'} sub="current holders" />
        <Stat label={t('Transfers')} value={stats.data?.transfers ?? '…'} sub="title changed hands" />
        <Stat label={t('Declared volume')} value={stats.data ? compactJpy(stats.data.volumeJpy) : '…'} sub="self-reported by sellers" />
      </div>
      <div className="mt-3">
        <WitnessBanner href="/witness" />
      </div>

      <Section title={t('How a slab title works')} sub={t('From the grading bench to a card show, every step checkable by anyone.')}>
        <Lifecycle />
      </Section>

      <Section title={t('Latest activity')} action={<Link to="/activity" className="text-sm text-muted hover:text-ink">All activity →</Link>}>
        <ActivityFeed items={activity.data} loading={activity.isLoading} compact />
      </Section>

      <Section title={t('Recently active titles')} action={<Link to="/explore" className="text-sm text-muted hover:text-ink">Explore →</Link>}>
        <TitleGrid items={recent.data?.items} loading={recent.isLoading} />
      </Section>

      <Section title={t('Graders')} sub="Each grader runs its own registry under nafuda.eth. None of them can take back a title once issued.">
        <GraderCards />
      </Section>
    </>
  )
}
