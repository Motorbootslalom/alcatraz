import type { Eingaben } from '../types'
import { werteVon } from '../lib/eingaben'
import type { ListenSichtExtra } from '../wkr/sicht'
import { istAblehnung, istGeraetId, istHinweis, type Ablehnung, type Hinweis } from './transport/protokoll'

// Gesprächsstand des Bedienrechners mit den WKR-Geräten (W1, Plan docs/plan-wkr-w1.md §2, 21.11.2026) – rein, ohne
// Speicher: Lesen/Schreiben im localStorage macht ablage.ts (ABLAGE.wkr, ABLAGE.herkunft). Beides gerätelokal am
// Bedienrechner, an AppState.kennung gebunden (andere Veranstaltung = leer), NIE im AppState: nicht in Sicherung,
// Vorlage oder Verlauf (F10). „Raum beenden“ lässt beides stehen – die Herkunft ◆ gilt für die Werte, nicht für den Raum.
//
// - Eingang (`alcatraz.geraete.wkr`): je Gerät die zuletzt abgelehnten Zeilen (Code, ≤ ABGELEHNT_JE_GERAET) und die
//   Hinweise des Bedienrechners, bis das Gerät sie als gesehen meldet. Beides geht in die Sicht der Liste (`extra`).
// - Herkunft (`alcatraz.geraete.herkunft`): je Zelle (Lauf|Starter|Feld) welches Gerät welchen Wert wann gesetzt hat.
//   ◆ gilt nur, solange der Wert noch derselbe ist ({@link herkunftGilt}) – hat der Bediener ihn geändert, ist er
//   seiner.

/** Höchstens so viele abgelehnte Zeilen je Gerät (die neuesten) – wie „zuletzt“ auf dem Gerät (WKR_ANNAHMEN). */
export const ABGELEHNT_JE_GERAET = 20
/** Höchstens so viele offene Hinweise je Gerät; ältere fallen weg. */
export const HINWEISE_JE_GERAET = 20
/** Höchstens so viele Zellen mit Herkunft – ein Wettkampftag hat weit weniger; die ältesten fallen weg. */
export const HERKUNFT_HOECHSTENS = 50_000

export interface EingangAbgelehnt {
  /** Listen-Kennung (wkr/liste.ts). */
  l: string
  /** Nummer der Zeile auf dem Gerät (0 = unlesbar). */
  z: number
  grund: Ablehnung
}

export interface EingangHinweis {
  id: number
  l: string
  code: Hinweis
  startNr?: string
}

export interface EingangGeraet {
  abgelehnt: EingangAbgelehnt[]
  hinweise: EingangHinweis[]
}

export interface WkrEingang {
  kennung: string
  /** Zähler der Hinweise (IDs steigen, nie doppelt in einer Veranstaltung). */
  n: number
  geraete: Record<string, EingangGeraet>
}

export interface HerkunftEintrag {
  /** Gerätename zur Zeit der Übernahme. */
  g: string
  /** Listen-Kennung. */
  l: string
  /** Zeit (Uhr des Bedienrechners, ms). */
  z: number
  /** Wert, den das Gerät gesetzt hat. */
  w: string
}

export interface WkrHerkunft {
  kennung: string
  zellen: Record<string, HerkunftEintrag>
}

const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const istZahl = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const istText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max

export const leererEingang = (kennung: string): WkrEingang => ({ kennung, n: 0, geraete: {} })
export const leereHerkunft = (kennung: string): WkrHerkunft => ({ kennung, zellen: {} })

/** Prüft Abgelegtes Eintrag für Eintrag; Kaputtes fällt weg, statt alles zu verwerfen. `null` ohne Kennung. */
export function liesEingangWert(wert: unknown): WkrEingang | null {
  if (!istObjekt(wert) || typeof wert.kennung !== 'string' || !istZahl(wert.n) || !istObjekt(wert.geraete)) return null
  const aus = leererEingang(wert.kennung)
  aus.n = wert.n
  for (const [id, g] of Object.entries(wert.geraete)) {
    if (!istGeraetId(id) || !istObjekt(g)) continue
    const abgelehnt = Array.isArray(g.abgelehnt)
      ? g.abgelehnt.filter((a): a is EingangAbgelehnt => istObjekt(a) && istText(a.l, 400) && istZahl(a.z) && istAblehnung(a.grund))
        .map((a) => ({ l: a.l, z: a.z, grund: a.grund })).slice(-ABGELEHNT_JE_GERAET)
      : []
    const hinweise = Array.isArray(g.hinweise)
      ? g.hinweise.filter((h): h is EingangHinweis => istObjekt(h) && istZahl(h.id) && istText(h.l, 400) && istHinweis(h.code) && (h.startNr === undefined || istText(h.startNr, 16)))
        .map((h) => ({ id: h.id, l: h.l, code: h.code, ...(h.startNr !== undefined ? { startNr: h.startNr } : {}) })).slice(-HINWEISE_JE_GERAET)
      : []
    aus.geraete[id] = { abgelehnt, hinweise }
  }
  return aus
}

export function liesHerkunftWert(wert: unknown): WkrHerkunft | null {
  if (!istObjekt(wert) || typeof wert.kennung !== 'string' || !istObjekt(wert.zellen)) return null
  const aus = leereHerkunft(wert.kennung)
  for (const [k, e] of Object.entries(wert.zellen)) {
    if (!istObjekt(e) || !istText(e.g, 60) || !istText(e.l, 400) || !istZahl(e.z) || !istText(e.w, 400)) continue
    aus.zellen[k] = { g: e.g, l: e.l, z: e.z, w: e.w }
  }
  return aus
}

