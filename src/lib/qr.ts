import qrcode from 'qrcode-generator'
import { CLASS_IDS } from '../domain/classes'
import type { ClassId } from '../types'

// QR-Codes auf Wettkampfrichter-Bögen und Laufzetteln – rein, ohne DOM und ohne Stand.
// Vorbild: lib/qr.ts im Fehlerpunkte-Prototyp (dort Format FP2). Ein Handscanner holt damit
// in der Erfassung den richtigen Bogen nach vorn; eingescannte oder fotografierte Blätter
// lassen sich später sicher zuordnen. Ein Link ist nicht nötig, der Code ist reiner Text.
//
// Format ALC1 („Alcatraz“, Format 1), Teile durch Punkte getrennt:
//   Laufzettel  ALC1.<VERANSTALTUNG>.<REGELWERK>.<AUFBAU>.<PARCOURS>.<KLASSEN>.<LAUF>
//   Bogen       … wie oben … .<LISTE>.S<SEITE>
// z. B. ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1 und ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.E123.2.STEG.S2.
//
// Anders als im Prototyp gibt es hier je Parcours eigene Bögen und bei der Clubmeisterschaft
// gemeinsame Bögen mehrerer Klassen – beides steht deshalb im Code:
//   • <VERANSTALTUNG> – die zufällige Kennung der Veranstaltung (AppState.kennung). Nur so
//     fällt ein Blatt vom letzten Jahr auf: Regelwerk, Aufbau und Parcours heißen dort gleich.
//   • <PARCOURS>      – die Kennung des Parcours, nicht sein Name: Umbenennen ändert nichts.
//   • <KLASSEN>       – die Klassen des Bogens aneinandergereiht („3“, „E123“); jede Klasse
//                       ist genau ein Zeichen.
//   • <LISTE>         – die Kennung der Liste im Aufbau („ZEIT2“ für zeit-2).
// Regelwerk und Aufbau stehen drin, damit die Erfassung ein Blatt abweist, dessen Spalten
// nicht mehr zu dem passen, was eingestellt ist.
//
// Format ALC2 – die Listen des Parallelslaloms (lib/parallelBogen.ts). Sie gehören zu einer
// Runde und einem Racecourse statt zu Parcours, Klassen und Lauf:
//   Laufzettel  ALC2.<VERANSTALTUNG>.<REGELWERK>.<AUFBAU>.<RUNDE>.<RACECOURSE>
//   Bogen       … wie oben … .<LISTE>.S<SEITE>
// z. B. ALC2.K7Q4.UIM2026.PARALLEL.PRE.A und ALC2.K7Q4.UIM2026.PARALLEL.PRE.A.ZEIT.S1. Den
// Laufzettel einer Runde gibt es je Racecourse (Entscheidung des Nutzers vom 15.11.2026): Sein
// Code öffnet nur die Listen dieses Racecourse.
//   • <RUNDE>      – PRE, SEMI, SMALL (Kleines Finale, seit 21.11.2026 eigene Runde), FINAL oder RERUN…
//                    (planung/parallelRunden.ts)
//   • <RACECOURSE> – A oder B
// ALC1 bleibt, wie es ist: Was für das Manövrieren gedruckt wurde, wird weiter gelesen, und
// neue Bögen des Manövrierens tragen weiter ALC1.
//
// Nur Großbuchstaben, Ziffern und Punkt: Diese Zeichen tippt ein Handscanner auch dann
// richtig, wenn er auf eine andere Tastaturbelegung eingestellt ist als der PC (US/DE). Dann
// sind nur Y und Z vertauscht; das fängt `leseCode` ab, und Präfix wie Veranstaltungs-Kennung
// enthalten beide Buchstaben nicht. Außerdem nutzt der QR-Code so den platzsparenden
// alphanumerischen Modus und hat bei gleicher Größe gröbere Kästchen.

