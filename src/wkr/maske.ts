import type { CellKind, ClassId } from '../types'
import type { Konfig } from '../config/konfig'
import { codeEntries, normalizeCodeCell, parseCodeEntry } from '../lib/codes'
import { listenFelder } from '../lib/eingaben'
import { CLASS_IDS } from '../domain/classes'
import { WKR_ANNAHMEN } from './annahmen'
import { bojenHalt, bojenLage, katalogFolge, type Weg } from './bojen'
import type { ListenTeil } from './liste'
import type { ListenSicht, MaskenFeld } from './sicht'

// Die Maske „Knöpfe“ der WKR-Geräte (W3, Plan docs/plan-wkr-w3.md §3.1, 21.11.2026) – rein, ohne DOM, ohne Store,
// nichts aus geraete/. Aus der Sicht der Liste (wkr/sicht.ts) entsteht der Aufbau der Maske einer Klasse; die Tipps
// des Wettkampfrichters sammelt ein Entwurf, und `zellenAus` macht daraus GENAU die Zellwerte, die der Bedienrechner
// unverändert annimmt (wkr/zeile.ts wertGilt: dieselben Sanierer wie die Erfassungstabelle, lib/codes.ts
// normalizeCodeCell, lib/disq.ts sanitizeDisq). Das Gerät rechnet nichts, was der Bedienrechner anders sähe.

/**
 * Welche Maske eine Liste bekommt (G2: an den Feldarten erkannt, nicht an der Listen-ID): nur Katalog, Disq. und Text
 * → `katalog` (mit Codes) bzw. `vorsteg` (ohne Codes: nur Disq. und Bemerkung); seit W4.1 (21.11.2026, P1) Bojen auf
 * dem Fahrweg (mit `boje` in der Sicht), auch gemischt mit Katalog, Disq. und Text → `bojen`; ein Feld mit Zeit oder
 * Punkten oder eine Boje außerhalb des Fahrwegs (Knoten) → `spaeter` (Masken W5, bis dahin Papier, G14).
 */
export type MaskenArt = 'katalog' | 'vorsteg' | 'bojen' | 'spaeter'

export interface MaskenCode {
  code: string
  text: string
  punkte: number
}

/** Ein Teil der Maske: ein Code-Feld mit seinem Katalog (Steg: Ablegen/Anlegen, Tor 5 und MüB: eines). */
export interface MaskenTeil {
  /** Steg-Teil (F16); `null` bei ungeteilten Listen. */
  teil: ListenTeil | null
  /** Feld-Kennung (z. B. `katalog:tor5`). */
  feld: string
  /** Überschrift des Felds in der gewählten Sprache. */
  titel: string
  codes: MaskenCode[]
  /** Disq.-Buchstaben, die dieses Feld annimmt (für die Schreibweise, H1). */
  buchstaben: string[]
}

export interface MaskenDisq {
  /** Das Feld der Disq.-Buchstaben: das eigene Disq.-Feld der Liste, sonst das erste Code-Feld (H1). */
  feld: string
  /** Gemeinsam für beide Teile (Steg `disq@steg`), sonst gehört es zum Teil des Code-Felds. */
  teil: ListenTeil | null
  /** `nurIn`: nur in diesen Teilen anzubieten (X am Steg nur im Ablegen, F5). */
  codes: { code: string; text: string; nurIn?: ListenTeil[] }[]
}

/** Ein Knopf der Bojen-Maske: eine Boje in einer Richtung (W4.1, P2, P7). */
export interface MaskenBoje {
  /** Feld-Kennung (`t1a|hin seiteB`). */
  feld: string
  /** Kopf der Unterspalte wie auf dem Bogen („H L“), '' ohne Unterspalte (Speedboje, Parallel-Bojen 1–5). */
  unter: string
  /** Knopfspalte aus Sicht des WKR; `null` = volle Breite. */
  spalte: 0 | 1 | null
  /** Zähler (Torbojen Tor 5, F2) statt Schalter. */
  zaehler: boolean
  /** Punkte je Berührung (P4). */
  punkte: number
  /**
   * Disq.-Buchstaben, die DIESE Bojenzelle annimmt (lib/disq.ts sanitizeBuoy, wie beim Abtippen) – Disq. an der Boje
   * (Nutzer 21.11.2026, WKR_ANNAHMEN.disqAnBoje, U1). Leer: an dieser Boje kein Disq.
   */
  disq: { code: string; text: string }[]
}

/** Eine Zeile der Bojen-Maske: ein Tor (bzw. Start, Ziel, Speedboje, Parallel-Boje) in einer Richtung. */
export interface MaskenHalt {
  halt: string
  /** Kopf der Spalte („Tor 1“). */
  titel: string
  weg: Weg
  /** Zweite Durchfahrt desselben Tores (Tor 1 der Speedrunde, P3). */
  durchfahrt?: 2
  /** Die Bojen in der Reihenfolge der Knopfspalten (0, 1, dann volle Breite). */
  bojen: MaskenBoje[]
}

