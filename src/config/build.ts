import { CLASS_IDS } from '../domain/classes'
import { istKuerzelNorm, type KuerzelNorm } from '../domain/kuerzel'
import type { CellKind, Column, DisqDef, ErrorDef, ErrorGroup, SheetDef, Sprache, TrennerDesign } from '../types'
import { STICH_KRITERIEN, type RawAufbauEintrag, type RawConfig, type RawDisq, type RawDisziplin, type RawKatalog, type RawPosition, type RawRegelwerk, type RawSchritt, type RawSpalte, type StichKriterium } from './schema'
import { feldKennungen } from './feld'
import { findeKombi, kombiReihenfolge } from './kombi'
import { bogenTexte, uebersetzt, uebersetztBlock, type BogenTexte } from './sprache'
import { abwandlung, aufbauIds, mitZeiten, nummerierung } from './zeitnahme'
import { bildVorgabe } from '../lib/parcoursbild'

/** Übersetzt einen Text in die Sprache der Konfiguration. */
type Uebersetzer = (de: string, en?: string) => string

// Wandelt die geparste (zusammengeführte) YAML-Konfiguration in die interne
// Darstellung um. Positionen binden Fehler-Kataloge und Hinweise per Verweis ein.

export interface ResolvedAufbau {
  id: string
  name: string
  /** Disziplin: Ihre Aufbauten teilen sich die Eingaben und die Wertungslisten. */
  disziplin: string
  /** Positions-IDs dieses Aufbaus (nur existierende, in Reihenfolge). */
  order: string[]
  /** Positionen mit `schnellauswahl: true`, die nicht schon in `order` stehen
   *  (z. B. Varianten wie „ohne Start/Ziel“), in YAML-Reihenfolge. Nicht Teil
   *  der Standard-Bögen bzw. des kompletten Laufs, aber in der Schnellauswahl
   *  und den Menüs wählbar. */
  zusatz: string[]
  /** Zusammenlegen möglich: die Liste, was sie ersetzt, und die Reihenfolge damit. */
  kombi?: { positionId: string; ersetzt: string[]; order: string[] }
  /** Kursvariante: eigene Parcoursbilder je Klasse (Dateiname ohne Endung). */
  kurs?: { id: string; name: string; bilder: Record<string, string> }
  /** Ein eigener Aufbau aus dem Browser, nicht aus dem Repo. */
  eigen?: boolean
  /** Spalten, die die Listen dieses Aufbaus nicht haben: Position → Spalten-Keys. */
  ohneSpalten?: Record<string, string[]>
}

/** Umschaltbares Bezeichnungs-Schema (Bojen-Kürzel), z. B. Rechts/Links. */
export interface BeschriftungScheme {
  id: string
  name: string
  tokens: Record<string, string>
  /** Räumliches Schema (Pfeile): an "von hinten" betrachteten Positionen spiegeln. */
  raeumlich: boolean
}

/** Kenndaten eines Regelwerks (Menü, Listen, A4-Legende). */
export interface RegelwerkInfo {
  id: string
  /** Anzeige mit Version, z. B. "DM 2026". */
  label: string
  /** Angebotene Sprachen der Listen, z. B. [de] oder [de, en]. */
  sprachen: string[]
  /** Sprache aller Listen außer den Wettkampfrichter-Bögen; für diese die Vorgabe. */
  listenSprache: 'de' | 'en'
  /** Kürzel der Länder auf den Listen: ISO oder IOC (domain/kuerzel.ts `KuerzelNorm`). */
  laenderKuerzel: KuerzelNorm
  /** Klassen dieses Regelwerks. */
  klassen: string[]
  /** Was bei gleichem Ergebnis entscheidet, der Reihe nach; leer = der Platz wird geteilt. */
  stichentscheid: StichKriterium[]
  /** Disziplin → Listen, die das Regelwerk in jedem ihrer Aufbauten vorsieht (abwählbare Vorgabe, lib/listen.ts). */
  vorgabeListen: Record<string, string[]>
  /** Läufe und Streichläufe, die das Regelwerk vorsieht; fehlt die Angabe, macht es keine. `nurVorgabe`: nur Voreinstellung, kein Hinweis bei Abweichung. */
  wertungslaeufe?: Wertungslaeufe
  /** Disziplin → was für sie statt `stichentscheid` und `wertungslaeufe` gilt (nur die Angaben, die sie macht). */
  wertungJeDisziplin: Record<string, DisziplinWertung>
  /** Was das Regelwerk für den Aushang verlangt: Unterschrift und Uhrzeit des Aushangs, Punkte auf der Gesamtliste. */
  aushang: { unterschrift: boolean; punkte: boolean }
  /** Vorgabe „Läufe direkt nacheinander“; `undefined` = das Regelwerk kennt den Schalter nicht. */
  versucheNacheinander?: boolean
}

