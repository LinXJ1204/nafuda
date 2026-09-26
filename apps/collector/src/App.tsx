import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { Shell } from '@nafuda/ui/Shell.tsx'
import { useWallet } from '@nafuda/ui/wallet.tsx'
import { CollectorPage } from './pages/Collector.tsx'
import { CollectorsPage } from './pages/Collectors.tsx'
import { ExplorePage } from './pages/Explore.tsx'
import { GradersPage } from './pages/Graders.tsx'
import { HomePage } from './pages/Home.tsx'
import { NotFound } from './pages/NotFound.tsx'
import { VerifyStart } from './pages/VerifyStart.tsx'

// Heavy pages (React Flow, charts) load on demand.
const TitlePage = lazy(() => import('./pages/Title.tsx').then((m) => ({ default: m.TitlePage })))
const MarketMapPage = lazy(() => import('./pages/MarketMap.tsx').then((m) => ({ default: m.MarketMapPage })))
const ActivityPage = lazy(() => import('./pages/Activity.tsx').then((m) => ({ default: m.ActivityPage })))
const GraderPage = lazy(() => import('./pages/Grader.tsx').then((m) => ({ default: m.GraderPage })))
const DevelopersPage = lazy(() => import('./pages/Developers.tsx').then((m) => ({ default: m.DevelopersPage })))
const MarketPage = lazy(() => import('./pages/Market.tsx').then((m) => ({ default: m.MarketPage })))
const WitnessPage = lazy(() => import('./pages/Witness.tsx').then((m) => ({ default: m.WitnessPage })))
const SubmitPage = lazy(() => import('./pages/Submit.tsx').then((m) => ({ default: m.SubmitPage })))

export const GRADER_CONSOLE_URL: string = (import.meta.env.VITE_GRADER_URL as string | undefined) || 'https://nafuda-grader.sololin.xyz'

function Me() {
  const { account } = useWallet()
  if (account) return <Navigate to={`/collector/${account}`} replace />
  return <CollectorsPage prompt />
}

export function App() {
  return (
    <Shell
      brand="Nafuda"
      tagline="Every slab wears its name."
      nav={[
        { to: '/explore', label: 'Explore' },
        { to: '/verify', label: 'Check a slab' },
        { to: '/activity', label: 'Activity' },
        { to: '/graders', label: 'Graders' },
        { to: '/collectors', label: 'Collectors' },
        { to: '/market', label: 'Market' },
        { to: '/witness', label: 'Witness' },
        { to: '/submit', label: 'Submit' },
        { to: '/me', label: 'My titles' },
      ]}
      cross={{ href: GRADER_CONSOLE_URL, label: 'Grader console ↗' }}
      witnessHref="/witness"
    >
      <Suspense fallback={<div className="skeleton mt-8 h-96" />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/verify" element={<VerifyStart />} />
        <Route path="/title/:grader/:cert" element={<TitlePage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/graders" element={<GradersPage />} />
        <Route path="/graders/:label" element={<GraderPage />} />
        <Route path="/collectors" element={<CollectorsPage />} />
        <Route path="/collector/:address" element={<CollectorPage />} />
        <Route path="/map" element={<MarketMapPage />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/developers" element={<DevelopersPage />} />
        <Route path="/witness" element={<WitnessPage />} />
        <Route path="/submit" element={<SubmitPage />} />
        <Route path="/me" element={<Me />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </Shell>
  )
}