/** Ein Abschnitt der Bojen-Maske in Fahrtfolge: ein Halt oder ein Katalog-Teil an seinem Platz (Einfahrt Tor 5, MüB). */
export type MaskenAbschnitt = { art: 'halt'; halt: MaskenHalt } | { art: 'katalog'; teil: MaskenTeil; weg: Weg }

export interface MaskenAufbau {
  art: MaskenArt
  /** Titel der Klasse („Klasse 5“). */
  titel: string
  /** Steg: [ab, an]; Tor 5 / MüB: [ein Teil]; Vorsteg und `spaeter`: []; `bojen`: die Katalog-Teile (auch in `abschnitte`). */
  teile: MaskenTeil[]
  /** `null`: Die Liste kennt keine Disq. (oder `spaeter`). X nur, wo die Sicht es anbietet (F5). */
  disq: MaskenDisq | null
  /** Feld-Kennung der Bemerkung, sonst `null`. */
  bemerkung: string | null
  /** Nur `bojen`: Halte und Katalog-Teile in Fahrtfolge (P6); sonst leer. */
  abschnitte: MaskenAbschnitt[]
  /** Nur `bojen`: mehr Zeilen als `bojenZeilenEineSeite` → Umschalter Hinweg/Rückweg (P8). */
  umschalter: boolean
}

/** Feldarten, die die Maske „Knöpfe“ abdeckt (G2); `buoy` nur mit Bojen-Angabe (W4.1). */
const KNOPF_ARTEN: readonly CellKind[] = ['code', 'disq', 'text']

/**
 * Die Art der Maske aus den Feldern einer Klasse (G2, P1). Ein `buoy`-Feld ist eine Boje der Maske, wenn es eine
 * Bojen-Angabe trägt (`boje` aus der Sicht bzw. aus wkr/bojen.ts bojenHalt) – Knoten (auch `buoy`) bleiben `spaeter`.
 */
export function maskenArt(felder: readonly { kind: CellKind; boje?: unknown }[]): MaskenArt {
  if (felder.some((f) => (f.kind === 'buoy' ? !f.boje : !KNOPF_ARTEN.includes(f.kind)))) return 'spaeter'
  if (felder.some((f) => f.kind === 'buoy')) return 'bojen'
  return felder.some((f) => f.kind === 'code') ? 'katalog' : 'vorsteg'
}

/**
 * Hat eine Liste in W3 eine Maske auf dem Gerät? (W3.2, Bedienrechner beim Zuweisen, G14.) Nein, sobald eine der
 * `klassen`, die die Liste hat, ein Feld außerhalb von Katalog/Disq./Text trägt (`spaeter`: Zeit, Knoten, Bojen außerhalb des Fahrwegs) –
 * dann zeigt das Gerät „Maske folgt – Papier“. Eine unbekannte Liste hat keine Maske. Klassen ohne die Liste zählen
 * nicht; ohne eine einzige passende Klasse entscheidet die Liste über alle ihre Klassen (Auslegung J1, 21.11.2026).
 */
export function listeMitMaske(konfig: Konfig, typeId: string, klassen: Iterable<ClassId>): boolean {
  if (!konfig.getPositions().some((p) => p.typeId === typeId)) return false
  const passend = [...new Set(klassen)].filter((k) => konfig.positionAllowsClass(typeId, k))
  const pruefe = passend.length > 0 ? passend : CLASS_IDS.filter((k) => konfig.positionAllowsClass(typeId, k))
  return pruefe.every((k) => maskenArt(listenFelder(konfig, typeId, k).map((f) => ({ kind: f.kind, boje: f.kind === 'buoy' ? bojenHalt(f.kennung) : null }))) !== 'spaeter')
}

/**
 * Der Aufbau der Maske einer Klasse. `sprache`: `liste` (Vorgabe) = die Texte der Sicht; `andere` = die zweite
 * Sprache (F13), wenn die Sicht sie trägt – sonst ebenfalls die der Liste. `null`: Die Klasse hat diese Liste nicht
 * (entfällt) oder kommt in der Sicht nicht vor.
 */