/** Inhalt der A4-Legende: alle Codes und Strafen eines Regelwerks. */
export interface LegendeModel {
  /** Überschriften in der gewählten Sprache. */
  texte: { titel: string; fehlercodes: string; ohneCode: string; disq: string }
  /** Dokument, aus dem die Werte stammen. */
  quelle?: string
  /** Fehlercodes je Katalog (in YAML-Reihenfolge). */
  gruppen: ErrorGroup[]
  /** Fehler ohne Code (Punkte werden direkt eingetragen). */
  direkt: Array<{ titel: string; text: string; punkte: number }>
  disq: DisqDef[]
  /** Hinweis zu den Fehlercodes (z. B. „kombinierbar“). */
  fehlerHinweis?: string
  hinweise: string[]
}

export interface ResolvedConfig {
  regelwerk: RegelwerkInfo
  legende: LegendeModel
  /** Feste Texte auf den Listen in der gewählten Sprache. */
  bogenTexte: BogenTexte
  positions: SheetDef[]
  /** Aufbauten (Setups); der erste ist der Standard. */
  aufbauten: ResolvedAufbau[]
  disziplinen: RawDisziplin[]
  /** Alle konfigurierten Disqualifikationen. */
  allDisqs: DisqDef[]
  /** Auf der Seite umschaltbare Bezeichnungs-Schemata (der erste ist Standard). */
  beschriftungen: BeschriftungScheme[]
  /** Laufzettel: Arbeitsschritte der Auswertung unter den Seiten-Checkboxen. */
  laufzettel: { titel?: string; schritte: Schritt[]; /** Auf dem Zettel des letzten Laufs. */ schritteLetzterLauf: Schritt[] }
}

