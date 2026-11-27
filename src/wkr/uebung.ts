import type { ClassId, CoPilot, CoPiloten, PunktId, Sprache } from '../types'
import { configFor } from '../config/konfig'
import { DEFAULT_AUFBAU, sollgewichtOf } from '../config/catalog'
import { CLASS_IDS } from '../domain/classes'
import { BOOTSNAMEN } from '../data/boote'
import { NACHNAMEN, VORNAMEN_M, VORNAMEN_W } from '../data/names'
import { ausgleichAmSteg, type CoPilotStand } from '../lib/ausgleich'
import { coPilotVorgesehen } from '../lib/besetzung'
import { liesRef, refKey } from '../betrieb/folge'
import { laufSchluessel } from '../lib/eingaben'
import { parcoursName } from '../config/sprache'
import { regelwerkSprache } from '../lib/listensprache'
import { WKR_ANNAHMEN } from './annahmen'
import { istOhneLauf, liesOhneLauf, listenKennung, ohneLaufKennung, teileVon, TISCH_BEREICH, type ListenTeil } from './liste'
import { coPilotenJeKlasse, LISTEN_SICHT_FASSUNG, maskenJeKlasse, maskenSprachen, maskenTexte, type ListenBestand, type ListenSicht, type ListenStart } from './sicht'
import { OHNE_PUNKT } from './abschluss'

// Übungsmodus der WKR-Maske (W3, Plan docs/plan-wkr-w3.md §3.3, G13, 21.11.2026) – rein, ohne AppState, ohne Store,
// ohne Netz. Die Übung baut eine ListenSicht wie der Bedienrechner (dieselben Masken über maskenJeKlasse), aber aus
// erfundenen Starts: Startnummern 1–WKR_ANNAHMEN.uebungStarts in den Klassen des Regelwerks, die die Liste haben –
// nie der Name eines Starters (Namen nur die erfundenen Co-Piloten am Steg, unten). Seit dem Wunsch des Nutzers vom 27.11.2026 („Hier beim Steg bitte noch das Boot und ggf.
// die Co-Piloten mit anzeigen“, WKR_ANNAHMEN CP8) mit erfundenem Boot je Klasse aus src/data/boote.ts an jedem Start (wie
// im Ernstfall) und an der Steg-Liste mit erfundenen Co-Piloten aus src/data/names.ts – Eigennamen, kein Text der
// Oberfläche, darum nicht in i18n. Bis dahin ohne Boot (Plan W3.1: ein Boot „Übung“ wäre ein Text außerhalb von i18n
// gewesen; „ÜBUNG“ steht ohnehin dauerhaft im Kopf). Nach der letzten Nummer beginnt der nächste Lauf.
//
// Abweichung vom Plan §3.3 (beim Bau 21.11.2026): Der Fortschritt steht in einem eigenen kleinen UebungsStand statt
// in der Sicht – die Sicht trägt weder Regelwerk noch Uhr, und ein neuer Start braucht beides. Gerätekern:
// geraete/uebung.ts (nächster Start 2–6 s nach dem Abschicken, Rückfall-Takt WKR_ANNAHMEN.uebungTaktSek, Quittung,
// Beispiel-Rückfrage).

/** Der Bereich der Übung (taucht nur in der Listen-Kennung auf). */
export const UEBUNG_BEREICH = 'uebung'
/** Wie viele Starts gleichzeitig „gezeigt“ sind, bevor der Takt weitere zeigt. */
const GEZEIGT_ANFANG = 2
/** Vorsteg: so viele freie Starts sieht er schon vor dem Zeigen (wie `vorabListen`). */
const VORAB = 2
/** Steg-Ablegen: so viele vorab (WKR_ANNAHMEN.stegAblegenVorab; die Übung kennt kein „Am Steg“ – „Als Nächstes“). */
const VORAB_STEG = 1

