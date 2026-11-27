import type { AppState, BereichId, KeineZeitGrund, PunktId, StartRef, WkrModus, WkrPunkt, WkrStatus } from '../types'
import type { Konfig } from '../config/konfig'
import { betriebVon, giltAuf, lage as bereichsLage, liesRef } from '../betrieb/folge'
import { erfasstKennung, listenFelder, werteVon, type Feld, type ListenTeil } from '../lib/eingaben'
import { abschluesseVon, punktVonRef, TEILE } from './abschluss'
import { WKR_ANNAHMEN } from './annahmen'
import { bestandOhneLauf, istParcoursListe, istTischListe, listenDerVeranstaltung, listenKennung, startAufListe, teileVon, teilHaken, teilVonZelle, type Liste } from './liste'
import { hatVorab, leser, schlange, vorabStarts, type SchlangenStart } from './schlange'
import { keineZeitVon } from './keineZeit'
import { listenSeite } from './versuch'

// Lage der digitalen WKR-Erfassung am Bedienrechner (W2, Plan docs/plan-wkr-w2.md §3, 21.11.2026): je Liste und Start,
// was da ist und was fehlt – EINE Stelle für Matrix, Geräteleiste, Rückstandswarnung, Marken der Erfassung und die
// Freigabe-Sicht. Rein: kein DOM, kein Store, keine Uhr (`jetzt` kommt hinein), nichts aus geraete/ – die Geräte kommen
// als einfache Daten ({@link GeraetAngabe}). Keine Wiederholung der Schlangenregeln: Offen ist, was `schlange()` nennt;
// gezeigt, ohne Haken und nicht in der Schlange heißt Papier (P, „Papier ab“, Rest auf Papier, vor `seit`, Pause –
// genau das, was `schlange()` über papierStarts/abschlussPapier ausnimmt). Abschlüsse nur über abschluss.ts.

/** Was ein Gerät zur Lage beiträgt – vom Host aus dem Register gereicht (gerätelokal, nie im Stand). */
export interface GeraetAngabe {
  id: string
  name: string
  /** Die Listen (Kennung) des Geräts, am Steg ggf. mit Teil. */
  listen: { liste: string; teil?: ListenTeil }[]
  /** Zuletzt gehört (ms seit 1970). */
  zuletzt: number
  /** Laut Lebenszeichen noch nicht zugestellte Zeilen (A11: nur als Zahl). */
  wartend?: number
  akku?: number
}

/** Gerät gehört ●, still ◐, weg ✕ – oder „ruht“ (grau), solange im Bereich kein Punkt läuft (A3). */
export type Ampel = 'gehoert' | 'still' | 'weg' | 'ruht'

/**
 * Stand einer Zelle der Matrix (Liste × Start): ✓ `ok`, ½ `halb` (Steg: ein Teil da), ○ `offen`, ○! `ueberfaellig`,
 * ! `rueckfrage`, V `vorschlag`, – `entfaellt` (Klasse ohne Liste, leere Seite), P `papier`, ✕ `x` (nicht gestartet –
 * ein X auf irgendeiner Liste des Laufs, seit 24.11.2026 auch „Nicht gestartet“ von einem Tor-Gerät, WKR_ANNAHMEN NG4),
 * `vorab` (Vorsteg: noch nicht gezeigt, schon zu erfassen), … `spaeter` (Steg-Anlegen kommt noch: Boot im Parcours
 * bzw. Start noch nicht gezeigt – kein Rückstand, kein Papier; WKR_ANNAHMEN.stegAnlegenNachlaufend, 21.11.2026).
 * ⊘ `nv` („nicht vorbeigekommen“, W4.3) entfiel am 24.11.2026 (NG6).
 */
export type Zelle = 'ok' | 'halb' | 'offen' | 'ueberfaellig' | 'rueckfrage' | 'vorschlag' | 'entfaellt' | 'papier' | 'x' | 'vorab' | 'spaeter'

export interface ZellLage {
  zelle: Zelle
  /** Nur geteilte Listen (Steg), wenn die Zelle aus den Teilen folgt: Stand je Teil. */
  teile?: { ab: Zelle; an: Zelle }
  /**
   * `ok` mit Disq.-Buchstaben im Disq.-Feld der Liste („J“, „A, D“) – die Matrix zeigt ✓ mit Disq.-Marke (seit W3-17,
   * 21.11.2026; ein X zeigt die Zelle als ✕ `x`, NG4).
   */
  disq?: string
  /**
   * `ok` mit „keine Zeit“ (W5.4, 22.11.2026, ZT4): je Zeitfeld ohne Zeit der Grund – die Matrix zeigt ✓ mit „keine
   * Zeit“, die Erfassung „Papier ansehen“ an genau diesen Zellen (zeilenMarken).
   */
  keineZeit?: Record<string, KeineZeitGrund>
}

/** Eine Spalte der Matrix: ein gezeigter Start (Parallelslalom: das Paar) bzw. am Vorsteg einer der nächsten (`vorab`). */
export interface MatrixStart {
  key: string
  /** Startnummern: einer, im Parallelslalom die besetzten Seiten A und B. */
  nummern: string[]
  punkt: PunktId | null
  /** Wann gezeigt; fehlt bei `vorab`. */
  zeit?: number
  vorab?: true
}

