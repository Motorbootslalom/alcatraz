import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ENDE_OHNE_ENTER_MS, MAX_ABSTAND_MS, hoereAufScanner } from './scanner'

// Der Mitschnitt des Handscanners mit echten Tastaturereignissen am Fenster und eigener Uhr.

describe('hoereAufScanner', () => {
  let zeit = 0
  let codes: string[] = []
  let ab: () => void

  /** Eine Taste, `ms` nach der vorigen; liefert, ob die Anwendung sie abgefangen hat. */
  function taste(key: string, ms: number, ziel: EventTarget = document.activeElement ?? document.body): boolean {
    zeit += ms
    const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    ziel.dispatchEvent(e)
    // Was der Browser ohne preventDefault täte: das Zeichen ins Feld schreiben.
    if (!e.defaultPrevented && key.length === 1 && (ziel instanceof HTMLInputElement || ziel instanceof HTMLTextAreaElement)) {
      ziel.value += key
      ziel.dispatchEvent(new Event('input', { bubbles: true }))
    }
    return e.defaultPrevented
  }
  const tippe = (text: string, ms: number, ziel?: EventTarget) => [...text].map((z) => taste(z, ms, ziel))

  beforeEach(() => {
    vi.useFakeTimers()
    zeit = 1000
    codes = []
    ab = hoereAufScanner(
      (c) => codes.push(c),
      (el) => el instanceof HTMLElement && el.hasAttribute('data-scan-feld'),
      () => zeit,
    )
  })
  afterEach(() => {
    ab()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('schneller Schwall mit Enter: ein Code, ohne dass ein Feld den Fokus hat', () => {
    tippe('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1', 5)
    expect(codes).toEqual([])
    expect(taste('Enter', 5)).toBe(true)
    expect(codes).toEqual(['ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1'])
  })

  it('ohne Enter gilt der Code nach einer kurzen Pause als vollständig; Tab schließt auch ab', () => {
    tippe('ALC1.K7Q4.X', 5)
    vi.advanceTimersByTime(ENDE_OHNE_ENTER_MS - 1)
    expect(codes).toEqual([])
    vi.advanceTimersByTime(1)
    expect(codes).toEqual(['ALC1.K7Q4.X'])
    tippe('alc1.abc', 5)
    taste('Tab', 5)
    expect(codes[1]).toBe('alc1.abc')
  })

  it('auch der Code des Prototyps wird abgefangen (für die verständliche Absage)', () => {
    tippe('FP2.DM2026.ALCATRAZ.3.1', 5)
    taste('Enter', 5)
    expect(codes).toEqual(['FP2.DM2026.ALCATRAZ.3.1'])
  })

  it('ein Mensch tippt langsamer: kein Scan, nichts wird abgefangen', () => {
    const abgefangen = tippe('ALC1.K7Q4', MAX_ABSTAND_MS + 40)
    taste('Enter', 100)
    vi.advanceTimersByTime(1000)
    expect(codes).toEqual([])
    expect(abgefangen.some(Boolean)).toBe(false)
  })

  it('anderer schneller Text (Strichcode einer Ware) ist kein Code', () => {
    tippe('4006381333931', 5)
    expect(taste('Enter', 5)).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(codes).toEqual([])
  })

  it('steht der Cursor in einem Feld, bekommt es seinen Inhalt von vor dem Scan zurück', () => {
    const feld = document.createElement('input')
    document.body.append(feld)
    feld.value = '5'
    feld.focus()
    const gemeldet: string[] = []
    feld.addEventListener('input', () => gemeldet.push(feld.value))
    tippe('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1', 5, feld)
    taste('Enter', 5, feld)
    expect(codes).toEqual(['ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1'])
    // Die ersten Zeichen waren schon hineingetippt; das Feld meldet danach wieder den alten Wert.
    expect(feld.value).toBe('5')
    expect(gemeldet.at(-1)).toBe('5')
  })

  it('Auswahlliste mit Fokus: Die Tippauswahl der ersten Zeichen wird zurückgenommen', () => {
    const liste = document.createElement('select')
    liste.innerHTML = ['alcatraz', 'alcatrazdm26', 'bawue'].map((wert) => `<option value="${wert}">${wert}</option>`).join('')
    document.body.append(liste)
    liste.value = 'alcatraz'
    liste.focus()
    const gemeldet: string[] = []
    liste.addEventListener('change', () => gemeldet.push(liste.value))
    // Was der Browser bei einem „A“ täte: zur nächsten Option mit A springen.
    const tippauswahl = (e: Event) => {
      if ((e as KeyboardEvent).key === 'A' && !e.defaultPrevented) {
        liste.value = 'alcatrazdm26'
        liste.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }
    liste.addEventListener('keydown', tippauswahl)
    tippe('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1', 5, liste)
    taste('Enter', 5, liste)
    expect(codes).toEqual(['ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1'])
    expect(liste.value).toBe('alcatraz')
    expect(gemeldet).toEqual(['alcatrazdm26', 'alcatraz'])
  })

  it('der Stand von vor dem Schwall wird wiederhergestellt – nach dem Zurückstellen des Felds', () => {
    ab()
    let stand = 'vorher'
    const ablauf: string[] = []
    ab = hoereAufScanner(
      (c) => codes.push(c),
      undefined,
      () => zeit,
      { merke: () => stand, stelleHer: (s) => (ablauf.push(`her:${s}`), (stand = s)) },
    )
    const feld = document.createElement('input')
    document.body.append(feld)
    feld.focus()
    // Jede Eingabe ändert den Stand, wie eine Zelle der Erfassung.
    feld.addEventListener('input', () => (ablauf.push(`eingabe:${feld.value}`), (stand = `mit ${feld.value}`)))
    zeit += 500
    tippe('ALC1.K7Q4.X', 5, feld)
    taste('Enter', 5, feld)
    expect(ablauf).toEqual(['eingabe:A', 'eingabe:AL', 'eingabe:ALC', 'eingabe:ALC1', 'eingabe:', 'her:vorher'])
    expect(stand).toBe('vorher')
    // Ein Mensch tippt: Nichts wird wiederhergestellt.
    ablauf.length = 0
    tippe('ALC1.', MAX_ABSTAND_MS + 40, feld)
    expect(ablauf.some((a) => a.startsWith('her:'))).toBe(false)
  })

  it('stellt der Scanner dem Code eine Kennung voran („]Q1“), wird sie nicht mitgemeldet', () => {
    const feld = document.createElement('input')
    document.body.append(feld)
    feld.value = '7'
    feld.focus()
    tippe(']Q1ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1', 5, feld)
    taste('Enter', 5, feld)
    expect(codes).toEqual(['ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1'])
    expect(feld.value).toBe('7')
  })

  it('das Scan-Feld liest selbst: Dort greift der Mitschnitt nicht', () => {
    const feld = document.createElement('input')
    feld.setAttribute('data-scan-feld', '')
    document.body.append(feld)
    feld.focus()
    const abgefangen = tippe('ALC1.K7Q4.DM2026', 5, feld)
    expect(abgefangen.some(Boolean)).toBe(false)
    expect(feld.value).toBe('ALC1.K7Q4.DM2026')
    vi.advanceTimersByTime(1000)
    expect(codes).toEqual([])
  })

  it('Tasten mit Strg/Alt gehören nicht zum Scan; nach dem Abmelden hört niemand mehr zu', () => {
    zeit += 500
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true, cancelable: true }))
    ab()
    tippe('ALC1.K7Q4', 5)
    taste('Enter', 5)
    expect(codes).toEqual([])
  })
})
