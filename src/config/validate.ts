import { load as yamlLoad, YAMLException } from 'js-yaml'
import { feldKennungen, spaltenKennung } from './feld.ts'
import { findeKombi, kombiReihenfolge } from './kombi.ts'
import { abwandlung, aufbauIds, eintragId, GERAETE, mitZeiten, nummerierung } from './zeitnahme.ts'
import { AUFGABEN, aufloesen, BLICKE, BOJEN_IDS, hochziehen, istInlineKurzform, istKurzform } from './kurzform.ts'
import type {
  RawAufbau,
  RawAufbauEintrag,
  RawBeschriftung,
  RawConfig,
  RawDirektpunkt,
  RawDisq,
  RawDisziplin,
  RawErgebnisSpalte,
  RawUebersetzung,
  RawKatalog,
  RawKurs,
  RawLegendeHinweis,
  RawPosition,
  RawQuelle,
  RawRegelwerk,
  RawRegelwerkListe,
  RawSpalte,
  RawUeberwachung,
} from './schema'

/**
 * Locker getypte Eingabe: Der Validator prüft gerade evtl. fehlerhaftes YAML,
 * darf also keinen vollständig gültigen RawConfig voraussetzen. Ein echter
 * RawConfig ist hierzu zuweisbar.
 */
export type ConfigInput = {
  sprachen?: string[]
  einheitEn?: string
  fehlerHinweis?: string
  fehlerHinweisEn?: string
  legendeHinweise?: RawLegendeHinweis[]
  direktpunkte?: Array<Partial<RawDirektpunkt>>
  uebersetzungen?: Record<string, RawUebersetzung>
  klassen?: Array<string | number>
  ohneSpalten?: Record<string, string[]>
  disqualifikationen?: Array<Partial<RawDisq>>
  kataloge?: Record<string, Partial<RawKatalog>>
  hinweise?: Record<string, string>
  bezeichnungen?: Record<string, string>
  beschriftungen?: Array<Partial<RawBeschriftung>>
  aufbauten?: Array<Partial<RawAufbau>>
  kurse?: Array<Partial<RawKurs>>
  disziplinen?: Array<Partial<RawDisziplin>>
  ueberwachung?: RawUeberwachung[]
  positionen?: Array<Partial<RawPosition>>
}

// Semantische Prüfung der YAML-Konfiguration: Die Positionen werden gegen JEDES
// Regelwerk geprüft, denn jedes muss alles anbieten, worauf sie verweisen. Der
// Parser (js-yaml) fängt bereits Syntaxfehler und doppelte Mapping-Keys ab; hier
// geht es um die fachlichen Regeln, die gültiges YAML NICHT verhindert:
//   • doppelte Definitionen (Positions-IDs, Spalten-Keys, Fehler-Codes …)
//   • Verweise ins Leere (Aufbau → Position, Spalte → Katalog/Summenspalte …)
// Genutzt von validate.test.ts (blockt Commit/CI) und scripts/check-config.ts.

export type Severity = 'error' | 'warning'

export interface ConfigIssue {
  severity: Severity
  /** Kurz-Code zum Nachschlagen, z. B. 'DUP_POSITION_ID'. */
  code: string
  /** Verständliche Meldung (deutsch). */
  message: string
  /** Fundstelle, z. B. 'positionen[3] (id: mueb)'. */
  where: string
  /** Werte für eine übersetzte Fassung der Meldung (Oberfläche: `own.issue.<code>`). */
  params?: Record<string, string>
}

const VALID_TYPEN = new Set<RawSpalte['typ']>([
  'boje',
  'code',
  'punkte',
  'zeit',
  'disq',
  'text',
  'summe',
  'trenner',
])

const VALID_TRENNER = new Set(['fett', 'doppelt', 'gepunktet', 'gestrichelt'])

// Bleibt lokal: types.ts würde hier einen Laufzeit-Import nötig machen, und das
// Skript check-config.ts läuft ohne Bundler.
const VALID_KLASSEN = new Set(['E', '1', '2', '3', '4', '5', '6', '7'])

/** Bereiche, denen Disqualifikationen und Positionen zugeordnet sein können. */
const VALID_BEREICHE = new Set(['vorsteg', 'steg', 'parcours', 'mueb'])