export interface ListenGeraet {
  id: string
  name: string
  teil?: ListenTeil
  ampel: Ampel
  /** Seit wann still (ms, nie negativ). */
  seitMs: number
  wartend?: number
  akku?: number
}

export interface ListenAbschluss {
  /** Punkt des Abschlusses; `ohne` = die ganze Liste am Tisch (W5.3). */
  punkt: WkrPunkt
  teil?: ListenTeil
  /** Name des Wettkampfrichters – nur am Bedienrechner (nie in einer Sicht). */
  name: string
  zeit: number
  /** Startnummern der abweichenden bzw. aufs Papier gegangenen Starts. */
  abweichend: string[]
  papier: string[]
}

export interface ListenLage {
  liste: string
  /** Name der Liste in der Sprache der übergebenen Konfiguration (Oberfläche). */
  titel: string
  typeId: string
  racecourse: Liste['racecourse']
  /** `null` = kein Eintrag = Papier (WKR_ANNAHMEN.ohneEintragPapier). */
  modus: WkrModus | null
  status: WkrStatus
  /** Nur geteilte Listen mit Eintrag: Status je Teil. */
  teile?: Record<ListenTeil, { status: WkrStatus }>
  /** Startnummer aus „Papier ab Start …“ der offenen Pause (`WkrPause.ab`), sonst `null`. */
  papierAb: string | null
  geraete: ListenGeraet[]
  /** Je Start (`key` der Matrix-Spalte) der Zellstand. */
  zellen: Record<string, ZellLage>
  /** Offene gezeigte Starts (Startnummern von–bis); `null`, wenn keiner offen ist (A4). */
  rueckstand: { zahl: number; von: string; bis: string } | null
  /**
   * Mindestens R offen (seit 21.11.2026, Befund 8; vorher mehr als R), Liste digital und aktiv (F1, F4) – und seit der
   * Parcours-Ampel (Nutzer 21.11.2026, P-03, AM5) nur noch Parcours-Listen: Steg und Vorsteg warnen nie.
   */
  warnt: boolean
  /** Parcours-Liste (wkr/liste.ts istParcoursListe, AM1): nur sie zählen für Ampel, Rückstandszeile und Auto-Modus. */
  parcours: boolean
  rueckfragen: number
  vorschlaege: number
  abschluss: ListenAbschluss[]
}

export interface ErfassungsLage {
  /** Der Punkt der Matrix: der laufende, sonst der des zuletzt gezeigten Starts. */
  punkt: PunktId | null
  starts: MatrixStart[]
  listen: ListenLage[]
}

/** Zustand eines Geräts nach seiner Stille (A13); ohne laufenden Punkt `ruht` (A3). */
export function ampelVon(zuletzt: number, jetzt: number, laeuft: boolean): Ampel {
  if (!laeuft && WKR_ANNAHMEN.ruhtOhnePunkt) return 'ruht'
  const still = jetzt - zuletzt
  if (still < WKR_ANNAHMEN.ampelStillSek * 1000) return 'gehoert'
  if (still < WKR_ANNAHMEN.ampelWegSek * 1000) return 'still'
  return 'weg'
}

const AMPEL_RANG: Record<Ampel, number> = { ruht: 0, gehoert: 1, still: 2, weg: 3 }

/** Die schlechteste Ampel (✕ vor ◐ vor ● vor grau); `null` ohne Geräte. */
export function schlechteste(ampeln: readonly Ampel[]): Ampel | null {
  return ampeln.reduce<Ampel | null>((a, b) => (a === null || AMPEL_RANG[b] > AMPEL_RANG[a] ? b : a), null)
}

const zellSchluessel = (lauf: string, starter: string) => `${lauf}|${starter}`

/** Die Startnummer eines Starters ('' ohne). */
function nummerVon(stand: AppState, id: string | null): string {
  return id === null ? '' : (stand.starters.find((s) => s.id === id)?.startNr ?? '')
}

/** Die Startnummern eines Starts: einer bzw. die besetzten Seiten eines Paars. */
function nummernVon(stand: AppState, ref: StartRef): string[] {
  if (ref.art === 'm') return [nummerVon(stand, ref.starter)]
  return [ref.a, ref.b].filter((id): id is string => id !== null).map((id) => nummerVon(stand, id))
}

/**
 * Rechnet Zellstände einer Liste – je Liste einmal gebaut (Schlangen, Papier, Rückfragen), dann je Start billig.
 * `gezeigt`: alle gezeigten Starts des Bereichs in ihrer Folge (für „überfällig“: mehr als R jüngere gezeigte Starts
 * derselben Liste dahinter, mindestens WKR_ANNAHMEN.ueberfaelligMin – N8, Feldtest 21.11.2026).
 */