export interface UebungsStand {
  regelwerk: string
  typeId: string
  /** Sprache der Liste; Vorgabe die des Regelwerks (H5). */
  sprache: Sprache
  /** Laufende Nummer des nächsten noch nicht gezeigten Starts (0 = Nr. 1 im 1. Lauf). */
  naechster: number
  /** Gezeigte, noch offene Starts (laufende Nummer); am Steg mit den schon erledigten Teilen. */
  offen: { i: number; ab: boolean; an: boolean }[]
  /**
   * Nur Listen ohne Lauf (Knoten, W5.3, 22.11.2026, KN8): die schon abgenommenen Startnummern 1–uebungStarts. Kein
   * Zeigen, kein Takt – der WKR tippt die Nummer ein.
   */
  erledigt?: number[]
  /**
   * „Klasse vorziehen“ (Nutzer 22.11.2026, R7-45, WKR_ANNAHMEN.uebungVorziehen Y4): Der NÄCHSTE gezeigte Start ist
   * einer dieser Klasse; danach geht die normale Folge weiter. Am Tisch: der Vorschlag nimmt den ersten offenen
   * dieser Klasse, bis die nächste Zeile abgeschickt ist.
   */
  vorziehen?: ClassId
  /** Vorgezogen gezeigte laufende Nummern ≥ `naechster` – die normale Folge überspringt sie. */
  vorgezogen?: number[]
  /**
   * Erfundene weitere Starts (Block der Klasse im Lauf erschöpft): laufende Nummer EXTRA + k, Startnummer
   * uebungStarts + k + 1 – so kollidieren sie nie mit den Nummern 1–uebungStarts der normalen Folge.
   */
  extra?: { klasse: ClassId; lauf: number }[]
  /** Der zuletzt gezeigte Start (Steg-Anlegen: er ist noch im Boot); fehlt = `naechster − 1`. */
  zuletzt?: number
}

/**
 * Der Anfang einer Übung: `gezeigt` Starts gezeigt (Vorgabe zwei). Der Gerätekern beginnt mit 0 und zeigt selbst, bis
 * seine Schlange einen Start hat (Übungstakt, Nutzer 21.11.2026, WKR_ANNAHMEN.uebungFolgeNachSenden).
 */
export function uebungsStand(regelwerk: string, typeId: string, sprache?: Sprache, gezeigt: number = GEZEIGT_ANFANG): UebungsStand {
  // Knoten (W5.3): nichts wird gezeigt – alle Starter stehen im Bestand.
  if (ohneLauf({ regelwerk, typeId })) return { regelwerk, typeId, sprache: sprache ?? regelwerkSprache(regelwerk), naechster: 0, offen: [], erledigt: [] }
  return {
    regelwerk,
    typeId,
    sprache: sprache ?? regelwerkSprache(regelwerk),
    naechster: gezeigt,
    offen: Array.from({ length: gezeigt }, (_, i) => ({ i, ab: false, an: false })),
  }
}

/** Ab hier zählen die erfundenen weiteren Starts (Y4) – weit hinter jeder Übung, die man durchhält. */
const EXTRA = 1_000_000
const istExtra = (i: number) => i >= EXTRA
const laufNormal = (i: number) => Math.floor(i / WKR_ANNAHMEN.uebungStarts) + 1
const nrVon = (i: number) => (istExtra(i) ? WKR_ANNAHMEN.uebungStarts + (i - EXTRA) + 1 : (i % WKR_ANNAHMEN.uebungStarts) + 1)
/** Lauf eines Starts; ein erfundener, der erst gezeigt wird, gehört zum laufenden Lauf (`naechster`). */
function laufVon(stand: UebungsStand, i: number): number {
  if (!istExtra(i)) return laufNormal(i)
  return stand.extra?.[i - EXTRA]?.lauf ?? laufNormal(stand.naechster)
}
const keyVon = (stand: UebungsStand, i: number) => refKey({ art: 'm', starter: `u${nrVon(i)}`, lauf: laufVon(stand, i) })
/** Klasse eines Starts: fest nach Nummer über die Klassen verteilt; ein erfundener trägt seine (bzw. die vorgezogene). */
function klasseAus(stand: UebungsStand, klassen: readonly ClassId[], i: number): ClassId {
  if (istExtra(i)) return stand.extra?.[i - EXTRA]?.klasse ?? stand.vorziehen ?? klassen[0]
  return klassen[Math.floor(((nrVon(i) - 1) * klassen.length) / WKR_ANNAHMEN.uebungStarts)]
}

/**
 * Der Start, den „Klasse vorziehen“ als nächsten zeigt (Y4): der nächste noch nicht gezeigte ihres Blocks im
 * laufenden Lauf; ist der erschöpft, ein erfundener weiterer Start mit neuer Nummer. `null` = nichts vorgezogen.
 */
