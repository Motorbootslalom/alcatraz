import { computed, effectScope, ref, shallowRef, watch, type ComputedRef, type ShallowRef } from 'vue'
import type { PunktId } from '../types'
import { WKR_ANNAHMEN } from '../wkr/annahmen'
import { zeilenPruefsumme } from '../wkr/uebernahme'
import { LISTEN_SICHT_FASSUNG, type ListenSicht, type ListenStart, type WkrHinweis } from '../wkr/sicht'
import type { ListenTeil } from '../wkr/liste'
import { geraetWkrAblage, liesKopplung, type Ablage, type RaumBezug } from './ablage'
import { listenAufgaben, type ListenAufgabe } from './aufgaben'
import type { GekoppeltesGeraet } from './gekoppelt'
import { gruppeDerListe } from './wkrGruppen'
import type { Empfang } from './transport/ntfy/transport'
import { istAblehnung, type Ablehnung, type GeraeteNachricht } from './transport/protokoll'

/**
 * Gerätekern der digitalen WKR-Erfassung (W1, Plan docs/plan-wkr-w1.md §5, 21.11.2026) – OHNE Oberfläche: Die Masken
 * (W3/W4) setzen auf diesen Kern, wie GeraetFreigabe.vue auf gekoppelt.ts. Ohne Store: Das Gerät kennt nur die Sicht
 * seiner Listen (wkr/sicht.ts, über die verschlüsselte Gruppe der Liste) und seinen Ausgang.
 *
 * - **Ausgang** gerätelokal (ablage.ts `alcatraz.geraet.wkr`, 36 h): wartende Zeilen und Nachrichten der Reihe nach,
 *   die letzten Zeilen mit ihren Werten (≤ WKR_ANNAHMEN.zuletzt, Unbestätigte bleiben immer), je Liste und Punkt die
 *   zuletzt gesendeten Werte jedes Starts (Korrektur: `vorher`; Abschluss: Prüfsummen), der Zeilenzähler `z`.
 *   `z` beginnt wie die Nummern des Transports bei der Uhrzeit (ms): Ein neuer Ausgang nach verlorenem Speicher
 *   erzeugt so nie die Kennung `${geraet}.${z}` einer älteren Zeile (Rückfragen hängen daran).
 * - **Bündeln** (§8): Eine Nachricht geht erst, wenn der Transport nichts Unbestätigtes hat und verbunden ist – dann
 *   alle wartenden Zeilen einer Liste (≤ WKR_ANNAHMEN.buendel) als EINE. Nach einem Funkloch also eine Nachricht.
 * - **Gesammelte Quittung**: `bis` dieses Geräts in der Sicht seiner Liste → `bestaetige(bis)`; die direkte Quittung
 *   gilt auch (Rückfall, wenn das Gerät die Gruppe nicht hat, oder abgelehnt).
 * - **Lebenszeichen** nach WKR_ANNAHMEN.lebenszeichenSek ohne eigene Nachricht, nur mit Liste und laufendem Punkt
 *   (Uhr aus der Umgebung).
 * - Die Maske sperrt nie (keine Wartepflicht): schicke/korrigiere legen nur in den Ausgang.
 * - Kein Name in irgendeiner Rückgabe (F6): Die Sicht trägt keinen, die Zeilen nur Kennung und Werte; der Name des
 *   Abschlusses geht nur in die Nachricht.
 */

/** Wie weit eine eigene Zeile ist. */
export type ZeilenStufe =
  /** Wartet im Ausgang (`gesendet: false`) oder ist unterwegs, noch ohne Quittung. */
  | { stufe: 'unterwegs'; gesendet: boolean }
  /** Am Bedienrechner übernommen; `nachRueckfrage`: nach einer Rückfrage, die der Bediener entschieden hat. */
  | { stufe: 'uebernommen'; nachRueckfrage?: true }
  /** Rückfrage am Bedienrechner: was dort jetzt steht (F11, nur diese Zellen). */
  | { stufe: 'rueckfrage'; zellen: { feld: string; lauf: string; steht: string }[] }
  /** Abgelehnt (Code, Texte `geraete.ablehnung.*`); `verworfen` = ntfy hat die Nachricht abgewiesen. */
  | { stufe: 'abgelehnt'; grund: Ablehnung | 'verworfen' }
  /** Nach dem Abschluss des Punkts oder auf Papier: Vorschlag, der Bediener entscheidet (F7). */
  | { stufe: 'vorschlag' }

/** Eine Zeile der Maske: Start (`ListenStart.key`), Werte je Feld-Kennung; `teil` am Steg ohne Teil-Kopplung. */
export interface MaskenZeile {
  s: string
  zellen: Readonly<Record<string, string>>
  teil?: ListenTeil
}

