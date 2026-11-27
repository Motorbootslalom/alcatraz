import type { AppState, BereichBetrieb, ClassId, PaarSeite, StartRef, WkrListe, WkrPause, WkrPunkt } from '../types'
import type { Konfig } from '../config/konfig'
import { abbruecheVon, betriebVon, giltAuf, istParallel, lage, liesRef, wiederholtNur, type FolgeEintrag } from '../betrieb/folge'
import { konfigVon } from '../state/reducer/gemeinsam'
import { erfasstKennung, felderJeKennung, werteVon, type Feld, type ListenTeil } from '../lib/eingaben'
import { nichtGestartet } from '../lib/erfassung'
import { parallelListen } from '../lib/parallelBogen'
import { abschlussPapier, istAbgeschlossen, punktVonRef, TEILE } from './abschluss'
import { WKR_ANNAHMEN } from './annahmen'
import { listenKennung, startAufListe, teileVon, teilHaken, type Liste } from './liste'
import { listenSeite } from './versuch'

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
  punkt: WkrPunkt
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

/**
 * Wartet bzw. fährt dieser Start als Wiederholung nur des ANDEREN Boots eines Paares (Parallelslalom, R13-02)? Dann kommt
 * er auf dieser Liste nicht wieder (vorab, „danach“): Ihr Boot ist gefahren, seine Zeile gilt.
 */
