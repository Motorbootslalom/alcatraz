import { reducer, type Action } from './state/reducer'
import type { AppState, LogoBild } from './types'

// Hilfen nur für Tests – kein Teil der Anwendung.

/**
 * Das Regelwerk wechseln, auch wenn schon Werte erfasst sind. In der Anwendung ist das gesperrt
 * (state/reducer.ts, SET_REGELWERK); ein solcher Stand entsteht dort nur durch eine geladene
 * Sicherung. Tests, die dieselben Werte unter beiden Regelwerken zeigen, kommen so dorthin: Der
 * Wechsel stellt alles wie SET_REGELWERK, die Werte und ihre Zeitpunkte bleiben.
 */
export function wechsleRegelwerk(store: { state: { value: AppState }; dispatch: (action: Action) => void }, regelwerk: string): void {
  const stand = store.state.value
  const gewechselt = reducer({ ...stand, eingaben: {} }, { type: 'SET_REGELWERK', regelwerk })
  store.dispatch({ type: 'LOAD_STATE', state: { ...gewechselt, eingaben: stand.eingaben, listenStand: stand.listenStand } })
}

/** Der Haken „erfasst“ der Knoten-Liste für die genannten Starter: Unter Regel 960 gibt es die UIM points des Manövrierens erst mit den Knoten. */
export function knotenHaken(ids: readonly string[]): { lauf: string; starter: string; feld: string; wert: string }[] {
  return ids.map((id) => ({ lauf: 'manoevrieren/0', starter: id, feld: 'erfasst@knoten', wert: '1' }))
}

/**
 * Ein selbst erzeugtes PNG von 2 × 1 Pixeln (74 Byte) als data-URL: Testbild für die Logos. Das Repo ist
 * öffentlich und enthält keine fremden Logos.
 */
export const TEST_PNG_2X1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR42mM4wcDwn4GBgQEAC0QByFbJzs4AAAAASUVORK5CYII='

/** Ein Logo aus {@link TEST_PNG_2X1}; die Pixelmaße sind frei wählbar (sie bestimmen die Breite auf dem Blatt). */
export function testLogo(breite = 2, hoehe = 1): LogoBild {
  return { src: TEST_PNG_2X1, breite, hoehe }
}

/** Ein SVG-Rechteck als prozentkodierte data-URL (2:1). */
export function testSvgLogo(): LogoBild {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#08c"/></svg>'
  return { src: `data:image/svg+xml,${encodeURIComponent(svg)}`, breite: 40, hoehe: 20 }
}

/** Beide Logos setzen (links 2:1, rechts 2:1) – für Tests „mit Logos“ an jedem Listenkopf. */
export function setzeTestLogos(store: { dispatch: (action: Action) => void }): void {
  store.dispatch({ type: 'SET_LOGO', seite: 'links', logo: testLogo() })
  store.dispatch({ type: 'SET_LOGO', seite: 'rechts', logo: testLogo(4, 2) })
}

/** Die Logos in einem Element (eine Druckseite, ein Kopf), in ihrer Folge: z. B. ['links', 'rechts']. */
export function logoFolge(el: Element): (string | null)[] {
  return [...el.querySelectorAll('img.listen-logo')].map((img) => img.getAttribute('data-logo'))
}

/** Kopf einer Druckseite: Logos, Text der Kopffelder (mit „ | “) und Spaltenzahl der Kopfzelle. */
export interface SeitenKopf {
  logos: (string | null)[]
  kopf: string
  colspan: string | null
}

/**
 * Je Druckseite (`.listen-seite`) unter `root` ihr Kopf – für Tests „mit Logos“: Die Logos stehen auf jeder
 * Seite, alles andere bleibt wie ohne. `felder`/`zelle`: die Kopffelder und die Kopfzelle der Listenform.
 */
export function seitenKoepfe(root: Element, felder = '.sheet-title-box [data-feld]', zelle = '.sheet-title th'): SeitenKopf[] {
  return [...root.querySelectorAll('.listen-seite')].map((s) => ({
    logos: logoFolge(s),
    kopf: [...s.querySelectorAll(felder)].map((f) => (f.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | '),
    colspan: s.querySelector(zelle)?.getAttribute('colspan') ?? null,
  }))
}

/** Dieselben Köpfe ohne die Logos – zum Vergleich mit einer Fassung ohne Logos. */
export const ohneLogos = (koepfe: SeitenKopf[]) => koepfe.map(({ kopf, colspan }) => ({ kopf, colspan }))