/** Ein Eintrag der Schlange: aus der Sicht; `geschaetzt` = ohne Verbindung aus „danach“ (vielleicht noch nicht gezeigt). */
export interface SchlangenEintrag extends ListenStart {
  geschaetzt?: true
}

/** Eine der letzten Zeilen (Korrektur über „Zuletzt“). Ohne Namen. */
export interface ZuletztZeile {
  z: number
  liste: string
  s: string
  punkt: PunktId | null
  korrektur: boolean
  zellen: Record<string, string>
  stufe: ZeilenStufe
}

export type AbschlussStufe = 'unterwegs' | 'angenommen' | 'abgelehnt'

export interface EigenerAbschluss {
  id: number
  liste: string
  punkt: PunktId
  stufe: AbschlussStufe
  /** Bei `abgelehnt`: `offen` (noch offene Starts ohne „Rest auf Papier“), `nicht-erlaubt`, `verworfen`. */
  grund?: Ablehnung | 'verworfen'
}

export interface ErfassenUmgebung {
  /** Vorgabe localStorage – dieselbe wie die des Geräts. */
  ablage?: Ablage | null
  /** Uhr des Geräts (Tests: Fake-Uhr für das Lebenszeichen). */
  uhr?: () => number
  /** Wie oft geprüft wird, ob ein Lebenszeichen fällig ist (Vorgabe 5 s). */
  taktMs?: number
  /** Akku in Prozent, wenn der Browser ihn verrät. */
  akku?: () => number | undefined
}

export interface Erfassung {
  /** Eigene Listen (Kennungen) mit Teil, wie die Aufgaben sie geben (F15: höchstens zwei). */
  readonly listen: ComputedRef<ListenAufgabe[]>
  /** Je eigener Liste die zuletzt empfangene Sicht (`null`: noch keine). */
  readonly sichten: Readonly<ShallowRef<Readonly<Record<string, ListenSicht | null>>>>
  /** Je eigener Liste die Schlange: Sicht minus eigene Zeilen (außer abgelehnten); ohne Verbindung plus „danach“. */
  readonly schlange: ComputedRef<Record<string, SchlangenEintrag[]>>
  /** Stufe je eigener Zeile (`z`), über die letzten Zeilen und alles Unbestätigte. */
  readonly stufen: ComputedRef<Record<number, ZeilenStufe>>
  /** Die letzten Zeilen, neueste zuerst. */
  readonly zuletzt: ComputedRef<ZuletztZeile[]>
  /** Hinweise des Bedienrechners je Liste, ohne die schon als gesehen gemeldeten. */
  readonly hinweise: ComputedRef<Record<string, { id: number; code: WkrHinweis; startNr?: string }[]>>
  /** Eigene Abschlüsse (F7, F8), neueste zuerst. */
  readonly abschluesse: ComputedRef<EigenerAbschluss[]>
  /** Zeilen, die das Gerät noch nicht losgeworden ist (wartend oder ohne Quittung). */
  readonly wartend: ComputedRef<number>
  /** Eine Zeile in den Ausgang; liefert `z` oder `null` (keine eigene Liste, Teil passt nicht). */
  schicke(liste: string, zeile: MaskenZeile): number | null
  /** Korrektur einer eigenen Zeile: `vorher` = zuletzt gesendeter Wert; nach dem Abschluss wird sie Vorschlag. */
  korrigiere(z: number, zellen: Readonly<Record<string, string>>): number | null
  pausiere(liste: string): number | null
  meldeAb(liste: string): number | null
  weiter(liste: string): number | null
  /** „Liste abschließen“ (F7, F8): Prüfsummen über die eigenen Werte des Punkts; liefert die Kennung des Abschlusses. */
  schliesseAb(liste: string, punkt: PunktId, name: string, restPapier: boolean): number | null
  /** Einen Hinweis als gelesen melden. */
  gesehen(hinweis: number): void
  stop(): void
}

// ---------------------------------------------------------------------------
// Ausgang (gerätelokal)
// ---------------------------------------------------------------------------

type Grund = Ablehnung | 'verworfen'

/**
 * Ist der Punkt laut Sicht für diesen Teil abgeschlossen? Wie der Reducer (wkr/abschluss.ts): am Steg je Teil (F16);
 * eine ganze Zeile (`zeile`, ohne Teil) einer geteilten Liste schon, wenn EIN Teil abgeschlossen ist.
 */
function zuFuer(sicht: ListenSicht | null | undefined, punkt: PunktId, teil: ListenTeil | undefined, zeile: boolean): boolean {
  if (!sicht) return false
  if (sicht.abgeschlossen.includes(punkt)) return true
  const teile = sicht.teile
  if (!teile) return false
  // Optional verkettet: Die Sicht kommt zwar vom Host, eine ältere Ablage könnte die Teile aber anders tragen.
  if (teil) return !!teile[teil]?.abgeschlossen?.includes(punkt)
  return zeile && (!!teile.ab?.abgeschlossen?.includes(punkt) || !!teile.an?.abgeschlossen?.includes(punkt))
}

