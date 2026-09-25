// The life of a slab title, as an animated pipeline (home page).

const STEPS = [
  { icon: '🔍', title: 'Graded', who: 'Grader', text: 'The card is graded and encapsulated.' },
  { icon: '◈', title: 'Chip sealed', who: 'Grader', text: 'An NFC chip with its own key goes inside the slab.' },
  { icon: '名', title: 'Title issued', who: 'ENS', text: '<cert>.<grader>.nafuda.eth records the chip and resolves to the owner.' },
  { icon: '📱', title: 'Tapped & checked', who: 'Buyer', text: 'The chip signs a fresh challenge; the seller must be the holder on ENS.' },
  { icon: '⇄', title: 'Title transferred', who: 'Seller → buyer', text: 'Selling the slab is an ENS name transfer. Nobody can claw it back.' },
]

export function Lifecycle() {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {STEPS.map((s, i) => (
        <div key={s.title} className="relative">
          <div className="h-full rounded-2xl border border-line bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-accent/10 font-serif text-lg text-accent">{s.icon}</span>
              <div>
                <div className="text-[11px] font-bold tracking-wide text-muted uppercase">
                  {i + 1} · {s.who}
                </div>
                <div className="font-bold">{s.title}</div>
              </div>
            </div>
            <p className="mt-2 text-[13px] leading-snug text-muted">{s.text}</p>
          </div>
          {i < STEPS.length - 1 && (
            <svg className="absolute top-1/2 -right-3 z-10 hidden -translate-y-1/2 md:block" width="18" height="12" viewBox="0 0 18 12" aria-hidden>
              <line x1="0" y1="6" x2="12" y2="6" stroke="var(--accent)" strokeWidth="2" className="flow-dash" />
              <path d="M11 1l6 5-6 5" fill="none" stroke="var(--accent)" strokeWidth="2" />
            </svg>
          )}
        </div>
      ))}
    </div>
  )
}
