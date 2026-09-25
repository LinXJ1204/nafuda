import { Navigate, Route, Routes } from 'react-router'
import { Shell } from '@nafuda/ui/Shell.tsx'
import { useWallet } from '@nafuda/ui/wallet.tsx'
import { ActivityPage } from './pages/Activity.tsx'
import { CollectorPage } from './pages/Collector.tsx'
import { CollectorsPage } from './pages/Collectors.tsx'
import { DevelopersPage } from './pages/Developers.tsx'
import { ExplorePage } from './pages/Explore.tsx'
import { GraderPage } from './pages/Grader.tsx'
import { GradersPage } from './pages/Graders.tsx'
import { HomePage } from './pages/Home.tsx'
import { MarketMapPage } from './pages/MarketMap.tsx'
import { NotFound } from './pages/NotFound.tsx'
import { SubmitPage } from './pages/Submit.tsx'
import { TitlePage } from './pages/Title.tsx'
import { VerifyStart } from './pages/VerifyStart.tsx'

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
        { to: '/map', label: 'Map' },
        { to: '/submit', label: 'Submit' },
        { to: '/me', label: 'My titles' },
      ]}
      cross={{ href: GRADER_CONSOLE_URL, label: 'Grader console ↗' }}
    >
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
        <Route path="/developers" element={<DevelopersPage />} />
        <Route path="/submit" element={<SubmitPage />} />
        <Route path="/me" element={<Me />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Shell>
  )
}
