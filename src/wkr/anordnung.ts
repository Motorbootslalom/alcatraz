import { WKR_ANNAHMEN } from './annahmen'
import type { ListenTeil } from './liste'

/**
 * Anordnung der WKR-Maske auf dem Gerät (W5.1, Plan docs/plan-wkr-w5.md §4.1, 22.11.2026) – rein: aus Fenstergröße,
 * Geräteart und eigenen Listen, wie viele Listen nebeneinander stehen, welche sich als Reiter die letzte Spalte teilen
 * und ob es eine eigene Seitenspalte (Schlange / Zuletzt / Einträge) gibt. Die Oberfläche (components/wkr/WkrGeraet.vue)
 * liest Breite und Höhe live (systemModus.ts useFenster) und zeichnet nur, was hier steht – so lässt sich jede
 * Kombination ohne DOM prüfen (anordnung.test.ts). Auslegungen PD1–PD3 in WKR_ANNAHMEN.
 *
 * Die Geräteart heißt hier wie geraete/transport/protokoll.ts GERAETE_TYPEN, ohne Import von dort: src/wkr bleibt frei
 * von geraete/ (CLAUDE.md des Ordners).
 */

export type AnordnungsArt = 'handy' | 'padQuer' | 'padHoch'
export type GeraeteArt = 'handy' | 'pad' | 'rechner'

export interface AnordnungsEingabe {
  /** Fenster in CSS-px. */
  breite: number
  hoehe: number
  /** Art aus der Kopplung (GF7); fehlt (Übung) → aus der kürzeren Seite (PD1). */
  typ?: GeraeteArt | null
  /** Eigene Listen (Kennungen) in der Folge der Aufgaben. */
  listen: readonly string[]
  /** Listen, die das Gerät GANZ hat und die in zwei Teile zerfallen (Steg ohne `teil`) – auf dem Pad zwei Spalten. */
  teile?: readonly string[]
}

/** Eine Spalte: eine Liste, am ganzen Steg auf dem Pad ein Teil davon. */
export interface Spalte {
  liste: string
  teil?: ListenTeil
}

export interface Anordnung {
  art: AnordnungsArt
  /** Was nebeneinander steht (Handy: eine). Die letzte Spalte zeigt bei `reiter` die gewählte Reiter-Liste. */
  spalten: Spalte[]
  /** Listen, die sich die letzte Spalte als Reiter teilen (leer: alle passen). Die erste ist die Vorgabe der Spalte. */
  reiter: string[]
  /** Eigene Seitenspalte: quer rechts, hoch unten, sonst keine (PD3). */
  seite: 'rechts' | 'unten' | null
}

/** Art der Anordnung (PD1): Art aus der Kopplung vor der Fenstergröße; Rechner wie Pad. */
export function anordnungsArt(breite: number, hoehe: number, typ?: GeraeteArt | null): AnordnungsArt {
  const pad = typ ? typ !== 'handy' : Math.min(breite, hoehe) >= WKR_ANNAHMEN.padAbKurzeSeite
  if (!pad) return 'handy'
  return breite >= hoehe ? 'padQuer' : 'padHoch'
}

/** Höchstens so viele Spalten passen (PD2); immer mindestens eine. */
export function spaltenPlatz(art: AnordnungsArt, breite: number): number {
  if (art === 'handy') return 1
  if (art === 'padHoch') return Math.max(1, Math.min(WKR_ANNAHMEN.padHochSpaltenMax, Math.floor(breite / WKR_ANNAHMEN.padHochSpalteMinPx)))
  return Math.max(1, Math.min(WKR_ANNAHMEN.padSpaltenMax, Math.floor(breite / WKR_ANNAHMEN.padSpalteMinPx)))
}

export function anordnung(e: AnordnungsEingabe): Anordnung {
  const art = anordnungsArt(e.breite, e.hoehe, e.typ)
  const listen = [...new Set(e.listen)]
  const platz = spaltenPlatz(art, e.breite)
  const ganz = new Set(e.teile ?? [])
  let spalten: Spalte[]
  let reiter: string[] = []
  // Steg ganz nur auf dem Pad und nur, wenn ALLE Listen samt beiden Teilen passen (§4.4) – sonst gingen andere Listen
  // in Reiter, nur damit der Steg zwei Spalten bekommt.
  const mitTeilen: Spalte[] = listen.flatMap((l) => (ganz.has(l) && art !== 'handy' ? [{ liste: l, teil: 'ab' as const }, { liste: l, teil: 'an' as const }] : [{ liste: l }]))
  if (mitTeilen.length <= platz) spalten = mitTeilen
  else if (listen.length <= platz) spalten = listen.map((l) => ({ liste: l }))
  else {
    // Die ersten platz-1 Listen fest, der Rest teilt sich die letzte Spalte als Reiter („Rest-Reiter wie heute“).
    spalten = listen.slice(0, platz).map((l) => ({ liste: l }))
    reiter = listen.slice(platz - 1)
  }
  const seite = art !== 'handy' && spalten.length === 1 && WKR_ANNAHMEN.padSeiteNurEineSpalte ? (art === 'padQuer' ? 'rechts' : 'unten') : null
  return { art, spalten, reiter, seite }
}
