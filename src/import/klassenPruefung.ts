import type { ClassId, Starter } from '../types'
import { birthYearRange } from '../domain/classes'
import { isoDatum, istTag } from '../lib/datum'

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

/**
 * Starterlaubnis nach Geburtstag (Regelwerk `geburtstagsGrenzen`, DM-Reglement C8: „Klasse ME
 * Starterlaubnis versicherungsbedingt ab dem 6. Geburtstag und Klasse M7 Starterlaubnis bis zum 27.
 * Geburtstag“). `ab`: am Tag der Veranstaltung mindestens so alt; `bis`: am Tag noch jünger – am
 * Geburtstag selbst nicht mehr (Auslegung vom 24.11.2026, offen zur Bestätigung).
 */
export interface GeburtstagsGrenze {
  ab?: number
  bis?: number
}

/**
 * Was der Reiter „Starter“ zum Geburtstag sagt – nur eine Warnung, nichts wird gesperrt, verschoben
 * oder abgefragt (Entscheidung des Nutzers vom 24.11.2026: „reicht eine Warnung und kann dann einfach
 * übergangen werden“):
 * - `zuJung` / `zuAlt`: am Tag der Veranstaltung jünger als `ab` bzw. schon `bis` oder älter.
 * - `pruefenAb` / `pruefenBis`: ohne Datum der Veranstaltung – der Starter wird im Jahr der
 *   Veranstaltung `ab` bzw. `bis`; ob vor oder nach dem Wettkampftag, sagt erst das Datum.
 */
export type GeburtstagsArt = 'zuJung' | 'zuAlt' | 'pruefenAb' | 'pruefenBis'

export interface GeburtstagsHinweis {
  starter: Starter
  art: GeburtstagsArt
  /** Die Grenze in Jahren (6 bzw. 27). */
  grenze: number
  /** Alter am Tag der Veranstaltung in vollendeten Jahren; ohne Datum `null`. */
  alter: number | null
  /** Der Tag, an dem der Starter `grenze` Jahre alt wird, JJJJ-MM-TT. */
  geburtstag: string
}

const ISO_TAG = /^(\d{4})-(\d{2})-(\d{2})$/

/** Jahr, Monat, Tag eines gespeicherten Datums (JJJJ-MM-TT); `null`, wenn es den Tag nicht gibt. */
function tagVon(iso: string): { jahr: number; monat: number; tag: number } | null {
  const m = ISO_TAG.exec(iso)
  if (!m) return null
  const [jahr, monat, tag] = [Number(m[1]), Number(m[2]), Number(m[3])]
  return isoDatum(m[1], monat, tag) === null ? null : { jahr, monat, tag }
}

/**
 * Der Tag, an dem ein Mensch, geboren `geburtsdatum`, `jahre` Jahre alt wird (JJJJ-MM-TT); `null`
 * ohne gültiges Datum. Wer am 29.02. geboren ist, wird in Jahren ohne 29.02. am 01.03. ein Jahr
 * älter: Nach BGB §§ 187 Abs. 2, 188 vollendet er das Lebensjahr mit Ablauf des 28.02. (Auslegung
 * vom 24.11.2026, offen zur Bestätigung).
 */
export function geburtstagMit(geburtsdatum: string, jahre: number): string | null {
  const g = tagVon(geburtsdatum)
  if (!g) return null
  const jahr = String(g.jahr + jahre).padStart(4, '0')
  return isoDatum(jahr, g.monat, g.tag) ?? `${jahr}-03-01`
}

/** Alter in vollendeten Jahren am Tag `tag` (beides JJJJ-MM-TT); `null`, wenn eines fehlt oder ungültig ist. */
export function alterAm(geburtsdatum: string, tag: string): number | null {
  const g = tagVon(geburtsdatum)
  const t = tagVon(tag)
  if (!g || !t) return null
  const jahre = t.jahr - g.jahr
  // Hat der Geburtstag dieses Jahres schon stattgefunden? Über geburtstagMit – so gilt der 01.03. für den 29.02.
  return tag >= (geburtstagMit(geburtsdatum, jahre) ?? tag) ? jahre : jahre - 1
}

/**
 * Die Starter, deren Geburtstag zur Grenze ihrer Klasse zu prüfen ist (Reihenfolge wie `starters`).
 * Mit Datum der Veranstaltung (`eventDatum`, erster Wettkampftag) genau: zu jung oder zu alt an diesem
 * Tag. Ohne Datum nur nach dem Jahr der Veranstaltung: sicher zu jung/zu alt (der Grenz-Geburtstag
 * liegt in einem anderen Jahr) oder `pruefen…` für den Grenz-Jahrgang. Ohne Geburtsdatum kein Hinweis
 * (das nennt der Reiter schon als „ohne Geburtsdatum“). Rein, für den Reiter „Starter“.
 */
export function geburtstagsHinweise(
  starters: readonly Starter[],
  grenzen: Partial<Record<ClassId, GeburtstagsGrenze>>,
  eventJahr: number,
  eventDatum: string,
): GeburtstagsHinweis[] {
  const mitDatum = istTag(eventDatum)
  const out: GeburtstagsHinweis[] = []
  for (const s of starters) {
    const grenze = grenzen[s.klasse]
    const g = tagVon(s.geburtsdatum)
    if (!grenze || !g) continue
    const alter = mitDatum ? alterAm(s.geburtsdatum, eventDatum) : null
    const pruefe = (jahre: number, art: 'ab' | 'bis') => {
      const geburtstag = geburtstagMit(s.geburtsdatum, jahre)!
      let wie: GeburtstagsArt | null
      if (alter !== null) wie = art === 'ab' ? (alter < jahre ? 'zuJung' : null) : alter >= jahre ? 'zuAlt' : null
      else {
        // Ohne Tag nur das Jahr: Wird er die Grenze erst nach dem Jahr der Veranstaltung, ist er sicher zu
        // jung; hatte er sie schon im Jahr davor, sicher zu alt; im Jahr selbst entscheidet der Tag.
        const jahr = g.jahr + jahre
        wie = jahr === eventJahr ? (art === 'ab' ? 'pruefenAb' : 'pruefenBis') : art === 'ab' ? (jahr > eventJahr ? 'zuJung' : null) : jahr < eventJahr ? 'zuAlt' : null
      }
      if (wie) out.push({ starter: s, art: wie, grenze: jahre, alter, geburtstag })
    }
    if (grenze.ab !== undefined) pruefe(grenze.ab, 'ab')
    if (grenze.bis !== undefined) pruefe(grenze.bis, 'bis')
  }
  return out
}
