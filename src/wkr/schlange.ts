import type { AppState, ClassId, PunktId, StartRef, WkrListe, WkrPause } from '../types'
import type { Konfig } from '../config/konfig'
import { betriebVon, istParallel, lage, liesRef, type FolgeEintrag } from '../betrieb/folge'
import { konfigVon } from '../state/reducer/gemeinsam'
import { erfasstKennung, felderJeKennung, werteVon, type Feld, type ListenTeil } from '../lib/eingaben'
import { nichtGestartet } from '../lib/erfassung'
import { parallelListen } from '../lib/parallelBogen'
import { abschlussPapier, istAbgeschlossen, TEILE } from './abschluss'
import { WKR_ANNAHMEN } from './annahmen'
import { listenKennung, startAufListe, teileVon, teilHaken, type Liste } from './liste'

// Die Schlange einer Liste: welche Starts diese Liste noch abschicken muss (Vorschlag §2, Plan §3.1) – rein, abgeleitet
// aus derselben Lage wie die öffentliche Sicht (betrieb/folge.ts). Kein eigener Zustand: gezeigte Starts minus Haken
// „erfasst“ der Liste (bzw. des Teils), ab `seit`, ohne Pausen und ohne die Starts, die aufs Papier gingen.

/** Ein Start in der Schlange (oder „danach“) einer Liste. */
export interface SchlangenStart {
  /** Kennung des Starts (`refKey`). */
  key: string
  ref: StartRef
  starter: string
  klasse: ClassId
  /** Lauf-Schlüssel der Werte; `weitere` nur am Vorsteg mit „Versuche nacheinander“. */
  lauf: string
  weitere: string[]
  punkt: PunktId
  /** Wann der Start gezeigt wurde; fehlt bei Starts, die noch nicht gezeigt sind (`vorab`, „danach“). */
  zeit?: number
  /** Die Klasse hat diese Liste nicht: grau „entfällt“, schließt sich mit dem nächsten Start (WKR_ANNAHMEN.entfaelltNurAktuell). */
  entfaellt?: 'klasse'
  /** Noch nicht gezeigt, aber schon zu erfassen (Vorsteg, WKR_ANNAHMEN.vorabListen). */
  vorab?: true
  /** Nur geteilte Listen ohne Teil (Sicht der Liste): welcher Teil diesen Start noch digital braucht. */
  teileOffen?: { ab: boolean; an: boolean }
}

type Pausen = readonly WkrPause[]

/** Liegt der Zeitpunkt in einer der Pausen? */
function inPause(pausen: Pausen, zeit: number): boolean {
  return pausen.some((p) => zeit >= p.von && (p.bis === null || zeit < p.bis))
}

/**
 * Was für einen Teil (bzw. die ganze Liste) gilt: aktiv?, Pausen, P und die abgeschlossenen Punkte. Pausen und P der
 * ganzen Liste gelten für jeden Teil; dazu die eigenen des Teils (WKR_ANNAHMEN.pauseJeTeil) und die Starts, die mit
 * einem Abschluss („Rest auf Papier“) aufs Papier gingen – sie und der abgeschlossene Punkt fehlen in der Schlange.
 */
function rahmen(stand: AppState, kennung: string, eintrag: WkrListe, teil: ListenTeil | undefined, geteilt: boolean) {
  const eigen = teil !== undefined ? eintrag.teile?.[teil] : undefined
  const aktiv = eintrag.status === 'aktiv' && (eigen?.status ?? 'aktiv') === 'aktiv'
  const pausen: Pausen = [...eintrag.pausen, ...(eigen?.pausen ?? [])]
  const papier = new Set([...pausen.flatMap((p) => p.papier), ...abschlussPapier(stand.wkr, kennung, teil)])
  const zu = (punkt: PunktId) => istAbgeschlossen(stand.wkr, kennung, punkt, teil, geteilt)
  /** Gehört der (gezeigte, bei `zeit`) Start in diesem Rahmen noch digital erfasst? */
  const offen = (s: SchlangenStart, zeit: number | undefined) => aktiv && !papier.has(s.key) && !zu(s.punkt) && (zeit === undefined || !inPause(pausen, zeit))
  return { aktiv, offen }
}

/**
 * Liest Starts einer Liste: Auflösen, Klasse prüfen, X erkennen, Haken lesen – je Aufruf einmal gebaut. Auch für die
 * Lage (wkr/lage.ts), damit X und Haken dort nach denselben Regeln gelesen werden.
 */
