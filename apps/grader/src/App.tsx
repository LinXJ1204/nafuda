import { Route, Routes } from 'react-router'
import { LinksProvider } from '@nafuda/ui/components.tsx'
import { Shell } from '@nafuda/ui/Shell.tsx'
import { COLLECTOR_URL, useConsole } from './console.tsx'
import { DashboardPage } from './pages/Dashboard.tsx'
import { IntakePage } from './pages/Intake.tsx'
import { IssuePage } from './pages/Issue.tsx'
import { IssuedPage } from './pages/Issued.tsx'
import { JoinPage } from './pages/Join.tsx'
import { NetworkPage } from './pages/Network.tsx'
import { TrustPage } from './pages/Trust.tsx'
import { GraderBar } from './components/GraderBar.tsx'

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
      >
        <GraderBar />
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
      </Shell>
    </LinksProvider>
  )
}