// 'trenner' ist keine Datenspalte und taucht hier nicht auf (wird vorher aus der
// Spaltenliste herausgefiltert, siehe buildColumns).
const TYP_TO_KIND: Record<Exclude<RawSpalte['typ'], 'trenner'>, CellKind> = {
  boje: 'buoy',
  code: 'code',
  punkte: 'points',
  zeit: 'time',
  disq: 'disq',
  text: 'text',
  summe: 'sum',
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Ersetzt ganze Wörter, die in der Token-Map stehen (einmalig, ohne Kaskade). */
function resolveTokens(text: string, tokens: Record<string, string>): string {
  const keys = Object.keys(tokens)
  if (keys.length === 0) return text
  keys.sort((a, b) => b.length - a.length)
  const re = new RegExp(`\\b(${keys.map(escapeRegex).join('|')})\\b`, 'g')
  return text.replace(re, (m) => tokens[m] ?? m)
}

function katalogRows(kat: RawKatalog | undefined, t: Uebersetzer): ErrorDef[] | undefined {
  return kat?.fehler.map((f) => ({ code: String(f.code), text: t(f.text, f.en), punkte: f.punkte }))
}

function katalogTitel(kat: RawKatalog, t: Uebersetzer): string | undefined {
  return kat.titel === undefined ? undefined : t(kat.titel, kat.titelEn)
}

function toColumn(
  sp: RawSpalte,
  tokens: Record<string, string>,
  kataloge: Record<string, RawKatalog>,
  t: Uebersetzer,
  texte: Record<string, string>,
  posKatalog?: string,
  positionId?: string,
): Column {
  // Innen/Außen-Modus: aktiv, sobald das Schema innen/aussen-Tokens liefert.
  // Für eine Spalte mit `innen`-Markierung (Tore 1-4) werden die Bojen-Seiten
  // dann relativ beschriftet - die innere Seite = innen, die andere = aussen.
  // Spalten ohne Markierung (Tor 5/Start/Ziel) bleiben physisch (R/L).
  let subTokens = tokens
  if (sp.innen && tokens.innen !== undefined && tokens.aussen !== undefined) {
    subTokens = {
      ...tokens,
      seiteA: sp.innen === 'seiteA' ? tokens.innen : tokens.aussen,
      seiteB: sp.innen === 'seiteB' ? tokens.innen : tokens.aussen,
    }
  }
  return {
    key: sp.key ?? '',
    label: t(sp.label ?? '', texte[sp.label ?? '']),
    kind: TYP_TO_KIND[sp.typ as Exclude<RawSpalte['typ'], 'trenner'>] ?? 'text',
    felder: feldKennungen(sp, posKatalog, positionId),
    sub: sp.sub?.map((x) => resolveTokens(x, subTokens)),
    pointsCol: sp.punkteSpalte,
    einzeln: sp.einzeln,
    errorTable: sp.katalog ? katalogRows(kataloge[sp.katalog], t) : undefined,
    grow: sp.breite,
    trenner: sp.trenner,
    subTrenner: sp.subTrenner,
    klassen: sp.klassen?.map((k) => String(k)),
    geraet: sp.geraet,
  }
}

/**
 * Baut die Spaltenliste einer Position. Einträge mit `typ: trenner` sind keine
 * echten Spalten, sondern hängen ihre Trennlinie (Design) an die LINKE Kante der
 * folgenden Spalte. Zusätzlich bleibt die Kurzform `trenner:` an einer Spalte
 * erhalten; ein vorangestellter Trenner-Eintrag hat Vorrang.
 */
function buildColumns(
  spalten: RawSpalte[],
  tokens: Record<string, string>,
  kataloge: Record<string, RawKatalog>,
  t: Uebersetzer,
  texte: Record<string, string>,
  posSubTrenner?: TrennerDesign,
  posKatalog?: string,
  positionId?: string,
): Column[] {
  const cols: Column[] = []
  let pending: TrennerDesign | undefined
  for (const sp of spalten) {
    if (sp.typ === 'trenner') {
      pending = sp.design ?? 'fett'
      continue
    }
    const col = toColumn(sp, tokens, kataloge, t, texte, posKatalog, positionId)
    if (pending) {
      col.trenner = pending
      pending = undefined
    }
    // Positions-Standard für Unter-Spalten-Trenner, sofern die Spalte nicht
    // selbst eines vorgibt.
    if (!col.subTrenner && posSubTrenner) col.subTrenner = posSubTrenner
    cols.push(col)
  }
  return cols
}

/** Disqualifikationen einer Position: alle, keine oder die eines Bereichs. */
function resolveDisq(pos: RawPosition, all: RawDisq[], t: Uebersetzer): DisqDef[] | undefined {
  if (!pos.disq || pos.disq === 'keine') return undefined
  const bereich = pos.disq
  const liste = bereich === 'alle' ? all : all.filter((d) => !d.bereiche || d.bereiche.includes(bereich))
  return liste.map((d) => ({ code: String(d.code), text: t(d.text, d.en) }))
}

/** Disziplin → Kennungen ohne Dubletten; alles andere (auch die frühere Listenform) ergibt nichts. */
function vorgabeListen(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([disziplin, liste]) => disziplin !== '__proto__' && Array.isArray(liste))
      .map(([disziplin, liste]) => [disziplin, [...new Set((liste as unknown[]).filter((x): x is string => typeof x === 'string'))]]),
  )
}

/** Ein Arbeitsschritt des Laufzettels: deutsch, dazu – wenn das Regelwerk ihn nennt – der englische Wortlaut. */
export interface Schritt {
  text: string
  en?: string
  /** Gehört zum Aushang zwischen den Läufen – entfällt, wenn sie direkt nacheinander gefahren werden (lib/laufzettel.ts). */
  zwischenaushang?: true
}

const schritt = (x: RawSchritt): Schritt =>
  x && typeof x === 'object'
    ? { text: String(x.text ?? ''), ...(typeof x.en === 'string' && x.en ? { en: x.en } : {}), ...(x.zwischenaushang === true ? { zwischenaushang: true as const } : {}) }
    : { text: String(x) }