export function leser(stand: AppState, konfig: Konfig, liste: Liste) {
  const vorrang = istParallel(liste.bereich) ? parallelListen(konfig) : []
  const felder = new Map<ClassId, ReadonlyMap<string, Feld>>()
  const felderVon = (klasse: ClassId) => {
    let f = felder.get(klasse)
    if (!f) felder.set(klasse, (f = felderJeKennung(konfig, klasse, vorrang)))
    return f
  }
  /** Trägt der Starter im Lauf ein X „nicht gestartet“ (auf irgendeiner Liste)? */
  const istX = (lauf: string, starter: string, klasse: ClassId) => nichtGestartet(werteVon(stand.eingaben, lauf, starter), felderVon(klasse))
  /** Der Start auf dieser Liste; `null`, wenn er hier nicht vorkommt oder ein X trägt (er fällt weg). */
  const lies = (key: string, ref: StartRef | null = liesRef(key)): SchlangenStart | null => {
    if (!ref) return null
    const start = startAufListe(stand, konfig, liste, ref)
    if (!start) return null
    if (istX(start.lauf, start.starter.id, start.starter.klasse)) return null
    const out: SchlangenStart = { key, ref, starter: start.starter.id, klasse: start.starter.klasse, lauf: start.lauf, weitere: start.weitere, punkt: start.punkt }
    if (!konfig.positionAllowsClass(liste.typeId, start.starter.klasse)) out.entfaellt = 'klasse'
    return out
  }
  /** Ist der Start auf dieser Liste (bzw. in diesem Teil) schon abgeschickt? Ohne Teil: der Haken der ganzen Liste. */
  const erledigt = (s: SchlangenStart, teil: ListenTeil | undefined): boolean => {
    const werte = werteVon(stand.eingaben, s.lauf, s.starter)
    return !!werte[erfasstKennung(liste.typeId)] || (teil !== undefined && !!werte[teilHaken(liste.typeId, teil)])
  }
  return { lies, erledigt, istX }
}

/**
 * Die Schlange einer Liste (bzw. eines Teils, Steg: `ab`/`an`): die gezeigten Starts ihres Bereichs ab `seit`, nicht
 * in einer Pause gezeigt, nicht aufs Papier gegangen (Pause oder Abschluss mit „Rest auf Papier“), Punkt nicht
 * abgeschlossen, ohne Haken der Liste bzw. des Teils, ohne X im Lauf – älteste oben. Ein Start einer Klasse ohne diese
 * Liste steht nur da, solange er der zuletzt gezeigte ist (`entfaellt`). Im Parallelslalom nur Starts, deren eigene
 * Seite besetzt ist. Am Vorsteg dazu die nächsten freien (`vorab`). Eine geteilte Liste ohne Teil (die Sicht der
 * Liste) nimmt einen Start, solange EIN Teil ihn noch braucht (`teileOffen`). Leer, wenn die Liste nicht digital
 * erfasst wird (kein Eintrag, Papier) oder sie (bzw. der Teil, bzw. beide Teile) pausiert oder abgemeldet ist.
 */
