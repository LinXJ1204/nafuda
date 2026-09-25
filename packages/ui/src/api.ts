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
}
export type Activity = Transfer & { kind: 'issue' | 'transfer' }
export type TitleDetail = Title & { history: Transfer[] }
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
export type Status = { indexedBlock: string | null; titles: number; transfers: number; graders: number }
export type CollectorRow = { name: string; bio: string; address: string; source: string; titles: number }

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
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
export const useStats = () => useQuery({ queryKey: ['stats'], queryFn: () => api<Stats>('/stats'), ...live })
export const useGraders = () => useQuery({ queryKey: ['graders'], queryFn: () => api<GraderSummary[]>('/graders'), ...live })
export const useGrader = (label: string) => useQuery({ queryKey: ['grader', label], queryFn: () => api<GraderDetail>(`/graders/${label}`), ...live })
export const useCollectors = () => useQuery({ queryKey: ['collectors'], queryFn: () => api<CollectorRow[]>('/collectors'), ...live })
export const useGraph = () => useQuery({ queryKey: ['graph'], queryFn: () => api<Graph>('/graph'), ...live })

export type TitleQuery = { grader?: string; holder?: string; q?: string; sort?: string; minGrade?: number; limit?: number; offset?: number }
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