function rechner(stand: AppState, konfig: Konfig, liste: Liste) {
  const kennung = listenKennung(liste)
  const eintrag = Object.hasOwn(stand.wkr.listen, kennung) ? stand.wkr.listen[kennung] : undefined
  const digital = !!eintrag && eintrag.modus !== 'papier'
  const teile = teileVon(liste.typeId)
  const geteilt = !!teile
  const { istX } = leser(stand, konfig, liste)
  // „Überfällig“ (A5) nie schärfer als vor dem Feldtest: R = 1 soll die Start-Freigabe fragen lassen, nicht jede eben
  // gezeigte Zeile in der Erfassung zu „Papier ansehen“ machen (N8).
  const R = Math.max(stand.anzeige.wkrRueckstand, WKR_ANNAHMEN.ueberfaelligMin)

  // Schlange je Rahmen (ganze Liste, bei geteilten Listen je Teil), nach Zelle (Lauf|Starter): Am Vorsteg mit
  // „Versuche nacheinander“ steht ein Starter einmal da, gezeigt wird er je Versuch.
  // `nachlaufend = false` nur, um beim Steg-Anlegen „kommt noch“ (Boot im Parcours) von „Papier“ zu trennen.
  const schlangeJe = new Map<string, Map<string, SchlangenStart>>()
  const schlangeVon = (t: ListenTeil | undefined, nachlaufend = true) => {
    const je = `${t ?? ''}|${nachlaufend}`
    let m = schlangeJe.get(je)
    if (!m) schlangeJe.set(je, (m = new Map(schlange(stand, liste, t, { nachlaufend }).map((s) => [zellSchluessel(s.lauf, s.starter), s]))))
    return m
  }

  // „Überfällig“: Folge der gezeigten Starts, die auf dieser Liste vorkommen (Klasse mit Liste), je Zelle die letzte Stelle.
  // Ohne abgebrochene Versuche (Ausfall, R11-11, 26.11.2026): Die Wiederholung zählt erst ab ihrem eigenen Zeigen –
  // sonst stünde sie gleich als „überfällig“ da. Im Parallelslalom nur Abbrüche, die das Boot dieser Liste trafen, und nie
  // die Wiederholung nur des anderen Boots (R13-02, betrieb/folge.ts giltAuf).
  const betrieb = betriebVon(stand, liste.bereich)
  const gezeigt = betrieb.gezeigt.filter((_, i) => giltAuf(betrieb, i, listenSeite(liste)))
  const gezeigtKeys = new Set(gezeigt.map((g) => g.ref))
  const stelle = new Map<string, number>()
  let n = 0
  for (const g of gezeigt) {
    const ref = liesRef(g.ref)
    const s = ref ? startAufListe(stand, konfig, liste, ref) : null
    if (!s || !konfig.positionAllowsClass(liste.typeId, s.starter.klasse)) continue
    const k = zellSchluessel(s.lauf, s.starter.id)
    if (!stelle.has(k)) stelle.set(k, n++)
  }
  const ueberfaellig = (k: string) => {
    const i = stelle.get(k)
    return i !== undefined && n - 1 - i > R
  }

  const offeneRueckfragen = stand.wkr.rueckfragen.filter((rf) => rf.liste === kennung)
  const rueckfrageZellen = new Map<string, string[]>()
  for (const rf of offeneRueckfragen) {
    const k = zellSchluessel(rf.lauf, rf.starter)
    rueckfrageZellen.set(k, [...(rueckfrageZellen.get(k) ?? []), rf.feld])
  }
  const offeneVorschlaege = stand.wkr.vorschlaege.filter((v) => v.liste === kennung)
  const vorschlagZellen = new Set(offeneVorschlaege.map((v) => zellSchluessel(v.lauf, v.starter)))

  // Abgetippt (WKR_ANNAHMEN.abgetipptErledigt, Prüfbefund 21.11.2026): Eigene Werte der Liste (am Steg die Felder des
  // Teils, ohne die gemeinsamen) zählen wie der Haken – wie lib/erfassung.ts zeileErfasst. Wer vom Bogen abtippt,
  // setzt den Haken nicht; sonst bliebe „Papier ansehen“ nach dem Abtippen stehen und der Rückstand warnte weiter.
  const felderJe = new Map<string, Feld[]>()
  const felderVon = (klasse: string) => {
    let f = felderJe.get(klasse)
    if (!f) felderJe.set(klasse, (f = konfig.getPositions().some((p) => p.typeId === liste.typeId) ? listenFelder(konfig, liste.typeId, klasse) : []))
    return f
  }
  const abgetippt = (werte: Readonly<Record<string, string>>, klasse: string, t: ListenTeil | undefined): boolean => {
    if (t !== undefined) return felderVon(klasse).some((f) => teilVonZelle(liste.typeId, f.zelle) === t && !!werte[f.kennung])
    if (geteilt) return TEILE.every((x) => abgetippt(werte, klasse, x))
    return felderVon(klasse).some((f) => !!werte[f.kennung])
  }
  /** Erledigt auf dieser Liste (bzw. in diesem Teil): Haken oder abgetippt. */
  const erledigt = (lauf: string, starter: string, klasse: string, t: ListenTeil | undefined): boolean => {
    const werte = werteVon(stand.eingaben, lauf, starter)
    return !!werte[erfasstKennung(liste.typeId)] || (t !== undefined && !!werte[teilHaken(liste.typeId, t)]) || abgetippt(werte, klasse, t)
  }

  /** Stand eines Teils (bzw. der ganzen Liste) für eine Zelle ohne ganzen Haken. */
  const teilZelle = (key: string, k: string, werte: Readonly<Record<string, string>>, klasse: string, t: ListenTeil | undefined): Zelle => {
    if (t !== undefined && (werte[teilHaken(liste.typeId, t)] || abgetippt(werte, klasse, t))) return 'ok'
    // Ohne Eintrag oder auf Papier, vor `seit`, in einer Pause, „Papier ab“, „Rest auf Papier“: vom Bogen.
    if (!digital) return 'papier'
    const q = schlangeVon(t).get(k)
    if (!q) {
      // Steg-Anlegen nachlaufend (T2): Boot noch im Parcours bzw. Start noch nicht gezeigt – „kommt noch“, nicht Papier.
      if (t === 'an' && WKR_ANNAHMEN.stegAnlegenNachlaufend && (!gezeigtKeys.has(key) || schlangeVon(t, false).has(k))) return 'spaeter'
      return 'papier'
    }
    if (q.vorab) return 'vorab'
    return ueberfaellig(k) ? 'ueberfaellig' : 'offen'
  }

  /** Disq.-Buchstaben im Disq.-Feld der Liste (seit W3-17) – nur, wenn welche stehen. */
  const disqMarke = (werte: Readonly<Record<string, string>>, klasse: string): { disq?: string } => {
    const text = felderVon(klasse)
      .filter((f) => f.kind === 'disq')
      .map((f) => werte[f.kennung] ?? '')
      .filter((x) => x !== '')
      .join(', ')
    return text ? { disq: text } : {}
  }
  /** „Keine Zeit“ der Zelle (W5.4, ZT4) – nur, wenn eins steht. */
  const kzMarke = (lauf: string, starter: string): { keineZeit?: Record<string, KeineZeitGrund> } => {
    const kz = keineZeitVon(stand.wkr, kennung, lauf, starter)
    return Object.keys(kz).length > 0 ? { keineZeit: { ...kz } } : {}
  }

  /** Der Zellstand eines Starts (Kennung) auf dieser Liste; `null`, wenn der Start nicht zur Art des Bereichs passt. */
  const zelleVon = (key: string): (ZellLage & { lauf: string; weitere: string[]; starter: string; klasse: string }) | null => {
    const ref = liesRef(key)
    if (!ref) return null
    const start = startAufListe(stand, konfig, liste, ref)
    // Leere Seite im Parallelslalom: nichts zu erfassen.
    if (!start) return ref.art === 'p' && liste.racecourse !== null ? { zelle: 'entfaellt', lauf: '', weitere: [], starter: '', klasse: '' } : null
    const basis = { lauf: start.lauf, weitere: start.weitere, starter: start.starter.id, klasse: start.starter.klasse }
    // Vorrang (Plan §3): X, Klasse ohne Liste, Rückfrage, Vorschlag, Haken, Teilhaken, Papier, Schlange.
    if (istX(start.lauf, start.starter.id, start.starter.klasse)) return { ...basis, zelle: 'x' }
    if (!konfig.positionAllowsClass(liste.typeId, start.starter.klasse)) return { ...basis, zelle: 'entfaellt' }
    const k = zellSchluessel(start.lauf, start.starter.id)
    if (rueckfrageZellen.has(k)) return { ...basis, zelle: 'rueckfrage' }
    if (vorschlagZellen.has(k)) return { ...basis, zelle: 'vorschlag' }
    const werte = werteVon(stand.eingaben, start.lauf, start.starter.id)
    const ganz = !!werte[erfasstKennung(liste.typeId)]
    if (ganz) return { ...basis, zelle: 'ok', ...disqMarke(werte, start.starter.klasse), ...kzMarke(start.lauf, start.starter.id) }
    if (!geteilt) {
      if (abgetippt(werte, start.starter.klasse, undefined)) return { ...basis, zelle: 'ok', ...kzMarke(start.lauf, start.starter.id) }
      return { ...basis, zelle: teilZelle(key, k, werte, start.starter.klasse, undefined) }
    }
    const je = {
      ab: teilZelle(key, k, werte, start.starter.klasse, 'ab'),
      an: teilZelle(key, k, werte, start.starter.klasse, 'an'),
    }
    return { ...basis, zelle: zusammen(je), teile: je }
  }

  return { kennung, eintrag, digital, geteilt, teile, schlangeVon, zelleVon, erledigt, rueckfrageZellen, offeneRueckfragen, offeneVorschlaege }
}