export function schlange(stand: AppState, liste: Liste, teil?: ListenTeil): SchlangenStart[] {
  const kennung = listenKennung(liste)
  const eintrag = stand.wkr.listen[kennung]
  if (!eintrag || eintrag.modus === 'papier' || eintrag.status !== 'aktiv') return []
  const geteilt = !!teileVon(liste.typeId)
  // Je Teil ein Rahmen – bei einer geteilten Liste ohne Teil beide, sonst einer (Teil bzw. ganze Liste).
  const rahmenTeile: (ListenTeil | undefined)[] = geteilt && teil === undefined ? [...TEILE] : [teil]
  const rahmenJe = rahmenTeile.map((t) => ({ t, r: rahmen(stand, kennung, eintrag, t, geteilt) }))
  if (!rahmenJe.some((x) => x.r.aktiv)) return []
  const konfig = konfigVon(stand)
  const { lies, erledigt } = leser(stand, konfig, liste)
  /** Welche Rahmen den Start noch brauchen; `null` = keiner. */
  const braucht = (s: SchlangenStart, zeit: number | undefined): SchlangenStart | null => {
    const offen = rahmenJe.filter(({ t, r }) => r.offen(s, zeit) && !erledigt(s, t)).map(({ t }) => t)
    if (offen.length === 0) return null
    return geteilt && teil === undefined ? { ...s, teileOffen: { ab: offen.includes('ab'), an: offen.includes('an') } } : s
  }
  const b = betriebVon(stand, liste.bereich)
  const letzter = b.gezeigt.at(-1)?.ref
  const gesehen = new Set<string>()
  const out: SchlangenStart[] = []
  for (const g of b.gezeigt) {
    if (g.zeit < eintrag.seit) continue
    const s = lies(g.ref)
    // Am Vorsteg mit „Versuche nacheinander“ steht der Starter einmal da: gleiche Zelle, gleicher Start.
    if (!s || gesehen.has(`${s.lauf}|${s.starter}`)) continue
    if (!rahmenJe.some(({ r }) => r.offen(s, g.zeit))) continue
    gesehen.add(`${s.lauf}|${s.starter}`)
    if (s.entfaellt) {
      if (g.ref === letzter || !WKR_ANNAHMEN.entfaelltNurAktuell) out.push({ ...s, zeit: g.zeit })
      continue
    }
    const offen = braucht(s, g.zeit)
    if (offen) out.push({ ...offen, zeit: g.zeit })
  }
  if (WKR_ANNAHMEN.vorabListen.includes(liste.typeId)) {
    for (const e of naechsteFreie(stand, liste.bereich)) {
      const s = lies(e.key, e.ref)
      if (!s || s.entfaellt || gesehen.has(`${s.lauf}|${s.starter}`)) continue
      gesehen.add(`${s.lauf}|${s.starter}`)
      const offen = braucht(s, undefined)
      if (offen) out.push({ ...offen, vorab: true })
    }
  }
  return out
}

/** Die nächsten freien Starts des Bereichs, die am Vorsteg schon zu sehen sind (Am Steg + Vor Steg der Anzeige). */
export function naechsteFreie(stand: AppState, bereich: string): FolgeEintrag[] {
  return lage(stand, bereich).frei.slice(0, Math.max(0, stand.anzeige.amSteg + stand.anzeige.vorSteg))
}

/**
 * „Danach“: die nächsten freien Starts des Bereichs auf dieser Liste – die Schätzung, mit der das Gerät ohne Netz
 * weiterschiebt (Vorschlag §2). Höchstens WKR_ANNAHMEN.danach; ohne X, ohne Klassen ohne diese Liste, ohne leere Seite.
 */
export function danach(stand: AppState, liste: Liste): SchlangenStart[] {
  const konfig = konfigVon(stand)
  const { lies } = leser(stand, konfig, liste)
  const vorab = new Set(WKR_ANNAHMEN.vorabListen.includes(liste.typeId) ? naechsteFreie(stand, liste.bereich).map((e) => e.key) : [])
  const out: SchlangenStart[] = []
  for (const e of lage(stand, liste.bereich).frei) {
    if (out.length >= WKR_ANNAHMEN.danach) break
    if (vorab.has(e.key)) continue
    const s = lies(e.key, e.ref)
    if (s && !s.entfaellt) out.push(s)
  }
  return out
}

/**
 * P („Papier“, Plan §3.1): die Starts dieser Liste (bzw. dieses Teils), die vom Bogen kommen – beim Pausieren bzw.
 * Abmelden offene und alle, die während einer Pause gezeigt wurden (WKR_ANNAHMEN.pauseJeListe/pauseJeTeil). Kennungen in der Folge, in der sie
 * dazukamen, ohne Doppelte; nur Starts, die auf dieser Liste vorkommen.
 */
export function papierStarts(stand: AppState, liste: Liste, teil?: ListenTeil): string[] {
  const eintrag = stand.wkr.listen[listenKennung(liste)]
  if (!eintrag) return []
  const konfig = konfigVon(stand)
  const gezeigt = betriebVon(stand, liste.bereich).gezeigt
  const out = new Set<string>()
  for (const p of [...eintrag.pausen, ...(teil !== undefined ? (eintrag.teile?.[teil]?.pausen ?? []) : [])]) {
    for (const key of p.papier) out.add(key)
    for (const g of gezeigt) if (g.zeit >= p.von && (p.bis === null || g.zeit < p.bis)) out.add(g.ref)
  }
  return [...out].filter((key) => {
    const ref = liesRef(key)
    const start = ref ? startAufListe(stand, konfig, liste, ref) : null
    return start !== null && konfig.positionAllowsClass(liste.typeId, start.starter.klasse)
  })
}
