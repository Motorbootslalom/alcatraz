// Tastatur-Navigation in der Erfassungstabelle – wie lib/gridnav.ts im Fehlerpunkte-Prototyp:
//   • ↑ / ↓        – eine Zeile hoch/runter (gleiche Spalte)
//   • Enter        – eine Zeile runter (wie ↓)
//   • ← / →        – vorheriges/nächstes Feld, aber nur wenn der Cursor am Rand des Textes
//                    steht (sonst normale Cursor-Bewegung)
//   • Tab          – bleibt beim Browser: zeilenweise durch die Felder
// Fokussiert wird nur innerhalb derselben Tabelle (`table`). Zeilen ohne Feld in der Spalte
// (Zwischenüberschrift einer Klasse, schraffierte Zelle) werden übersprungen.
//
// Nimmt das native KeyboardEvent (Vue `@keydown`), currentTarget ist das <input>.

export function gridNavKeyDown(e: KeyboardEvent): void {
  const input = e.currentTarget as HTMLInputElement
  switch (e.key) {
    case 'ArrowUp':
      if (moveVertical(input, -1)) e.preventDefault()
      break
    case 'ArrowDown':
    case 'Enter':
      if (moveVertical(input, 1)) e.preventDefault()
      break
    case 'ArrowLeft':
      if (atStart(input) && moveHorizontal(input, -1)) e.preventDefault()
      break
    case 'ArrowRight':
      if (atEnd(input) && moveHorizontal(input, 1)) e.preventDefault()
      break
    default:
      break
  }
}

function atStart(input: HTMLInputElement): boolean {
  return (input.selectionStart ?? 0) === 0 && (input.selectionEnd ?? 0) === 0
}

function atEnd(input: HTMLInputElement): boolean {
  const end = input.value.length
  return (input.selectionStart ?? end) === end && (input.selectionEnd ?? end) === end
}

function focusInput(el: HTMLInputElement): void {
  el.focus()
  // Inhalt markieren: Die nächste Eingabe überschreibt, ohne dass erst gelöscht werden muss.
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => el.select())
  else el.select()
}

// Über `children` statt `rows`/`cells`/`cellIndex`: gleichwertig im Browser, und das Test-DOM
// (happy-dom) kennt die Tabellen-Abkürzungen nicht vollständig.
function lage(input: HTMLInputElement): { rows: Element[]; rowIdx: number; colIdx: number } | null {
  const body = input.closest('tbody')
  const tr = input.closest('tr')
  const td = input.closest('td')
  if (!body || !tr || !td) return null
  const rows = Array.from(body.children)
  return { rows, rowIdx: rows.indexOf(tr), colIdx: Array.from(tr.children).indexOf(td) }
}

/** Das Feld einer Zeile in einer Spalte; Zeilen mit anderer Zellenzahl (Zwischenüberschrift) haben keines. */
const feldIn = (row: Element | undefined, colIdx: number) =>
  row?.children[colIdx]?.querySelector<HTMLInputElement>('input:not([type=checkbox])') ?? null

function moveVertical(input: HTMLInputElement, dir: -1 | 1): boolean {
  const l = lage(input)
  if (!l) return false
  for (let r = l.rowIdx + dir; r >= 0 && r < l.rows.length; r += dir) {
    const target = feldIn(l.rows[r], l.colIdx)
    if (target) {
      focusInput(target)
      return true
    }
  }
  return false
}

/**
 * Enter in einer Zeit-Zelle: immer eine Zeile nach unten in DERSELBEN Spalte – so wird eine
 * Stoppuhr-Spalte von oben nach unten abgetippt. Nach der letzten Zeile geht es in der
 * nächsten Spalte oben weiter; gibt es keine, verlässt der Fokus das Feld.
 */
export function timeEnter(input: HTMLInputElement): void {
  if (moveVertical(input, 1)) return
  const l = lage(input)
  if (!l) return
  const breite = Math.max(...l.rows.map((r) => r.children.length))
  for (let c = l.colIdx + 1; c < breite; c++) {
    const target = l.rows.map((r) => feldIn(r, c)).find((f) => f !== null)
    if (target) {
      focusInput(target)
      return
    }
  }
  input.blur()
}

function moveHorizontal(input: HTMLInputElement, dir: -1 | 1): boolean {
  const table = input.closest('table')
  if (!table) return false
  const inputs = Array.from(table.querySelectorAll<HTMLInputElement>('tbody input:not([type=checkbox])'))
  const next = inputs[inputs.indexOf(input) + dir]
  if (next) {
    focusInput(next)
    return true
  }
  return false
}
