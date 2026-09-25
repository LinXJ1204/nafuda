// Each route render gets a View: `alive()` turns false once the user navigates away (so late
// async results are dropped), and `onLeave` callbacks run on navigation (unsubscribe, timers).

export type View = {
  main: HTMLElement
  alive(): boolean
  onLeave(fn: () => void): void
}

export function viewRunner(main: HTMLElement): () => View {
  let leave: (() => void)[] = []
  let seq = 0
  return () => {
    for (const fn of leave) fn()
    leave = []
    const mine = ++seq
    main.replaceChildren()
    window.scrollTo(0, 0)
    return { main, alive: () => mine === seq, onLeave: (fn) => leave.push(fn) }
  }
}
