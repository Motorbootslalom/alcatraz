import type { AppState, PokalEinstellungen } from '../types'
import { ROH_QUELLE, ROH_REGELWERKE, resolveRegelwerkId } from './konfig'
import { POKAL_PLATZ_VARIANTEN, POKAL_VARIANTEN, type PokalPlatzVariante, type PokalVariante } from './schema'

// Pokalauswertung: was die Konfiguration vorgibt und was die Veranstaltung daraus macht.
//
// Die Vorgaben stehen in den YAML-Dateien, nicht hier:
//   • einstellungen.yaml `pokalPunkte` – Punkte je Platz der Varianten plaetze3 und plaetze6;
//   • regelwerke/<id>.yaml `pokal.vorgabe` – welche Varianten eine Veranstaltung nach diesem
//     Regelwerk eingeschaltet hat;
//   • regelwerke/uim-2026.yaml `pokal.uim` – Punktetabelle der UIM (Regel 960, Pkt. 5.1), Zahl
//     der Besten und Mindestzahl der Starter je Herkunft.
// Die Veranstaltung speichert nur, was sie davon abweichend festlegt (`AppState.pokal`) – wie
// bei den Durchschnittsgewichten und den zusätzlichen Listen. Wechselt das Regelwerk, folgt alles
// Unveränderte dem neuen.

export { POKAL_PLATZ_VARIANTEN, POKAL_VARIANTEN }
export type { PokalPlatzVariante, PokalVariante }

export const istPokalVariante = (x: unknown): x is PokalVariante => (POKAL_VARIANTEN as readonly unknown[]).includes(x)

/** Höchstwerte der Eingabefelder: mehr ergäbe keine sinnvolle Wertung, nur unlesbare Spalten. */
export const POKAL_PUNKTE_MAX = 999
export const POKAL_BESTE_MAX = 50

/** Was die Konfiguration für ein Regelwerk vorgibt. */
export interface PokalVorgabe {
  /** Die Varianten, die nach dem Regelwerk eingeschaltet sind. */
  an: PokalVariante[]
  /** Punkte für Platz 1, 2, 3 … je Variante; dahinter gibt es keine. */
  punkte: Record<PokalVariante, number[]>
  /** UIM: So viele Starter je Herkunft zählen. */
  beste: number
  /** UIM: So viele Starter muss eine Herkunft stellen, um gewertet zu werden. */
  mindestens: number
}

/** Brauchbare Punkte je Platz: ganze Zahlen von 0 bis {@link POKAL_PUNKTE_MAX}; sonst leer. */
export function punkteListe(x: unknown): number[] {
  if (!Array.isArray(x)) return []
  return x.map((n) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(POKAL_PUNKTE_MAX, Math.round(n))) : 0))
}

const ganz = (x: unknown, min: number, max: number): number | undefined =>
  typeof x === 'number' && Number.isFinite(x) ? Math.max(min, Math.min(max, Math.round(x))) : undefined

/** Eine brauchbare Zahl der Besten bzw. Mindestzahl (1 bis {@link POKAL_BESTE_MAX}); sonst `undefined`. */
export const pokalZahl = (x: unknown): number | undefined => ganz(x, 1, POKAL_BESTE_MAX)

/**
 * Die UIM-Tabelle gilt in jedem Regelwerk – auch die DM-Mappe druckt die UIM-Wertung. Sie
 * steht aber nur einmal, im Regelwerk der UIM: Hat das gewählte Regelwerk keine eigene, gilt
 * die des ersten Regelwerks, das eine nennt.
 */
const uimTabelle = (regelwerk: string) => {
  const eigene = ROH_REGELWERKE.find((r) => r.id === regelwerk)?.pokal?.uim
  return eigene ?? ROH_REGELWERKE.find((r) => r.pokal?.uim)?.pokal?.uim ?? {}
}

/** Die Vorgabe zum Regelwerk; ein unbekanntes Regelwerk gilt als das erste (wie überall). */
export function pokalVorgabe(regelwerk: string): PokalVorgabe {
  const id = resolveRegelwerkId(regelwerk)
  const uim = uimTabelle(id)
  const punkte = punkteListe(uim.punkte)
  const jePlatz = ROH_QUELLE.pokalPunkte ?? {}
  return {
    an: (ROH_REGELWERKE.find((r) => r.id === id)?.pokal?.vorgabe ?? []).filter(istPokalVariante),
    punkte: { plaetze3: punkteListe(jePlatz.plaetze3), plaetze6: punkteListe(jePlatz.plaetze6), uim: punkte },
    beste: pokalZahl(uim.beste) ?? 5,
    mindestens: pokalZahl(uim.mindestens) ?? 1,
  }
}

/** Was für die Veranstaltung gilt: die Vorgabe des Regelwerks mit ihren eigenen Abweichungen. */
export interface PokalRegeln extends PokalVorgabe {
  /** Nur ausgewählte Starter zählen (`Starter.pokal`). */
  nurAuswahl: boolean
}

export function pokalRegeln(stand: Pick<AppState, 'regelwerk' | 'pokal'>): PokalRegeln {
  const vorgabe = pokalVorgabe(stand.regelwerk)
  const eigen = stand.pokal
  const eigenePunkte = (v: PokalPlatzVariante) => {
    const liste = eigen.punkte[v]
    // Nur eine Liste in der Länge der Vorgabe gilt: Die Zahl der Plätze steht mit der Variante fest.
    return liste && liste.length === vorgabe.punkte[v].length ? punkteListe(liste) : vorgabe.punkte[v]
  }
  return {
    an: POKAL_VARIANTEN.filter((v) => eigen.varianten[v] ?? vorgabe.an.includes(v)),
    punkte: { plaetze3: eigenePunkte('plaetze3'), plaetze6: eigenePunkte('plaetze6'), uim: vorgabe.punkte.uim },
    beste: pokalZahl(eigen.beste) ?? vorgabe.beste,
    mindestens: pokalZahl(eigen.mindestens) ?? vorgabe.mindestens,
    nurAuswahl: eigen.nurAuswahl,
  }
}

/** Einstellungen einer frisch angelegten Veranstaltung: nichts weicht ab, alle Starter zählen. */
export const POKAL_LEER: PokalEinstellungen = { varianten: {}, punkte: {}, nurAuswahl: false }

/** Gelesene Einstellungen (Sicherung, Vorlage, localStorage) in gültiger Form; Unbrauchbares entfällt. */
export function pokalWert(x: unknown): PokalEinstellungen {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return POKAL_LEER
  const roh = x as { varianten?: unknown; punkte?: unknown; beste?: unknown; mindestens?: unknown; nurAuswahl?: unknown }
  const objekt = (o: unknown): Record<string, unknown> => (o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : {})
  const varianten: PokalEinstellungen['varianten'] = {}
  for (const v of POKAL_VARIANTEN) {
    const an = objekt(roh.varianten)[v]
    if (typeof an === 'boolean') varianten[v] = an
  }
  const punkte: PokalEinstellungen['punkte'] = {}
  for (const v of POKAL_PLATZ_VARIANTEN) {
    const liste = objekt(roh.punkte)[v]
    if (Array.isArray(liste) && liste.length > 0) punkte[v] = punkteListe(liste)
  }
  const beste = pokalZahl(roh.beste)
  const mindestens = pokalZahl(roh.mindestens)
  return { varianten, punkte, ...(beste !== undefined ? { beste } : {}), ...(mindestens !== undefined ? { mindestens } : {}), nurAuswahl: roh.nurAuswahl === true }
}
