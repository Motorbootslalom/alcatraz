import type { AppState, BereichId, PunktId, StartRef, WkrModus, WkrStatus } from '../types'
import type { Konfig } from '../config/konfig'
import { betriebVon, lage as bereichsLage, liesRef } from '../betrieb/folge'
import { erfasstKennung, listenFelder, werteVon, type Feld, type ListenTeil } from '../lib/eingaben'
import { abschluesseVon, punktVonRef, TEILE } from './abschluss'
import { WKR_ANNAHMEN } from './annahmen'
import { listenDerVeranstaltung, listenKennung, startAufListe, teileVon, teilHaken, teilVonZelle, type Liste } from './liste'
import { leser, naechsteFreie, schlange, type SchlangenStart } from './schlange'

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
 * ! `rueckfrage`, V `vorschlag`, – `entfaellt` (Klasse ohne Liste, leere Seite), P `papier`, ✕ `x` (nicht gestartet),
 * `vorab` (Vorsteg: noch nicht gezeigt, schon zu erfassen).
 */
export type Zelle = 'ok' | 'halb' | 'offen' | 'ueberfaellig' | 'rueckfrage' | 'vorschlag' | 'entfaellt' | 'papier' | 'x' | 'vorab'

export interface ZellLage {
  zelle: Zelle
  /** Nur geteilte Listen (Steg), wenn die Zelle aus den Teilen folgt: Stand je Teil. */
  teile?: { ab: Zelle; an: Zelle }
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
  punkt: PunktId
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
  /** Mindestens R offen (seit 21.11.2026, Befund 8; vorher mehr als R), Liste digital und aktiv (F1, F4). */
  warnt: boolean
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
  const schlangeJe = new Map<ListenTeil | undefined, Map<string, SchlangenStart>>()
  const schlangeVon = (t: ListenTeil | undefined) => {
    let m = schlangeJe.get(t)
    if (!m) schlangeJe.set(t, (m = new Map(schlange(stand, liste, t).map((s) => [zellSchluessel(s.lauf, s.starter), s]))))
    return m
  }

  // „Überfällig“: Folge der gezeigten Starts, die auf dieser Liste vorkommen (Klasse mit Liste), je Zelle die letzte Stelle.
  const gezeigt = betriebVon(stand, liste.bereich).gezeigt
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
  const teilZelle = (k: string, werte: Readonly<Record<string, string>>, klasse: string, t: ListenTeil | undefined): Zelle => {
    if (t !== undefined && (werte[teilHaken(liste.typeId, t)] || abgetippt(werte, klasse, t))) return 'ok'
    // Ohne Eintrag oder auf Papier, vor `seit`, in einer Pause, „Papier ab“, „Rest auf Papier“: vom Bogen.
    if (!digital) return 'papier'
    const q = schlangeVon(t).get(k)
    if (!q) return 'papier'
    if (q.vorab) return 'vorab'
    return ueberfaellig(k) ? 'ueberfaellig' : 'offen'
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
    if (werte[erfasstKennung(liste.typeId)]) return { ...basis, zelle: 'ok' }
    if (!geteilt) return { ...basis, zelle: abgetippt(werte, start.starter.klasse, undefined) ? 'ok' : teilZelle(k, werte, start.starter.klasse, undefined) }
    const je = { ab: teilZelle(k, werte, start.starter.klasse, 'ab'), an: teilZelle(k, werte, start.starter.klasse, 'an') }
    return { ...basis, zelle: zusammen(je), teile: je }
  }

  return { kennung, eintrag, digital, geteilt, teile, schlangeVon, zelleVon, erledigt, rueckfrageZellen, offeneRueckfragen, offeneVorschlaege }
}

/** Zellstand einer geteilten Liste aus den Teilen: ein Teil da → ½, sonst der dringendere Teil. */
function zusammen(je: { ab: Zelle; an: Zelle }): Zelle {
  if (je.ab === 'ok' && je.an === 'ok') return 'ok'
  if (je.ab === 'ok' || je.an === 'ok') return 'halb'
  for (const z of ['ueberfaellig', 'offen', 'vorab'] as const) if (je.ab === z || je.an === z) return z
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
    if (!ref || gesehen.has(g.ref) || punkt === null || punktVonRef(stand, g.ref) !== punkt) continue
    gesehen.add(g.ref)
    spalten.push({ key: g.ref, nummern: nummernVon(stand, ref), punkt, zeit: g.zeit })
  }
  if (starts === 'punkt') spalten = spalten.slice(-WKR_ANNAHMEN.matrixStarts)
  const vorabListen = listen.filter((l) => WKR_ANNAHMEN.vorabListen.includes(l.typeId) && stand.wkr.listen[listenKennung(l)])
  if (vorabListen.length > 0) {
    for (const e of naechsteFreie(stand, bereich)) {
      if (gesehen.has(e.key)) continue
      gesehen.add(e.key)
      spalten.push({ key: e.key, nummern: nummernVon(stand, e.ref), punkt: punktVonRef(stand, e.key), vorab: true })
    }
  }
  const R = stand.anzeige.wkrRueckstand
  const lagen = listen.map((liste): ListenLage => {
    const r = rechner(stand, konfig, liste)
    const zellen: Record<string, ZellLage> = {}
    const vorabListe = WKR_ANNAHMEN.vorabListen.includes(liste.typeId)
    for (const s of spalten) {
      // Noch nicht gezeigte Starts stehen nur auf den Listen, die sie vorab sehen.
      if (s.vorab && !vorabListe) continue
      const z = r.zelleVon(s.key)
      // Ein Start vorab, der nicht (mehr) in der Schlange steht, hat hier nichts zu zeigen.
      if (!z || (s.vorab && z.zelle === 'papier')) continue
      zellen[s.key] = z.teile ? { zelle: z.zelle, teile: z.teile } : { zelle: z.zelle }
    }
    const geraeteHier = geraeteDerListe(r.kennung, geraete, jetzt, laeuft)
    const nr = (s: SchlangenStart | undefined) => (s ? nummerVon(stand, s.starter) : '')
    // Rückstand (A4): offene gezeigte Starts; am Steg mit Teil-Geräten der Teil, der weiter zurück ist. Abgetippte
    // zählen nicht (die Schlange der Geräte kennt nur den Haken, WKR_ANNAHMEN.abgetipptErledigt).
    const offen = (t: ListenTeil | undefined) => [...r.schlangeVon(t).values()].filter((s) => !s.vorab && !s.entfaellt && !r.erledigt(s.lauf, s.starter, s.klasse, t))
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
      warnt: !!rueckstand && r.digital && status === 'aktiv' && rueckstand.zahl >= R,
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
  for (const g of betriebVon(stand, liste.bereich).gezeigt) {
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