/** Zellstand einer geteilten Liste aus den Teilen: ein Teil da → ½, sonst der dringendere Teil. */
function zusammen(je: { ab: Zelle; an: Zelle }): Zelle {
  if (je.ab === 'ok' && je.an === 'ok') return 'ok'
  if (je.ab === 'ok' || je.an === 'ok') return 'halb'
  for (const z of ['ueberfaellig', 'offen', 'vorab', 'spaeter'] as const) if (je.ab === z || je.an === z) return z
  return 'papier'
}

/** Die Geräte einer Liste mit Ampel. */
function geraeteDerListe(kennung: string, geraete: readonly GeraetAngabe[], jetzt: number, laeuft: boolean): ListenGeraet[] {
  const out: ListenGeraet[] = []
  for (const g of geraete) {
    const l = g.listen.find((x) => x.liste === kennung)
    if (!l) continue
    out.push({
      id: g.id,
      name: g.name,
      ...(l.teil !== undefined ? { teil: l.teil } : {}),
      ampel: ampelVon(g.zuletzt, jetzt, laeuft),
      seitMs: Math.max(0, jetzt - g.zuletzt),
      ...(g.wartend !== undefined ? { wartend: g.wartend } : {}),
      ...(g.akku !== undefined ? { akku: g.akku } : {}),
    })
  }
  return out
}

/** Der Punkt der Matrix: der laufende, sonst der des zuletzt gezeigten Starts. */
function matrixPunkt(stand: AppState, bereich: BereichId): PunktId | null {
  const laufend = bereichsLage(stand, bereich).laufend
  if (laufend !== null) return laufend
  const letzter = betriebVon(stand, bereich).gezeigt.at(-1)
  return letzter ? punktVonRef(stand, letzter.ref) : null
}