function fremdeWiederholung(b: Pick<BereichBetrieb, 'gezeigt'>, key: string, seite: PaarSeite | undefined): boolean {
  if (seite === undefined) return false
  const nur = wiederholtNur(b, key)
  return nur !== null && nur !== seite
}

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
  const zu = (punkt: WkrPunkt) => istAbgeschlossen(stand.wkr, kennung, punkt, teil, geteilt)
  /**
   * Gehört der (gezeigte, bei `zeit`) Start in diesem Rahmen noch digital erfasst? `wiederholung`: Er ist die Wiederholung
   * nach einem Ausfall (R11-11) – sie kommt auch in einem schon abgeschlossenen Punkt (Prüfbefund 27.11.2026,
   * BETRIEB_ANNAHMEN.wiederholungAbschlussBleibt): Fiel der letzte Start eines Laufs hinter Tor 1 aus und hatte Tor 1
   * schon abgeschlossen, bekäme das Gerät die Wiederholung sonst nie (und mit „Druck nach Modus“ fehlte oft auch der
   * Bogen). Ihre Zeile wird dort ein Vorschlag „abgeschlossen“ (state/reducer/wkr.ts WKR_ZEILEN). Was der Abschluss mit
   * „Rest auf Papier“ nannte, bleibt Papier (`papier`).
   */
  const offen = (s: SchlangenStart, zeit: number | undefined, wiederholung = false) =>
    aktiv && !papier.has(s.key) && (wiederholung || !zu(s.punkt)) && (zeit === undefined || !inPause(pausen, zeit))
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
export function schlange(stand: AppState, liste: Liste, teil?: ListenTeil, optionen: SchlangenOptionen = {}): SchlangenStart[] {
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
  // Steg-Zeitversatz (WKR_ANNAHMEN.stegAblegenVorab/stegAnlegenNachlaufend, Nutzer 21.11.2026): Ablegen sieht die
  // nächsten Starts schon vorab, Anlegen erst, wenn das Boot nicht mehr „Im Boot“ ist – nie beide zugleich.
  const nachlaufend = geteilt && WKR_ANNAHMEN.stegAnlegenNachlaufend && optionen.nachlaufend !== false
  const boot = nachlaufend ? imBoot(stand, liste.bereich) : null
  /** Gehört der Teil `t` dieses Starts schon (bzw. noch) in die Schlange? Anlegen nicht vorab und nicht im Boot. */
  const imTeil = (t: ListenTeil | undefined, s: SchlangenStart, vorab: boolean) => t !== 'an' || !geteilt || (!vorab && (!nachlaufend || s.key !== boot))
  /** Welche Rahmen den Start noch brauchen; `null` = keiner. `wdh`: die Wiederholung nach einem Ausfall (siehe rahmen). */
  const braucht = (s: SchlangenStart, zeit: number | undefined, vorab = false, wdh = false): SchlangenStart | null => {
    const offen = rahmenJe.filter(({ t, r }) => imTeil(t, s, vorab) && r.offen(s, zeit, wdh) && !erledigt(s, t)).map(({ t }) => t)
    if (offen.length === 0) return null
    return geteilt && teil === undefined ? { ...s, teileOffen: { ab: offen.includes('ab'), an: offen.includes('an') } } : s
  }
  const b = betriebVon(stand, liste.bereich)
  const seite = listenSeite(liste)
  const letzter = b.gezeigt.at(-1)?.ref
  const gesehen = new Set<string>()
  const out: SchlangenStart[] = []
  for (let i = 0; i < b.gezeigt.length; i++) {
    const g = b.gezeigt[i]
    // Ein abgebrochener Versuch (Ausfall, R11-11, 26.11.2026) ist nichts mehr zu erfassen – seine Werte sind verworfen; die
    // Wiederholung kommt mit ihrem neuen Zeigen in die Schlange (neue Zeit, eigene Kennung für die Geräte, wkr/versuch.ts).
    // Im Parallelslalom nur, wenn der Abbruch das Boot dieser Liste traf (R13-02): Sonst ist der Versuch hier gefahren und
    // gilt. Die Wiederholung nur des ANDEREN Boots ist hier kein Start (betrieb/folge.ts giltAuf) – auch nicht, wenn der
    // Versuch davor hier nicht zählte (Liste damals pausiert oder noch nicht digital; Prüfbefund 27.11.2026).
    if (!giltAuf(b, i, seite) || g.zeit < eintrag.seit) continue
    const s = lies(g.ref)
    // Am Vorsteg mit „Versuche nacheinander“ steht der Starter einmal da: gleiche Zelle, gleicher Start.
    if (!s || gesehen.has(`${s.lauf}|${s.starter}`)) continue
    // Ein geltender Versuch nach einem abgebrochenen ist die Wiederholung (R11-11).
    const wdh = abbruecheVon(b, g.ref, seite) > 0
    if (!rahmenJe.some(({ r }) => r.offen(s, g.zeit, wdh))) continue
    gesehen.add(`${s.lauf}|${s.starter}`)
    if (s.entfaellt) {
      if (g.ref === letzter || !WKR_ANNAHMEN.entfaelltNurAktuell) out.push({ ...s, zeit: g.zeit })
      continue
    }
    const offen = braucht(s, g.zeit, false, wdh)
    if (offen) out.push({ ...offen, zeit: g.zeit })
  }
  for (const e of vorabStarts(stand, liste)) {
    const s = lies(e.key, e.ref)
    if (!s || s.entfaellt || gesehen.has(`${s.lauf}|${s.starter}`) || fremdeWiederholung(b, e.key, seite)) continue
    gesehen.add(`${s.lauf}|${s.starter}`)
    const offen = braucht(s, undefined, true)
    if (offen) out.push({ ...offen, vorab: true })
  }
  return out
}

/** Optionen von {@link schlange}. */
export interface SchlangenOptionen {
  /**
   * `false`: das Anlegen des Starts im Boot mitnehmen – wkr/lage.ts, um „kommt noch“ von „Papier“ zu trennen, und P
   * beim Pausieren, Abmelden und „Papier ab“ (state/reducer/wkr.ts, Prüfbefund 21.11.2026: das Boot kommt in der Pause
   * zurück). Vorgabe: nachlaufend (WKR_ANNAHMEN.stegAnlegenNachlaufend).
   */
  nachlaufend?: boolean
}

/**
 * Die Starts, die eine Liste schon vor dem Zeigen sieht (`vorab`): am Vorsteg die nächsten freien wie die
 * Zuschauerliste am und vor dem Steg (WKR_ANNAHMEN.vorabListen), am Steg fürs Ablegen die „Am Steg“ (mindestens „Als
 * Nächstes“, WKR_ANNAHMEN.stegAblegenVorab); sonst keine. Am Steg gilt `vorab` nur für den Teil Ablegen.
 */