export function maskeFuer(sicht: ListenSicht, klasse: ClassId, sprache: 'liste' | 'andere' = 'liste'): MaskenAufbau | null {
  const k = sicht.klassen[klasse]
  if (!k || !k.felder) return null
  const anders = sprache === 'andere' ? sicht.andere?.klassen[klasse] : undefined
  const andereFelder = new Map((anders?.felder ?? []).map((f) => [f.kennung, f]))
  const titel = anders?.titel ?? k.titel
  const art = maskenArt(k.felder)
  if (art === 'spaeter') return { art, titel, teile: [], disq: null, bemerkung: null, abschnitte: [], umschalter: false }

  const textVon = (feld: MaskenFeld, code: string, art: 'katalog' | 'disq', vorgabe: string) =>
    andereFelder.get(feld.kennung)?.[art]?.find((e) => e.code === code)?.text ?? vorgabe

  const teile: MaskenTeil[] = k.felder
    .filter((f) => f.kind === 'code')
    .map((f) => ({
      teil: f.teil ?? null,
      feld: f.kennung,
      titel: andereFelder.get(f.kennung)?.label ?? f.label,
      codes: (f.katalog ?? []).map((e) => ({ code: e.code, punkte: e.punkte, text: textVon(f, e.code, 'katalog', e.text) })),
      buchstaben: (f.disq ?? []).map((d) => d.code),
    }))

  // Das Disq.-Feld: das eigene der Liste; ohne eines das erste Code-Feld (dort sortiert normalizeCodeCell die
  // Buchstaben hinter die Codes, H1).
  const disqFeld = k.felder.find((f) => f.kind === 'disq') ?? k.felder.find((f) => f.kind === 'code' && (f.disq ?? []).length > 0)
  let disq: MaskenDisq | null = null
  if (disqFeld && (disqFeld.disq ?? []).length > 0) {
    const gemeinsam = disqFeld.kind === 'disq'
    const geteilt = teile.some((t) => t.teil !== null)
    disq = {
      feld: disqFeld.kennung,
      teil: gemeinsam ? null : (disqFeld.teil ?? null),
      codes: disqFeld.disq!.map((d) => {
        const out: MaskenDisq['codes'][number] = { code: d.code, text: textVon(disqFeld, d.code, 'disq', d.text) }
        // Gemeinsames Feld einer geteilten Liste: ein Buchstabe nur in den Teilen, deren Code-Feld ihn auch annimmt –
        // so bleibt X am Steg im Ablegen (die Sicht nimmt es dem Anlegen schon weg, F5).
        if (gemeinsam && geteilt) {
          const nurIn = teile.filter((t) => t.teil !== null && t.buchstaben.includes(d.code)).map((t) => t.teil as ListenTeil)
          if (nurIn.length < teile.filter((t) => t.teil !== null).length) out.nurIn = nurIn
        }
        return out
      }),
    }
  }
  const bemerkung = k.felder.find((f) => f.kind === 'text')?.kennung ?? null
  if (art !== 'bojen') return { art, titel, teile, disq, bemerkung, abschnitte: [], umschalter: false }

  // Bojen (W4.1): Felder gleichen Halts und Wegs zu einer Zeile, Zeilen und Katalog-Teile nach dem Fahrweg (P6).
  const halte = new Map<string, MaskenHalt & { folge: number }>()
  for (const f of k.felder) {
    if (f.kind !== 'buoy' || !f.boje) continue
    const b = f.boje
    const anderes = andereFelder.get(f.kennung)?.boje
    const schluessel = `${b.halt}|${b.weg}`
    const halt = halte.get(schluessel) ?? { halt: b.halt, titel: anderes?.titel ?? b.titel, weg: b.weg, ...(b.durchfahrt ? { durchfahrt: b.durchfahrt } : {}), bojen: [], folge: b.folge }
    const disq = (f.disq ?? []).map((d) => ({ code: d.code, text: textVon(f, d.code, 'disq', d.text) }))
    halt.bojen.push({ feld: f.kennung, unter: anderes?.unter ?? b.unter, spalte: b.spalte, zaehler: !!b.zaehler, punkte: WKR_ANNAHMEN.bojenPunkte, disq })
    halte.set(schluessel, halt)
  }
  const platz = (s: number | null) => (s === null ? 2 : s)
  const mitFolge: { folge: number; abschnitt: MaskenAbschnitt }[] = [...halte.values()].map(({ folge, ...halt }) => ({
    folge,
    abschnitt: { art: 'halt', halt: { ...halt, bojen: [...halt.bojen].sort((a, b) => platz(a.spalte) - platz(b.spalte)) } },
  }))
  for (const t of teile) {
    // Ein Katalog ohne Platz im Fahrweg (eigener Aufbau) kommt ans Ende des Rückwegs.
    const p = katalogFolge(t.feld) ?? { folge: Number.MAX_SAFE_INTEGER, weg: 'rueck' as const }
    mitFolge.push({ folge: p.folge, abschnitt: { art: 'katalog', teil: t, weg: p.weg } })
  }
  const abschnitte = mitFolge.sort((a, b) => a.folge - b.folge).map((x) => x.abschnitt)
  const aufbau: MaskenAufbau = { art, titel, teile, disq, bemerkung, abschnitte, umschalter: false }
  aufbau.umschalter = maskenZeilen(aufbau) > WKR_ANNAHMEN.bojenZeilenEineSeite
  return aufbau
}

/** Zeilen der Bojen-Maske (P8): je Halt eine, je Code eines Katalog-Abschnitts eine. */
export function maskenZeilen(aufbau: MaskenAufbau): number {
  return aufbau.abschnitte.reduce((n, a) => n + (a.art === 'halt' ? 1 : a.teil.codes.length), 0)
}