/** Ist der gezeigte Start eines Bereichs durchs Start-Tor gefahren (Parcours-Ampel, AM4)? */
export interface Durchfahrt {
  /** Der gezeigte Start (`refKey`); `null` = keiner. */
  ref: string | null
  /** Durchgefahren: per Knopf oder weil eine Parcours-Liste für ihn schon etwas hat. */
  durch: boolean
  /** Per Knopf „Durchs Start-Tor“ (BereichBetrieb.durchfahrt) – nur dann gibt es „zurück“. */
  perKnopf: boolean
  /** Eine Liste trägt für ihn X (nicht gestartet): auf niemanden zu warten. */
  x: boolean
}

/**
 * Durchfahrt des gezeigten Starts (Nutzer 21.11.2026, P-03, WKR_ANNAHMEN.rotDurchErsteZeile, AM4): per Knopf
 * (`durchfahrt` des Bereichs für genau diesen Start) ODER irgendeine Parcours-Liste – gleich in welchem Modus, auch
 * abgetippt vom Bogen – hat für ihn einen Haken, einen eigenen Wert, eine offene Rückfrage oder einen Vorschlag. Wer
 * etwas abschickt, hat das Boot gesehen. Ein X des Starts gilt als durch (`x`).
 */
export function durchfahrtVon(stand: AppState, konfig: Konfig, bereich: BereichId): Durchfahrt {
  // Ein abgebrochener Versuch im Boot (Ausfall, R11-11) hat keine Ampel (BETRIEB_ANNAHMEN.wiederholungOhneAmpel).
  const aktuell = bereichsLage(stand, bereich).aktuell
  const ref = aktuell && !aktuell.abgebrochen ? aktuell.key : null
  if (ref === null) return { ref, durch: false, perKnopf: false, x: false }
  const betrieb = betriebVon(stand, bereich)
  const perKnopf = betrieb.durchfahrt?.ref === ref
  const start = liesRef(ref)
  let durch = perKnopf
  let x = false
  if (start) {
    for (const liste of listenDerVeranstaltung(stand, konfig)) {
      if (liste.bereich !== bereich || !istParcoursListe(konfig, liste.typeId)) continue
      // Die Wiederholung nur eines Boots (R13-02): Nur die Listen seines Racecourse zählen – die des anderen tragen die
      // Werte aus dem früheren, geltenden Versuch, das wiederholende Boot liegt noch vor dem Start-Tor (Prüfbefund 27.11.2026).
      if (!giltAuf(betrieb, betrieb.gezeigt.length - 1, listenSeite(liste))) continue
      const s = startAufListe(stand, konfig, liste, start)
      if (!s) continue
      if (leser(stand, konfig, liste).istX(s.lauf, s.starter.id, s.starter.klasse)) {
        x = true
        durch = true
        continue
      }
      if (durch) continue
      const kennung = listenKennung(liste)
      const werte = werteVon(stand.eingaben, s.lauf, s.starter.id)
      const felder = konfig.positionAllowsClass(liste.typeId, s.starter.klasse) ? listenFelder(konfig, liste.typeId, s.starter.klasse) : []
      const gleich = (e: { liste: string; lauf: string; starter: string }) => e.liste === kennung && e.lauf === s.lauf && e.starter === s.starter.id
      if (!!werte[erfasstKennung(liste.typeId)] || felder.some((f) => !!werte[f.kennung]) || stand.wkr.rueckfragen.some(gleich) || stand.wkr.vorschlaege.some(gleich)) durch = true
    }
  }
  return { ref, durch, perKnopf, x }
}

/**
 * Die Lage der Erfassung in einem Bereich: Spalten (gezeigte Starts des laufenden Punkts, die letzten
 * WKR_ANNAHMEN.matrixStarts oder mit `starts: 'alle'` alle; am Vorsteg dazu die nächsten freien) und je Liste des
 * Bereichs (Parallelslalom: je Racecourse) Modus, Status, Geräte mit Ampel, Zellstände, Rückstand, Rückfragen,
 * Vorschläge, Abschlüsse.
 */
