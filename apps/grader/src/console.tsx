// Which grader this console is for: the connected wallet's grader (can issue), or one picked
// from the list to look at (read-only). ?as=<label> selects the read-only view.

import { useSearchParams } from 'react-router'
import { isAddressEqual } from 'viem'
import { GRADERS, type Grader } from '@nafuda/core/deployment.ts'
import { useWallet } from '@nafuda/ui/wallet.tsx'

export const COLLECTOR_URL: string = (import.meta.env.VITE_COLLECTOR_URL as string | undefined) || 'https://nafuda.sololin.xyz'

export function useConsole(): { grader: Grader; canIssue: boolean; connectedGrader: Grader | null; setGrader: (label: string) => void } {
  const { account } = useWallet()
  const [params, setParams] = useSearchParams()
  const connectedGrader = account ? (GRADERS.find((g) => isAddressEqual(g.grader, account)) ?? null) : null
  const picked = GRADERS.find((g) => g.label === params.get('as'))
  const grader = connectedGrader ?? picked ?? GRADERS[0]
  return {
    grader,
    canIssue: !!connectedGrader,
    connectedGrader,
    setGrader: (label) => {
      const next = new URLSearchParams(params)
      next.set('as', label)
      setParams(next, { replace: true })
    },
  }
}
