import type { ClassId, Starter } from '../types'
import { birthYearRange } from '../domain/classes'

/**
 * Passt die Klasse eines Starters zu seinem Geburtsjahr? Geprüft wird beim Einfügen aus
 * Excel: Eine falsche Klasse fiele sonst erst bei der Verwiegung oder gar nicht auf – und
 * wer in der falschen Klasse fährt, verfälscht deren Wertung.
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

/** `klassen`: die Klassen des Regelwerks, in denen ein passender Jahrgang gesucht wird. */
export function pruefeKlassen(starters: readonly Starter[], eventJahr: number, klassen: readonly ClassId[]): KlassenPruefung {
  const fehler: KlassenFehler[] = []
  let ohneDatum = 0
  for (const s of starters) {
    const jahr = parseInt(s.geburtsdatum.slice(0, 4), 10)
    if (!s.geburtsdatum || Number.isNaN(jahr)) {
      ohneDatum++
      continue
    }
    const erlaubt = birthYearRange(s.klasse, eventJahr)
    if (jahr >= erlaubt[0] && jahr <= erlaubt[1]) continue
    const passend = klassen.filter((k) => {
      const [von, bis] = birthYearRange(k, eventJahr)
      return jahr >= von && jahr <= bis
    })
    fehler.push({ starter: s, jahr, erlaubt, passend })
  }
  return { fehler, ohneDatum }
}