export function erfassungsLage(stand: AppState, konfig: Konfig, bereich: BereichId, geraete: readonly GeraetAngabe[], jetzt: number, starts: 'punkt' | 'alle' = 'punkt'): ErfassungsLage {
  const listen = listenDerVeranstaltung(stand, konfig).filter((l) => l.bereich === bereich)
  const laeuft = bereichsLage(stand, bereich).laufend !== null
  const punkt = matrixPunkt(stand, bereich)
  const gesehen = new Set<string>()
  let spalten: MatrixStart[] = []
  for (const g of betriebVon(stand, bereich).gezeigt) {
    const ref = liesRef(g.ref)
    // Ein abgebrochener Versuch (R11-11) ist keine Spalte; die Wiederholung bekommt ihre mit dem neuen Zeigen.
    if (!ref || g.abgebrochen || gesehen.has(g.ref) || punkt === null || punktVonRef(stand, g.ref) !== punkt) continue
    gesehen.add(g.ref)
    spalten.push({ key: g.ref, nummern: nummernVon(stand, ref), punkt, zeit: g.zeit })
  }
  if (starts === 'punkt') spalten = spalten.slice(-WKR_ANNAHMEN.matrixStarts)
  // Vorab-Spalten: die Starts, die eine Liste mit Eintrag schon vor dem Zeigen sieht (Vorsteg; Steg-Ablegen seit dem
  // Nutzerbefund 21.11.2026) – je Liste ihre eigenen (Vorsteg mehr als Ablegen), in der Folge des Bereichs.
  for (const l of listen.filter((x) => hatVorab(x.typeId) && stand.wkr.listen[listenKennung(x)])) {
    for (const e of vorabStarts(stand, l)) {
      if (gesehen.has(e.key)) continue
      gesehen.add(e.key)
      spalten.push({ key: e.key, nummern: nummernVon(stand, e.ref), punkt: punktVonRef(stand, e.key), vorab: true })
    }
  }
  const R = stand.anzeige.wkrRueckstand
  const aufTafel = bereichsLage(stand, bereich).aktuell?.key ?? null
  // Parcours-Ampel (P-03, AM5): Der gezeigte Start zählt auf Parcours-Listen erst, wenn er durchgefahren ist.
  const durch = durchfahrtVon(stand, konfig, bereich).durch
  const lagen = listen.map((liste): ListenLage => {
    const r = rechner(stand, konfig, liste)
    const parcours = istParcoursListe(konfig, liste.typeId)
    const zellen: Record<string, ZellLage> = {}
    const vorabListe = hatVorab(liste.typeId)
    for (const s of spalten) {
      // Noch nicht gezeigte Starts stehen nur auf den Listen, die sie vorab sehen.
      if (s.vorab && !vorabListe) continue
      const z = r.zelleVon(s.key)
      // Ein Start vorab, der nicht (mehr) in der Schlange steht, hat hier nichts zu zeigen.
      // Am Steg sieht nur das Ablegen vorab: Ist es dort Papier (Start hinter „Am Steg“), hat die Zeile nichts zu zeigen.
      if (!z || (s.vorab && (z.zelle === 'papier' || z.teile?.ab === 'papier'))) continue
      zellen[s.key] = { zelle: z.zelle, ...(z.teile ? { teile: z.teile } : {}), ...(z.disq ? { disq: z.disq } : {}), ...(z.keineZeit ? { keineZeit: z.keineZeit } : {}) }
    }
    const geraeteHier = geraeteDerListe(r.kennung, geraete, jetzt, laeuft)
    const nr = (s: SchlangenStart | undefined) => (s ? nummerVon(stand, s.starter) : '')
    // Rückstand (A4): offene gezeigte Starts; am Steg mit Teil-Geräten der Teil, der weiter zurück ist. Abgetippte
    // zählen nicht (die Schlange der Geräte kennt nur den Haken, WKR_ANNAHMEN.abgetipptErledigt).
    // Am Steg zählt das Anlegen des Starts auf der Tafel nie (WKR_ANNAHMEN.stegAnlegenNachlaufend, Prüfbefund 21.11.2026):
    // Auch am Ende eines Punkts, wo er für die Schlange schon „zurück“ ist – sonst fragte die Freigabe an jeder Laufgrenze.
    const nurAnlegenAufTafel = (s: SchlangenStart, t: ListenTeil | undefined) =>
      r.geteilt && WKR_ANNAHMEN.stegAnlegenNachlaufend && s.key === aufTafel && (t === 'an' || (t === undefined && r.erledigt(s.lauf, s.starter, s.klasse, 'ab')))
    const nochNichtDurch = (s: SchlangenStart) => parcours && !durch && s.key === aufTafel
    const offen = (t: ListenTeil | undefined) =>
      [...r.schlangeVon(t).values()].filter((s) => !s.vorab && !s.entfaellt && !r.erledigt(s.lauf, s.starter, s.klasse, t) && !nurAnlegenAufTafel(s, t) && !nochNichtDurch(s))
    let q = offen(undefined)
    if (r.geteilt && geraeteHier.some((g) => g.teil !== undefined)) {
      const ab = offen('ab')
      const an = offen('an')
      q = ab.length >= an.length ? ab : an
    }
    const rueckstand = q.length > 0 ? { zahl: q.length, von: nr(q[0]), bis: nr(q.at(-1)) } : null
    const e = r.eintrag
    const status = e?.status ?? 'aktiv'
    const offenePause = [...(e?.pausen ?? []), ...TEILE.flatMap((t) => e?.teile?.[t]?.pausen ?? [])].find((p) => p.bis === null && p.ab !== undefined)
    const abRef = offenePause?.ab !== undefined ? liesRef(offenePause.ab) : null
    const abStart = abRef ? startAufListe(stand, konfig, liste, abRef) : null
    const out: ListenLage = {
      liste: r.kennung,
      titel: konfig.getPositions().some((p) => p.typeId === liste.typeId) ? konfig.getSheetDef(liste.typeId).title : liste.typeId,
      typeId: liste.typeId,
      racecourse: liste.racecourse,
      modus: e?.modus ?? null,
      status,
      papierAb: abStart ? abStart.starter.startNr : null,
      geraete: geraeteHier,
      zellen,
      rueckstand,
      // Ab R offenen Starts (Feldtest 21.11.2026, Befund 8; vorher „mehr als R“, F4/A4) – WKR_ANNAHMEN.rueckstandAbR.
      // Nur Parcours-Listen (Nutzer 21.11.2026, P-03, AM5): Steg und Vorsteg „laufen autark“.
      warnt: parcours && !!rueckstand && r.digital && status === 'aktiv' && rueckstand.zahl >= R,
      parcours,
      rueckfragen: r.offeneRueckfragen.length,
      vorschlaege: r.offeneVorschlaege.length,
      abschluss: abschluesseVon(stand.wkr, r.kennung).map(({ punkt: p, teil, abschluss: a }) => {
        const nummern = (keys: readonly string[]) =>
          keys.map((k) => {
            const ref = liesRef(k)
            return ref ? nummernVon(stand, ref).join('/') : ''
          })
        return { punkt: p, ...(teil !== undefined ? { teil } : {}), name: a.name, zeit: a.zeit, abweichend: nummern(a.abweichend), papier: nummern(a.papier) }
      }),
    }
    if (r.geteilt && e) out.teile = { ab: { status: e.teile?.ab?.status ?? 'aktiv' }, an: { status: e.teile?.an?.status ?? 'aktiv' } }
    return out
  })
  return { punkt, starts: spalten, listen: lagen }
}