function zielVon(stand: UebungsStand, klassen: readonly ClassId[]): number | null {
  if (!stand.vorziehen) return null
  const vor = stand.vorgezogen ?? []
  const ende = laufNormal(stand.naechster) * WKR_ANNAHMEN.uebungStarts
  for (let j = stand.naechster; j < ende; j++) if (!vor.includes(j) && klasseAus(stand, klassen, j) === stand.vorziehen) return j
  return EXTRA + (stand.extra?.length ?? 0)
}

/** Die nächsten `n` zu zeigenden Starts: der vorgezogene zuerst, dann die normale Folge ohne schon gezeigte. */
function folgeVon(stand: UebungsStand, klassen: readonly ClassId[], n: number): number[] {
  const ziel = zielVon(stand, klassen)
  const out = ziel === null ? [] : [ziel]
  const vor = stand.vorgezogen ?? []
  for (let j = stand.naechster; out.length < n; j++) if (j !== ziel && !vor.includes(j)) out.push(j)
  return out.slice(0, n)
}

/** Zeigt den nächsten Start der Folge (der vorgezogene verbraucht `vorziehen`). */
function zeigeNaechsten(stand: UebungsStand, klassen: readonly ClassId[]): UebungsStand {
  const ziel = zielVon(stand, klassen)
  const [i] = folgeVon(stand, klassen, 1)
  let { naechster } = stand
  let vorgezogen = stand.vorgezogen ?? []
  let extra = stand.extra ?? []
  if (istExtra(i)) extra = [...extra, { klasse: stand.vorziehen!, lauf: laufNormal(naechster) }]
  else if (i === naechster) {
    naechster++
    while (vorgezogen.includes(naechster)) naechster++
  } else vorgezogen = [...vorgezogen, i]
  vorgezogen = vorgezogen.filter((j) => j >= naechster)
  const { vorziehen: _v, vorgezogen: _g, extra: _e, ...rest } = stand
  return {
    ...rest,
    ...(i !== ziel && stand.vorziehen ? { vorziehen: stand.vorziehen } : {}),
    ...(vorgezogen.length > 0 ? { vorgezogen } : {}),
    ...(extra.length > 0 ? { extra } : {}),
    naechster,
    offen: [...stand.offen, { i, ab: false, an: false }],
    zuletzt: i,
  }
}

/**
 * „Klasse vorziehen“ (Y4): Der nächste gezeigte Start (am Tisch: der Vorschlag) ist einer dieser Klasse. Eine Klasse,
 * die die Liste nicht hat, ändert nichts (dieselbe Referenz).
 */
export function ziehVor(stand: UebungsStand, klasse: ClassId): UebungsStand {
  if (stand.vorziehen === klasse || !klassenVon(stand).includes(klasse)) return stand
  return { ...stand, vorziehen: klasse }
}

/** Hat die Übungsliste keinen Lauf (Knoten, W5.3)? Dann Bestand statt Schlange. */
function ohneLauf(stand: Pick<UebungsStand, 'regelwerk' | 'typeId'>): boolean {
  return istOhneLauf(configFor({ regelwerk: stand.regelwerk }), stand.typeId)
}

/** Die Nummer 1–uebungStarts eines Starters ohne Lauf der Übung (`["o","u7"]`); `null`, wenn sie keiner ist. */
function nrOhneLauf(key: string): number | null {
  const m = /^u(\d+)$/.exec(liesOhneLauf(key) ?? '')
  const nr = m ? Number(m[1]) : 0
  return nr >= 1 && nr <= WKR_ANNAHMEN.uebungStarts ? nr : null
}

/** Die laufende Nummer zu einer Kennung der Übung; `null`, wenn sie keine ist (auch kein bekannter erfundener Start). */
function indexVon(stand: UebungsStand, key: string): number | null {
  const ref = liesRef(key)
  if (!ref || ref.art !== 'm') return null
  const m = /^u(\d+)$/.exec(ref.starter)
  if (!m) return null
  const nr = Number(m[1])
  if (nr < 1) return null
  if (nr > WKR_ANNAHMEN.uebungStarts) {
    // Erfundener Start (Y4): schon gezeigt, oder der gerade vorgezogene (Vorsteg sieht ihn vorab).
    const k = nr - WKR_ANNAHMEN.uebungStarts - 1
    const bekannt = k < (stand.extra?.length ?? 0) || (k === (stand.extra?.length ?? 0) && !!stand.vorziehen)
    return bekannt && laufVon(stand, EXTRA + k) === ref.lauf ? EXTRA + k : null
  }
  return (ref.lauf - 1) * WKR_ANNAHMEN.uebungStarts + nr - 1
}