interface AusZeile {
  z: number
  liste: string
  s: string
  t?: ListenTeil
  seite?: 'A' | 'B'
  k?: true
  klasse: string | null
  punkt: PunktId | null
  c: [string, string, string][]
  /** Nummer der Nachricht, in der sie ging (`null`: wartet). */
  nr: number | null
  /** Wird Vorschlag: Liste auf Papier bzw. Punkt (vom eigenen Abschluss) abgeschlossen. */
  vs?: 'papier' | 'abschluss'
  /** Hatte eine Rückfrage. */
  rf?: true
  ab?: Grund
  /** Bestätigt (bis ≥ nr oder direkte Quittung). */
  ok?: true
}

interface AusAbschluss {
  id: number
  liste: string
  punkt: PunktId
  nr: number | null
  ok?: true
  ab?: Grund
}

type AusEintrag = { art: 'zeile'; z: number } | { art: 'nachricht'; id: number; liste?: string; nachricht: GeraeteNachricht }

interface Inhalt {
  naechsteZ: number
  aus: AusEintrag[]
  zeilen: AusZeile[]
  /** Je Liste und Punkt ('' = ohne) je Start: Klasse und zuletzt gesendete Werte. */
  werte: Record<string, Record<string, Record<string, { k: string | null; w: Record<string, string> }>>>
  abschluesse: AusAbschluss[]
  sichten: Record<string, ListenSicht>
  gesehen: number[]
}

const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const istText = (v: unknown): v is string => typeof v === 'string'
const istNr = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 1

function istAusZeile(v: unknown): v is AusZeile {
  if (!istObjekt(v) || !istNr(v.z) || !istText(v.liste) || !istText(v.s)) return false
  if (v.nr !== null && !istNr(v.nr)) return false
  if (v.punkt !== null && !istText(v.punkt)) return false
  if (v.klasse !== null && !istText(v.klasse)) return false
  return Array.isArray(v.c) && v.c.every((c) => Array.isArray(c) && c.length === 3 && c.every(istText))
}

function istAusAbschluss(v: unknown): v is AusAbschluss {
  return istObjekt(v) && istNr(v.id) && istText(v.liste) && istText(v.punkt) && (v.nr === null || istNr(v.nr))
}

function istAusEintrag(v: unknown): v is AusEintrag {
  if (!istObjekt(v)) return false
  if (v.art === 'zeile') return istNr(v.z)
  return v.art === 'nachricht' && istNr(v.id) && istObjekt(v.nachricht) && istText(v.nachricht.art)
}

function istListenSicht(v: unknown, liste: string): v is ListenSicht {
  return istObjekt(v) && v.lv === LISTEN_SICHT_FASSUNG && v.liste === liste && Array.isArray(v.schlange) && Array.isArray(v.danach) &&
    istObjekt(v.geraete) && istObjekt(v.klassen) && Array.isArray(v.abgeschlossen)
}

function leer(uhr: () => number): Inhalt {
  return { naechsteZ: Math.max(1, Math.floor(uhr())), aus: [], zeilen: [], werte: {}, abschluesse: [], sichten: {}, gesehen: [] }
}

/** Abgelegten Ausgang lesen – was nicht passt, fällt weg (Programmfehler, alte Fassung), nie das Ganze. */
function liesInhalt(roh: Record<string, unknown> | null, uhr: () => number): Inhalt {
  const out = leer(uhr)
  if (!roh) return out
  if (istNr(roh.naechsteZ)) out.naechsteZ = roh.naechsteZ
  if (Array.isArray(roh.zeilen)) out.zeilen = roh.zeilen.filter(istAusZeile)
  if (Array.isArray(roh.abschluesse)) out.abschluesse = roh.abschluesse.filter(istAusAbschluss)
  const zs = new Set(out.zeilen.map((z) => z.z))
  if (Array.isArray(roh.aus)) out.aus = roh.aus.filter(istAusEintrag).filter((a) => a.art !== 'zeile' || zs.has(a.z))
  if (istObjekt(roh.werte)) {
    for (const [liste, jePunkt] of Object.entries(roh.werte)) {
      if (!istObjekt(jePunkt)) continue
      for (const [punkt, jeStart] of Object.entries(jePunkt)) {
        if (!istObjekt(jeStart)) continue
        for (const [s, e] of Object.entries(jeStart)) {
          if (!istObjekt(e) || !istObjekt(e.w) || (e.k !== null && !istText(e.k))) continue
          const w: Record<string, string> = {}
          for (const [f, x] of Object.entries(e.w)) if (istText(x)) w[f] = x
          ;((out.werte[liste] ??= {})[punkt] ??= {})[s] = { k: e.k as string | null, w }
        }
      }
    }
  }
  if (istObjekt(roh.sichten)) for (const [liste, s] of Object.entries(roh.sichten)) if (istListenSicht(s, liste)) out.sichten[liste] = s
  if (Array.isArray(roh.gesehen)) out.gesehen = roh.gesehen.filter(istNr).slice(-50)
  // Der Zähler steht immer über allem Abgelegten.
  for (const z of [...out.zeilen.map((x) => x.z), ...out.abschluesse.map((x) => x.id), ...out.aus.map((a) => (a.art === 'zeile' ? a.z : a.id))]) {
    if (z >= out.naechsteZ) out.naechsteZ = z + 1
  }
  return out
}