export function vorabStarts(stand: AppState, liste: Liste): FolgeEintrag[] {
  if (WKR_ANNAHMEN.vorabListen.includes(liste.typeId)) return naechsteFreie(stand, liste.bereich)
  if (WKR_ANNAHMEN.stegAblegenVorab && teileVon(liste.typeId)) return lage(stand, liste.bereich).frei.slice(0, Math.max(1, stand.anzeige.amSteg))
  return []
}

/** Sieht die Liste Starts vorab (Vorsteg, Steg-Ablegen)? */
export function hatVorab(typeId: string): boolean {
  return WKR_ANNAHMEN.vorabListen.includes(typeId) || (WKR_ANNAHMEN.stegAblegenVorab && !!teileVon(typeId))
}

/**
 * Der Start „Im Boot“ eines Bereichs (Kennung), solange sein Boot noch fährt (WKR_ANNAHMEN.stegAnlegenNachlaufend): der
 * zuletzt gezeigte, solange in seinem Punkt noch ein Start aussteht – frei, zurückgestellt, Wiederholung offen (R11-11),
 * „Boot fehlt“ (ausgesetzte Klasse) oder nachzuholen; nie ein abgebrochener Versuch. Prüfbefund 21.11.2026: vorher zählte nur `frei`; war der letzte freie Start eines Punkts
 * gezeigt und ein anderer zurückgestellt, stand das fahrende Boot schon im Anlegen. Steht in seinem Punkt nichts mehr
 * aus (letzter Start eines Laufs, auch wenn er auf der Tafel stehen bleibt), gilt er als zurück; `null` = keiner im
 * Boot. Den Rückstand vor „Nächster Start“ nimmt das Anlegen des Starts auf der Tafel trotzdem nie (wkr/lage.ts, T2).
 */
export function imBoot(stand: AppState, bereich: string): string | null {
  const l = lage(stand, bereich)
  // Ein abgebrochener Versuch (Ausfall, R11-11) ist nicht mehr unterwegs.
  if (!l.aktuell || l.aktuell.abgebrochen) return null
  const punkt = punktVonRef(stand, l.aktuell.key)
  if (punkt === null) return null
  const steht = (e: FolgeEintrag) => e.punkt === punkt && e.key !== l.aktuell!.key
  return [l.frei, l.zurueckgestellt, l.wiederholung, l.bootFehlt, l.nachzuholen].some((x) => x.some(steht)) ? l.aktuell.key : null
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
  const vorab = new Set(vorabStarts(stand, liste).map((e) => e.key))
  const out: SchlangenStart[] = []
  const b = betriebVon(stand, liste.bereich)
  const seite = listenSeite(liste)
  for (const e of lage(stand, liste.bereich).frei) {
    if (out.length >= WKR_ANNAHMEN.danach) break
    if (vorab.has(e.key) || fremdeWiederholung(b, e.key, seite)) continue
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
  const b = betriebVon(stand, liste.bereich)
  const seite = listenSeite(liste)
  const out = new Set<string>()
  for (const p of [...eintrag.pausen, ...(teil !== undefined ? (eintrag.teile?.[teil]?.pausen ?? []) : [])]) {
    for (const key of p.papier) out.add(key)
    // Ein abgebrochener Versuch (R11-11) zählt nicht – die Wiederholung gilt nach ihrem eigenen Zeigen; im Parallelslalom
    // nur, wenn der Abbruch das Boot dieser Liste traf, und die Wiederholung nur des anderen Boots nie (R13-02, giltAuf).
    b.gezeigt.forEach((g, i) => {
      if (giltAuf(b, i, seite) && g.zeit >= p.von && (p.bis === null || g.zeit < p.bis)) out.add(g.ref)
    })
  }
  return [...out].filter((key) => {
    const ref = liesRef(key)
    const start = ref ? startAufListe(stand, konfig, liste, ref) : null
    return start !== null && konfig.positionAllowsClass(liste.typeId, start.starter.klasse)
  })
}