function konfigVon(stand: UebungsStand, sprache: Sprache = stand.sprache) {
  return configFor({ regelwerk: stand.regelwerk, sprache })
}

/** Die Klassen der Übung: die des Regelwerks, die die Liste haben (sonst alle – dann „entfällt“ überall). */
function klassenVon(stand: UebungsStand): ClassId[] {
  const konfig = konfigVon(stand)
  const alle = konfig.getRegelwerk().klassen as ClassId[]
  const bekannt = konfig.getPositions().some((p) => p.typeId === stand.typeId)
  const mit = bekannt ? alle.filter((k) => konfig.positionAllowsClass(stand.typeId, k)) : []
  return mit.length > 0 ? mit : alle
}

/**
 * Erfundenes Ausgleichsgewicht eines Übungsstarts (Nutzer 24.11.2026, WKR_ANNAHMEN AG4): ein erfundenes Körpergewicht
 * um das Durchschnittsgewicht der Klasse (reihum WKR_ANNAHMEN.ausgleichUebung nach Startnummer), gerechnet durch
 * dieselbe Funktion wie am Bedienrechner (lib/ausgleich.ts ausgleichAmSteg). `null` = das Regelwerk kennt für die
 * Klasse kein Durchschnittsgewicht – dann steht wie im Ernstfall nichts.
 */
export function uebungsAusgleich(regelwerk: string, klasse: ClassId, nr: number): number | 'fehlt' | null {
  const folge = WKR_ANNAHMEN.ausgleichUebung
  const abstand = folge[(nr - 1) % folge.length]
  const soll = sollgewichtOf(regelwerk, {}, klasse)
  return ausgleichAmSteg({ regelwerk, sollgewicht: {} }, { klasse, ...(abstand === null || !(soll > 0) ? {} : { gewicht: Math.round((soll + abstand) * 10) / 10 }) })
}

/**
 * Erfundenes Boot einer Klasse in der Übung (Nutzer 27.11.2026, WKR_ANNAHMEN CP8): fest nach der Klasse aus den
 * Beispiel-Bootsnamen (src/data/boote.ts) – ohne Zufall, damit dieselbe Klasse in jeder Übung dasselbe Boot fährt; je
 * Klasse ein anderes (Schritt 5 ist teilerfremd zur Zahl der Namen).
 */
export function uebungsBoot(klasse: ClassId): string {
  return BOOTSNAMEN[(CLASS_IDS.indexOf(klasse) * 5 + 2) % BOOTSNAMEN.length]
}

/** Ein erfundener Name für die k-te Person der Übung (abwechselnd Vornamen w/m, Nachnamen gestreut). */
function uebungsName(k: number): string {
  const vornamen = k % 2 === 0 ? VORNAMEN_W : VORNAMEN_M
  return `${vornamen[(k * 7 + 3) % vornamen.length]} ${NACHNAMEN[(k * 13 + 5) % NACHNAMEN.length]}`
}

/**
 * Erfundene Besetzung der Übung für die Co-Piloten (Nutzer 27.11.2026, WKR_ANNAHMEN CP8): in jeder der `klassen`, in
 * der das Regelwerk einen Co-Piloten vorsieht, reihum nach WKR_ANNAHMEN.coPilotUebung Co-Pilot und ggf. Ersatz mit
 * erfundenem Namen und Gewicht. Als Stand für lib/ausgleich.ts – dieselbe Rechnung wie am Bedienrechner, „je Klasse“,
 * Stufe 1 kg (die Übung kennt keine Veranstaltung). Nichts davon gespeichert.
 */
export function uebungsCoPiloten(regelwerk: string, klassen: readonly ClassId[]): CoPilotStand {
  const folge = WKR_ANNAHMEN.coPilotUebung
  const coPiloten: CoPiloten = {}
  // In der Folge der Klassen (E, 1, 2 …), gleich wie `klassen` geordnet ist – reihum heißt immer dasselbe.
  CLASS_IDS.filter((k) => klassen.includes(k) && coPilotVorgesehen(regelwerk, k)).forEach((k, j) => {
    const art = folge[j % folge.length]
    const person = (n: number, kg: number | null): CoPilot => ({ name: uebungsName(2 * j + n), ...(kg === null ? {} : { gewicht: kg }) })
    coPiloten[k] = { haupt: person(0, art.haupt), ...(art.ersatz !== undefined ? { ersatz: person(1, art.ersatz) } : {}) }
  })
  return { regelwerk, starters: [], coPiloten, coPilotAusgleich: 'klasse' }
}