export const QR_FORMAT = 'ALC1'
/** Fassung für die Listen einer Runde des Parallelslaloms (siehe oben). */
export const QR_FORMAT_RUNDE = 'ALC2'
/** Steht in Beispielansichten an der Stelle der Veranstaltung: Ein solcher Code trifft nie einen echten Bogen. */
export const QR_MUSTER = 'MUSTER'
/** Für einen Stand, der (noch) keine Kennung hat – etwa in Tests ohne Store. */
const OHNE_KENNUNG = '0'

/** Zeichen der Veranstaltungs-Kennung: ohne Y/Z (Tastaturbelegung) und ohne 0/O, 1/I (Abtippen). */
export const KENNUNG_ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWX23456789'
const KENNUNG_LAENGE = 4

/**
 * Eine neue Kennung für eine Veranstaltung. `zufall` liefert Zahlen in [0, 1) – der Store
 * reicht `Math.random` herein, damit hier und im Reducer nichts gewürfelt wird.
 */
export function neueKennung(zufall: () => number): string {
  return Array.from({ length: KENNUNG_LAENGE }, () => KENNUNG_ZEICHEN[Math.floor(zufall() * KENNUNG_ZEICHEN.length) % KENNUNG_ZEICHEN.length]).join('')
}

/** Ist das eine brauchbare gespeicherte Kennung? */
export function istKennung(wert: unknown): wert is string {
  return typeof wert === 'string' && /^[A-Z0-9]{2,12}$/.test(wert) && wert !== QR_MUSTER
}

/** Woraus ein Code entsteht (passt auf den AppState). */
export interface QrKontext {
  kennung: string
  regelwerk: string
  aufbau: string
}

/** Was einen Laufzettel bzw. einen Bogen benennt. */
export interface QrBogen {
  parcoursId: string
  klassen: readonly string[]
  lauf: number
}

/** Kennung als Code-Teil: nur A–Z und 0–9 (dm-2026 → DM2026, par_1 → PAR1). */
export function teil(id: string): string {
  return id.replace(/[^a-z0-9]/gi, '').toUpperCase()
}

/** Die Klassen in fester Reihenfolge (E, 1 … 7) aneinandergereiht. */
function klassenTeil(klassen: readonly string[]): string {
  const rang = (k: string) => {
    const i = CLASS_IDS.indexOf(k as ClassId)
    return i < 0 ? CLASS_IDS.length : i
  }
  return [...new Set(klassen)].sort((a, b) => rang(a) - rang(b)).join('')
}

/** Code eines Laufzettels: alle Listen einer Klasse (oder Klassengruppe) in einem Lauf auf einem Parcours. */
export function laufzettelCode(k: QrKontext, b: QrBogen): string {
  return [QR_FORMAT, teil(k.kennung) || OHNE_KENNUNG, teil(k.regelwerk), teil(k.aufbau), teil(b.parcoursId), klassenTeil(b.klassen), String(b.lauf)].join('.')
}

/** Code eines Bogens, noch ohne Seite – die hängt {@link seitenCode} an, wenn der Bogen aufgeteilt ist. */
export function bogenCode(k: QrKontext, b: QrBogen & { typeId: string }): string {
  return `${laufzettelCode(k, b)}.${teil(b.typeId)}`
}

/** Was einen Laufzettel bzw. einen Bogen einer Runde des Parallelslaloms benennt. */
export interface QrRunde {
  runde: string
}

/** Code des Laufzettels einer Runde auf einem Racecourse: dessen Listen. `k.aufbau` ist der Aufbau des Parallelslaloms. */
export function rundenZettelCode(k: QrKontext, b: QrRunde & { racecourse: string }): string {
  return [QR_FORMAT_RUNDE, teil(k.kennung) || OHNE_KENNUNG, teil(k.regelwerk), teil(k.aufbau), teil(b.runde), teil(b.racecourse)].join('.')
}

/** Code eines Bogens einer Runde auf einem Racecourse, noch ohne Seite ({@link seitenCode}). */
export function rundenBogenCode(k: QrKontext, b: QrRunde & { racecourse: string; typeId: string }): string {
  return `${rundenZettelCode(k, b)}.${teil(b.typeId)}`
}