/**
 * Die Bojen-Maske „wie der Parcours liegt“ (Nutzer 21.11.2026, WKR_ANNAHMEN.bojenNachLage/bojenSpiegeln, V1/V2): je
 * Ort im Parcours eine Gruppe (wkr/bojen.ts bojenLage – Tor 1 mit Hin, Rück und 2. Durchfahrt; Start und Ziel; Tor 5
 * mit Einfahrt; MüB an der Schikane), Gruppen längs der Strecke, mit `startOben: false` umgekehrt; in der Gruppe die
 * Abschnitte in Fahrtfolge. Abschnitte ohne Platz (eigener Aufbau) kommen als eigene Gruppen ans Ende.
 */
export interface LageGruppe {
  /** Platz längs der Strecke (wkr/bojen.ts BOJEN_LAGE); `null` ohne Platz. */
  lage: number | null
  /** Überschrift: die Titel der Halte (bzw. des Katalogs), ohne Doppel – „Tor 1“, „Start / Ziel“. */
  titel: string
  /** Hat die Gruppe Halte mit verschiedenen Titeln (Start und Ziel, Sp. 1 und Sp. 2)? Dann tragen die Zeilen ihren Titel. */
  titelJeZeile: boolean
  abschnitte: MaskenAbschnitt[]
}

export function nachLage(aufbau: MaskenAufbau, startOben = true): LageGruppe[] {
  const gruppen: LageGruppe[] = []
  const jeLage = new Map<number, LageGruppe>()
  for (const a of aufbau.abschnitte) {
    const lage = bojenLage(a.art === 'halt' ? a.halt.halt : a.teil.feld)
    const g = lage === null ? undefined : jeLage.get(lage)
    if (g) g.abschnitte.push(a)
    else {
      const neu: LageGruppe = { lage, titel: '', titelJeZeile: false, abschnitte: [a] }
      gruppen.push(neu)
      if (lage !== null) jeLage.set(lage, neu)
    }
  }
  for (const g of gruppen) {
    const halte = [...new Set(g.abschnitte.flatMap((a) => (a.art === 'halt' ? [a.halt.titel] : [])))]
    const titel = halte.length > 0 ? halte : g.abschnitte.map((a) => (a.art === 'katalog' ? a.teil.titel.replace(/:\s*$/, '') : ''))
    g.titel = titel.filter(Boolean).join(' / ')
    g.titelJeZeile = halte.length > 1
  }
  const mitLage = gruppen.filter((g) => g.lage !== null).sort((a, b) => (startOben ? a.lage! - b.lage! : b.lage! - a.lage!))
  return [...mitLage, ...gruppen.filter((g) => g.lage === null)]
}

/** Weg eines Abschnitts (für den Umschalter). */
export function wegVon(a: MaskenAbschnitt): Weg {
  return a.art === 'halt' ? a.halt.weg : a.weg
}

/**
 * Die Maske für die Probe beim Einrichten (W3.4, G10, Plan §5.9): die der ersten Klasse (in der Folge der Sicht), die
 * eine Maske „Knöpfe“ hat – Katalog vor Vorsteg ist egal, eine Liste hat nur eine Art. Bei Bojen-Listen (W4.1, P11)
 * die Klasse mit den MEISTEN Zeilen (zeigt Speedrunde und Umschalter; bei Gleichstand die erste). `null`: Die Liste
 * hat keine (nur Zeit/Knoten oder keine Klasse mit der Liste) – dann gibt es keine Probe.
 */
export function probeMaske(sicht: ListenSicht, sprache: 'liste' | 'andere' = 'liste'): MaskenAufbau | null {
  let beste: MaskenAufbau | null = null
  for (const k of Object.keys(sicht.klassen) as ClassId[]) {
    const a = maskeFuer(sicht, k, sprache)
    if (!a || a.art === 'spaeter') continue
    if (a.art !== 'bojen') return a
    if (!beste || maskenZeilen(a) > maskenZeilen(beste)) beste = a
  }
  return beste
}

/** Alle Bojen-Knöpfe einer Maske in Fahrtfolge. */
export function bojenVon(aufbau: MaskenAufbau): MaskenBoje[] {
  return aufbau.abschnitte.flatMap((a) => (a.art === 'halt' ? a.halt.bojen : []))
}

/** Die Teile, die eine Zeile dieses Teils beschreibt (ohne Teil: alle). */
export function teileFuer(aufbau: MaskenAufbau, teil?: ListenTeil): MaskenTeil[] {
  return aufbau.teile.filter((t) => teil === undefined || t.teil === null || t.teil === teil)
}

/** Die Disq.-Buchstaben, die in diesem Teil angeboten werden (X am Steg nur im Ablegen, F5). */
export function disqFuer(aufbau: MaskenAufbau, teil?: ListenTeil): MaskenDisq['codes'] {
  if (!aufbau.disq) return []
  if (aufbau.disq.teil !== null && teil !== undefined && aufbau.disq.teil !== teil) return []
  return aufbau.disq.codes.filter((c) => !c.nurIn || teil === undefined || c.nurIn.includes(teil))
}

// ---------------------------------------------------------------------------
// Entwurf: die Tipps eines Starts (je Teil)
// ---------------------------------------------------------------------------