/** Werte, die in der Liste mehr als einmal vorkommen (Wert → Anzahl). */
function duplicates<T>(items: readonly T[], keyOf: (t: T) => string | undefined): Map<string, number> {
  const counts = new Map<string, number>()
  for (const it of items) {
    const k = keyOf(it)
    if (k === undefined || k === '') continue
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return new Map([...counts].filter(([, n]) => n > 1))
}

/** Eine Boje oder Aufgabe, die in einem Aufbau keine Liste abdeckt. */
export interface UeberwachungsLuecke {
  aufbau: string
  /** Die Lücke besteht nur mit zusammengelegten Listen. */
  nurZusammengelegt: boolean
  /** Name für Meldungen an die Pflege der YAML-Dateien, z. B. „Tor 1 (hin seiteA)“. */
  element: string
  klassen: string[]
  /**
   * Woher die Lücke stammt, für Oberflächen mit eigener Sprache (Assistent): die Spalte,
   * ggf. mit ihrer Boje (`sub`, z. B. „hin seiteA“), oder der Katalog der Fehler-Spalte.
   */
  key?: string
  sub?: string
  katalog?: string
}

/** Was eine Liste für eine Klasse abdeckt: „key|sub“, „key“ und „katalog:id“. */
function abgedeckt(positionen: Array<Partial<RawPosition>>, klasse: string): Set<string> {
  const gilt = (klassen?: Array<string | number>) => !klassen || klassen.map(String).includes(klasse)
  const out = new Set<string>()
  for (const pos of positionen) {
    if (!gilt(pos.klassen)) continue
    for (const sp of pos.spalten ?? []) {
      if (!sp?.key || !gilt(sp.klassen)) continue
      out.add(spaltenKennung(sp.key))
      for (const kennung of feldKennungen(sp, pos.katalog)) out.add(kennung)
    }
  }
  return out
}

/**
 * Prüft je Aufbau und Klasse, ob jede Boje und jede Aufgabe aus `ueberwachung` auf einer
 * Liste steht, auch mit zusammengelegten Positionen. Aufbauten mit `eigeneStrecke`
 * zählen nicht.
 */
export function ueberwachungsLuecken(raw: ConfigInput): UeberwachungsLuecke[] {
  const positionen = raw.positionen ?? []
  const pruefungen = raw.ueberwachung ?? []
  const klassenAlle = [...VALID_KLASSEN]
  const luecken = new Map<string, UeberwachungsLuecke>()
  for (const a of raw.aufbauten ?? []) {
    if (a?.eigeneStrecke || !a?.id) continue
    const normal = aufbauIds(a.positionen)
    const kombi = findeKombi(normal, positionen)
    const varianten: Array<[string[], boolean]> = [[normal, false]]
    if (kombi?.ersetzt && kombi.id) varianten.push([kombiReihenfolge(normal, kombi.id, kombi.ersetzt), true])
    for (const [ids, zusammengelegt] of varianten) {
      const liste = ids.map((id) => positionen.find((p) => p?.id === id)).filter((p): p is Partial<RawPosition> => !!p)
      for (const klasse of klassenAlle) {
        const da = abgedeckt(liste, klasse)
        for (const p of pruefungen) {
          if (p.klassen && !p.klassen.map(String).includes(klasse)) continue
          const fehlend: Array<Pick<UeberwachungsLuecke, 'element' | 'key' | 'sub' | 'katalog'>> = p.katalog
            ? da.has(`katalog:${p.katalog}`) ? [] : [{ element: p.name, katalog: p.katalog }]
            : p.sub
              ? p.sub.filter((s) => !da.has(`${p.key}|${s}`)).map((s) => ({ element: `${p.name} (${s})`, key: p.key, sub: s }))
              : da.has(p.key ?? '') ? [] : [{ element: p.name, key: p.key }]
          for (const herkunft of fehlend) {
            const schluessel = `${a.id}|${zusammengelegt}|${herkunft.element}`
            const eintrag = luecken.get(schluessel) ?? { aufbau: a.id, nurZusammengelegt: zusammengelegt, ...herkunft, klassen: [] }
            eintrag.klassen.push(klasse)
            luecken.set(schluessel, eintrag)
          }
        }
      }
    }
  }
  // Fehlt etwas schon ohne Zusammenlegen, ist die zusammengelegte Variante nichts Neues.
  const alle = [...luecken.values()]
  return alle.filter((l) => !l.nurZusammengelegt || !alle.some((n) => !n.nurZusammengelegt && n.aufbau === l.aufbau && n.element === l.element))
}

/**
 * Prüft die bereits geparste, zusammengeführte Roh-Konfiguration. Gibt eine
 * Liste von Befunden zurück (leer = alles gut). `error` sollte den Build/Commit
 * blocken, `warning` ist ein Hinweis.
 */
/** Positionen in Kurzform: Blick, Bojen und Aufgaben müssen zum festen Wortschatz gehören. */
export function kurzformBefunde(quelle: RawQuelle): ConfigIssue[] {
  const issues: ConfigIssue[] = []
  // Positionen direkt im Aufbau dürfen keine ID nutzen, die es schon gibt.
  const ids = new Set((quelle?.positionen ?? []).map((p) => p?.id))
  for (const a of quelle?.aufbauten ?? [])
    for (const e of a?.positionen ?? []) {
      if (!istInlineKurzform(e)) continue
      if (ids.has(e.id))
        issues.push({
          severity: 'error',
          code: 'KURZFORM_DOPPELT',
          message: `Die Position "${e.id}" im Aufbau "${a.id}" gibt es schon. Bitte eine andere id wählen.`,
          where: `aufbauten (id: ${a.id})`,
        })
      ids.add(e.id)
    }
  ;(hochziehen(quelle).positionen ?? []).forEach((pos, i) => {
    if (!pos || typeof pos !== 'object' || !istKurzform(pos)) return
    const where = `positionen[${i}]${pos.id ? ` (id: ${pos.id})` : ''}`
    const err = (code: string, message: string) => issues.push({ severity: 'error', code, message, where })
    if (pos.blick !== undefined && !BLICKE.includes(pos.blick))
      err('KURZFORM_BLICK', `Blick "${pos.blick}" in "${pos.id}" muss ${BLICKE.join(' | ')} sein.`)
    if (pos.bojen !== undefined && !Array.isArray(pos.bojen)) err('KURZFORM_BOJEN', `bojen in "${pos.id}" muss eine Liste sein.`)
    for (const b of Array.isArray(pos.bojen) ? pos.bojen : [])
      if (!BOJEN_IDS.includes(b)) err('KURZFORM_BOJE', `Unbekannte Boje "${b}" in "${pos.id}" (erlaubt: ${BOJEN_IDS.join(', ')}).`)
    if (pos.aufgaben !== undefined && !Array.isArray(pos.aufgaben)) err('KURZFORM_AUFGABEN', `aufgaben in "${pos.id}" muss eine Liste sein.`)
    for (const a of Array.isArray(pos.aufgaben) ? pos.aufgaben : [])
      if (!AUFGABEN.includes(a)) err('KURZFORM_AUFGABE', `Unbekannte Aufgabe "${a}" in "${pos.id}" (erlaubt: ${AUFGABEN.join(', ')}).`)
    if (!pos.bojen?.length && !pos.aufgaben?.length)
      err('KURZFORM_LEER', `Position "${pos.id}" hat weder "spalten" noch "bojen" oder "aufgaben".`)
    if (pos.zeiten !== undefined && !pos.aufgaben?.includes('zeit'))
      err('KURZFORM_ZEITEN', `Position "${pos.id}" nennt "zeiten", aber nicht die Aufgabe "zeit".`)
  })
  return issues
}

function gueltigeZeiten(zeiten: unknown): boolean {
  return Array.isArray(zeiten) && zeiten.length > 0 && zeiten.every((g) => GERAETE.includes(g))
}

/** Ein abgewandelter Eintrag im Aufbau: `{ id, titel?, zeiten? }`. */
function gueltigerEintrag(e: unknown): e is RawAufbauEintrag {
  if (!e || typeof e !== 'object') return false
  const { id, titel, zeiten, ...rest } = e as Record<string, unknown>
  return (
    typeof id === 'string' &&
    Object.keys(rest).length === 0 &&
    (titel === undefined || typeof titel === 'string') &&
    (zeiten === undefined || gueltigeZeiten(zeiten))
  )
}

export function validateRawConfig(raw: ConfigInput): ConfigIssue[] {
  const issues: ConfigIssue[] = []
  const add = (severity: Severity, code: string, message: string, where: string) =>
    issues.push({ severity, code, message, where })
  const err = (code: string, message: string, where: string) => add('error', code, message, where)
  const warn = (code: string, message: string, where: string) => add('warning', code, message, where)

  const positionen = raw.positionen ?? []
  const kataloge = raw.kataloge ?? {}
  const hinweise = raw.hinweise ?? {}
  const aufbauten = raw.aufbauten ?? []
  const beschriftungen = raw.beschriftungen ?? []
  const disqs = raw.disqualifikationen ?? []

  const katalogIds = new Set(Object.keys(kataloge))
  const hinweisIds = new Set(Object.keys(hinweise))
  const positionIds = new Set<string>()

  // ---- Duplikate auf oberster Ebene ---------------------------------------
  for (const [id, n] of duplicates(positionen, (p) => p?.id))
    err('DUP_POSITION_ID', `Positions-ID "${id}" ${n}× definiert.`, 'positionen')
  for (const p of positionen) if (p?.id) positionIds.add(p.id)

  for (const [id, n] of duplicates(aufbauten, (a) => a?.id))
    err('DUP_AUFBAU_ID', `Aufbau-ID "${id}" ${n}× definiert.`, 'aufbauten')

  for (const [id, n] of duplicates(beschriftungen, (b) => b?.id))
    err('DUP_BESCHRIFTUNG_ID', `Beschriftungs-ID "${id}" ${n}× definiert.`, 'beschriftungen')

  for (const [code, n] of duplicates(disqs, (d) => (d ? String(d.code) : undefined)))
    err('DUP_DISQ_CODE', `Disqualifikations-Code "${code}" ${n}× definiert.`, 'disqualifikationen')

  // Die Eingabe akzeptiert je Zeichen einen Buchstaben (siehe lib/disq).
  for (const d of disqs)
    if (d && !/^[A-Z]$/.test(String(d.code)))
      err('BAD_DISQ_CODE', `Disqualifikations-Code "${d.code}" muss ein einzelner Großbuchstabe sein.`, 'disqualifikationen')

  for (const [kid, kat] of Object.entries(kataloge)) {
    for (const [code, n] of duplicates(kat?.fehler ?? [], (f) => (f ? String(f.code) : undefined)))
      err('DUP_FEHLER_CODE', `Fehler-Code "${code}" ${n}× im Katalog "${kid}".`, `kataloge.${kid}`)
    // Die Eingabe akzeptiert nur Zahlen als Fehlercode (siehe lib/codes).
    for (const f of kat?.fehler ?? [])
      if (f && !/^\d+$/.test(String(f.code)))
        err('BAD_FEHLER_CODE', `Fehler-Code "${f.code}" im Katalog "${kid}" muss eine Zahl sein.`, `kataloge.${kid}`)
  }

  // Eindeutige Codes über alle Kataloge halten die A4-Legende lesbar.
  const alleFehler = Object.values(kataloge).flatMap((k) => k?.fehler ?? [])
  for (const [code, n] of duplicates(alleFehler, (f) => (f ? String(f.code) : undefined)))
    warn('DUP_FEHLER_CODE_KATALOGE', `Fehler-Code "${code}" steht in ${n} Katalogen.`, 'kataloge')

  for (const k of raw.klassen ?? [])
    if (!VALID_KLASSEN.has(String(k)))
      err('BAD_KLASSE', `Unbekannte Klasse "${k}" (erlaubt: E, 1 bis 7).`, 'klassen')

  for (const d of disqs)
    for (const b of d?.bereiche ?? [])
      if (!VALID_BEREICHE.has(b))
        err('UNKNOWN_DISQ_BEREICH', `Disqualifikation "${d?.code}" nennt den unbekannten Bereich "${b}".`, 'disqualifikationen')

  // ---- Positionen im Detail ------------------------------------------------
  positionen.forEach((pos, i) => {
    const where = `positionen[${i}]${pos?.id ? ` (id: ${pos.id})` : ''}`
    if (!pos || typeof pos !== 'object') {
      err('BAD_POSITION', 'Position ist kein Objekt.', where)
      return
    }
    if (!pos.id) err('MISSING_POSITION_ID', 'Position ohne "id".', where)

    const spalten = pos.spalten ?? []
    if (spalten.length === 0) warn('EMPTY_POSITION', `Position "${pos.id}" hat keine Spalten.`, where)

    for (const [key, n] of duplicates(spalten, (s) => s?.key))
      err('DUP_SPALTE_KEY', `Spalten-Key "${key}" ${n}× in Position "${pos.id}".`, where)

    const spaltenKeys = new Set(spalten.map((s) => s?.key).filter(Boolean) as string[])
    const summeKeys = new Set(
      spalten.filter((s) => s?.typ === 'summe').map((s) => s?.key).filter(Boolean) as string[],
    )

    if (pos.katalog && !katalogIds.has(pos.katalog))
      err('UNKNOWN_KATALOG', `Position "${pos.id}" verweist auf unbekannten Katalog "${pos.katalog}".`, where)

    for (const id of pos.ersetzt ?? [])
      if (!positionen.some((p) => p?.id === id))
        err('UNKNOWN_POSITION_REF', `Position "${pos.id}" ersetzt die unbekannte Position "${id}".`, where)

    // Ein Hinweis darf auch direkter Freitext sein (dann Leerzeichen/Zeilen);
    // nur einzelne Wörter werden als Verweis-ID gewertet und geprüft.
    if (pos.hinweis && !/\s/.test(pos.hinweis) && !hinweisIds.has(pos.hinweis))
      warn(
        'UNKNOWN_HINWEIS',
        `Position "${pos.id}" verweist auf unbekannten Hinweis "${pos.hinweis}" (wird als Freitext angezeigt).`,
        where,
      )

    if (pos.summeSpalte && !summeKeys.has(pos.summeSpalte)) {
      if (spaltenKeys.has(pos.summeSpalte))
        err('BAD_SUMME_SPALTE', `summeSpalte "${pos.summeSpalte}" in "${pos.id}" ist keine Spalte vom Typ "summe".`, where)
      else err('UNKNOWN_SUMME_SPALTE', `summeSpalte "${pos.summeSpalte}" in "${pos.id}" existiert nicht.`, where)
    }

    if (pos.subTrenner && !VALID_TRENNER.has(pos.subTrenner))
      err('BAD_SUBTRENNER', `subTrenner "${pos.subTrenner}" in "${pos.id}" muss fett | doppelt | gepunktet | gestrichelt sein.`, where)

    if (pos.zeiten !== undefined && !gueltigeZeiten(pos.zeiten))
      err('BAD_ZEITEN', `zeiten in "${pos.id}" muss eine Liste aus ${GERAETE.join(' | ')} sein.`, where)

    // Bildgenerator: braucht ein Ziel (`bild`). Abblenden muss er nichts, den Rahmen der
    // Quelle entfernt er immer.
    if (pos.bildGenerator && !pos.bild && !pos.bildImBrowser)
      err('MISSING_BILD', `Position "${pos.id}" hat bildGenerator: true, aber kein "bild" (Zielordner).`, where)
    if (pos.abblenden !== undefined && !Array.isArray(pos.abblenden))
      err('BAD_ABBLENDEN', `abblenden in "${pos.id}" muss eine Liste von Element-IDs sein.`, where)

    if (pos.disq !== undefined && typeof pos.disq !== 'string') {
      err('BAD_DISQ', `disq in "${pos.id}" muss 'alle', 'keine' oder ein Bereich sein (keine Liste von Buchstaben).`, where)
    } else if (pos.disq !== undefined && pos.disq !== 'alle' && pos.disq !== 'keine' && !VALID_BEREICHE.has(pos.disq)) {
      err('UNKNOWN_DISQ_BEREICH', `Position "${pos.id}" verweist auf den unbekannten Bereich "${pos.disq}".`, where)
    }

    spalten.forEach((sp, j) => {
      const sw = `${where} · spalte "${sp?.key ?? j}"`
      if (!sp || typeof sp !== 'object') {
        err('BAD_SPALTE', 'Spalte ist kein Objekt.', sw)
        return
      }
      // Trenner-Eintrag: keine Datenspalte - kein key nötig, nur Design prüfen.
      if (sp.typ === 'trenner') {
        if (sp.design && !VALID_TRENNER.has(sp.design))
          err('BAD_TRENNER', `trenner-Design "${sp.design}" (${sw}) muss fett | doppelt | gepunktet | gestrichelt sein.`, sw)
        return
      }
      if (!sp.key) err('MISSING_SPALTE_KEY', 'Spalte ohne "key".', sw)
      if (!sp.typ) err('MISSING_SPALTE_TYP', `Spalte "${sp.key}" ohne "typ".`, sw)
      else if (!VALID_TYPEN.has(sp.typ)) err('BAD_SPALTE_TYP', `Unbekannter Spalten-Typ "${sp.typ}" (Spalte "${sp.key}").`, sw)

      if (sp.katalog && !katalogIds.has(sp.katalog))
        err('UNKNOWN_KATALOG', `Spalte "${sp.key}" verweist auf unbekannten Katalog "${sp.katalog}".`, sw)

      if (sp.punkteSpalte && !summeKeys.has(sp.punkteSpalte)) {
        if (spaltenKeys.has(sp.punkteSpalte))
          err('BAD_PUNKTE_SPALTE', `punkteSpalte "${sp.punkteSpalte}" (Spalte "${sp.key}") ist keine Spalte vom Typ "summe".`, sw)
        else
          err('UNKNOWN_PUNKTE_SPALTE', `punkteSpalte "${sp.punkteSpalte}" (Spalte "${sp.key}") existiert nicht in "${pos.id}".`, sw)
      }

      // Der Spaltenname muss zum Tor passen, sonst steht der Fehler auf dem Papier.
      const tor = /^t([1-5])[a-c]?$/.exec(sp.key ?? '')
      if (sp.typ === 'boje' && tor && sp.label !== `Tor ${tor[1]}`)
        warn('FALSCHER_TORNAME', `Spalte "${sp.key}" in "${pos.id}" heißt "${sp.label}", erwartet "Tor ${tor[1]}".`, sw)

      // Ohne `innen` bleibt die Spalte im Schema Innen/Außen bei R/L, der Hinweis aber nicht.
      if (sp.typ === 'boje' && sp.key && /^t[1-4][a-c]$/.test(sp.key) && !sp.innen)
        warn('FEHLT_INNEN', `Tor-Spalte "${sp.key}" in "${pos.id}" hat keine Angabe "innen".`, sw)

      if (sp.innen && sp.innen !== 'seiteA' && sp.innen !== 'seiteB')
        err('BAD_INNEN', `innen "${sp.innen}" (Spalte "${sp.key}") muss 'seiteA' oder 'seiteB' sein.`, sw)

      if (sp.trenner && !VALID_TRENNER.has(sp.trenner))
        err('BAD_TRENNER', `trenner "${sp.trenner}" (Spalte "${sp.key}") muss fett | doppelt | gepunktet | gestrichelt sein.`, sw)

      if (sp.subTrenner && !VALID_TRENNER.has(sp.subTrenner))
        err('BAD_SUBTRENNER', `subTrenner "${sp.subTrenner}" (Spalte "${sp.key}") muss fett | doppelt | gepunktet | gestrichelt sein.`, sw)

      if (sp.geraet !== undefined && (sp.typ !== 'zeit' || !GERAETE.includes(sp.geraet)))
        err('BAD_GERAET', `geraet "${sp.geraet}" (Spalte "${sp.key}") gibt es nur bei typ: zeit, als ${GERAETE.join(' | ')}.`, sw)
    })
  })

  // Unter jedem Regelwerk geprüft: Der Titel reist mit dem Aufbau, auch dorthin, wo Englisch gilt.
  positionen.forEach((pos, i) => {
    if (pos?.titelEn !== undefined && typeof pos.titelEn !== 'string')
      err('BAD_TITEL_EN', `titelEn in "${pos.id}" muss ein Text sein.`, `positionen[${i}]${pos?.id ? ` (id: ${pos.id})` : ''}`)
  })

  // ---- Regelwerk mit Englisch: Fehlt irgendwo eine Übersetzung? -------------
  for (const sp of raw.sprachen ?? [])
    if (sp !== 'de' && sp !== 'en') err('BAD_SPRACHE', `Unbekannte Sprache "${sp}" (erlaubt: de, en).`, 'sprachen')
  if (raw.sprachen?.includes('en')) {
    const fehlt = (was: string, where: string) => err('MISSING_EN', `Englischer Text fehlt: ${was}.`, where)
    for (const d of disqs) if (!d?.en) fehlt(`Disqualifikation "${d?.code}"`, 'disqualifikationen')
    for (const [kid, kat] of Object.entries(kataloge)) {
      if (kat?.titel && !kat.titelEn) fehlt(`Titel des Katalogs "${kid}"`, `kataloge.${kid}`)
      for (const f of kat?.fehler ?? []) if (!f?.en) fehlt(`Fehler-Code "${f?.code}"`, `kataloge.${kid}`)
    }
    for (const d of raw.direktpunkte ?? []) if (!d?.en || !d.titelEn) fehlt(`Fehler ohne Code "${d?.titel}"`, 'direktpunkte')
    if (raw.fehlerHinweis && !raw.fehlerHinweisEn) fehlt('fehlerHinweis', 'fehlerHinweisEn')
    for (const h of raw.legendeHinweise ?? [])
      if (typeof h === 'string' || !h.en) fehlt(`Hinweis "${typeof h === 'string' ? h : h.text}"`, 'legendeHinweise')

    const en = raw.uebersetzungen?.en
    const texte = en?.texte ?? {}
    const hinweisTexte = en?.hinweise ?? {}
    // Eine frei benannte Position eines eigenen Aufbaus (`bildImBrowser`, siehe eigene.ts) kann
    // nicht in i18n/en.yaml stehen. Ihr englischer Titel ist freiwillig (`titelEn`): Ohne ihn
    // steht auf englischen Listen der deutsche (`uebersetzt` fällt darauf zurück). Das ist ein
    // Hinweis, kein Fehler – sonst ließe sich unter UIM kein eigener Aufbau speichern.
    const ohneTitelEn = (titel: string, where: string) =>
      issues.push({
        severity: 'warning',
        code: 'EN_TITEL_FEHLT',
        message: `Position "${titel}" hat keinen englischen Titel (titelEn). Auf englischen Listen steht der deutsche.`,
        where,
        params: { titel },
      })
    positionen.forEach((pos, i) => {
      const where = `positionen[${i}]${pos?.id ? ` (id: ${pos.id})` : ''}`
      if (pos?.titel && !pos.titelEn && !texte[pos.titel]) {
        if (pos.bildImBrowser) ohneTitelEn(pos.titel, where)
        else fehlt(`Titel "${pos.titel}" (i18n/en.yaml)`, where)
      }
      if (pos?.hinweis && hinweisIds.has(pos.hinweis) && !hinweisTexte[pos.hinweis])
        fehlt(`Hinweis "${pos.hinweis}" (i18n/en.yaml)`, where)
      const spalten = pos?.zeiten && gueltigeZeiten(pos.zeiten) ? mitZeiten(pos as RawPosition).spalten : (pos?.spalten ?? [])
      for (const sp of spalten)
        if (sp?.label && !texte[sp.label]) fehlt(`Spaltenname "${sp.label}" (i18n/en.yaml)`, where)
    })
    for (const a of aufbauten)
      for (const e of a?.positionen ?? []) {
        const pos = typeof e === 'object' && e && gueltigerEintrag(e) ? positionen.find((p) => p?.id === e.id) : undefined
        if (!pos?.spalten || typeof e !== 'object') continue
        const neu = abwandlung(pos as RawPosition, e)
        const where = `Aufbau ${a?.id} (${e.id})`
        // Auch eine umbenannte Liste eines eigenen Aufbaus ({ id: zeit, titel: … }) ist frei benannt.
        if (!texte[neu.titel]) {
          if (a?.eigen) ohneTitelEn(neu.titel, where)
          else fehlt(`Titel "${neu.titel}" (i18n/en.yaml)`, where)
        }
        for (const sp of neu.spalten)
          if (sp.label && !texte[sp.label]) fehlt(`Spaltenname "${sp.label}" (i18n/en.yaml)`, where)
      }
    for (const b of beschriftungen)
      if (b?.id && !en?.bezeichnungen?.[b.id]) fehlt(`Bezeichnungs-Schema "${b.id}" (i18n/en.yaml)`, 'beschriftungen')
  }

  // ---- Regelwerk: Spalten, die es hier nicht gibt --------------------------
  for (const [pid, keys] of Object.entries(raw.ohneSpalten ?? {})) {
    const pos = positionen.find((p) => p?.id === pid)
    if (!pos) {
      err('UNKNOWN_POSITION_REF', `ohneSpalten verweist auf unbekannte Position "${pid}".`, 'ohneSpalten')
      continue
    }
    for (const key of keys)
      if (!(pos.spalten ?? []).some((s) => s?.key === key))
        err('UNKNOWN_SPALTE', `ohneSpalten: Position "${pid}" hat keine Spalte "${key}".`, 'ohneSpalten')
  }

  // ---- Kursvarianten -------------------------------------------------------
  const kurse = raw.kurse ?? []
  for (const [id, n] of duplicates(kurse, (k) => k?.id)) err('DUP_KURS_ID', `Kursvariante "${id}" ${n}× definiert.`, 'kurse')
  kurse.forEach((k, i) => {
    const where = `kurse[${i}]${k?.id ? ` (id: ${k.id})` : ''}`
    if (!k?.id || !k.name) err('MISSING_KURS_ID', 'Kursvariante ohne "id" oder "name".', where)
    for (const [klasse, datei] of Object.entries(k?.bilder ?? {})) {
      if (!VALID_KLASSEN.has(String(klasse))) err('BAD_KURS_KLASSE', `Unbekannte Klasse "${klasse}" in den Bildern von "${k?.id}".`, where)
      if (typeof datei !== 'string' || !/^[\w-]+$/.test(datei))
        err('BAD_KURS_BILD', `Bild "${datei}" (Klasse ${klasse}) in "${k?.id}" muss ein Dateiname ohne Endung sein.`, where)
    }
  })

  // ---- Aufbauten: Positions-Verweise --------------------------------------
  aufbauten.forEach((a, i) => {
    const where = `aufbauten[${i}]${a?.id ? ` (id: ${a.id})` : ''}`
    if (!a?.id) err('MISSING_AUFBAU_ID', 'Aufbau ohne "id".', where)
    if (a?.kurs !== undefined && !kurse.some((k) => k?.id === a.kurs))
      err('UNKNOWN_KURS', `Aufbau "${a?.id}" verweist auf die unbekannte Kursvariante "${a.kurs}".`, where)
    for (const e of a?.positionen ?? []) {
      if (typeof e !== 'string' && !gueltigerEintrag(e)) {
        err(
          'BAD_AUFBAU_EINTRAG',
          `Aufbau "${a?.id}": Eintrag ${JSON.stringify(e)} braucht eine "id" und darf nur "titel" und "zeiten" (${GERAETE.join(' | ')}) abwandeln.`,
          where,
        )
        continue
      }
      const pid = eintragId(e)
      if (!positionIds.has(pid))
        err('UNKNOWN_POSITION_REF', `Aufbau "${a?.id}" verweist auf unbekannte Position "${pid}".`, where)
    }
  })

  // Eine nummerierte ID (zeit-1 …) gilt in allen Aufbauten gleich. Wandeln zwei Aufbauten
  // sie verschieden ab, gälte nur die erste.
  const abwandlungen = new Map<string, { aufbau?: string; json: string }>()
  for (const a of aufbauten) {
    const eintraege = (a?.positionen ?? []).filter((e) => typeof e === 'string' || gueltigerEintrag(e))
    for (const { nid, variante } of nummerierung(eintraege)) {
      if (!nid) continue
      const json = JSON.stringify(variante ?? null)
      const bisher = abwandlungen.get(nid)
      if (!bisher) abwandlungen.set(nid, { aufbau: a?.id, json })
      else if (bisher.json !== json)
        err(
          'ABWANDLUNG_KONFLIKT',
          `"${nid}" ist in den Aufbauten "${bisher.aufbau}" und "${a?.id}" verschieden abgewandelt. Es gälte nur die erste.`,
          `aufbauten (id: ${a?.id})`,
        )
    }
  }

  // ---- Ergebnislisten: Stehen alle Punkte einer Disziplin in ihren Spalten? --
  const disziplinen = raw.disziplinen ?? []
  if (disziplinen.length > 0) {
    const felderVon = (sp: Partial<RawErgebnisSpalte>) => [
      ...(sp.felder ?? []),
      ...(sp.unter ?? []).map((u) => (typeof u === 'string' ? u : u.feld)),
    ]
    const bekannt = new Set(
      positionen.flatMap((p) => (p?.spalten ?? []).flatMap((sp) => feldKennungen(sp, p?.katalog))),
    )
    for (const d of disziplinen)
      for (const feld of (d?.ergebnisspalten ?? []).flatMap(felderVon))
        if (!bekannt.has(feld))
          warn('UNKNOWN_ERGEBNIS_FELD', `Ergebnisspalte verweist auf unbekanntes Feld "${feld}".`, `Disziplin ${d?.id}`)
    aufbauten.forEach((a) => {
      const d = a?.disziplin ? disziplinen.find((x) => x?.id === a.disziplin) : disziplinen[0]
      if (!d) {
        err('UNKNOWN_DISZIPLIN', `Aufbau "${a?.id}" verweist auf unbekannte Disziplin "${a?.disziplin}".`, 'aufbauten')
        return
      }
      const inSpalten = new Set((d.ergebnisspalten ?? []).flatMap(felderVon))
      for (const pid of aufbauIds(a?.positionen)) {
        const pos = positionen.find((p) => p?.id === pid)
        if (!pos || pos.lauf === false) continue // Knoten stehen nur auf der Gesamtliste.
        for (const sp of pos.spalten ?? []) {
          if (sp.typ !== 'boje' && sp.typ !== 'code' && sp.typ !== 'punkte') continue
          for (const feld of feldKennungen(sp, pos.katalog))
            if (!inSpalten.has(feld))
              err('ERGEBNIS_LUECKE', `Feld "${feld}" (${pid}) fehlt in den Ergebnisspalten der Disziplin "${d.id}".`, `Aufbau ${a?.id}`)
        }
      }
    })
  }

  // ---- Verwaiste Positionen (in keinem Aufbau, nicht in der Schnellauswahl)
  // - nur Hinweis: sie wären nirgends wählbar.
  if (aufbauten.length > 0) {
    const used = new Set(aufbauten.flatMap((a) => aufbauIds(a?.positionen)))
    for (const p of positionen)
      if (p?.id && !used.has(p.id) && p.schnellauswahl !== true && !p.ersetzt?.length)
        warn(
          'ORPHAN_POSITION',
          `Position "${p.id}" steht in keinem Aufbau und hat kein "schnellauswahl: true" - sie ist nirgends wählbar.`,
          'positionen',
        )
  }

  // ---- Überwachung: Steht jede Boje und jede Aufgabe auf einer Liste? --------
  for (const l of ueberwachungsLuecken(raw)) {
    const alleKlassen = l.klassen.length === VALID_KLASSEN.size ? 'alle Klassen' : `Klasse ${l.klassen.join(', ')}`
    warn(
      'NICHT_UEBERWACHT',
      `${l.element}: von keiner Liste abgedeckt (${alleKlassen})${l.nurZusammengelegt ? ', nur mit zusammengelegter Tor-5-Liste' : ''}.`,
      `Aufbau ${l.aufbau}`,
    )
  }

  return issues
}

/** Parst eine YAML-Datei und meldet Syntaxfehler / doppelte Keys als Befund. */
export function parseYaml(text: string, file: string): { data: unknown; issues: ConfigIssue[] } {
  if (text.trim() === '') return { data: {}, issues: [] } // leere Datei = leere Konfiguration
  try {
    return { data: yamlLoad(text) ?? {}, issues: [] }
  } catch (e) {
    const msg = e instanceof YAMLException ? e.message.split('\n')[0] : String(e)
    return { data: null, issues: [{ severity: 'error', code: 'YAML_PARSE', message: msg, where: file }] }
  }
}

/** Die YAML-Texte der Konfiguration, wie sie im Ordner src/config liegen. */
export interface ConfigTexts {
  /** Inhalt von regelwerke.yaml. */
  liste: string
  /** Inhalt von regelwerke/<id>.yaml je Datei (Schlüssel = <id>). */
  regelwerke: Record<string, string>
  /** Inhalt von positionen.yaml. */
  positionen: string
}

/**
 * Parst die YAML-Texte und prüft die Positionen gegen jedes Regelwerk - wie
 * mergeAndBuild in active.ts, aber mit gesammelten Befunden statt stillem
 * Fallback. Rückgabe: alle Parse- + Validierungs-Befunde.
 */
export function validateConfigTexts(texte: ConfigTexts): ConfigIssue[] {
  const liste = parseYaml(texte.liste, 'regelwerke.yaml')
  const positionen = parseYaml(texte.positionen, 'positionen.yaml')
  const issues = [...liste.issues, ...positionen.issues]
  if (liste.data === null || positionen.data === null) return issues
  issues.push(...kurzformBefunde(positionen.data as RawQuelle))

  const ids = (liste.data as RawRegelwerkListe).regelwerke ?? []
  if (ids.length === 0)
    issues.push({ severity: 'error', code: 'NO_REGELWERK', message: 'regelwerke.yaml nennt kein Regelwerk.', where: 'regelwerke.yaml' })
  for (const [id, n] of duplicates(ids, (x) => x))
    issues.push({ severity: 'error', code: 'DUP_REGELWERK', message: `Regelwerk "${id}" ${n}× in der Liste.`, where: 'regelwerke.yaml' })
  for (const id of ids)
    if (texte.regelwerke[id] === undefined)
      issues.push({ severity: 'error', code: 'MISSING_REGELWERK', message: `Datei regelwerke/${id}.yaml fehlt.`, where: 'regelwerke.yaml' })
  for (const id of Object.keys(texte.regelwerke))
    if (!ids.includes(id))
      issues.push({ severity: 'warning', code: 'ORPHAN_REGELWERK', message: `regelwerke/${id}.yaml steht nicht in regelwerke.yaml - nicht wählbar.`, where: `regelwerke/${id}.yaml` })

  // Befunde, die nur die Positionen betreffen, würden sonst je Regelwerk einmal
  // erscheinen.
  const gesehen = new Set<string>()
  for (const [id, text] of Object.entries(texte.regelwerke)) {
    const file = `regelwerke/${id}.yaml`
    const parsed = parseYaml(text, file)
    issues.push(...parsed.issues)
    if (parsed.data === null) continue
    const rw = parsed.data as RawRegelwerk
    if (rw.id !== id)
      issues.push({ severity: 'error', code: 'BAD_REGELWERK_ID', message: `id "${rw.id}" passt nicht zum Dateinamen "${id}".`, where: file })
    if (!rw.name || rw.version === undefined)
      issues.push({ severity: 'error', code: 'MISSING_REGELWERK_NAME', message: 'Regelwerk ohne "name" oder "version".', where: file })
    const raw: RawConfig = { ...rw, ...aufloesen(positionen.data as RawQuelle) }
    for (const issue of validateRawConfig(raw)) {
      const schluessel = `${issue.code}|${issue.where}|${issue.message}`
      if (gesehen.has(schluessel)) continue
      gesehen.add(schluessel)
      issues.push({ ...issue, where: `${file}: ${issue.where}` })
    }
  }
  return issues
}