export interface Wertungslaeufe {
  laeufe: number
  streichlaeufe: number
  nurVorgabe?: true
  /** Zahl der Läufe → Streichläufe der Einstellung „nach Regel“; was fehlt, folgt der allgemeinen Regel. */
  nachRegel?: Record<number, number>
}

/** Nur eine stimmige Angabe gilt: mindestens ein Lauf, weniger Streichläufe als Läufe. */
function wertungslaeufe(raw: unknown): Wertungslaeufe | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const { laeufe, streichlaeufe = 0, nurVorgabe, nachRegel: roh } = raw as { laeufe?: unknown; streichlaeufe?: unknown; nurVorgabe?: unknown; nachRegel?: unknown }
  const ganz = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x)
  if (!(ganz(laeufe) && ganz(streichlaeufe) && laeufe >= 1 && streichlaeufe >= 0 && streichlaeufe < laeufe)) return undefined
  // Nur stimmige Einträge gelten (mindestens ein Lauf zählt); den Rest meldet die Prüfung.
  const eintraege = (roh && typeof roh === 'object' && !Array.isArray(roh) ? Object.entries(roh) : [])
    .map(([l, s]): [number, unknown] => [Number(l), s])
    .filter((e): e is [number, number] => Number.isInteger(e[0]) && e[0] >= 1 && ganz(e[1]) && e[1] >= 0 && e[1] < e[0])
  const nachRegel = eintraege.length > 0 ? { nachRegel: Object.fromEntries(eintraege) as Record<number, number> } : {}
  return { laeufe, streichlaeufe, ...(nurVorgabe === true ? { nurVorgabe: true as const } : {}), ...nachRegel }
}

/** Die Wertung einer Disziplin, soweit das Regelwerk sie eigens regelt (`wertungJeDisziplin`). */
export interface DisziplinWertung {
  stichentscheid?: StichKriterium[]
  wertungslaeufe?: Wertungslaeufe
}

/** Nur Kriterien, die die Wertung kennt, jedes einmal; Unbekanntes meldet die Prüfung (validate.ts). */
function stichKriterien(roh: unknown): StichKriterium[] {
  return [...new Set(Array.isArray(roh) ? roh : [])].filter((k): k is StichKriterium => (STICH_KRITERIEN as readonly string[]).includes(k))
}

function wertungJeDisziplin(roh: unknown): Record<string, DisziplinWertung> {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return {}
  const out: Record<string, DisziplinWertung> = {}
  for (const [disziplin, angabe] of Object.entries(roh as Record<string, unknown>)) {
    if (disziplin === '__proto__' || !angabe || typeof angabe !== 'object' || Array.isArray(angabe)) continue
    const a = angabe as { stichentscheid?: unknown; wertungslaeufe?: unknown }
    const laeufe = wertungslaeufe(a.wertungslaeufe)
    out[disziplin] = {
      ...(Array.isArray(a.stichentscheid) ? { stichentscheid: stichKriterien(a.stichentscheid) } : {}),
      // Ohne `nurVorgabe` und `nachRegel`: Die Läufe dieser Disziplin stellt niemand ein.
      ...(laeufe ? { wertungslaeufe: { laeufe: laeufe.laeufe, streichlaeufe: laeufe.streichlaeufe } } : {}),
    }
  }
  return out
}

/** Nur eine Sprache, die das Regelwerk anbietet; sonst seine erste (ohne Angabe: deutsch). */
function listenSprache(rw: RawRegelwerk): 'de' | 'en' {
  const angeboten = (rw.sprachen ?? ['de']).filter((s): s is 'de' | 'en' => s === 'de' || s === 'en')
  return angeboten.find((s) => s === rw.listenSprache) ?? angeboten[0] ?? 'de'
}