/** Lage einer Liste am Tisch (ohne Lauf, Knoten – W5.3, 22.11.2026, KN4): wie eine ListenLage, dazu der Bestand. */
export interface TischLage extends ListenLage {
  /** Starter des Bestands ohne Haken und ohne eigene Werte (wie „erledigt“ der Matrix) / alle des Bestands. */
  knoten: { offen: number; gesamt: number; nummern: string[] }
}

/**
 * Die Listen am Tisch (Bereich `tisch`, ohne Lauf): je Liste Modus, Status, Geräte mit Ampel, Rückfragen/Vorschläge,
 * Abschlüsse und „Knoten: 14 / 38 offen“ (KN4). Nie Rückstand, nie `warnt`, nie Parcours – die Liste gehört zu keinem
 * Bereich des Betriebs, also auch nie zur Start-Freigabe. „Erledigt“ wie in der Matrix: Haken oder eigene Werte
 * (abgetippt). Die Ampel der Geräte ruht nie (am Tisch gibt es keinen laufenden Punkt; sie zählt die Stille).
 */
export function tischLage(stand: AppState, konfig: Konfig, geraete: readonly GeraetAngabe[], jetzt: number): TischLage[] {
  return listenDerVeranstaltung(stand, konfig)
    .filter(istTischListe)
    .map((liste): TischLage => {
      const r = rechner(stand, konfig, liste)
      const bestand = bestandOhneLauf(stand, konfig, liste)
      const offen = bestand.filter(({ start }) => !r.erledigt(start.lauf, start.starter.id, start.starter.klasse, undefined))
      const e = r.eintrag
      const nummer = (key: string) => {
        const b = bestand.find((x) => x.key === key)
        return b ? b.start.starter.startNr : ''
      }
      return {
        liste: r.kennung,
        titel: konfig.getPositions().some((p) => p.typeId === liste.typeId) ? konfig.getSheetDef(liste.typeId).title : liste.typeId,
        typeId: liste.typeId,
        racecourse: null,
        modus: e?.modus ?? null,
        status: e?.status ?? 'aktiv',
        papierAb: null,
        geraete: geraeteDerListe(r.kennung, geraete, jetzt, true),
        zellen: {},
        rueckstand: null,
        warnt: false,
        parcours: false,
        rueckfragen: r.offeneRueckfragen.length,
        vorschlaege: r.offeneVorschlaege.length,
        abschluss: abschluesseVon(stand.wkr, r.kennung).map(({ punkt, teil, abschluss: a }) => ({
          punkt,
          ...(teil !== undefined ? { teil } : {}),
          name: a.name,
          zeit: a.zeit,
          abweichend: a.abweichend.map(nummer),
          papier: a.papier.map(nummer),
        })),
        knoten: { offen: offen.length, gesamt: bestand.length, nummern: offen.map(({ start }) => start.starter.startNr) },
      }
    })
}

/** Marke einer Zeile bzw. Zelle in der Erfassung (F4, A5). */
export type ZeilenMarke = 'papier-ansehen' | 'rueckfrage'

export interface ZeilenMarken {
  /** Marke der ganzen Zeile (▭ bzw. !); `null`, wenn nur einzelne Zellen markiert sind. */
  marke: ZeilenMarke | null
  /** Je Feld-Kennung die Marke der Zelle. */
  zellen: Record<string, ZeilenMarke>
}

/**
 * Marken „Papier ansehen“ und Rückfrage für die Erfassungstabelle eines Bogens (A5): je Zeile (`${lauf}|${starter}`,
 * nur Lauf-Schlüssel aus `laeufe`) – nur für Listen mit Eintrag „digital“ oder „beides“. Zeile: Start auf Papier,
 * überfällig, oder offen, während jedes Gerät der Liste (bzw. des Teils) `weg` ist; Zelle: nur ein Steg-Teil ist
 * verdächtig (dessen Spalten) bzw. genau dort steht eine Rückfrage. `geraete`/`jetzt` wie bei erfassungsLage; ohne
 * Geräte zählt „offen“ nie als verdächtig. Je Bogen einmal rechnen (Leistung).
 */