/**
 * Merker für einen Disq.-Tipp in `folge`, mit dem Buchstaben (`#disq:A`): Nimmt ein zweiter Tipp einen Buchstaben
 * heraus, fällt genau sein Merker – „zurück“ nimmt danach wirklich den letzten Tipp (H2; Prüfbefund W3, 21.11.2026).
 */
const DISQ = '#disq:'
/** Merker für einen Bojen-Tipp in `folge` (`#boje:t1a|hin seiteB`, W4.1) – „zurück“ nimmt genau diesen Tipp. */
const BOJE = '#boje:'
/**
 * Merker für einen Disq.-Buchstaben an einer Boje (`#bdisq:t3a|hin seiteB`, U1, 21.11.2026). Ersetzte der Buchstabe
 * etwas, hängt dahinter je `WAR` der vorige Stand des Felds – `+2` (zwei Berührungen) bzw. `=G` (Buchstabe G, samt
 * dessen eigenem Rest): „− letzte zurück“ stellt ihn wieder her (Prüfbefund 21.11.2026: Punkte → Disq. → zurück
 * ließ die Zelle leer, die Berührung war still verloren – H2 „zurück = letzter Tipp“).
 */
const BOJEN_DISQ = '#bdisq:'
const WAR = '\u001f'
/** Ist `m` der Bojen-Disq.-Merker dieses Felds (mit oder ohne vorigen Stand)? */
const istBojenDisqMerker = (m: string, feld: string) => m === BOJEN_DISQ + feld || m.startsWith(BOJEN_DISQ + feld + WAR)

/**
 * Was der Wettkampfrichter für einen Start (und Teil) getippt hat. `codes`: je Feld die Code-Tipps in Reihenfolge
 * (ein Tipp = +1, H2); `disq`: Buchstaben in Tipp-Reihenfolge, jeder höchstens einmal (Schalter, H1); `folge`: die
 * Reihenfolge aller Tipps (Feld bzw. Disq.) für „− letzte zurück“.
 */
export interface Entwurf {
  codes: Record<string, string[]>
  disq: string[]
  bemerkung: string
  folge: string[]
  /** Berührungen je Bojen-Feld (W4.1): Schalter 0/1, Zähler bis `bojenZaehlerMax`; 0 steht nie drin. */
  bojen: Record<string, number>
  /**
   * Disq.-Buchstabe je Bojen-Feld (U1, 21.11.2026): an dieser Boje disqualifiziert – die Zelle trägt dann den
   * Buchstaben statt der Punkte (U2: ein Feld hat nie beides).
   */
  bojenDisq: Record<string, string>
}

export function leererEntwurf(): Entwurf {
  return { codes: {}, disq: [], bemerkung: '', folge: [], bojen: {}, bojenDisq: {} }
}

/**
 * Ein Bojen-Tipp (W4.1, P2, P5): Schalter – der erste setzt, der zweite nimmt weg (samt SEINEM Merker, wie Disq.);
 * Zähler – jeder Tipp +1 bis `bojenZaehlerMax`, danach nimmt der Knopf nichts mehr an (gleiche Referenz zurück).
 */
export function tippeBoje(e: Entwurf, boje: Pick<MaskenBoje, 'feld' | 'zaehler'>): Entwurf {
  // Eine Boje mit Disq.-Buchstaben nimmt keine Berührung an (U2) – ändern nur über „Disq. an Boje“ bzw. „zurück“.
  if (e.bojenDisq[boje.feld]) return e
  const n = e.bojen[boje.feld] ?? 0
  if (boje.zaehler) {
    if (n >= WKR_ANNAHMEN.bojenZaehlerMax) return e
    return { ...e, bojen: { ...e.bojen, [boje.feld]: n + 1 }, folge: [...e.folge, BOJE + boje.feld] }
  }
  if (n === 0) return { ...e, bojen: { ...e.bojen, [boje.feld]: 1 }, folge: [...e.folge, BOJE + boje.feld] }
  const bojen = { ...e.bojen }
  delete bojen[boje.feld]
  const i = e.folge.lastIndexOf(BOJE + boje.feld)
  return { ...e, bojen, folge: e.folge.filter((_, j) => j !== i) }
}

/**
 * Disq. an einer Boje (U1/U2, Nutzer 21.11.2026): `code` setzt den Buchstaben (ersetzt einen anderen und löscht die
 * Berührungen dieses Felds samt ihren Merkern – die Zelle hält nur eins; „zurück“ stellt sie wieder her, s.
 * `WAR`); derselbe Buchstabe noch einmal bzw. `null` nimmt ihn heraus. Ein Buchstabe, den die Zelle nicht annimmt,
 * ändert nichts (gleiche Referenz).
 */