/** Kenndaten eines Regelwerks; fehlende Angaben bekommen neutrale Standardwerte. */
export function regelwerkInfo(rw: RawRegelwerk): RegelwerkInfo {
  return {
    id: rw.id ?? 'standard',
    label: [rw.name ?? rw.id ?? 'Standard', rw.version].filter((x) => x !== undefined).join(' '),
    sprachen: rw.sprachen ?? ['de'],
    listenSprache: listenSprache(rw),
    // Unbekanntes meldet die Prüfung (validate.ts); es gilt dann ISO wie ohne Angabe.
    laenderKuerzel: istKuerzelNorm(rw.laenderKuerzel) ? rw.laenderKuerzel : 'iso',
    klassen: rw.klassen ? rw.klassen.map(String) : [...CLASS_IDS],
    // Unbekanntes meldet die Prüfung (validate.ts); gewertet wird nur, was es gibt.
    stichentscheid: stichKriterien(rw.stichentscheid),
    // Ob es die Position gibt, zeigt sich am Aufbau: Dazu kommt nur, was er als Zusatz anbietet.
    vorgabeListen: vorgabeListen(rw.vorgabeListen),
    wertungslaeufe: wertungslaeufe(rw.wertungslaeufe),
    wertungJeDisziplin: wertungJeDisziplin(rw.wertungJeDisziplin),
    aushang: { unterschrift: rw.aushang?.unterschrift === true, punkte: rw.aushang?.punkte === true },
    ...(typeof rw.versucheNacheinander === 'boolean' ? { versucheNacheinander: rw.versucheNacheinander } : {}),
  }
}

function buildLegende(raw: RawConfig, sprache: Sprache): LegendeModel {
  const t: Uebersetzer = (de, en) => uebersetzt(sprache, de, en)
  const einheit = t(raw.einheit ?? 'Punkte', raw.einheitEn)
  return {
    texte: {
      titel: t('Legende: Fehlerpunkte und Disqualifikationen', 'Legend: penalties and disqualifications'),
      fehlercodes: `${t('Fehlercodes', 'Penalty codes')} (${einheit})`,
      ohneCode: t('Ohne Code (Strafe direkt eintragen)', 'Without code (enter the penalty directly)'),
      disq: t('Disqualifikation', 'Disqualification'),
    },
    quelle: raw.quelle === undefined ? undefined : uebersetzt(sprache === 'de' ? 'de' : 'en', raw.quelle, raw.quelleEn),
    // Der Katalog-Titel steht auf den Listen teils mit Doppelpunkt, als
    // Überschrift auf der Legende ohne.
    gruppen: Object.values(raw.kataloge ?? {}).map((k) => ({
      title: katalogTitel({ ...k, titel: k.titel?.replace(/:\s*$/, ''), titelEn: k.titelEn?.replace(/:\s*$/, '') }, t),
      rows: katalogRows(k, t) ?? [],
    })),
    direkt: (raw.direktpunkte ?? []).map((d) => ({
      titel: t(d.titel, d.titelEn),
      text: t(d.text, d.en),
      punkte: d.punkte,
    })),
    disq: (raw.disqualifikationen ?? []).map((d) => ({ code: String(d.code), text: t(d.text, d.en) })),
    fehlerHinweis: raw.fehlerHinweis && uebersetztBlock(sprache, raw.fehlerHinweis, raw.fehlerHinweisEn),
    hinweise: (raw.legendeHinweise ?? []).map((h) =>
      typeof h === 'string' ? h : uebersetztBlock(sprache, h.text, h.en),
    ),
  }
}

