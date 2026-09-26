import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router'
import { LinksProvider } from '@nafuda/ui/components.tsx'
import { Shell } from '@nafuda/ui/Shell.tsx'
import { COLLECTOR_URL, useConsole } from './console.tsx'
import { IntakePage } from './pages/Intake.tsx'
import { IssuePage } from './pages/Issue.tsx'
import { GraderBar } from './components/GraderBar.tsx'

// Heavy pages (React Flow, charts) load on demand.
const DashboardPage = lazy(() => import('./pages/Dashboard.tsx').then((m) => ({ default: m.DashboardPage })))
const NetworkPage = lazy(() => import('./pages/Network.tsx').then((m) => ({ default: m.NetworkPage })))
const TrustPage = lazy(() => import('./pages/Trust.tsx').then((m) => ({ default: m.TrustPage })))
const IssuedPage = lazy(() => import('./pages/Issued.tsx').then((m) => ({ default: m.IssuedPage })))
const JoinPage = lazy(() => import('./pages/Join.tsx').then((m) => ({ default: m.JoinPage })))

const links = {
  collector: (a: string) => `${COLLECTOR_URL}/collector/${a}`,
  title: (g: string, c: string) => `${COLLECTOR_URL}/title/${g}/${c}`,
  grader: (l: string) => `${COLLECTOR_URL}/graders/${l}`,
  internal: false,
}

export function App() {
  const { grader } = useConsole()
  return (
    <LinksProvider value={links}>
      <Shell
        brand={
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: grader.color }} />
            Grader Console
          </span>
        }
        tagline="Issue and track Nafuda slab titles"
        nav={[
          { to: '/', label: 'Dashboard', end: true },
          { to: '/intake', label: 'Intake' },
          { to: '/issue', label: 'Issue' },
          { to: '/issued', label: 'Issued titles' },
          { to: '/trust', label: 'Trust' },
          { to: '/network', label: 'Name tree' },
          { to: '/join', label: 'Join as a grader' },
        ]}
        cross={{ href: COLLECTOR_URL, label: 'Collector app ↗' }}
        walletLabel="Connect grader wallet"
        witnessHref={`${COLLECTOR_URL}/witness`}
      >
        <GraderBar />
        <Suspense fallback={<div className="skeleton mt-8 h-96" />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/intake" element={<IntakePage />} />
          <Route path="/issue" element={<IssuePage />} />
          <Route path="/issued" element={<IssuedPage />} />
          <Route path="/trust" element={<TrustPage />} />
          <Route path="/network" element={<NetworkPage />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="*" element={<DashboardPage />} />
        </Routes>
        </Suspense>
      </Shell>
    </LinksProvider>
  )
}