export function zeilenMarken(stand: AppState, konfig: Konfig, liste: Liste, laeufe: readonly string[], geraete: readonly GeraetAngabe[] = [], jetzt = 0): Map<string, ZeilenMarken> {
  const out = new Map<string, ZeilenMarken>()
  const r = rechner(stand, konfig, liste)
  if (!r.digital) return out
  const imBogen = new Set(laeufe)
  const laeuft = bereichsLage(stand, liste.bereich).laufend !== null
  const hier = geraeteDerListe(r.kennung, geraete, jetzt, laeuft)
  /** Ist jedes Gerät dieses Teils (bzw. der Liste) weg? Ohne Geräte: nein (A5, Beim Bau). */
  const alleWeg = (t: ListenTeil | undefined) => {
    const g = hier.filter((x) => t === undefined || x.teil === undefined || x.teil === t)
    return g.length > 0 && g.every((x) => x.ampel === 'weg')
  }
  const verdaechtig = (z: Zelle, t: ListenTeil | undefined) => z === 'papier' || z === 'ueberfaellig' || (z === 'offen' && alleWeg(t))
  const gesehen = new Set<string>()
  const betrieb = betriebVon(stand, liste.bereich)
  for (let i = 0; i < betrieb.gezeigt.length; i++) {
    const g = betrieb.gezeigt[i]
    // Abgebrochene Versuche (R11-11) markieren nichts – die Erfassung zeigt dort „Wiederholung nach Ausfall“. Im
    // Parallelslalom nur, wenn der Abbruch das Boot dieser Liste traf; die Wiederholung nur des anderen Boots nie (R13-02).
    if (!giltAuf(betrieb, i, listenSeite(liste))) continue
    const z = r.zelleVon(g.ref)
    if (!z || z.starter === '') continue
    const laufe = [z.lauf, ...z.weitere].filter((l) => imBogen.has(l))
    const eigen = zellSchluessel(z.lauf, z.starter)
    if (laufe.length === 0 || gesehen.has(eigen)) continue
    gesehen.add(eigen)
    let m: ZeilenMarken | null = null
    if (z.zelle === 'rueckfrage') {
      m = { marke: 'rueckfrage', zellen: Object.fromEntries((r.rueckfrageZellen.get(eigen) ?? []).map((f) => [f, 'rueckfrage' as const])) }
    } else if (z.teile && r.teile) {
      const je = TEILE.filter((t) => z.teile![t] !== 'ok' && verdaechtig(z.teile![t], t))
      if (je.length === TEILE.length) m = { marke: 'papier-ansehen', zellen: {} }
      else if (je.length > 0) {
        const felder = listenFelder(konfig, liste.typeId, z.klasse).filter((f) => je.includes(teilVonZelle(liste.typeId, f.zelle) as ListenTeil))
        m = { marke: null, zellen: Object.fromEntries(felder.map((f) => [f.kennung, 'papier-ansehen' as const])) }
      }
    } else if (verdaechtig(z.zelle, undefined)) {
      m = { marke: 'papier-ansehen', zellen: {} }
    } else if (z.zelle === 'ok' && z.keineZeit) {
      // „Keine Zeit“ (W5.4, ZT4): genau die Zeitfelder ohne Zeit – dort steht vielleicht eine Stoppuhrzeit auf dem Bogen.
      m = { marke: null, zellen: Object.fromEntries(Object.keys(z.keineZeit).map((f) => [f, 'papier-ansehen' as const])) }
    }
    if (m) for (const l of laufe) out.set(zellSchluessel(l, z.starter), m)
  }
  // Rückfragen zu Starts, die die Start-Freigabe nicht gezeigt hat (Grund `start`, Prüfbefund 21.11.2026): gerade
  // dort wartet ein Gerätewert, den die Schleife oben nie sieht – „!“ unabhängig von `gezeigt`.
  for (const rf of r.offeneRueckfragen) {
    const laufe = [rf.lauf, ...rf.weitere].filter((l) => imBogen.has(l))
    if (laufe.length === 0) continue
    const eigen = zellSchluessel(rf.lauf, rf.starter)
    const m: ZeilenMarken = { marke: 'rueckfrage', zellen: Object.fromEntries((r.rueckfrageZellen.get(eigen) ?? []).map((f) => [f, 'rueckfrage' as const])) }
    for (const l of laufe) if (out.get(zellSchluessel(l, rf.starter))?.marke !== 'rueckfrage') out.set(zellSchluessel(l, rf.starter), m)
  }
  return out
}

/** Die Zeile über „Nächster Start“ (F4): die Listen, die warnen, mit offenen Startnummern und Gerätezustand. */
export interface RueckstandZeile {
  warnt: boolean
  teile: { titel: string; zahl: number; von: string; bis: string; geraet: Ampel | null; wartend?: number }[]
}

/** Die Rückstandszeile aus den Lagen eines Bereichs: nur warnende Listen. */
export function rueckstandZeile(lagen: readonly ListenLage[]): RueckstandZeile {
  const teile = lagen
    .filter((l) => l.warnt && l.rueckstand)
    .map((l) => {
      const wartend = l.geraete.reduce((s, g) => s + (g.wartend ?? 0), 0)
      const titel = l.racecourse ? `${l.titel} ${l.racecourse}` : l.titel
      return { titel, zahl: l.rueckstand!.zahl, von: l.rueckstand!.von, bis: l.rueckstand!.bis, geraet: schlechteste(l.geraete.map((g) => g.ampel)), ...(wartend > 0 ? { wartend } : {}) }
    })
  return { warnt: teile.length > 0, teile }
}