export function buildConfig(
  raw: RawConfig,
  opts?: { raeumlich?: boolean; sprache?: Sprache; schema?: string },
): ResolvedConfig {
  const regelwerk = regelwerkInfo(raw)
  // Englisch nur, wenn das Regelwerk es anbietet (die Wahl bleibt im Zustand
  // erhalten und greift wieder, sobald zurückgewechselt wird).
  const sprache: Sprache = regelwerk.sprachen.includes('en') ? (opts?.sprache ?? 'de') : 'de'
  const t: Uebersetzer = (de, en) => uebersetzt(sprache, de, en)
  const englisch = raw.uebersetzungen?.en ?? {}
  const englischTexte = englisch.texte ?? {}
  const allDisqs: DisqDef[] = (raw.disqualifikationen ?? []).map((d) => ({
    code: String(d.code),
    text: t(d.text, d.en),
  }))
  const kataloge = raw.kataloge ?? {}
  const hinweise = raw.hinweise ?? {}
  const tokens = raw.bezeichnungen ?? {}
  const raeumlich = opts?.raeumlich ?? false

  function sheetDef(pos: RawPosition): SheetDef {
    const disqTable = resolveDisq(pos, raw.disqualifikationen ?? [], t)
    // Spalten, die es im gewählten Regelwerk nicht gibt (z. B. einzelne Knoten).
    const ohne = raw.ohneSpalten?.[pos.id] ?? []
    const spalten = pos.spalten.filter((sp) => !sp.key || !ohne.includes(sp.key))
    const kat = pos.katalog ? kataloge[pos.katalog] : undefined
    // Räumliches Schema (Pfeile) + Position von hinten betrachtet → Bojen-Seiten
    // spiegeln (Rechts erscheint dann links im Bild). Nur die Anzeige-Kürzel
    // werden getauscht, nicht die Langnamen (seiteAlang bleibt "Rechts").
    const posTokens =
      raeumlich && pos.pfeileSpiegeln
        ? { ...tokens, seiteA: tokens.seiteB ?? '', seiteB: tokens.seiteA ?? '' }
        : tokens
    // Hinweis per Verweis (ID), sonst direkt als Text; Tokens einsetzen.
    const noteRaw = pos.hinweis ? (hinweise[pos.hinweis] ?? pos.hinweis) : undefined
    // Nach dem Ersetzen leere Zeilen entfernen (z. B. wenn der iahinweis-Token
    // außerhalb des Innen/Außen-Schemas leer ist).
    const noteZeilen = (text: string, tk: Record<string, string>) =>
      resolveTokens(text, tk)
        .split('\n')
        .filter((l) => l.trim() !== '')
    // Der englische Hinweis nutzt dieselben Kürzel, nur die Langnamen sind englisch.
    const schemaId = opts?.schema ?? raw.beschriftungen?.[0]?.id ?? ''
    const noteEn = pos.hinweis ? englisch.hinweise?.[pos.hinweis] : undefined
    const noteDe = noteRaw && (sprache !== 'en' || !noteEn) ? noteZeilen(noteRaw, posTokens) : []
    const noteEnZeilen =
      noteEn && sprache !== 'de' ? noteZeilen(noteEn, { ...posTokens, ...englisch.bezeichnungen?.[schemaId] }) : []
    // Spalten-eigene Kataloge (in Reihenfolge, ohne Dubletten) → Legende zeigt
    // die Blöcke nebeneinander (z. B. Steg Ablegen / Anlegen).
    const groupIds: string[] = []
    for (const sp of spalten) {
      if (sp.katalog && kataloge[sp.katalog] && !groupIds.includes(sp.katalog)) groupIds.push(sp.katalog)
    }
    const errorGroups: ErrorGroup[] | undefined =
      groupIds.length > 0
        ? groupIds.map((id) => ({ title: katalogTitel(kataloge[id], t), rows: katalogRows(kataloge[id], t) ?? [] }))
        : undefined
    // Listen mit Fehlercodes: Hinweis aus dem Regelwerk (z. B. „kombinierbar“).
    const hatCodes = !!kat || groupIds.length > 0
    const hinweisDe = hatCodes && raw.fehlerHinweis && sprache !== 'en' ? [raw.fehlerHinweis] : []
    const hinweisEn = hatCodes && raw.fehlerHinweisEn && sprache !== 'de' ? [raw.fehlerHinweisEn] : []
    const noteLinks = [...noteDe, ...hinweisDe].join('\n')
    const noteRechts = [...noteEnZeilen, ...hinweisEn].join('\n')
    const legendNote = [noteLinks, noteRechts].filter(Boolean).join('\n')
    // Hängt die Fehler-Spalte von der Klasse ab, gibt es eine Legende ohne Codes: ohne
    // Fehlerpunkte, ohne den Hinweis dazu und ohne die MüB-Buchstaben.
    const codeJeKlasse = spalten.some((sp) => sp.typ === 'code' && sp.klassen)
    const ohneCodes = codeJeKlasse
      ? {
          legendNote: [...noteDe, ...noteEnZeilen].join('\n') || undefined,
          legendNoteSpalten:
            noteDe.length > 0 && noteEnZeilen.length > 0
              ? ([noteDe.join('\n'), noteEnZeilen.join('\n')] as [string, string])
              : undefined,
          disqTable: resolveDisq({ ...pos, disq: pos.disq === 'mueb' ? 'parcours' : pos.disq }, raw.disqualifikationen ?? [], t),
        }
      : undefined
    return {
      typeId: pos.id,
      title: t(pos.titel, pos.titelEn || englischTexte[pos.titel]),
      titelDe: pos.titel,
      // Menüs gehören zur Bedienleiste und bleiben deutsch.
      menuLabel: pos.menue ?? pos.titel,
      orientation: pos.ausrichtung === 'quer' ? 'landscape' : 'portrait',
      showLauf: pos.lauf !== false,
      ...(pos.einmalJeStarter === true ? { einmalJeStarter: true } : {}),
      klassen: pos.klassen?.map((k) => String(k)),
      columns: buildColumns(spalten, posTokens, kataloge, t, englischTexte, pos.subTrenner, pos.katalog, pos.id),
      sumColumnKey: pos.summeSpalte,
      errorTable: katalogRows(kat, t),
      errorTableTitle: kat && katalogTitel(kat, t),
      errorGroups,
      disqTable,
      disqTableTitle: `${t('Disqualifikation', 'Disqualification')}${raw.id ? ` (${regelwerk.label})` : ''}:`,
      disqZweispaltig: (!!pos.bild || !!pos.bildImBrowser) && Math.abs(pos.bildDrehung ?? 0) !== 90,
      showDisqTable: !!disqTable && disqTable.length > 0,
      legendNote: legendNote || undefined,
      legendNoteSpalten: noteLinks && noteRechts ? [noteLinks, noteRechts] : undefined,
      ohneCodes,
      // Hier gibt es keine vorgebauten Bildordner: Der Browser blendet die Zeichnung der Klasse
      // selbst ab (lib/parcoursQuelle.ts), nichts wird nachgeladen. Deshalb trägt jede Position
      // mit erzeugtem Bild ihre Vorgabe – auch die mitgelieferten, deren `bild` im Prototyp den
      // Ordner nennt. Eigene Aufbauten (`bildImBrowser`) nennen statt eines Ordners die Quelle.
      ...(pos.bildGenerator
        ? (({ quelle, dim, aus }) => ({ courseImageDir: pos.bildImBrowser ? quelle : (pos.bild ?? quelle), bildErzeugen: { dim, aus } }))(
            bildVorgabe(pos),
          )
        : { courseImageDir: pos.bild }),
      bildDrehung: pos.bildDrehung,
      bildBreite: pos.bildBreite,
      bildNeben: pos.bildNeben,
    }
  }

  const rohPositionen = new Map((raw.positionen ?? []).map((p) => [p.id, p]))
  const positions: SheetDef[] = (raw.positionen ?? []).map((pos) => sheetDef(mitZeiten(pos)))
  const known = new Set(positions.map((p) => p.typeId))

  // Steht eine Position mehrfach in einem Aufbau (z. B. dreimal Zeit für drei
  // Zeitnahmen) oder ist sie dort abgewandelt, wird jedes Vorkommen eine eigene,
  // nummerierte Position mit eigener ID (zeit-1 …). So unterscheiden sich Kopf,
  // QR-Code, Laufzettel und Schnellauswahl. Gleiche Titel werden durchgezählt:
  // „Zeit (1)“, „Zeit (2)“ oder „Elektronische Zeiterfassung“, „Stoppuhr (1)“ ….
  const instanzen = new Map<string, SheetDef[]>() // Basis-ID → nummerierte Positionen
  function nummeriert(eintraege: Array<string | RawAufbauEintrag>): string[] {
    const plan = nummerierung(eintraege).map((e) => ({
      ...e,
      basis: !e.nid
        ? undefined
        : e.variante
          ? sheetDef(abwandlung(rohPositionen.get(e.id)!, e.variante))
          : positions.find((p) => p.typeId === e.id)!,
    }))
    const titelAnzahl = new Map<string, number>()
    for (const { basis } of plan) if (basis) titelAnzahl.set(basis.titelDe, (titelAnzahl.get(basis.titelDe) ?? 0) + 1)
    const titelBisher = new Map<string, number>()
    return plan.map(({ id, nid, n, basis }) => {
      if (!nid || !n || !basis) return id
      const k = (titelBisher.get(basis.titelDe) ?? 0) + 1
      titelBisher.set(basis.titelDe, k)
      const zusatz = (titelAnzahl.get(basis.titelDe) ?? 0) > 1 ? ` (${k})` : ''
      const liste = instanzen.get(id) ?? []
      // Eine nummerierte ID gilt überall gleich; die Prüfung meldet abweichende Abwandlungen.
      if (!liste.some((d) => d.typeId === nid)) {
        liste.push({
          ...basis,
          typeId: nid,
          title: `${basis.title}${zusatz}`,
          titelDe: `${basis.titelDe}${zusatz}`,
          menuLabel: `${basis.menuLabel}${zusatz}`,
          // Jede Zeitnahme erfasst eigene Werte; die erste entspricht der einfachen Liste.
          columns: basis.columns.map((c) => ({
            ...c,
            felder: c.felder?.map((f) => (f.includes('@') ? `${f.split('@')[0]}@${nid}` : n === 1 ? f : `${f}~${n}`)),
          })),
        })
        instanzen.set(id, liste)
      }
      return nid
    })
  }

  // Positionen mit `schnellauswahl: true` stehen jedem Aufbau als Zusatz zur
  // Verfügung (sofern sie nicht ohnehin zu ihm gehören).
  const schnell = (raw.positionen ?? []).filter((p) => p.schnellauswahl === true).map((p) => p.id)
  const standardDisziplin = raw.disziplinen?.[0]?.id ?? 'standard'
  // Aufbauten: nur existierende Positions-IDs; ohne Definition ein Standard mit allen.
  const aufbauten: ResolvedAufbau[] =
    raw.aufbauten && raw.aufbauten.length > 0
      ? raw.aufbauten.map((a) => {
          const ids = aufbauIds(a.positionen)
          const order = nummeriert(a.positionen.filter((_, i) => known.has(ids[i])))
          const kombi = findeKombi(ids, raw.positionen ?? [])
          const kurs = raw.kurse?.find((k) => k.id === a.kurs)
          return {
            id: a.id,
            name: a.name,
            ...(a.eigen ? { eigen: true } : {}),
            ...(a.ohneSpalten ? { ohneSpalten: a.ohneSpalten } : {}),
            ...(kurs
              ? {
                  kurs: {
                    id: kurs.id,
                    name: kurs.name,
                    bilder: Object.fromEntries(Object.entries(kurs.bilder ?? {}).map(([k, d]) => [String(k), d])),
                  },
                }
              : {}),
            disziplin: a.disziplin ?? standardDisziplin,
            order,
            zusatz: schnell.filter((id) => !ids.includes(id)),
            ...(kombi?.ersetzt
              ? { kombi: { positionId: kombi.id, ersetzt: kombi.ersetzt, order: kombiReihenfolge(order, kombi.id, kombi.ersetzt) } }
              : {}),
          }
        })
      : [{ id: 'standard', name: 'Standard', disziplin: standardDisziplin, order: positions.map((p) => p.typeId), zusatz: [] }]
  // Nummerierte Positionen direkt hinter ihrer Basis-Position einreihen.
  const allePositionen = positions.flatMap((p) => [p, ...(instanzen.get(p.typeId) ?? [])])

  const beschriftungen: BeschriftungScheme[] = (raw.beschriftungen ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    tokens: b.tokens ?? {},
    raeumlich: b.raeumlich ?? false,
  }))

  const laufzettel = {
    titel: raw.laufzettel?.titel,
    schritte: (raw.laufzettel?.schritte ?? []).map(schritt),
    // Ohne eigene Angabe steht auf dem letzten Zettel dasselbe wie auf den anderen.
    schritteLetzterLauf: (raw.laufzettel?.schritteLetzterLauf ?? raw.laufzettel?.schritte ?? []).map(schritt),
  }

  return {
    regelwerk,
    legende: buildLegende(raw, sprache),
    bogenTexte: bogenTexte(sprache, raw.klassenNamen),
    positions: allePositionen,
    aufbauten,
    disziplinen: raw.disziplinen ?? [],
    allDisqs,
    beschriftungen,
    laufzettel,
  }
}