export function tippeBojenDisq(e: Entwurf, boje: Pick<MaskenBoje, 'feld' | 'disq'>, code: string | null): Entwurf {
  const alt = e.bojenDisq[boje.feld]
  const i = findLastIndex(e.folge, (m) => istBojenDisqMerker(m, boje.feld))
  if (code === null || code === alt) {
    if (!alt) return e
    const bojenDisq = { ...e.bojenDisq }
    delete bojenDisq[boje.feld]
    return { ...e, bojenDisq, folge: e.folge.filter((_, j) => j !== i) }
  }
  if (!boje.disq.some((d) => d.code === code)) return e
  // Voriger Stand für „zurück“: der alte Buchstabe samt SEINEM vorigen Stand, sonst die Berührungen.
  const n = e.bojen[boje.feld] ?? 0
  const war = alt ? WAR + '=' + alt + (i >= 0 ? e.folge[i].slice(BOJEN_DISQ.length + boje.feld.length) : '') : n > 0 ? WAR + '+' + n : ''
  const bojen = { ...e.bojen }
  delete bojen[boje.feld]
  const folge = e.folge.filter((m, j) => m !== BOJE + boje.feld && j !== i)
  return { ...e, bojen, bojenDisq: { ...e.bojenDisq, [boje.feld]: code }, folge: [...folge, BOJEN_DISQ + boje.feld + war] }
}

function findLastIndex<T>(xs: T[], f: (x: T) => boolean): number {
  for (let i = xs.length - 1; i >= 0; i--) if (f(xs[i])) return i
  return -1
}

/** „zurück“ eines Bojen-Disq.-Merkers: Buchstabe heraus, voriger Stand (Berührungen bzw. Buchstabe) wieder hinein. */
function bojenDisqZurueck(e: Entwurf, merker: string, folge: string[]): Entwurf {
  const rest = merker.slice(BOJEN_DISQ.length)
  const t = rest.indexOf(WAR)
  const feld = t < 0 ? rest : rest.slice(0, t)
  const war = t < 0 ? '' : rest.slice(t + 1)
  const bojenDisq = { ...e.bojenDisq }
  delete bojenDisq[feld]
  if (war.startsWith('=')) {
    // Der vorige Buchstabe kommt mit seinem eigenen Rest zurück (G → A → zurück = G; noch einmal zurück = davor).
    const u = war.indexOf(WAR)
    bojenDisq[feld] = u < 0 ? war.slice(1) : war.slice(1, u)
    return { ...e, bojenDisq, folge: [...folge, BOJEN_DISQ + feld + (u < 0 ? '' : war.slice(u))] }
  }
  const n = war.startsWith('+') ? Number(war.slice(1)) : 0
  if (!(n > 0)) return { ...e, bojenDisq, folge }
  // Die Berührungen kommen ans Ende der Folge (ihre alte Stelle ist nicht gemerkt) – die Zahl stimmt, jede einzeln zurücknehmbar.
  return { ...e, bojenDisq, bojen: { ...e.bojen, [feld]: n }, folge: [...folge, ...Array.from({ length: n }, () => BOJE + feld)] }
}

/** Die Disq.-Buchstaben an Bojen in der Folge der Maske (Fuß, Texte): `{feld, code}`. */
export function disqAnBojen(e: Entwurf, aufbau: MaskenAufbau): { feld: string; code: string }[] {
  return bojenVon(aufbau).flatMap((b) => (e.bojenDisq[b.feld] ? [{ feld: b.feld, code: e.bojenDisq[b.feld] }] : []))
}

/** Ein Code-Tipp: +1 für diesen Code im Feld. */
export function tippe(e: Entwurf, feld: string, code: string): Entwurf {
  return { ...e, codes: { ...e.codes, [feld]: [...(e.codes[feld] ?? []), code] }, folge: [...e.folge, feld] }
}

/** Ein Disq.-Tipp: setzt den Buchstaben; ein zweiter Tipp nimmt ihn wieder heraus (H1). */
export function tippeDisq(e: Entwurf, code: string): Entwurf {
  if (!e.disq.includes(code)) return { ...e, disq: [...e.disq, code], folge: [...e.folge, DISQ + code] }
  // Herausnehmen: den Buchstaben und SEINEN Merker – die übrigen Tipps behalten ihre Reihenfolge.
  const i = e.folge.lastIndexOf(DISQ + code)
  return { ...e, disq: e.disq.filter((d) => d !== code), folge: e.folge.filter((_, j) => j !== i) }
}

/** Bemerkung setzen (zählt nicht als Tipp, H2). */
export function mitBemerkung(e: Entwurf, text: string): Entwurf {
  return { ...e, bemerkung: text }
}

/** „− letzte zurück“: nimmt den letzten Tipp – Code oder Disq. – zurück (H2). */
export function zurueck(e: Entwurf): Entwurf {
  const letzt = e.folge[e.folge.length - 1]
  if (letzt === undefined) return e
  const folge = e.folge.slice(0, -1)
  if (letzt.startsWith(DISQ)) {
    const code = letzt.slice(DISQ.length)
    return { ...e, disq: e.disq.filter((d) => d !== code), folge }
  }
  if (letzt.startsWith(BOJEN_DISQ)) return bojenDisqZurueck(e, letzt, folge)
  if (letzt.startsWith(BOJE)) {
    const feld = letzt.slice(BOJE.length)
    const bojen = { ...e.bojen }
    const n = (bojen[feld] ?? 0) - 1
    if (n > 0) bojen[feld] = n
    else delete bojen[feld]
    return { ...e, bojen, folge }
  }
  const codes = { ...e.codes, [letzt]: (e.codes[letzt] ?? []).slice(0, -1) }
  if (codes[letzt].length === 0) delete codes[letzt]
  return { ...e, codes, folge }
}