/** Code einer Druckseite eines Bogens (Seite ab 1). */
export function seitenCode(bogen: string, seite: number): string {
  return `${bogen}.S${seite}`
}

/** Wie {@link bogenCode}, für die Beispielansicht: gleich gebaut und gleich groß, aber kein Bogen einer Veranstaltung. */
export function musterCode(k: Omit<QrKontext, 'kennung'>, b: QrBogen & { typeId: string }): string {
  return bogenCode({ ...k, kennung: QR_MUSTER }, b)
}

// ---- Lesen ------------------------------------------------------------------

/** Was ein gelesener Code bezeichnet, aufgelöst auf die Kennungen der Veranstaltung. */
export interface QrZiel {
  /** Fehlt bei Blättern des Manövrierens; `runde` = ein Blatt des Parallelslaloms ({@link QrRundenZiel}). */
  art?: undefined
  parcoursId: string
  klassen: ClassId[]
  lauf: number
  /** Nur bei Bögen; ohne Liste ist es ein Laufzettel. */
  typeId?: string
  seite?: number
}

/** Ein Blatt einer Runde des Parallelslaloms (Format ALC2). */
export interface QrRundenZiel {
  art: 'runde'
  /** Die Runde, wie sie im Stand heißt (`pre`, `semi` …). */
  runde: string
  racecourse: 'A' | 'B'
  /** Nur bei Bögen; ohne Liste ist es der Laufzettel der Runde auf diesem Racecourse. */
  typeId?: string
  seite?: number
}

/** Wogegen ein Code aufgelöst wird: die Veranstaltung, wie sie gerade eingestellt ist. */
export interface QrBekannt extends QrKontext {
  /** Alle Regelwerke und Aufbauten, die es gibt – nur um einen fremden beim Namen zu nennen. */
  regelwerke: readonly string[]
  aufbauten: readonly string[]
  /** Kennungen der Parcours der Veranstaltung. */
  parcours: readonly string[]
  /** Listen des eingestellten Aufbaus. */
  listen: readonly string[]
  laufCount: number
  /**
   * Der Parallelslalom der Veranstaltung: sein Aufbau, dessen Listen und die Runden, für die es
   * Listen gibt. Fehlt, wenn nach dem Regelwerk keiner gefahren wird – ein ALC2-Code nennt dann
   * einen Aufbau, den es hier nicht gibt.
   */
  parallel?: { aufbau: string; listen: readonly string[]; runden: readonly string[] }
}

/**
 * Warum ein Code nicht passt – in der Reihenfolge, in der geprüft wird. `wert` ist der Teil
 * des Codes, `id` die Kennung dazu, wenn es sie gibt (ein anderes, aber bekanntes Regelwerk).
 */
export type QrFehler =
  | { art: 'leer' | 'fremd' | 'prototyp' | 'fassung' | 'kaputt' | 'muster' }
  | { art: 'veranstaltung' | 'parcours' | 'klasse' | 'lauf' | 'liste' | 'runde' | 'racecourse'; wert: string }
  | { art: 'regelwerk' | 'aufbau'; wert: string; id?: string }

export type QrLesung = { ok: true; ziel: QrZiel | QrRundenZiel } | { ok: false; fehler: QrFehler }

/** Woran eine vertauschte Tastaturbelegung schuld sein kann: Kennungen, die nicht gefunden wurden – in Prüfreihenfolge. */
const KENNUNG_FEHLT: QrFehler['art'][] = ['regelwerk', 'aufbau', 'parcours', 'liste']

/**
 * Liest einen gescannten, getippten oder eingefügten Code. Groß-/Kleinschreibung und Leerraum
 * sind egal. Wird eine Kennung nicht gefunden, wird es mit vertauschtem Y/Z noch einmal
 * versucht (Scanner auf US-Tastatur, PC auf deutscher, oder umgekehrt); scheitert auch das,
 * wird der Fehler des Versuchs gemeldet, der weiter gekommen ist.
 */