function vorgabeAblage(): Ablage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Kern
// ---------------------------------------------------------------------------

/**
 * Die WKR-Erfassung eines gekoppelten Geräts öffnen: liest den Ausgang, hört auf die Sicht seiner Listen und schickt,
 * was wartet. Das Gerät muss gestartet werden ({@link GekoppeltesGeraet.start}); `stop()` hier beendet nur die
 * Erfassung (Ausgang bleibt abgelegt).
 */
export function oeffneErfassung(geraet: GekoppeltesGeraet, umgebung: ErfassenUmgebung = {}): Erfassung {
  const ablage = umgebung.ablage === undefined ? vorgabeAblage() : umgebung.ablage
  const uhr = umgebung.uhr ?? Date.now
  const p = geraet.koppelPaket
  const bezug: RaumBezug = { u: p.u, r: p.r, s: p.s }
  const speicher = geraetWkrAblage(bezug, ablage, uhr)
  const kanal = geraet.kanal
  let inhalt = liesInhalt(speicher.lies(), uhr)
  /** Zählt bei jeder Änderung des Ausgangs hoch – die abgeleiteten Werte hängen daran. */
  const rev = ref(0)
  const sichten = shallowRef<Readonly<Record<string, ListenSicht | null>>>({})
  let gestoppt = false

  const speichere = () => {
    rev.value++
    // Raum verlassen oder entkoppelt (ablage.ts verlasseRaum): nichts mehr ablegen – sonst stünden die eben gelöschten
    // Werte wieder auf dem Gerät.
    const k = liesKopplung(ablage)
    if (gestoppt || !k || k.u !== bezug.u || k.r !== bezug.r || k.s !== bezug.s) return
    speicher.schreibe(inhalt)
  }

  const scope = effectScope(true)
  const listen = scope.run(() => computed(() => listenAufgaben(geraet.aufgaben.value)))!
  const aufgabeVon = (liste: string) => listen.value.find((a) => a.liste === liste)

  const setzeSichten = () => {
    const out: Record<string, ListenSicht | null> = {}
    for (const a of listen.value) out[a.liste] = inhalt.sichten[a.liste] ?? null
    sichten.value = out
  }

  const meinBlatt = (liste: string) => {
    const id = kanal.id()
    return id ? (inhalt.sichten[liste]?.geraete[id] ?? null) : null
  }

  function stufeVon(z: AusZeile): ZeilenStufe {
    if (z.ab) return { stufe: 'abgelehnt', grund: z.ab }
    if (z.nr === null) return { stufe: 'unterwegs', gesendet: false }
    if (!z.ok) return { stufe: 'unterwegs', gesendet: true }
    const blatt = meinBlatt(z.liste)
    const rf = blatt?.rueckfragen.filter((r) => r.z === String(z.z)) ?? []
    if (rf.length) return { stufe: 'rueckfrage', zellen: rf.map((r) => ({ feld: r.feld, lauf: r.lauf, steht: r.steht })) }
    const sicht = inhalt.sichten[z.liste]
    if (z.vs === 'papier' || (z.vs === 'abschluss' && z.punkt !== null && zuFuer(sicht, z.punkt, z.t, true))) return { stufe: 'vorschlag' }
    return z.rf ? { stufe: 'uebernommen', nachRueckfrage: true } : { stufe: 'uebernommen' }
  }

  // --- Ausgang pflegen ---------------------------------------------------------------------------

  /** Was die Sicht einer Liste über eigene Zeilen sagt, in den Ausgang übernehmen (überlebt die 20 der Sicht). */
  function vermerkeAusSicht(liste: string): boolean {
    const blatt = meinBlatt(liste)
    if (!blatt) return false
    let geaendert = false
    for (const z of inhalt.zeilen) {
      if (z.liste !== liste || z.nr === null) continue
      if (!z.ok && blatt.bis >= z.nr) {
        z.ok = true
        geaendert = true
      }
      if (!z.rf && blatt.rueckfragen.some((r) => r.z === String(z.z))) {
        z.rf = true
        geaendert = true
      }
      const ab = blatt.abgelehnt.find((a) => a.z === String(z.z))
      if (ab && !z.ab) {
        z.ab = istAblehnung(ab.grund) ? ab.grund : 'wert-ungueltig'
        geaendert = true
      }
    }
    for (const a of inhalt.abschluesse) {
      if (a.liste === liste && a.nr !== null && !a.ok && blatt.bis >= a.nr) {
        a.ok = true
        geaendert = true
      }
    }
    return geaendert
  }

  /** Nur die letzten Zeilen behalten – Unbestätigte und Wartende immer; Werte nur noch für Punkte, die vorkommen. */
  function raeumeAuf(): void {
    const behalten = new Set<number>()
    const fertig = inhalt.zeilen.filter((z) => z.ok || z.ab)
    for (const z of fertig.slice(-WKR_ANNAHMEN.zuletzt)) behalten.add(z.z)
    for (const z of inhalt.zeilen) if (!z.ok && !z.ab) behalten.add(z.z)
    inhalt.zeilen = inhalt.zeilen.filter((z) => behalten.has(z.z))
    inhalt.abschluesse = inhalt.abschluesse.slice(-10)
    for (const liste of Object.keys(inhalt.werte)) {
      const punkte = new Set<string>([
        inhalt.sichten[liste]?.punkt?.id ?? '',
        ...inhalt.zeilen.filter((z) => z.liste === liste).map((z) => z.punkt ?? ''),
        ...inhalt.abschluesse.filter((a) => a.liste === liste && !a.ok && !a.ab).map((a) => a.punkt),
      ])
      for (const punkt of Object.keys(inhalt.werte[liste])) if (!punkte.has(punkt)) delete inhalt.werte[liste][punkt]
      if (Object.keys(inhalt.werte[liste]).length === 0) delete inhalt.werte[liste]
    }
  }

  /**
   * Das Nächste senden – nur wenn der Transport nichts Unbestätigtes hat und verbunden ist. Zeilen bündeln: alle
   * wartenden Zeilen der Liste der ersten (≤ Bündel), bis zur nächsten anderen Nachricht (Reihenfolge Zeile →
   * Abschluss bleibt).
   */
  function pumpe(): void {
    if (gestoppt || inhalt.aus.length === 0) return
    if (geraet.lage.value !== 'gekoppelt' || geraet.status.value !== 'verbunden') return
    if (kanal.unbestaetigt().length > 0) return
    const erstes = inhalt.aus[0]
    if (erstes.art === 'nachricht') {
      const nr = kanal.schicke(erstes.nachricht)
      if (nr === null) return
      inhalt.aus.shift()
      const a = inhalt.abschluesse.find((x) => x.id === erstes.id)
      if (a) a.nr = nr
      speichere()
      return
    }
    const zeileVon = new Map(inhalt.zeilen.map((z) => [z.z, z]))
    const liste = zeileVon.get(erstes.z)?.liste
    const buendel: AusZeile[] = []
    for (const a of inhalt.aus) {
      if (a.art !== 'zeile') break
      const z = zeileVon.get(a.z)
      if (!z || z.liste !== liste) continue
      buendel.push(z)
      if (buendel.length >= WKR_ANNAHMEN.buendel) break
    }
    if (!liste || buendel.length === 0) {
      inhalt.aus.shift()
      speichere()
      return pumpe()
    }
    const zeilen = buendel.map((z) => ({
      z: z.z,
      s: z.s,
      ...(z.t ? { t: z.t } : {}),
      ...(z.k ? { k: true as const } : {}),
      ...(z.seite ? { seite: z.seite } : {}),
      c: z.c.map((c) => [...c]),
    }))
    const nr = kanal.schicke({ art: 'action', action: { type: 'WKR_ZEILEN', liste, zeilen } })
    if (nr === null) return
    const weg = new Set(buendel.map((z) => z.z))
    inhalt.aus = inhalt.aus.filter((a) => a.art !== 'zeile' || !weg.has(a.z))
    for (const z of buendel) z.nr = nr
    speichere()
  }

  function nimmSicht(gruppe: string, sicht: unknown): void {
    const a = listen.value.find((x) => gruppeDerListe(x.liste) === gruppe)
    if (!a || !istListenSicht(sicht, a.liste)) return
    inhalt.sichten[a.liste] = sicht
    vermerkeAusSicht(a.liste)
    // Gesehene Hinweise, die der Host schon entfernt hat, vergessen.
    const offen = new Set(Object.values(inhalt.sichten).flatMap((s) => Object.values(s.geraete).flatMap((g) => g.hinweise.map((h) => h.id))))
    inhalt.gesehen = inhalt.gesehen.filter((id) => offen.has(id))
    raeumeAuf()
    speichere()
    setzeSichten()
    const bis = meinBlatt(a.liste)?.bis
    if (bis !== undefined) kanal.bestaetige(bis)
    pumpe()
  }

  function nimmQuittung(nr: number, ergebnis: string, grund: Ablehnung | undefined): void {
    let geaendert = false
    for (const z of inhalt.zeilen) {
      if (z.nr !== nr) continue
      if (ergebnis === 'abgelehnt') z.ab ??= grund ?? 'nicht-erlaubt'
      else z.ok = true
      geaendert = true
    }
    for (const a of inhalt.abschluesse) {
      if (a.nr !== nr) continue
      if (ergebnis === 'abgelehnt') a.ab ??= grund ?? 'nicht-erlaubt'
      else a.ok = true
      geaendert = true
    }
    if (geaendert) speichere()
  }

  function verwirf(nr: number): void {
    for (const z of inhalt.zeilen) if (z.nr === nr && !z.ok) z.ab ??= 'verworfen'
    for (const a of inhalt.abschluesse) if (a.nr === nr && !a.ok) a.ab ??= 'verworfen'
    speichere()
  }

  const ab = kanal.empfange((e: Empfang) => {
    if (gestoppt) return
    if (e.art === 'sicht' && e.gruppe.startsWith('l')) return nimmSicht(e.gruppe, e.sicht)
    if (e.art === 'verworfen') verwirf(e.nr)
    if (e.art === 'direkt' && e.nachricht.art === 'quittung') nimmQuittung(e.nachricht.auf, e.nachricht.ergebnis, e.nachricht.grund)
    // Die Antwort hat die Schlange des Transports geleert (er nimmt sie vor dem Ausliefern heraus): weiter.
    if (e.art === 'direkt' || e.art === 'verworfen') pumpe()
  })

  /** Listen weg (entzogen, Rechte geändert): ihre wartenden Zeilen gehen nie mehr; Unbestätigtes gilt als abgelehnt. */
  function ohneListen(behalten: ReadonlySet<string>): void {
    let geaendert = false
    for (const z of inhalt.zeilen) {
      if (behalten.has(z.liste) || z.ok || z.ab) continue
      // Schon unterwegs: Der Host beantwortet sie noch (direkt, wenn die Gruppe weg ist).
      if (z.nr !== null) continue
      z.ab = 'nicht-erlaubt'
      geaendert = true
    }
    const vorher = inhalt.aus.length
    inhalt.aus = inhalt.aus.filter((a) => {
      if (a.art === 'nachricht') return a.liste === undefined || behalten.has(a.liste)
      const z = inhalt.zeilen.find((x) => x.z === a.z)
      return !!z && behalten.has(z.liste)
    })
    for (const liste of Object.keys(inhalt.sichten)) {
      if (behalten.has(liste)) continue
      delete inhalt.sichten[liste]
      geaendert = true
    }
    if (geaendert || inhalt.aus.length !== vorher) speichere()
    setzeSichten()
  }

  scope.run(() => {
    watch(listen, (l) => ohneListen(new Set(l.map((a) => a.liste))), { immediate: true })
    watch(geraet.status, (s) => {
      if (s === 'verbunden') pumpe()
    })
    watch(geraet.lage, (l) => {
      if (l === 'gekoppelt') pumpe()
      if (l === 'entzogen') ohneListen(new Set())
    })
  })

  // --- Lebenszeichen -------------------------------------------------------------------------------

  const wartendJetzt = () => inhalt.zeilen.filter((z) => !z.ok && !z.ab).length
  const takt = setInterval(() => {
    if (gestoppt || geraet.lage.value !== 'gekoppelt' || geraet.status.value !== 'verbunden') return
    if (kanal.unbestaetigt().length > 0 || inhalt.aus.length > 0) return
    if (!listen.value.some((a) => inhalt.sichten[a.liste]?.punkt)) return
    if (uhr() - kanal.zuletztGesendet() < WKR_ANNAHMEN.lebenszeichenSek * 1000) return
    const akku = umgebung.akku?.()
    const n: GeraeteNachricht = { art: 'lebenszeichen', wartend: wartendJetzt(), ...(akku !== undefined && Number.isInteger(akku) && akku >= 0 && akku <= 100 ? { akku } : {}) }
    kanal.schicke(n)
  }, umgebung.taktMs ?? 5000)

  // --- Abgeleitet ----------------------------------------------------------------------------------

  const stufen = scope.run(() =>
    computed(() => {
      void rev.value
      void sichten.value
      const out: Record<number, ZeilenStufe> = {}
      for (const z of inhalt.zeilen) out[z.z] = stufeVon(z)
      return out
    }),
  )!

  const schlange = scope.run(() =>
    computed(() => {
      void rev.value
      const verbunden = geraet.status.value === 'verbunden'
      const out: Record<string, SchlangenEintrag[]> = {}
      for (const a of listen.value) {
        const sicht = sichten.value[a.liste]
        if (!sicht) {
          out[a.liste] = []
          continue
        }
        const eigen = new Set(inhalt.zeilen.filter((z) => z.liste === a.liste && stufeVon(z).stufe !== 'abgelehnt').map((z) => z.s))
        const passt = (s: ListenStart) => !eigen.has(s.key) && !(a.teil && s.teile?.[a.teil])
        const liste: SchlangenEintrag[] = sicht.schlange.filter(passt).map((s) => ({ ...s }))
        if (!verbunden) {
          const schon = new Set(sicht.schlange.map((s) => s.key))
          for (const s of sicht.danach) if (!schon.has(s.key) && passt(s)) liste.push({ ...s, geschaetzt: true })
        }
        out[a.liste] = liste
      }
      return out
    }),
  )!

  const zuletzt = scope.run(() =>
    computed(() => {
      void rev.value
      void sichten.value
      return inhalt.zeilen
        .slice()
        .reverse()
        .map((z): ZuletztZeile => ({ z: z.z, liste: z.liste, s: z.s, punkt: z.punkt, korrektur: !!z.k, zellen: Object.fromEntries(z.c.map(([f, w]) => [f, w])), stufe: stufeVon(z) }))
    }),
  )!

  const hinweise = scope.run(() =>
    computed(() => {
      void rev.value
      const out: Record<string, { id: number; code: WkrHinweis; startNr?: string }[]> = {}
      const gesehen = new Set(inhalt.gesehen)
      for (const a of listen.value) out[a.liste] = (meinBlattAus(sichten.value[a.liste])?.hinweise ?? []).filter((h) => !gesehen.has(h.id)).map((h) => ({ ...h }))
      return out
    }),
  )!
  function meinBlattAus(sicht: ListenSicht | null | undefined) {
    const id = kanal.id()
    return id && sicht ? (sicht.geraete[id] ?? null) : null
  }

  const abschluesse = scope.run(() =>
    computed(() => {
      void rev.value
      void sichten.value
      return inhalt.abschluesse
        .slice()
        .reverse()
        .map((a): EigenerAbschluss => {
          const basis = { id: a.id, liste: a.liste, punkt: a.punkt }
          if (a.ab) return { ...basis, stufe: 'abgelehnt', grund: a.ab }
          if (!a.ok) return { ...basis, stufe: 'unterwegs' }
          // Still quittiert und doch nicht abgeschlossen: Der Host hat ihn wegen offener Starts nicht angenommen.
          // Am Steg zählt nur der eigene Teil (F16): Der Abschluss des anderen Teils ist nicht meiner.
          return zuFuer(inhalt.sichten[a.liste], a.punkt, aufgabeVon(a.liste)?.teil, false) ? { ...basis, stufe: 'angenommen' } : { ...basis, stufe: 'abgelehnt', grund: 'offen' }
        })
    }),
  )!

  const wartend = scope.run(() =>
    computed(() => {
      void rev.value
      return wartendJetzt()
    }),
  )!

  // --- Eingaben der Maske --------------------------------------------------------------------------

  const neueId = () => inhalt.naechsteZ++

  /** Wird eine Zeile für diesen Punkt Vorschlag? (Papier; Punkt abgeschlossen oder eigener Abschluss unterwegs.) */
  function vorschlagWeil(liste: string, punkt: PunktId | null, teil: ListenTeil | undefined): AusZeile['vs'] {
    const sicht = inhalt.sichten[liste]
    if (sicht?.modus === 'papier') return 'papier'
    if (punkt === null) return undefined
    if (zuFuer(sicht, punkt, teil, true)) return 'abschluss'
    return inhalt.abschluesse.some((a) => a.liste === liste && a.punkt === punkt && !a.ab) ? 'abschluss' : undefined
  }

  const werteVon = (liste: string, punkt: PunktId | null, s: string) => inhalt.werte[liste]?.[punkt ?? '']?.[s]

  function merkeWerte(z: AusZeile): void {
    const jeStart = ((inhalt.werte[z.liste] ??= {})[z.punkt ?? ''] ??= {})
    const e = (jeStart[z.s] ??= { k: z.klasse, w: {} })
    if (z.klasse !== null) e.k = z.klasse
    for (const [f, w] of z.c) e.w[f] = w
  }

  function stelleAn(z: AusZeile): number {
    inhalt.zeilen.push(z)
    merkeWerte(z)
    inhalt.aus.push({ art: 'zeile', z: z.z })
    raeumeAuf()
    speichere()
    pumpe()
    return z.z
  }

  function nachricht(liste: string | undefined, n: GeraeteNachricht): number {
    const id = neueId()
    inhalt.aus.push({ art: 'nachricht', id, ...(liste !== undefined ? { liste } : {}), nachricht: n })
    return id
  }

  function status(liste: string, s: 'aktiv' | 'pausiert' | 'abgemeldet'): number | null {
    if (gestoppt || !aufgabeVon(liste)) return null
    const id = nachricht(liste, { art: 'action', action: { type: 'WKR_STATUS', liste, status: s } })
    speichere()
    pumpe()
    return id
  }

  return {
    listen,
    sichten,
    schlange,
    stufen,
    zuletzt,
    hinweise,
    abschluesse,
    wartend,
    schicke(liste, zeile) {
      const aufgabe = aufgabeVon(liste)
      if (gestoppt || !aufgabe || typeof zeile.s !== 'string' || zeile.s === '') return null
      if (aufgabe.teil && zeile.teil && zeile.teil !== aufgabe.teil) return null
      const teil = aufgabe.teil ?? zeile.teil
      const sicht = inhalt.sichten[liste]
      const start = sicht ? [...sicht.schlange, ...sicht.danach].find((x) => x.key === zeile.s) : undefined
      const punkt = sicht?.punkt?.id ?? null
      const bisher = werteVon(liste, punkt, zeile.s)?.w ?? {}
      const c: [string, string, string][] = Object.entries(zeile.zellen)
        .filter(([f, w]) => typeof w === 'string' && (w !== '' || (bisher[f] ?? '') !== ''))
        .map(([f, w]) => [f, w, bisher[f] ?? ''])
      const vs = vorschlagWeil(liste, punkt, teil)
      return stelleAn({
        z: neueId(),
        liste,
        s: zeile.s,
        ...(teil ? { t: teil } : {}),
        ...(start?.seite ? { seite: start.seite } : {}),
        klasse: start?.klasse ?? werteVon(liste, punkt, zeile.s)?.k ?? null,
        punkt,
        c,
        nr: null,
        ...(vs ? { vs } : {}),
      })
    },
    korrigiere(z, zellen) {
      const alt = inhalt.zeilen.find((x) => x.z === z)
      if (gestoppt || !alt || !aufgabeVon(alt.liste)) return null
      if (alt.nr === null && !alt.ab) {
        // Noch im Ausgang: die wartende Zeile ändern statt einer zweiten (eine Nachricht weniger).
        for (const [f, w] of Object.entries(zellen)) {
          const i = alt.c.findIndex((c) => c[0] === f)
          if (i >= 0) alt.c[i] = [f, w, alt.c[i][2]]
          else alt.c.push([f, w, werteVon(alt.liste, alt.punkt, alt.s)?.w[f] ?? ''])
        }
        merkeWerte(alt)
        speichere()
        return alt.z
      }
      const bisher = werteVon(alt.liste, alt.punkt, alt.s)?.w ?? {}
      const c: [string, string, string][] = Object.entries(zellen)
        .filter(([f, w]) => typeof w === 'string' && (bisher[f] ?? '') !== w)
        .map(([f, w]) => [f, w, bisher[f] ?? ''])
      if (c.length === 0) return alt.z
      const vs = vorschlagWeil(alt.liste, alt.punkt, alt.t)
      return stelleAn({
        z: neueId(),
        liste: alt.liste,
        s: alt.s,
        ...(alt.t ? { t: alt.t } : {}),
        ...(alt.seite ? { seite: alt.seite } : {}),
        k: true,
        klasse: alt.klasse,
        punkt: alt.punkt,
        c,
        nr: null,
        ...(vs ? { vs } : {}),
      })
    },
    pausiere: (liste) => status(liste, 'pausiert'),
    meldeAb: (liste) => status(liste, 'abgemeldet'),
    weiter: (liste) => status(liste, 'aktiv'),
    schliesseAb(liste, punkt, name, restPapier) {
      const aufgabe = aufgabeVon(liste)
      const sauber = typeof name === 'string' ? name.trim() : ''
      if (gestoppt || !aufgabe || sauber === '' || sauber.length > WKR_ANNAHMEN.nameMax) return null
      const sicht = inhalt.sichten[liste]
      const pruefsummen: Record<string, string> = {}
      for (const [s, e] of Object.entries(inhalt.werte[liste]?.[punkt] ?? {})) {
        const felder = e.k !== null ? sicht?.klassen[e.k as keyof ListenSicht['klassen']]?.felder : null
        if (!felder) continue
        const kennungen = felder.filter((f) => !aufgabe.teil || f.teil === aufgabe.teil).map((f) => f.kennung)
        pruefsummen[s] = zeilenPruefsumme(e.w, kennungen)
      }
      const id = nachricht(liste, { art: 'action', action: { type: 'WKR_ABSCHLUSS', liste, punkt, name: sauber, pruefsummen, restPapier } })
      inhalt.abschluesse.push({ id, liste, punkt, nr: null })
      speichere()
      pumpe()
      return id
    },
    gesehen(hinweis) {
      if (gestoppt || !istNr(hinweis) || inhalt.gesehen.includes(hinweis)) return
      inhalt.gesehen.push(hinweis)
      nachricht(undefined, { art: 'gesehen', hinweis })
      speichere()
      pumpe()
    },
    stop() {
      if (gestoppt) return
      gestoppt = true
      clearInterval(takt)
      ab()
      scope.stop()
    },
  }
}