/** Zahl der Einträge (Code-Tipps, Bojen-Berührungen, Disq. – auch an Bojen) – „Abschicken · n“. */
export function eintraege(e: Entwurf): number {
  return (
    Object.values(e.codes).reduce((n, c) => n + c.length, 0) +
    Object.values(e.bojen).reduce((n, b) => n + b, 0) +
    e.disq.length +
    Object.keys(e.bojenDisq).length
  )
}

/** Einträge einer Seite des Umschalters (Zahl am Reiter, P8): Bojen (auch Disq. an Bojen, U1) und Codes dieses Wegs, ohne die Disq.-Liste. */
export function eintraegeAuf(e: Entwurf, aufbau: MaskenAufbau, weg: Weg): number {
  let n = 0
  for (const a of aufbau.abschnitte) {
    if (wegVon(a) !== weg) continue
    if (a.art === 'halt') for (const b of a.halt.bojen) n += (e.bojen[b.feld] ?? 0) + (e.bojenDisq[b.feld] ? 1 : 0)
    else n += (e.codes[a.teil.feld] ?? []).length
  }
  return n
}

/**
 * Punkte der Code-Tipps und Bojen im Teil (ohne Disq.; die Wertung rechnet am Bedienrechner, das hier ist nur die
 * Anzeige, P13). Bojen-Listen sind nie geteilt.
 */
export function punkteVon(e: Entwurf, aufbau: MaskenAufbau, teil?: ListenTeil): number {
  let summe = 0
  for (const t of teileFuer(aufbau, teil)) {
    const punkte = new Map(t.codes.map((c) => [c.code, c.punkte]))
    for (const code of e.codes[t.feld] ?? []) summe += punkte.get(code) ?? 0
  }
  for (const b of bojenVon(aufbau)) if (!e.bojenDisq[b.feld]) summe += (e.bojen[b.feld] ?? 0) * b.punkte
  return summe
}

/**
 * Die Zellwerte der Zeile: je Feld des Teils (ohne Teil: alle) und die gemeinsamen (Disq., Bemerkung) – auch leere,
 * denn „Fehlerfrei“ ist eine Zeile mit leeren Feldern (geraete/erfassen.ts schicke lässt leere ohne `vorher` weg).
 * Code-Felder in der Schreibweise der Erfassung („2x6, 20“, normalizeCodeCell), Disq. in Tipp-Reihenfolge („A, X“,
 * sanitizeDisq lässt sie so), Bemerkung getrimmt und gekürzt. Am Steg gehen Disq. ins gemeinsame `disq@steg`.
 * Bojen (W4.1, P4): Berührungen × Punkte („5“, Zähler „10“) bzw. ''; seit U1 (21.11.2026) ein Disq. an der Boje als
 * ihr Buchstabe allein („G“) – genau das, was sanitizeBuoy unverändert lässt. Disq. aus der DISQ-Liste weiter ins
 * Disq.-Feld der Liste.
 */
export function zellenAus(e: Entwurf, aufbau: MaskenAufbau, teil?: ListenTeil): Record<string, string> {
  const out: Record<string, string> = {}
  const angeboten = new Set(disqFuer(aufbau, teil).map((d) => d.code))
  const disq = e.disq.filter((d) => angeboten.has(d))
  for (const t of teileFuer(aufbau, teil)) {
    const roh = [...(e.codes[t.feld] ?? []), ...(aufbau.disq?.feld === t.feld ? disq : [])].join(', ')
    out[t.feld] = normalizeCodeCell(roh, new Set(t.codes.map((c) => c.code)), new Set(t.buchstaben))
  }
  if (aufbau.disq && !(aufbau.disq.feld in out) && (aufbau.disq.teil === null || teil === undefined || aufbau.disq.teil === teil)) {
    out[aufbau.disq.feld] = disq.join(', ')
  }
  for (const b of bojenVon(aufbau)) {
    const n = e.bojen[b.feld] ?? 0
    const disq = e.bojenDisq[b.feld]
    out[b.feld] = disq && b.disq.some((d) => d.code === disq) ? disq : n > 0 ? String(n * b.punkte) : ''
  }
  if (aufbau.bemerkung) out[aufbau.bemerkung] = e.bemerkung.trim().slice(0, WKR_ANNAHMEN.textMax).trim()
  return out
}

/**
 * Ein Entwurf aus Zellwerten – Korrektur einer Zeile aus „Zuletzt“ (F7). Rund: `zellenAus(entwurfAus(z))` gibt die
 * Zellen zurück (soweit die Maske sie kennt). Codes in Katalogfolge der Zelle, Buchstaben im Code-Feld zählen als Disq.
 */