export function leseCode(text: string, bekannt: QrBekannt): QrLesung {
  const roh = text.replace(/\s+/g, '').toUpperCase()
  // Manche Scanner stellen dem Code eine Kennung der Code-Art voran („]Q1“ für QR): Gelesen
  // wird ab dem Anfang des Codes. Ohne erkennbaren Anfang bleibt der Text, wie er ist (fremd).
  const anfang = roh.search(/(ALC|FP)\d+\./)
  const code = anfang > 0 ? roh.slice(anfang) : roh
  const erst = loese(code, bekannt)
  if (erst.ok || !KENNUNG_FEHLT.includes(erst.fehler.art) || !/[YZ]/.test(code)) return erst
  const getauscht = loese(code.replace(/[YZ]/g, (c) => (c === 'Y' ? 'Z' : 'Y')), bekannt)
  if (getauscht.ok) return getauscht
  return KENNUNG_FEHLT.indexOf(getauscht.fehler.art) > KENNUNG_FEHLT.indexOf(erst.fehler.art) ? getauscht : erst
}

/** Die eine Kennung, deren Code-Teil passt; bei zweien (nur in Groß-/Kleinschreibung oder Trennzeichen verschieden) keine. */
function finde(ids: readonly string[], codeTeil: string): string | undefined {
  const treffer = ids.filter((id) => teil(id) === codeTeil)
  return treffer.length === 1 ? treffer[0] : undefined
}

function loese(code: string, bekannt: QrBekannt): QrLesung {
  const fehler = (f: QrFehler): QrLesung => ({ ok: false, fehler: f })
  if (code === '') return fehler({ art: 'leer' })
  const teile = code.split('.')
  if (/^FP\d+$/.test(teile[0])) return fehler({ art: 'prototyp' })
  if (teile[0] === QR_FORMAT_RUNDE) return loeseRunde(teile, bekannt)
  if (teile[0] !== QR_FORMAT) return fehler({ art: /^ALC\d+$/.test(teile[0]) ? 'fassung' : 'fremd' })
  // Laufzettel: 7 Teile; Bogen: dazu Liste und Seite.
  if ((teile.length !== 7 && teile.length !== 9) || teile.some((t) => !/^[A-Z0-9]+$/.test(t))) {
    // Auch ein abgeschnittener Muster-Code soll als solcher erkannt werden.
    return fehler({ art: teile[1] === QR_MUSTER ? 'muster' : 'kaputt' })
  }
  const [, kennung, rw, ab, pc, kl, la, liste, seiteTeil] = teile
  if (kennung === QR_MUSTER) return fehler({ art: 'muster' })
  if (kennung !== (teil(bekannt.kennung) || OHNE_KENNUNG)) return fehler({ art: 'veranstaltung', wert: kennung })
  if (rw !== teil(bekannt.regelwerk)) return fehler({ art: 'regelwerk', wert: rw, id: finde(bekannt.regelwerke, rw) })
  if (ab !== teil(bekannt.aufbau)) return fehler({ art: 'aufbau', wert: ab, id: finde(bekannt.aufbauten, ab) })
  const parcoursId = finde(bekannt.parcours, pc)
  if (!parcoursId) return fehler({ art: 'parcours', wert: pc })
  const klassen = [...kl] as ClassId[]
  if (klassen.some((k) => !CLASS_IDS.includes(k)) || new Set(klassen).size !== klassen.length) return fehler({ art: 'klasse', wert: kl })
  const lauf = /^\d+$/.test(la) ? Number(la) : 0
  if (lauf < 1 || lauf > Math.max(1, bekannt.laufCount)) return fehler({ art: 'lauf', wert: la })
  const ziel: QrZiel = { parcoursId, klassen, lauf }
  if (liste === undefined) return { ok: true, ziel }

  // Höchstens drei Stellen: Mehr Seiten hat kein Bogen, eine längere Zahl ist ein Lesefehler.
  const seite = /^S\d{1,3}$/.test(seiteTeil) ? Number(seiteTeil.slice(1)) : 0
  if (seite < 1) return fehler({ art: 'kaputt' })
  const typeId = finde(bekannt.listen, liste)
  if (!typeId) return fehler({ art: 'liste', wert: liste })
  return { ok: true, ziel: { ...ziel, typeId, seite } }
}

