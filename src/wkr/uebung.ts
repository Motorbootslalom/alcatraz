import type { ClassId, PunktId, Sprache } from '../types'
import { configFor } from '../config/konfig'
import { liesRef, refKey } from '../betrieb/folge'
import { laufSchluessel } from '../lib/eingaben'
import { parcoursName } from '../config/sprache'
import { regelwerkSprache } from '../lib/listensprache'
import { WKR_ANNAHMEN } from './annahmen'
import { listenKennung, teileVon, type ListenTeil } from './liste'
import { LISTEN_SICHT_FASSUNG, maskenJeKlasse, maskenSprachen, maskenTexte, type ListenSicht, type ListenStart } from './sicht'

// Übungsmodus der WKR-Maske (W3, Plan docs/plan-wkr-w3.md §3.3, G13, 21.11.2026) – rein, ohne AppState, ohne Store,
// ohne Netz. Die Übung baut eine ListenSicht wie der Bedienrechner (dieselben Masken über maskenJeKlasse), aber aus
// erfundenen Starts: Startnummern 1–WKR_ANNAHMEN.uebungStarts in den Klassen des Regelwerks, die die Liste haben –
// keine Namen, nichts aus src/data/. Ohne Boot (Plan: Boot „Übung“): Das wäre ein Text außerhalb von i18n auf dem
// Gerät; „ÜBUNG“ steht ohnehin dauerhaft im Kopf. Nach der letzten Nummer beginnt der nächste Lauf.
//
// Abweichung vom Plan §3.3 (beim Bau 21.11.2026): Der Fortschritt steht in einem eigenen kleinen UebungsStand statt
// in der Sicht – die Sicht trägt weder Regelwerk noch Uhr, und ein neuer Start braucht beides. Gerätekern:
// geraete/uebung.ts (Takt alle WKR_ANNAHMEN.uebungTaktSek, Quittung, Beispiel-Rückfrage).

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
}

/** Der Anfang einer Übung: zwei Starts gezeigt. */
export function uebungsStand(regelwerk: string, typeId: string, sprache?: Sprache): UebungsStand {
  return {
    regelwerk,
    typeId,
    sprache: sprache ?? regelwerkSprache(regelwerk),
    naechster: GEZEIGT_ANFANG,
    offen: Array.from({ length: GEZEIGT_ANFANG }, (_, i) => ({ i, ab: false, an: false })),
  }
}

const nrVon = (i: number) => (i % WKR_ANNAHMEN.uebungStarts) + 1
const laufVon = (i: number) => Math.floor(i / WKR_ANNAHMEN.uebungStarts) + 1
const keyVon = (i: number) => refKey({ art: 'm', starter: `u${nrVon(i)}`, lauf: laufVon(i) })

