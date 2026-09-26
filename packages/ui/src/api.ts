// Client for the Nafuda read API (/api, same origin), with React Query hooks.
// The API is an index of chain events: fast lists, stats and search. Title pages still verify
// the facts through ENS (see ens.ts).

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Grader } from '@nafuda/core/deployment.ts'

export type Title = {
  grader: string
  cert: string
  card: string
  grade: string
  gradeScore: number
  chip: string
  holder: string
  holderName: string | null
  issuedAt: string
  issuedTx: string
  issuedBlock: string
  attributes: Record<string, string>
  transferCount: number
  lastPriceJpy: number | null
  lastTransferAt: string | null
}

export type Transfer = {
  grader: string
  cert: string
  card: string
  grade: string
  from: string | null
  fromName: string | null
  to: string
  toName: string | null
  block: string
  tx: string
  time: string
  priceJpy: number | null
  /// Curvegrid MultiBaas reported this same log (second witness)
  witnessed?: boolean
  /// Curvegrid's copy of the transaction carries the same declared price
  priceWitnessed?: boolean
}
export type Activity = Transfer & { kind: 'issue' | 'transfer' }
export type TitleDetail = Title & { history: Transfer[]; issuedWitnessed?: boolean }
export type GraderSummary = Grader & { titles: number; transfers: number; holders: number; avgGrade: number | null }
export type GraderDetail = Grader & {
  titles: number
  transfers: number
  holders: number
  grades: { grade: string; grade_score: number; n: number }[]
  issuedPerHour: { hour: string; n: number }[]
}
export type Stats = {
  titles: number
  transfers: number
  holders: number
  volumeJpy: number
  priced_transfers: number
  perHour: { hour: string; issued: number; transfers: number; volume: number }[]
  grades: { grader: string; grade: string; grade_score: number; n: number }[]
  topHolders: { holder: string; n: number; name: string | null }[]
}
export type Holder = {
  address: string
  name: string | null
  bio: string | null
  held: Title[]
  past: Title[]
  activity: Activity[]
  stats: { bought: number; sold: number; spentJpy: number; earnedJpy: number }
}
export type Graph = { nodes: { id: string; name: string | null; titles: number }[]; edges: { from: string; to: string; count: number; volumeJpy: number }[] }
export type WitnessSummary = {
  witnessed: number
  agreed: number
  mismatch: number
  missing: number
  pending: number
  regeneration: number
  unwitnessed: number
  reorged: number
  pricesChecked: number
  pricesConfirmed: number
}
export type Status = {
  indexedBlock: string | null
  titles: number
  transfers: number
  graders: number
  witness?: WitnessSummary & { configured: boolean; lastDeliveryAt: string | null }
}
export type WitnessVerdict = 'agreed' | 'mismatch' | 'missing' | 'pending' | 'regeneration'
export type Witness = {
  source: string
  configured: boolean
  deliveries: { count: number; first: string | null; last: string | null }
  refused: Record<string, number>
  summary: WitnessSummary & { fromBlock: string | null; toBlock: string | null }
  byGrader: Record<string, { witnessed: number; agreed: number }>
  recent: {
    grader: string
    cert: string | null
    kind: 'transfer' | 'mint' | 'burn'
    from: string
    fromName: string | null
    to: string
    toName: string | null
    tx: string
    logIndex: number
    batchIndex: number
    block: string
    verdict: WitnessVerdict
    detail: string | null
    triggeredAt: string | null
    priceSeen: boolean
    priceJpy: number | null
  }[]
  unwitnessed: { kind: 'transfer' | 'issue'; grader: string; cert: string; tx: string; block: string }[]
  perHour: { hour: string; witnessed: number; indexed: number }[]
}
export type CollectorRow = { name: string; bio: string; address: string; source: string; titles: number }

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`)
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${path}`)
  return res.json() as Promise<T>
}

const qs = (params: Record<string, string | number | undefined | null>) => {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v))
  const str = s.toString()
  return str ? `?${str}` : ''
}

const live = { refetchInterval: 15_000 }

