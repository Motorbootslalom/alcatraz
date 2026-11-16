import type { ClassId, Starter } from '../types'
import { birthYearRange } from '../domain/classes'

/**
 * Passt die Klasse eines Starters zu seinem Geburtsjahr? Geprüft wird beim Einfügen aus
 * Excel, beim Hinzufügen von Hand und beim Bearbeiten: Eine falsche Klasse fiele sonst erst bei
 * der Verwiegung oder gar nicht auf – und wer in der falschen Klasse fährt, verfälscht deren
 * Wertung. Die Jahrgänge einer Klasse folgen aus dem Jahr der Veranstaltung (domain/classes.ts
 * birthYearRange), welche Klassen es gibt, sagt das Regelwerk (`klassen`, config/catalog.ts).
 */
export interface KlassenFehler {
  starter: Starter
  /** Geburtsjahr laut Liste. */
  jahr: number
  /** Jahrgänge, die in der gemeldeten Klasse starten dürfen. */
  erlaubt: [number, number]
  /** Klassen, in die das Geburtsjahr gehört; leer, wenn in keine. */
  passend: ClassId[]
}

export interface KlassenPruefung {
  fehler: KlassenFehler[]
  /** Starter ohne Geburtsdatum: Sie lassen sich nicht prüfen. */
  ohneDatum: number
}

/** Das Geburtsjahr aus JJJJ-MM-TT; `null` ohne (lesbares) Datum. */
export function geburtsjahr(geburtsdatum: string): number | null {
  const jahr = parseInt(geburtsdatum.slice(0, 4), 10)
  return geburtsdatum && !Number.isNaN(jahr) ? jahr : null
}

/** Die Klassen des Regelwerks, in denen der Jahrgang starten darf (die Klassen überschneiden sich nicht: höchstens eine). */
export function klassenFuerJahr(jahr: number, eventJahr: number, klassen: readonly ClassId[]): ClassId[] {
  return klassen.filter((k) => {
    const [von, bis] = birthYearRange(k, eventJahr)
    return jahr >= von && jahr <= bis
  })
}

/**
 * Die Jahrgänge, die nach dem Regelwerk überhaupt starten – zusammenhängende Klassen als ein
 * Bereich, aufsteigend. Für die Meldung, wenn ein Jahrgang in keine Klasse passt.
 */
export function startendeJahrgaenge(eventJahr: number, klassen: readonly ClassId[]): [number, number][] {
  const bereiche = klassen.map((k) => birthYearRange(k, eventJahr)).sort((a, b) => a[0] - b[0])
  const zusammen: [number, number][] = []
  for (const [von, bis] of bereiche) {
    const letzter = zusammen[zusammen.length - 1]
    if (letzter && von <= letzter[1] + 1) letzter[1] = Math.max(letzter[1], bis)
    else zusammen.push([von, bis])
  }
  return zusammen
}

/** „2008–2020“, mehrere Bereiche durch Komma getrennt. */
export function jahrgaengeText(bereiche: readonly [number, number][]): string {
  return bereiche.map(([von, bis]) => (von === bis ? String(von) : `${von}–${bis}`)).join(', ')
}

/** `klassen`: die Klassen des Regelwerks, in denen ein passender Jahrgang gesucht wird. */
export function pruefeKlassen(starters: readonly Starter[], eventJahr: number, klassen: readonly ClassId[]): KlassenPruefung {
  const fehler: KlassenFehler[] = []
  let ohneDatum = 0
  for (const s of starters) {
    const jahr = geburtsjahr(s.geburtsdatum)
    if (jahr === null) {
      ohneDatum++
      continue
    }
    const erlaubt = birthYearRange(s.klasse, eventJahr)
    if (jahr >= erlaubt[0] && jahr <= erlaubt[1]) continue
    fehler.push({ starter: s, jahr, erlaubt, passend: klassenFuerJahr(jahr, eventJahr, klassen) })
  }
  return { fehler, ohneDatum }
}