export function entwurfAus(zellen: Readonly<Record<string, string>>, aufbau: MaskenAufbau): Entwurf {
  let e = leererEntwurf()
  const disq: string[] = []
  for (const t of aufbau.teile) {
    const wert = zellen[t.feld]
    if (!wert) continue
    for (const eintrag of codeEntries(wert)) {
      const c = parseCodeEntry(eintrag)
      if (c) {
        for (let i = 0; i < c.anzahl && i < 99; i++) e = tippe(e, t.feld, String(Number(c.code)))
      } else {
        for (const ch of eintrag.toUpperCase()) if (t.buchstaben.includes(ch) && !disq.includes(ch)) disq.push(ch)
      }
    }
  }
  if (aufbau.disq && aufbau.disq.teil === null) {
    for (const ch of (zellen[aufbau.disq.feld] ?? '').toUpperCase()) if (/[A-Z]/.test(ch) && !disq.includes(ch)) disq.push(ch)
  }
  // Bojen: Punkte → Berührungen, gerundet; Schalter höchstens 1, Zähler höchstens bojenZaehlerMax. Ein Buchstabe, den
  // die Zelle annimmt, ist ein Disq. an dieser Boje (U1); andere Buchstaben werden übergangen.
  for (const b of bojenVon(aufbau)) {
    const wert = (zellen[b.feld] ?? '').trim().toUpperCase()
    if (/^[A-Z]$/.test(wert)) {
      e = tippeBojenDisq(e, b, wert)
      continue
    }
    const ziffern = wert.replace(/\D/g, '')
    if (!ziffern || b.punkte <= 0) continue
    const n = Math.min(Math.round(Number(ziffern) / b.punkte), b.zaehler ? WKR_ANNAHMEN.bojenZaehlerMax : 1)
    for (let i = 0; i < n; i++) e = tippeBoje(e, b)
  }
  for (const d of disq) e = tippeDisq(e, d)
  if (aufbau.bemerkung && zellen[aufbau.bemerkung]) e = mitBemerkung(e, zellen[aufbau.bemerkung])
  return e
}

// ---------------------------------------------------------------------------
// Takt des Weiterspringens (Doppeltipp-Schutz, G5)
// ---------------------------------------------------------------------------

/**
 * Wo die Maske nach dem Abschicken steht (G5, neu nach dem Feldtest 21.11.2026, Befund 13 – N1 in WKR_ANNAHMEN):
 *
 * - `gesendet`: Overlay „wird übertragen …“ über der ganzen Maske, die Nummer steht noch – mindestens
 *   `uebertragenMinMs`, bis die Quittung da ist, höchstens `uebertragenMaxMs`.
 * - `uebernommen`: Quittung da – „✓ übernommen“ (bzw. Rückfrage/abgelehnt) `uebernommenMs` lang.
 * - `sperre`: Nummer gewechselt (Blitz), `sperreMs` keine Eingabe (Doppeltipp-Schutz bleibt).
 * - `frei`.
 *
 * Ohne Quittung geht das Overlay nach `uebertragenMaxMs` trotzdem weg (die Maske sperrt nie bis zur Quittung, §5.2);
 * eine spätere Quittung ändert am Takt nichts mehr. Die Uhr wird hineingereicht (kein Date.now()).
 */
export type Takt = 'gesendet' | 'uebernommen' | 'sperre' | 'frei'

/** Ab wann nach dem Abschicken (ms) die Nummer wechselt – mit Quittung früher, ohne nach `uebertragenMaxMs`. */
export function wechselNach(gesendetUm: number, quittungUm: number | null = null): number {
  const q = quittungAb(gesendetUm, quittungUm)
  return q === null ? WKR_ANNAHMEN.uebertragenMaxMs : q + WKR_ANNAHMEN.uebernommenMs
}

/** Ab wann (ms nach dem Abschicken) „✓ übernommen“ steht – nie vor `uebertragenMinMs`; `null` = keine Quittung bis zum Höchstwert. */
function quittungAb(gesendetUm: number, quittungUm: number | null): number | null {
  if (quittungUm === null) return null
  const q = Math.max(quittungUm - gesendetUm, WKR_ANNAHMEN.uebertragenMinMs)
  return q < WKR_ANNAHMEN.uebertragenMaxMs ? q : null
}

export function wechselTakt(gesendetUm: number | null, jetzt: number, quittungUm: number | null = null): Takt {
  if (gesendetUm === null) return 'frei'
  const d = jetzt - gesendetUm
  const q = quittungAb(gesendetUm, quittungUm)
  const wechsel = wechselNach(gesendetUm, quittungUm)
  // Eine rückwärts gestellte Uhr gilt als „gerade gesendet“ – lieber kurz warten als einen Tropfen durchlassen.
  if (d < wechsel) return q !== null && d >= q ? 'uebernommen' : 'gesendet'
  if (d < wechsel + WKR_ANNAHMEN.sperreMs) return 'sperre'
  return 'frei'
}
