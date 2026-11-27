import { WKR_ANNAHMEN } from './annahmen'

/**
 * Maskenwahl (F14, W5.1, Plan docs/plan-wkr-w5.md §4.3, 22.11.2026) – rein: welche Masken eine Liste erlaubt, welche
 * ohne Auswahl gilt (MW1) und welche das Gerät am Ende zeigt (Vorgabe des Bedienrechners, `fest`, Wahl des WKR, MW2).
 * Dieselben Namen wie geraete/aufgaben.ts MASKEN_VORGABEN (Test) – ohne Import von dort, src/wkr bleibt frei von
 * geraete/. Am Bedienrechner (components/betrieb/GeraeteListe.vue) und auf dem Gerät (components/wkr/WkrGeraet.vue).
 */

export type MaskenWahl = 'knoepfe' | 'bild' | 'text'
export const MASKEN_WAHL: readonly MaskenWahl[] = ['knoepfe', 'bild', 'text']

/**
 * Welche Masken schon gebaut sind: „Bild“ seit W5.2 (22.11.2026; ob eine KLASSE ein vollständiges Bild hat, sagt erst
 * wkr/bild.ts bildTreffer – sonst zeigt sie Knöpfe, BD2), „Tabelle“ (`text`) seit W5.5 (22.11.2026, wkr/tabelle.ts).
 * Eine nicht gebaute zeigte das Gerät als „Knöpfe“ (MW1) – der Schalter bleibt für künftige Masken.
 */
export const MASKEN_GEBAUT: Readonly<Record<MaskenWahl, boolean>> = { knoepfe: true, bild: true, text: true }

/**
 * Geht die Maske auf diesem Gerät (TB1, W5.5, 22.11.2026, bestätigt 22.11.2026, R8-38)? „Tabelle“ nur auf Pad und Rechner – sie
 * braucht eine Tastatur und Platz für eine ganze Bogenzeile; auf dem Handy ist die Wahl ausgegraut, eine Vorgabe des
 * Bedienrechners zeigt dort „Knöpfe“.
 */
export function maskeAufGeraet(m: MaskenWahl, pad: boolean): boolean {
  return m !== 'text' || !WKR_ANNAHMEN.tabelleNurPad || pad
}

export interface MaskenListe {
  /** Die Liste hat Bojen auf dem Fahrweg (wkr/maske.ts MaskenArt `bojen`) – nur dann gibt es „Bild“. */
  bojen: boolean
  /** Gerät ist ein Pad bzw. Rechner (wkr/anordnung.ts), nicht ein Handy. */
  pad: boolean
  /** Reine Zeit-Liste (wkr/maske.ts MaskenArt `zeit`): feste Art Ziffernblock (MW1) – keine Wahl, auch keine Tabelle. */
  zeit?: boolean
}

/**
 * Masken, die eine Liste grundsätzlich erlaubt (Plan §4.3): Knöpfe immer, Bild nur auf Bojen-Listen, Tabelle immer (Zeit
 * und Knoten haben ab W5.3/W5.4 ihre feste Art: reine Zeit-Listen nur „Knöpfe“ = Ziffernblock, W5.5). Ob gebaut, sagt
 * {@link MASKEN_GEBAUT}, ob auf diesem Gerät, {@link maskeAufGeraet}.
 */
export function erlaubteMasken(l: Pick<MaskenListe, 'bojen' | 'zeit'>): MaskenWahl[] {
  if (l.zeit) return ['knoepfe']
  return MASKEN_WAHL.filter((m) => m !== 'bild' || l.bojen)
}

/** Vorgabe ohne Auswahl (MW1): Pad + Bojen-Liste → Bild, sonst Knöpfe; Tabelle nie (auch nach W5.5 nicht, MW1). */
export function vorgabeMaske(l: MaskenListe): MaskenWahl {
  return WKR_ANNAHMEN.maskeVorgabePadBild && l.pad && l.bojen ? 'bild' : 'knoepfe'
}

export interface MaskenLage {
  /** Vorgabe des Bedienrechners (Aufgabe.maske), fehlt = MW1. */
  vorgabe?: MaskenWahl
  fest?: boolean
  /** Wahl des WKR auf dem Gerät (MW2). */
  wahl?: MaskenWahl
}

/**
 * Was das Gerät zeigt: bei `fest` die Vorgabe, sonst die Wahl des WKR, sonst die Vorgabe bzw. MW1 – jeweils nur, wenn
 * die Liste die Maske erlaubt und sie auf diesem Gerät geht (TB1: Tabelle nicht auf dem Handy); ist sie (noch) nicht
 * gebaut, „Knöpfe“.
 */
export function wirksameMaske(l: MaskenListe, lage: MaskenLage): MaskenWahl {
  const erlaubt = erlaubteMasken(l)
  const gilt = (m: MaskenWahl | undefined): m is MaskenWahl => !!m && erlaubt.includes(m) && maskeAufGeraet(m, l.pad)
  const gewuenscht = lage.fest && gilt(lage.vorgabe) ? lage.vorgabe : gilt(lage.wahl) ? lage.wahl : gilt(lage.vorgabe) ? lage.vorgabe : vorgabeMaske(l)
  return MASKEN_GEBAUT[gewuenscht] ? gewuenscht : 'knoepfe'
}
