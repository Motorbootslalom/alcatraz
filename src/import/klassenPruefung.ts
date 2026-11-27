import type { ClassId, Starter } from '../types'
import { birthYearRange } from '../domain/classes'
import { isoDatum, istTag, tageImMonat } from '../lib/datum'

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
 * Geburtstag“). `ab`: am Tag mindestens so alt; `bis`: am Tag noch jünger – am Geburtstag selbst
 * nicht mehr (Auslegung vom 24.11.2026, vom Nutzer bestätigt am 26.11.2026, R11-01: „bis zum 27.
 * Geburtstag“ = am 27. Geburtstag selbst nicht mehr).
 */
export interface GeburtstagsGrenze {
  ab?: number
  bis?: number
}

/**
 * Wie nah am Wettkampftag ein Geburtstag an der Grenze warnt (Antwort des Nutzers vom 26.11.2026 auf
 * R11-02 „Welcher Tag zählt, wenn die Veranstaltung über zwei oder mehr Tage geht?“: „Es sollte dann
 * zwei Warnungen geben. Einen Hinweis, dass man 2 Wochen vor dem Datum ist, und eine deutliche Warnung,
 * wenn der Tag weniger als 2 Tage dran ist.“). Gemessen wird der Abstand zwischen dem entscheidenden
 * Geburtstag (6. bzw. 27.) und dem Datum der Veranstaltung (erster Wettkampftag), in beide Richtungen:
 * - `warnungTage`: bis zu so vielen Tagen davor oder danach eine deutliche Warnung – bei zwei oder drei
 *   Wettkampftagen kann der Geburtstag auf einen davon fallen, dann entscheidet der Tag des Starts.
 *   Auslegung vom 26.11.2026: „weniger als 2 Tage“ einschließlich 2 Tagen, damit auch der dritte Tag
 *   (Freitag bis Sonntag) erfasst ist – bestätigt 27.11.2026 (R12-01). In beide Richtungen gleich, also rot
 *   auch, wenn der 6. Geburtstag 1–2 Tage VOR dem ersten Wettkampftag liegt und das Kind an allen Tagen
 *   starten darf (Rot erinnert dann nur ans genaue Hinsehen, etwa wegen eines Tippfehlers in der Meldung) –
 *   bestätigt 27.11.2026 (R12-02).
 * - `hinweisTage`: darüber hinaus bis zu so vielen Tagen ein Hinweis zum Prüfen (gelb).
 * Hier und nicht im Regelwerk-YAML (Entscheidung beim Bau, 26.11.2026): Das Reglement nennt nur die
 * Grenzen in Jahren; wie früh die App davor warnt, ist eine Sache der App und gilt für jedes Regelwerk
 * mit `geburtstagsGrenzen` gleich.
 */
export const GEBURTSTAG_FENSTER = { warnungTage: 2, hinweisTage: 14 } as const

/**
 * Was der Reiter „Starter“ zum Geburtstag sagt – nichts wird gesperrt, verschoben oder abgefragt
 * (Entscheidung des Nutzers vom 24.11.2026: „reicht eine Warnung und kann dann einfach übergangen
 * werden“; die zwei Stufen vom 26.11.2026 bleiben ebenso übergehbar):
 * - `zuJung` / `zuAlt`: klar außerhalb – am ersten Wettkampftag jünger als `ab` und der Geburtstag
 *   mehr als `warnungTage` danach, bzw. schon `bis` oder älter und der Geburtstag mehr als
 *   `warnungTage` davor. Ohne Datum der Veranstaltung: sicher außerhalb nach dem Jahr. Rot, egal wie nah
 *   der Geburtstag liegt – Klasse E mit dem 6. Geburtstag 3–14 Tage nach dem ersten Wettkampftag ist „zu
 *   jung“, nicht gelb (bestätigt 27.11.2026, R12-03).
 * - `knappAb` / `knappBis`: Geburtstag höchstens `warnungTage` vor oder nach dem ersten Wettkampftag.
 * - `nahAb` / `nahBis`: am ersten Wettkampftag startberechtigt, aber der Geburtstag liegt höchstens
 *   `hinweisTage` davor (`ab`) bzw. danach (`bis`). Gelb nur dann (bestätigt 27.11.2026, R12-03).
 * - `pruefenAb` / `pruefenBis`: ohne Datum der Veranstaltung – der Starter wird im Jahr der
 *   Veranstaltung `ab` bzw. `bis`; ob vor oder nach dem Wettkampftag, sagt erst das Datum. Den ganzen
 *   Grenz-Jahrgang mit dem Tag des Geburtstags zu nennen (statt nur „Datum fehlt“): bestätigt 26.11.2026 (R11-29 (1)).
 */