/** Die Sicht der Übung – Form und Fassung wie vom Bedienrechner (wkr/sicht.ts). */
export function uebungsSicht(stand: UebungsStand): ListenSicht {
  const sprachen = maskenSprachen(stand.regelwerk, stand.sprache)
  const listenKonfig = konfigVon(stand)
  const texte = listenKonfig.getBogenTexte()
  const klassen = klassenVon(stand)
  const klasseVon = (i: number) => klasseAus(stand, klassen, i)
  const teile = teileVon(stand.typeId)
  const vorab = WKR_ANNAHMEN.vorabListen.includes(stand.typeId)
  // Steg-Zeitversatz (Nutzer 21.11.2026, T1/T2): Ablegen sieht „Als Nächstes“ vorab, Anlegen erst nach dem Boot.
  const nVorab = vorab ? VORAB : teile && WKR_ANNAHMEN.stegAblegenVorab ? VORAB_STEG : 0
  const nachlaufend = !!teile && WKR_ANNAHMEN.stegAnlegenNachlaufend
  const imBoot = stand.zuletzt ?? stand.naechster - 1
  const mitAusgleich = WKR_ANNAHMEN.ausgleichListen.includes(stand.typeId)
  const start = (i: number, extra: Partial<ListenStart> = {}): ListenStart => {
    const ag = mitAusgleich ? uebungsAusgleich(stand.regelwerk, klasseVon(i), nrVon(i)) : null
    return {
      key: keyVon(stand, i),
      startNr: String(nrVon(i)),
      klasse: klasseVon(i),
      titel: texte.lauf(laufVon(stand, i)),
      lauf: laufSchluessel('manoevrieren', laufVon(stand, i)),
      boot: uebungsBoot(klasseVon(i)),
      ...(ag !== null ? { ausgleich: ag } : {}),
      ...extra,
    }
  }
  const schlange = stand.offen.map((o) => start(o.i, teile ? { teile: { ab: o.ab, an: o.an || (nachlaufend && o.i === imBoot) } } : {}))
  // Der vorgezogene Start (Y4) steht vorn – der Vorsteg sieht ihn schon vorab.
  const frei = folgeVon(stand, klassen, nVorab + WKR_ANNAHMEN.danach)
  schlange.push(...frei.slice(0, nVorab).map((i) => start(i, { vorab: true, ...(teile ? { teile: { ab: false, an: nachlaufend } } : {}) })))
  const danach = frei.slice(nVorab).map((i) => start(i, teile ? { teile: { ab: false, an: nachlaufend } } : {}))
  const normal = stand.offen.filter((o) => !istExtra(o.i)).map((o) => o.i)
  const lauf = laufNormal(normal.length > 0 ? Math.max(...normal) : stand.naechster)
  const xErlaubt = WKR_ANNAHMEN.xListen.includes(stand.typeId)
  const maskenKonfig = konfigVon(stand, sprachen.maske)
  const bekannt = listenKonfig.getPositions().some((p) => p.typeId === stand.typeId)
  // Knoten (W5.3, KN8): Bestand 1–20 statt Schlange, Punkt `ohne`, Bereich „Am Tisch“.
  const tisch = stand.erledigt !== undefined
  const bestand: ListenBestand[] = tisch
    ? Array.from({ length: WKR_ANNAHMEN.uebungStarts }, (_, j) => ({ key: ohneLaufKennung(`u${j + 1}`), startNr: String(j + 1), klasse: klasseVon(j), erledigt: stand.erledigt!.includes(j + 1) }))
    : []

  const sicht: ListenSicht = {
    lv: LISTEN_SICHT_FASSUNG,
    liste: listenKennung({ bereich: tisch ? TISCH_BEREICH : UEBUNG_BEREICH, typeId: stand.typeId, racecourse: null }),
    titel: bekannt ? listenKonfig.getSheetDef(stand.typeId).title : stand.typeId,
    bereich: tisch ? texte.tisch : parcoursName('Parcours 1', stand.sprache),
    sprache: stand.sprache,
    modus: 'digital',
    status: 'aktiv',
    punkt: tisch ? { id: OHNE_PUNKT, titel: texte.alleStarter } : { id: `lauf:${lauf}` as PunktId, titel: texte.lauf(lauf) },
    abgeschlossen: [],
    schlange: tisch ? [] : schlange,
    danach: tisch ? [] : danach,
    // Parcours-Zeichnung des vorgegebenen Aufbaus (W4-13, GF9) – die Übung kennt keinen eigenen.
    klassen: maskenJeKlasse(listenKonfig, maskenKonfig, stand.typeId, klassen, xErlaubt, DEFAULT_AUFBAU),
    geraete: {},
  }
  if (sprachen.andere !== null) {
    const andere = konfigVon(stand, sprachen.andere)
    sicht.andere = {
      sprache: sprachen.andere,
      titel: bekannt ? andere.getSheetDef(stand.typeId).title : stand.typeId,
      bereich: tisch ? andere.getBogenTexte().tisch : parcoursName('Parcours 1', sprachen.andere),
      klassen: maskenTexte(maskenJeKlasse(listenKonfig, andere, stand.typeId, klassen, xErlaubt)),
    }
  }
  if (teile) sicht.teile = { ab: { status: 'aktiv', abgeschlossen: [] }, an: { status: 'aktiv', abgeschlossen: [] } }
  // Co-Piloten am Steg (CP8): erfunden, durch dieselbe Auswahl und Rechnung wie die echte Sicht (wkr/sicht.ts).
  if (WKR_ANNAHMEN.coPilotListen.includes(stand.typeId)) {
    const coPiloten = coPilotenJeKlasse(uebungsCoPiloten(stand.regelwerk, klassen), sicht.klassen)
    if (coPiloten) sicht.coPiloten = coPiloten
  }
  if (tisch) {
    sicht.bestand = bestand
    sicht.offen = { n: bestand.filter((b) => !b.erledigt).length, m: bestand.length }
  }
  return sicht
}