/** Die laufende Nummer zu einer Kennung der Übung; `null`, wenn sie keine ist. */
function indexVon(key: string): number | null {
  const ref = liesRef(key)
  if (!ref || ref.art !== 'm') return null
  const m = /^u(\d+)$/.exec(ref.starter)
  if (!m) return null
  const nr = Number(m[1])
  if (nr < 1 || nr > WKR_ANNAHMEN.uebungStarts) return null
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

/** Die Sicht der Übung – Form und Fassung wie vom Bedienrechner (wkr/sicht.ts). */
export function uebungsSicht(stand: UebungsStand): ListenSicht {
  const sprachen = maskenSprachen(stand.regelwerk, stand.sprache)
  const listenKonfig = konfigVon(stand)
  const texte = listenKonfig.getBogenTexte()
  const klassen = klassenVon(stand)
  const klasseVon = (i: number) => klassen[Math.floor(((nrVon(i) - 1) * klassen.length) / WKR_ANNAHMEN.uebungStarts)]
  const teile = teileVon(stand.typeId)
  const vorab = WKR_ANNAHMEN.vorabListen.includes(stand.typeId)
  // Steg-Zeitversatz (Nutzer 21.11.2026, T1/T2): Ablegen sieht „Als Nächstes“ vorab, Anlegen erst nach dem Boot.
  const nVorab = vorab ? VORAB : teile && WKR_ANNAHMEN.stegAblegenVorab ? VORAB_STEG : 0
  const nachlaufend = !!teile && WKR_ANNAHMEN.stegAnlegenNachlaufend
  const imBoot = stand.naechster - 1
  const start = (i: number, extra: Partial<ListenStart> = {}): ListenStart => ({
    key: keyVon(i),
    startNr: String(nrVon(i)),
    klasse: klasseVon(i),
    titel: texte.lauf(laufVon(i)),
    lauf: laufSchluessel('manoevrieren', laufVon(i)),
    ...extra,
  })
  const schlange = stand.offen.map((o) => start(o.i, teile ? { teile: { ab: o.ab, an: o.an || (nachlaufend && o.i === imBoot) } } : {}))
  const frei = Array.from({ length: nVorab + WKR_ANNAHMEN.danach }, (_, j) => stand.naechster + j)
  schlange.push(...frei.slice(0, nVorab).map((i) => start(i, { vorab: true, ...(teile ? { teile: { ab: false, an: nachlaufend } } : {}) })))
  const danach = frei.slice(nVorab).map((i) => start(i, teile ? { teile: { ab: false, an: nachlaufend } } : {}))
  const lauf = laufVon(stand.offen.length > 0 ? Math.max(...stand.offen.map((o) => o.i)) : stand.naechster)
  const xErlaubt = WKR_ANNAHMEN.xListen.includes(stand.typeId)
  const maskenKonfig = konfigVon(stand, sprachen.maske)
  const bekannt = listenKonfig.getPositions().some((p) => p.typeId === stand.typeId)

  const sicht: ListenSicht = {
    lv: LISTEN_SICHT_FASSUNG,
    liste: listenKennung({ bereich: UEBUNG_BEREICH, typeId: stand.typeId, racecourse: null }),
    titel: bekannt ? listenKonfig.getSheetDef(stand.typeId).title : stand.typeId,
    bereich: parcoursName('Parcours 1', stand.sprache),
    sprache: stand.sprache,
    modus: 'digital',
    status: 'aktiv',
    punkt: { id: `lauf:${lauf}` as PunktId, titel: texte.lauf(lauf) },
    abgeschlossen: [],
    schlange,
    danach,
    klassen: maskenJeKlasse(listenKonfig, maskenKonfig, stand.typeId, klassen, xErlaubt),
    geraete: {},
  }
  if (sprachen.andere !== null) {
    const andere = konfigVon(stand, sprachen.andere)
    sicht.andere = {
      sprache: sprachen.andere,
      titel: bekannt ? andere.getSheetDef(stand.typeId).title : stand.typeId,
      bereich: parcoursName('Parcours 1', sprachen.andere),
      klassen: maskenTexte(maskenJeKlasse(listenKonfig, andere, stand.typeId, klassen, xErlaubt)),
    }
  }
  if (teile) sicht.teile = { ab: { status: 'aktiv', abgeschlossen: [] }, an: { status: 'aktiv', abgeschlossen: [] } }
  return sicht
}

/**
 * Ein Schritt der Übung: `zeile` = eine abgeschickte Zeile (Start erledigt, am Steg nur ihr Teil; ein noch nicht
 * gezeigter Start am Vorsteg wird dabei gezeigt), danach rückt ein Start nach, wenn weniger als zwei offen sind;
 * `null` = der Takt zeigt den nächsten Start (höchstens WKR_ANNAHMEN.schlange offen). Unbekannte Kennungen ändern
 * nichts (dieselbe Referenz zurück).
 */
export function uebungsSchritt(stand: UebungsStand, zeile: { s: string; teil?: ListenTeil } | null): UebungsStand {
  if (zeile === null) {
    if (stand.offen.length >= WKR_ANNAHMEN.schlange) return stand
    return { ...stand, naechster: stand.naechster + 1, offen: [...stand.offen, { i: stand.naechster, ab: false, an: false }] }
  }
  const i = indexVon(zeile.s)
  if (i === null) return stand
  let { naechster } = stand
  let offen = stand.offen.map((o) => ({ ...o }))
  if (i >= naechster) {
    // Vorsteg vorab (oder geschätzt): alles bis dorthin gilt als gezeigt.
    if (i >= naechster + VORAB + WKR_ANNAHMEN.danach) return stand
    for (let j = naechster; j <= i; j++) offen.push({ i: j, ab: false, an: false })
    naechster = i + 1
  }
  const o = offen.find((x) => x.i === i)
  if (!o) return stand
  const geteilt = !!teileVon(stand.typeId)
  if (geteilt && zeile.teil) o[zeile.teil] = true
  else {
    o.ab = true
    o.an = true
  }
  offen = offen.filter((x) => !(x.ab && x.an))
  while (offen.length < GEZEIGT_ANFANG) {
    offen.push({ i: naechster, ab: false, an: false })
    naechster++
  }
  return { ...stand, naechster, offen }
}