export type GeburtstagsArt = 'zuJung' | 'zuAlt' | 'knappAb' | 'knappBis' | 'nahAb' | 'nahBis' | 'pruefenAb' | 'pruefenBis'

/** `warnung`: deutlich (rot) – klar außerhalb oder knapp; `hinweis`: zum Prüfen (gelb). */
export type GeburtstagsStufe = 'warnung' | 'hinweis'

const STUFE: Record<GeburtstagsArt, GeburtstagsStufe> = {
  zuJung: 'warnung',
  zuAlt: 'warnung',
  knappAb: 'warnung',
  knappBis: 'warnung',
  nahAb: 'hinweis',
  nahBis: 'hinweis',
  pruefenAb: 'hinweis',
  pruefenBis: 'hinweis',
}

export interface GeburtstagsHinweis {
  starter: Starter
  art: GeburtstagsArt
  stufe: GeburtstagsStufe
  /** Die Grenze in Jahren (6 bzw. 27). */
  grenze: number
  /** Alter am Tag der Veranstaltung in vollendeten Jahren; ohne Datum `null`. */
  alter: number | null
  /** Der Tag, an dem der Starter `grenze` Jahre alt wird, JJJJ-MM-TT – bei `ab` der erste Tag mit Starterlaubnis. */
  geburtstag: string
  /** Tage vom Datum der Veranstaltung bis `geburtstag` (positiv: danach, negativ: davor); ohne Datum `null`. */
  abstand: number | null
  /** Nur bei einer `bis`-Grenze: der letzte Tag mit Starterlaubnis (Tag vor `geburtstag`), sonst `null`. */
  letzterTag: string | null
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
 * Fortlaufende Tageszahl eines Tages im gregorianischen Kalender (0 = 01.01.1970). Ohne `Date`:
 * Date.UTC deutet zweistellige Jahre als 19xx, und Sommerzeit spielt so sicher keine Rolle.
 */
function tagNummer(jahr: number, monat: number, tag: number): number {
  const j = monat <= 2 ? jahr - 1 : jahr
  const aera = Math.floor(j / 400)
  const jahrInAera = j - aera * 400
  const tagImJahr = Math.floor((153 * ((monat + 9) % 12) + 2) / 5) + tag - 1
  const tagInAera = jahrInAera * 365 + Math.floor(jahrInAera / 4) - Math.floor(jahrInAera / 100) + tagImJahr
  return aera * 146097 + tagInAera - 719468
}

/** Tage von `von` bis `bis` (beides JJJJ-MM-TT; positiv, wenn `bis` später liegt); `null` ohne gültige Tage. */
export function tageZwischen(von: string, bis: string): number | null {
  const a = tagVon(von)
  const b = tagVon(bis)
  return a && b ? tagNummer(b.jahr, b.monat, b.tag) - tagNummer(a.jahr, a.monat, a.tag) : null
}

/** Der Tag vor `iso` (JJJJ-MM-TT, gültig); über Monats- und Jahreswechsel und den 29.02. */
function tagDavor(iso: string): string {
  const t = tagVon(iso)!
  if (t.tag > 1) return isoDatum(iso.slice(0, 4), t.monat, t.tag - 1)!
  const jahr = t.monat === 1 ? t.jahr - 1 : t.jahr
  const monat = t.monat === 1 ? 12 : t.monat - 1
  return isoDatum(String(jahr).padStart(4, '0'), monat, tageImMonat(jahr, monat))!
}

/**
 * Der Tag, an dem ein Mensch, geboren `geburtsdatum`, `jahre` Jahre alt wird (JJJJ-MM-TT); `null`
 * ohne gültiges Datum. Wer am 29.02. geboren ist, wird in Jahren ohne 29.02. am 01.03. ein Jahr
 * älter: Nach BGB §§ 187 Abs. 2, 188 vollendet er das Lebensjahr mit Ablauf des 28.02. (Auslegung
 * vom 24.11.2026, bestätigt 27.11.2026, R13-14 (1)).
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
 * Die Art eines Geburtstags `abstand` Tage nach dem ersten Wettkampftag (negativ: davor) an einer
 * `ab`- bzw. `bis`-Grenze; `null` = nichts zu sagen. Die Grenzen nach GEBURTSTAG_FENSTER (26.11.2026).
 */
export function geburtstagsArtMitDatum(abstand: number, art: 'ab' | 'bis'): GeburtstagsArt | null {
  const { warnungTage, hinweisTage } = GEBURTSTAG_FENSTER
  if (Math.abs(abstand) <= warnungTage) return art === 'ab' ? 'knappAb' : 'knappBis'
  if (art === 'ab') return abstand > 0 ? 'zuJung' : -abstand <= hinweisTage ? 'nahAb' : null
  return abstand < 0 ? 'zuAlt' : abstand <= hinweisTage ? 'nahBis' : null
}

/**
 * Ob der Starter am ersten Wettkampftag selbst schon außerhalb liegt, obwohl die Art `knapp…` heißt:
 * an der `ab`-Grenze mit dem Geburtstag 1–2 Tage danach (noch zu jung), an der `bis`-Grenze mit dem
 * Geburtstag am Tag oder 1–2 Tage davor (schon zu alt – dann an keinem Tag der Veranstaltung). Der Text
 * sagt das dann ausdrücklich, statt nur einen „letzten Tag“ vor der Veranstaltung zu nennen
 * (Prüfbefund 26.11.2026). Stufe und Art bleiben: deutlich ist die Warnung ohnehin.
 */
export function knappAmErstenTagAusserhalb(h: Pick<GeburtstagsHinweis, 'art' | 'abstand'>): boolean {
  if (h.abstand === null) return false
  return (h.art === 'knappAb' && h.abstand > 0) || (h.art === 'knappBis' && h.abstand <= 0)
}

/**
 * Die Starter, deren Geburtstag zur Grenze ihrer Klasse zu prüfen ist (Reihenfolge wie `starters`,
 * je Starter und Grenze höchstens ein Eintrag). Mit Datum der Veranstaltung (`eventDatum`, erster
 * Wettkampftag) nach dem Abstand des Geburtstags zu diesem Tag (geburtstagsArtMitDatum). Ohne Datum nur
 * nach dem Jahr der Veranstaltung: sicher zu jung/zu alt (der Grenz-Geburtstag liegt in einem anderen
 * Jahr) oder `pruefen…` für den Grenz-Jahrgang. Ohne Geburtsdatum kein Hinweis (das nennt der Reiter
 * schon als „ohne Geburtsdatum“). Rein, für den Reiter „Starter“.
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
      const abstand = mitDatum ? tageZwischen(eventDatum, geburtstag) : null
      let wie: GeburtstagsArt | null
      if (abstand !== null) wie = geburtstagsArtMitDatum(abstand, art)
      else {
        // Ohne Tag nur das Jahr: Wird er die Grenze erst nach dem Jahr der Veranstaltung, ist er sicher zu
        // jung; hatte er sie schon im Jahr davor, sicher zu alt; im Jahr selbst entscheidet der Tag.
        const jahr = g.jahr + jahre
        wie = jahr === eventJahr ? (art === 'ab' ? 'pruefenAb' : 'pruefenBis') : art === 'ab' ? (jahr > eventJahr ? 'zuJung' : null) : jahr < eventJahr ? 'zuAlt' : null
      }
      if (wie) out.push({ starter: s, art: wie, stufe: STUFE[wie], grenze: jahre, alter, geburtstag, abstand, letzterTag: art === 'bis' ? tagDavor(geburtstag) : null })
    }
    if (grenze.ab !== undefined) pruefe(grenze.ab, 'ab')
    if (grenze.bis !== undefined) pruefe(grenze.bis, 'bis')
  }
  return out
}