/**
 * Ein Schritt der Übung: `zeile` = eine abgeschickte Zeile (Start erledigt, am Steg nur ihr Teil; ein noch nicht
 * gezeigter Start am Vorsteg wird dabei gezeigt), danach rücken Starts nach, bis `mindestens` offen sind (Vorgabe
 * zwei; der Gerätekern gibt 0 und zeigt den nächsten erst nach 2–6 s, Nutzer 21.11.2026);
 * `null` = der Takt zeigt den nächsten Start (höchstens WKR_ANNAHMEN.schlange offen). Unbekannte Kennungen ändern
 * nichts (dieselbe Referenz zurück).
 */
export function uebungsSchritt(stand: UebungsStand, zeile: { s: string; teil?: ListenTeil } | null, mindestens: number = GEZEIGT_ANFANG): UebungsStand {
  // Knoten (W5.3, KN8): kein Takt; eine Zeile hakt ihre Nummer ab (einmal).
  if (stand.erledigt !== undefined) {
    const nr = zeile ? nrOhneLauf(zeile.s) : null
    if (nr === null || stand.erledigt.includes(nr)) return stand
    // „Klasse vorziehen“ (Y4) wirkt am Tisch bis zur nächsten abgeschickten Zeile.
    const { vorziehen: _v, ...rest } = stand
    return { ...rest, erledigt: [...stand.erledigt, nr].sort((a, b) => a - b) }
  }
  const klassen = klassenVon(stand)
  if (zeile === null) {
    if (stand.offen.length >= WKR_ANNAHMEN.schlange) return stand
    return zeigeNaechsten(stand, klassen)
  }
  const i = indexVon(stand, zeile.s)
  if (i === null) return stand
  let neu = stand
  if (!stand.offen.some((x) => x.i === i)) {
    // Vorsteg vorab (oder geschätzt): alles in der Folge bis dorthin gilt als gezeigt.
    const p = folgeVon(stand, klassen, VORAB + WKR_ANNAHMEN.danach).indexOf(i)
    if (p < 0) return stand
    for (let j = 0; j <= p; j++) neu = zeigeNaechsten(neu, klassen)
  }
  let offen = neu.offen.map((o) => ({ ...o }))
  const o = offen.find((x) => x.i === i)
  if (!o) return stand
  const geteilt = !!teileVon(stand.typeId)
  if (geteilt && zeile.teil) o[zeile.teil] = true
  else {
    o.ab = true
    o.an = true
  }
  offen = offen.filter((x) => !(x.ab && x.an))
  neu = { ...neu, offen }
  while (neu.offen.length < mindestens) neu = zeigeNaechsten(neu, klassen)
  return neu
}