/** Ein Code im Format ALC2: Laufzettel (6 Teile) oder Bogen (8 Teile) einer Runde des Parallelslaloms auf einem Racecourse. */
function loeseRunde(teile: string[], bekannt: QrBekannt): QrLesung {
  const fehler = (f: QrFehler): QrLesung => ({ ok: false, fehler: f })
  if ((teile.length !== 6 && teile.length !== 8) || teile.some((t) => !/^[A-Z0-9]+$/.test(t))) {
    return fehler({ art: teile[1] === QR_MUSTER ? 'muster' : 'kaputt' })
  }
  const [, kennung, rw, ab, ru, rc, liste, seiteTeil] = teile
  if (kennung === QR_MUSTER) return fehler({ art: 'muster' })
  if (kennung !== (teil(bekannt.kennung) || OHNE_KENNUNG)) return fehler({ art: 'veranstaltung', wert: kennung })
  if (rw !== teil(bekannt.regelwerk)) return fehler({ art: 'regelwerk', wert: rw, id: finde(bekannt.regelwerke, rw) })
  const parallel = bekannt.parallel
  if (!parallel || ab !== teil(parallel.aufbau)) return fehler({ art: 'aufbau', wert: ab, id: finde(bekannt.aufbauten, ab) })
  const runde = finde(parallel.runden, ru)
  if (!runde) return fehler({ art: 'runde', wert: ru })
  if (rc !== 'A' && rc !== 'B') return fehler({ art: 'racecourse', wert: rc })
  if (liste === undefined) return { ok: true, ziel: { art: 'runde', runde, racecourse: rc } }
  const seite = /^S\d{1,3}$/.test(seiteTeil) ? Number(seiteTeil.slice(1)) : 0
  if (seite < 1) return fehler({ art: 'kaputt' })
  const typeId = finde(parallel.listen, liste)
  if (!typeId) return fehler({ art: 'liste', wert: liste })
  return { ok: true, ziel: { art: 'runde', runde, racecourse: rc, typeId, seite } }
}

// ---- Zeichnen ---------------------------------------------------------------

/** Zeichen des alphanumerischen QR-Modus (unsere Codes passen immer hinein). */
const ALPHANUMERISCH = /^[0-9A-Z $%*+\-./:]*$/

/** QR-Modulmatrix (true = dunkles Modul), Fehlerkorrektur M wie im Prototyp. */
export function qrModules(text: string): boolean[][] {
  const qr = qrcode(0, 'M')
  qr.addData(text, ALPHANUMERISCH.test(text) ? 'Alphanumeric' : 'Byte')
  qr.make()
  const count = qr.getModuleCount()
  return Array.from({ length: count }, (_, r) => Array.from({ length: count }, (_, c) => qr.isDark(r, c)))
}

/** Heller Rand um den Code in Modulen. Zwei genügen: Das Blatt ringsum ist ohnehin weiß. */
export const QR_RAND = 2

/**
 * Der Code als Pfad für ein SVG mit `viewBox="0 0 groesse groesse"`: Vektor, also im Druck in
 * jeder Auflösung scharf. Nebeneinanderliegende Module einer Zeile sind ein Rechteck – das
 * hält den Pfad kurz und vermeidet Haarlinien zwischen den Kästchen.
 */
export function qrPfad(text: string): { groesse: number; pfad: string } {
  const module = qrModules(text)
  const teile: string[] = []
  module.forEach((zeile, r) => {
    for (let c = 0; c < zeile.length; c++) {
      if (!zeile[c]) continue
      let ende = c
      while (ende + 1 < zeile.length && zeile[ende + 1]) ende++
      teile.push(`M${c + QR_RAND} ${r + QR_RAND}h${ende - c + 1}v1h-${ende - c + 1}z`)
      c = ende
    }
  })
  return { groesse: module.length + 2 * QR_RAND, pfad: teile.join('') }
}