const geraetVon = (e: WkrEingang, id: string): EingangGeraet => e.geraete[id] ?? { abgelehnt: [], hinweise: [] }

/** Abgelehnte Zeilen eines Geräts dazu (die neuesten {@link ABGELEHNT_JE_GERAET}). Unverändert ohne Ablehnung. */
export function mitAbgelehnt(e: WkrEingang, id: string, liste: string, abgelehnt: readonly { z: number; grund: Ablehnung }[]): WkrEingang {
  if (abgelehnt.length === 0) return e
  const g = geraetVon(e, id)
  const neu = [...g.abgelehnt, ...abgelehnt.map((a) => ({ l: liste, z: a.z, grund: a.grund }))].slice(-ABGELEHNT_JE_GERAET)
  return { ...e, geraete: { ...e.geraete, [id]: { ...g, abgelehnt: neu } } }
}

/** Ein Hinweis an diese Geräte (alle einer Liste) – dieselbe ID für alle; jedes meldet für sich „gesehen“. */
export function mitHinweis(e: WkrEingang, ids: readonly string[], liste: string, code: Hinweis, startNr?: string): { eingang: WkrEingang; id: number } {
  const id = e.n + 1
  const geraete = { ...e.geraete }
  for (const g of ids) {
    const bisher = geraetVon(e, g)
    const h: EingangHinweis = { id, l: liste, code, ...(startNr !== undefined ? { startNr } : {}) }
    geraete[g] = { ...bisher, hinweise: [...bisher.hinweise, h].slice(-HINWEISE_JE_GERAET) }
  }
  return { eingang: { ...e, n: id, geraete }, id }
}

/** Das Gerät hat den Hinweis gesehen: weg (nur bei ihm). Unverändert, wenn es ihn nicht hatte. */
export function ohneHinweis(e: WkrEingang, geraet: string, hinweis: number): WkrEingang {
  const g = e.geraete[geraet]
  if (!g || !g.hinweise.some((h) => h.id === hinweis)) return e
  return { ...e, geraete: { ...e.geraete, [geraet]: { ...g, hinweise: g.hinweise.filter((h) => h.id !== hinweis) } } }
}

/** Ein entzogenes Gerät: sein Gesprächsstand ist weg. */
export function ohneGeraet(e: WkrEingang, geraet: string): WkrEingang {
  if (!e.geraete[geraet]) return e
  const geraete = { ...e.geraete }
  delete geraete[geraet]
  return { ...e, geraete }
}

/**
 * Was der Host zur Sicht einer Liste dazugibt (wkr/sicht.ts ListenSichtExtra): je Gerät der Liste `bis` (= `letzteNr`
 * im Register, die gesammelte Quittung) und Abgelehntes und Hinweise DIESER Liste.
 */
export function extraFuer(e: WkrEingang, liste: string, geraete: readonly { id: string; bis: number }[]): ListenSichtExtra {
  const aus: ListenSichtExtra = { geraete: {} }
  for (const { id, bis } of geraete) {
    const g = geraetVon(e, id)
    aus.geraete[id] = {
      bis,
      abgelehnt: g.abgelehnt.filter((a) => a.l === liste).map((a) => ({ z: a.z, grund: a.grund })),
      hinweise: g.hinweise.filter((h) => h.l === liste).map((h) => ({ id: h.id, code: h.code, ...(h.startNr !== undefined ? { startNr: h.startNr } : {}) })),
    }
  }
  return aus
}

/** Schlüssel einer Zelle in der Herkunft: Lauf|Starter|Feld (Feld-Kennungen enthalten selbst `|`, Lauf und Starter nicht). */
export function zellSchluessel(lauf: string, starter: string, feld: string): string {
  return `${lauf}|${starter}|${feld}`
}

/** Herkunft für diese Zellen setzen (neueste gewinnt); die ältesten über {@link HERKUNFT_HOECHSTENS} fallen weg. */
export function mitHerkunft(h: WkrHerkunft, eintraege: readonly { lauf: string; starter: string; feld: string; eintrag: HerkunftEintrag }[]): WkrHerkunft {
  if (eintraege.length === 0) return h
  const zellen = { ...h.zellen }
  for (const { lauf, starter, feld, eintrag } of eintraege) {
    const k = zellSchluessel(lauf, starter, feld)
    // Neu einsortieren: Die Reihenfolge der Schlüssel ist die der Übernahme, damit die ältesten zuerst gehen.
    delete zellen[k]
    zellen[k] = { ...eintrag }
  }
  const schluessel = Object.keys(zellen)
  for (const k of schluessel.slice(0, Math.max(0, schluessel.length - HERKUNFT_HOECHSTENS))) delete zellen[k]
  return { ...h, zellen }
}

/** Gilt ◆ für diese Zelle? Nur, solange dort noch der Wert des Geräts steht. */
export function herkunftGilt(h: WkrHerkunft, eingaben: Eingaben, lauf: string, starter: string, feld: string): HerkunftEintrag | null {
  const e = h.zellen[zellSchluessel(lauf, starter, feld)]
  if (!e) return null
  return (werteVon(eingaben, lauf, starter)[feld] ?? '') === e.w ? e : null
}