export const useStatus = () => useQuery({ queryKey: ['status'], queryFn: () => api<Status>('/status'), ...live })
export type Market = {
  totals: { sales: number; median: number; volume: number; confirmed: number; witnessChecked: number }
  byGrade: { grade_score: number; n: number; median: number; min: number; max: number }[]
  byGrader: { grader: string; n: number; median: number; volume: number }[]
  byCategory: { category: string; kind: string | null; titles: number; sales: number; median: number | null }[]
  guide: { card: string; grader: string; grade: string; grade_score: number; n: number; median: number; last: number; last_at: string }[]
  recent: { grader: string; cert: string; card: string; grade: string; priceJpy: number; time: string; tx: string; from: string; to: string; confirmed: boolean }[]
}
export const useMarket = () => useQuery({ queryKey: ['market'], queryFn: () => api<Market>('/market'), ...live })
export type Categories = { items: { category: string; kind: string | null; n: number }[]; unclassified: number }
export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: () => api<Categories>('/categories'), ...live })
export const useWitness = () => useQuery({ queryKey: ['witness'], queryFn: () => api<Witness>('/witness'), ...live })
export const useStats = () => useQuery({ queryKey: ['stats'], queryFn: () => api<Stats>('/stats'), ...live })
export const useGraders = () => useQuery({ queryKey: ['graders'], queryFn: () => api<GraderSummary[]>('/graders'), ...live })
export const useGrader = (label: string) => useQuery({ queryKey: ['grader', label], queryFn: () => api<GraderDetail>(`/graders/${label}`), ...live })
export const useCollectors = () => useQuery({ queryKey: ['collectors'], queryFn: () => api<CollectorRow[]>('/collectors'), ...live })
export const useGraph = () => useQuery({ queryKey: ['graph'], queryFn: () => api<Graph>('/graph'), ...live })

export type TitleQuery = { grader?: string; holder?: string; q?: string; sort?: string; minGrade?: number; limit?: number; offset?: number; forTrade?: number; category?: string }
export const useTitles = (query: TitleQuery) =>
  useQuery({
    queryKey: ['titles', query],
    queryFn: () => api<{ total: number; items: Title[] }>(`/titles${qs(query)}`),
    placeholderData: keepPreviousData,
    ...live,
  })

export const useTitle = (grader: string, cert: string) =>
  useQuery({
    queryKey: ['title', grader, cert],
    queryFn: () => api<TitleDetail>(`/titles/${grader}/${cert}`),
    retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2,
    ...live,
  })

export const useActivity = (query: { grader?: string; type?: string; limit?: number } = {}) =>
  useQuery({ queryKey: ['activity', query], queryFn: () => api<Activity[]>(`/activity${qs(query)}`), placeholderData: keepPreviousData, ...live })

export const useHolder = (address: string | null | undefined) =>
  useQuery({ queryKey: ['holder', address], queryFn: () => api<Holder>(`/holders/${address}`), enabled: !!address, ...live })

////////////////////////////////////////////////////////////////////////
// Signed, off-chain data: trade interest and grading submissions
////////////////////////////////////////////////////////////////////////

export type OfferRow = { id: string; grader: string; cert: string; kind: 'ask' | 'bid'; from: string; priceJpy: number; note: string; expiry: string; createdAt: string; card: string | null; grade: string | null }
export type SubmissionRow = {
  id: string
  grader: string
  submitter: string
  card: string
  declaredValueJpy: number
  service: string
  status: 'received' | 'grading' | 'sealed' | 'issued' | 'rejected'
  grade: string | null
  cert: string | null
  issueTx: string | null
  createdAt: string
  updatedAt: string
}

export const useTitleOffers = (grader: string, cert: string) =>
  useQuery({ queryKey: ['offers', grader, cert], queryFn: () => api<OfferRow[]>(`/titles/${grader}/${cert}/offers`), ...live })
export const useOpenAsks = () => useQuery({ queryKey: ['asks'], queryFn: () => api<OfferRow[]>('/offers?kind=ask'), ...live })
export const useHolderOffers = (address: string | null | undefined) =>
  useQuery({ queryKey: ['holderOffers', address], queryFn: () => api<{ made: OfferRow[]; received: OfferRow[] }>(`/holders/${address}/offers`), enabled: !!address, ...live })
export const useSubmissions = (query: { grader?: string; submitter?: string }) =>
  useQuery({ queryKey: ['submissions', query], queryFn: () => api<SubmissionRow[]>(`/submissions${qs(query)}`), ...live })

const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x))

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: json(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `${res.status}`)
  return data as T
}
