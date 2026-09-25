// Hash routes for both pages. Hash routing needs no server rewrites, so the same build works
// on nginx, Cloudflare Workers static assets, or any file host. Pure; covered by routes.test.ts.
//
//   consumer (/)          #/  #/title/<cert>  #/holder/<address>  #/me
//   grader   (/grader/)   #/issue  #/issued  #/trust

import { getAddress, isAddress, type Address } from 'viem'

export function segments(hash: string): string[] {
  return hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s)
      } catch {
        return s
      }
    })
}

export type ConsumerRoute =
  | { view: 'explore' }
  | { view: 'title'; cert: string }
  | { view: 'holder'; address: Address }
  | { view: 'me' }
  | { view: 'not-found' }

/// A cert that is not canonical still routes to the title page, which explains the rule.
export function consumerRoute(hash: string): ConsumerRoute {
  const [head, arg, ...rest] = segments(hash)
  if (rest.length) return { view: 'not-found' }
  if (!head) return { view: 'explore' }
  if (head === 'title' && arg) return { view: 'title', cert: arg }
  if (head === 'holder' && arg && isAddress(arg)) return { view: 'holder', address: getAddress(arg) }
  if (head === 'me' && !arg) return { view: 'me' }
  return { view: 'not-found' }
}

export const GRADER_VIEWS = ['issue', 'issued', 'trust'] as const
export type GraderRoute = { view: (typeof GRADER_VIEWS)[number] } | { view: 'not-found' }

export function graderRoute(hash: string): GraderRoute {
  const [head, ...rest] = segments(hash)
  if (!head) return { view: 'issue' }
  const view = GRADER_VIEWS.find((v) => v === head)
  return view && !rest.length ? { view } : { view: 'not-found' }
}

export const titleHash = (cert: string) => `#/title/${encodeURIComponent(cert)}`
export const holderHash = (address: Address) => `#/holder/${address}`
