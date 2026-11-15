import type { ClassId } from '../types'
import type { KlassenErgebnis, LaufListe } from './ergebnis'

// Welche Wertungslisten eine Auswahl zeigt und in welcher Reihenfolge – rein, ohne DOM. Für
// den Reiter „Wertungslisten“ (components/ErgebnisListen.vue) und für die Druckdatei
// (components/DruckdateiListen.vue); gezeichnet werden sie von components/ErgebnisStapel.vue.

/** „beide“: je Liste erst die nach Startnummer (zum Prüfen), dann die nach Platz (für den Aushang). */
export const ERGEBNIS_ORDNUNG = ['platz', 'nummer', 'beide'] as const
export type ErgebnisOrdnung = (typeof ERGEBNIS_ORDNUNG)[number]
export const ERGEBNIS_UMFANG = ['alles', 'laeufe', 'gesamt'] as const
export type ErgebnisUmfang = (typeof ERGEBNIS_UMFANG)[number]

/** Eine Liste in einer Reihenfolge: ein Dokument mit eigener Seitenzählung. */
export interface ErgebnisBlatt {
  key: string
  ergebnis: KlassenErgebnis
  /** Die Liste des Laufs; `undefined` = die Gesamtliste. */
  liste?: LaufListe
  ordnung: 'platz' | 'nummer'
}

export interface ErgebnisWahl {
  /** Nur diese Klassen; fehlt = alle. */
  klassen?: readonly ClassId[]
  /** Nur dieser Lauf (dann ohne Gesamtliste); fehlt = alle. */
  lauf?: number
  umfang: ErgebnisUmfang
  ordnungLauf: ErgebnisOrdnung
  ordnungGesamt: ErgebnisOrdnung
}

/** Die Fassungen einer Liste in Druckreihenfolge; „beide“ = erst nach Startnummer, dann nach Platz. */
const ordnungen = (o: ErgebnisOrdnung): ErgebnisBlatt['ordnung'][] => (o === 'beide' ? ['nummer', 'platz'] : [o])

/** Die Blätter in Druckreihenfolge: Klasse (in der Reihenfolge von `alle`), Lauf, zuletzt die Gesamtliste. */
export function ergebnisBlaetter(alle: readonly KlassenErgebnis[], wahl: ErgebnisWahl): ErgebnisBlatt[] {
  return (
    alle
      .filter((e) => wahl.klassen === undefined || wahl.klassen.includes(e.klasse))
      .flatMap((e): Omit<ErgebnisBlatt, 'ordnung'>[] => [
        ...(wahl.umfang === 'gesamt' ? [] : e.laeufe.filter((l) => wahl.lauf === undefined || l.lauf === wahl.lauf).map((l) => ({ key: `${e.klasse}/${l.lauf}`, ergebnis: e, liste: l }))),
        // Die Gesamtliste steht hinter den Läufen ihrer Klasse – nicht, wenn nur ein einzelner Lauf gewählt ist.
        ...(wahl.umfang === 'laeufe' || wahl.lauf !== undefined ? [] : [{ key: `${e.klasse}/gesamt`, ergebnis: e }]),
      ])
      // Druckreihenfolge bleibt Klasse, Lauf, Liste: Die beiden Fassungen einer Liste liegen beieinander.
      .flatMap((b) => ordnungen(b.liste ? wahl.ordnungLauf : wahl.ordnungGesamt).map((ordnung): ErgebnisBlatt => ({ ...b, key: `${b.key}/${ordnung}`, ordnung })))
  )
}
