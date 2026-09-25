// English / 日本語. The key texts (navigation, the home page, the buyer check and its outcomes,
// section titles, main actions) are translated; details stay in English. The choice is kept in
// localStorage when available.

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Outcome } from '@nafuda/core/verify.ts'

export type Lang = 'en' | 'ja'

const JA: Record<string, string> = {
  // navigation
  Explore: '探す',
  'Check a slab': 'スラブを確認',
  Activity: '取引履歴',
  Graders: '鑑定会社',
  Collectors: 'コレクター',
  Map: 'マップ',
  Submit: '鑑定に出す',
  'My titles': 'マイ名札',
  'Grader console ↗': '鑑定会社コンソール ↗',
  'Collector app ↗': 'コレクターアプリ ↗',
  'Connect wallet': 'ウォレット接続',
  'Connect grader wallet': '鑑定会社のウォレット接続',
  'Every slab wears its name.': 'すべてのスラブに、名札を。',
  Dashboard: 'ダッシュボード',
  Intake: '受付',
  Issue: '発行',
  'Issued titles': '発行済みの名札',
  Trust: '信頼性',
  'Name tree': 'ネームツリー',
  'Join as a grader': '鑑定会社として参加',
  // notice
  notice:
    'Sepolia 上のデモです。PSA-Sim・BGS-Sim・CGC-Sim は PSA・Beckett・CGC を模したシミュレーションの鑑定会社で、各社とは一切関係ありません。スラブのチップはブラウザ上でシミュレーションしています（本番では Arx HaLo などの NFC チップを鑑定会社がスラブ内に封入します）。カードとコレクターは架空です。',
  // home
  'ENSv2 titles for graded cards': '鑑定済みカードのための ENSv2 名札',
  heroLede:
    'クローンされたスラブは本物の鑑定番号をコピーするため、公式の照会でも「存在する」と表示されてしまいます。Nafuda では、鑑定会社が各スラブにチップを封入し、その名札を ENS の名前として発行します。スラブをタップすれば鑑定会社が封入した本物かがわかり、名前を引けば今の持ち主がわかります。売るときは名前を移転するだけです。',
  'Explore titles': '名札を見る',
  'No account, no app: any ENS client can read a title.': 'アカウントもアプリも不要。どの ENS クライアントでも名札を読めます。',
  Titles: '名札',
  Transfers: '移転',
  'Declared volume': '申告取引額',
  'How a slab title works': 'スラブの名札のしくみ',
  'From the grading bench to a card show, every step checkable by anyone.': '鑑定の作業台からカードショーまで、すべての段階を誰でも確認できます。',
  'Latest activity': '最新の動き',
  'Recently active titles': '最近動いた名札',
  // lifecycle
  Graded: '鑑定',
  'The card is graded and encapsulated.': 'カードを鑑定し、ケースに封入します。',
  'Chip sealed': 'チップ封入',
  'An NFC chip with its own key goes inside the slab.': '固有の鍵を持つ NFC チップをスラブの中に封入します。',
  'Title issued': '名札を発行',
  '<cert>.<grader>.nafuda.eth records the chip and resolves to the owner.': '<cert>.<grader>.nafuda.eth がチップを記録し、持ち主を指します。',
  'Tapped & checked': 'タップして確認',
  'The chip signs a fresh challenge; the seller must be the holder on ENS.': 'チップが新しいチャレンジに署名。売り手は ENS 上の持ち主でなければなりません。',
  'Title transferred': '名札を移転',
  'Selling the slab is an ENS name transfer. Nobody can claw it back.': 'スラブを売ることは ENS の名前を移転すること。誰にも取り消せません。',
  Grader: '鑑定会社',
  Buyer: '買い手',
  'Seller → buyer': '売り手 → 買い手',
  // title page
  'Check this slab before you buy': '買う前にこのスラブを確認',
  'At a card show: tap the slab with your phone, then check the seller against the holder on ENS.': 'カードショーで：スマホでスラブをタップし、売り手が ENS 上の持ち主か確認します。',
  "The slab in the seller's hand": '売り手が持っているスラブ',
  'Who is selling?': '売っているのは誰？',
  'Tap the slab and verify': 'スラブをタップして確認',
  Provenance: '来歴',
  'How ENS resolves this name': 'ENS がこの名前を解決するしくみ',
  'Trade interest': '取引の意向',
  'Transfer this title': 'この名札を移転',
  'Declared price history': '申告価格の推移',
  'Any ENS client can read it': 'どの ENS クライアントでも読めます',
  Result: '結果',
}

const OUTCOMES_JA: Record<Outcome, { title: string; body: string }> = {
  GENUINE_AND_HOLDER: { title: '本物のスラブで、売り手が登録上の持ち主です', body: '鑑定会社が封入したスラブです。代金を払い、その場で名札を移転してもらいましょう。' },
  GENUINE_NOT_HOLDER: { title: '本物のスラブですが、売り手は登録上の持ち主ではありません', body: '先に名札の移転を求めてください。できないなら買わないこと。盗品か、過去の売買が記録されていない可能性があります。' },
  NOT_SEALED_BY_GRADER: { title: '鑑定会社が封入したスラブではありません', body: 'チップがこの鑑定番号のスラブであることを証明できませんでした。クローンか、チップが差し替えられています。' },
  NO_TITLE: { title: 'この鑑定番号には名札がありません', body: '鑑定会社が名札を発行していません（未参加の鑑定会社か、古いスラブ）。Nafuda ではどちらとも判断できません。' },
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string, fallback?: string) => string; outcome: <T extends { title: string; body: string }>(o: Outcome, en: T) => T }
const LangCtx = createContext<Ctx>({ lang: 'en', setLang: () => {}, t: (k, f) => f ?? k, outcome: (_o, en) => en })

function stored(): Lang {
  try {
    return localStorage.getItem('nafuda.lang') === 'ja' ? 'ja' : 'en'
  } catch {
    return 'en'
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(stored)
  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang: (l) => {
        setLangState(l)
        document.documentElement.lang = l
        try {
          localStorage.setItem('nafuda.lang', l)
        } catch {
          // not remembered
        }
      },
      /// `key` is the English text (or a short id with an English `fallback`).
      t: (key, fallback) => (lang === 'ja' ? (JA[key] ?? fallback ?? key) : (fallback ?? key)),
      outcome: (o, en) => (lang === 'ja' ? { ...en, ...OUTCOMES_JA[o] } : en),
    }),
    [lang],
  )
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>
}

export const useT = () => useContext(LangCtx)

export function LangToggle() {
  const { lang, setLang } = useT()
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'ja' : 'en')}
      className="cursor-pointer rounded-lg border border-line px-2 py-1 text-xs font-semibold text-muted hover:text-ink"
      title="Language / 言語"
    >
      {lang === 'en' ? '日本語' : 'EN'}
    </button>
  )
}
