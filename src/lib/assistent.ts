import { istInlineKurzform, istKurzform } from '../config/kurzform'
import type { Aufgabe, Blick, RawAufbau, RawKurzform, RawPosition, RawQuelle } from '../config/schema'
import { eintragId, zeitTitel } from '../config/zeitnahme'
import type { Geraet } from '../types'

// Der Assistent für eigene Aufbauten (KONZEPT-POSITIONEN.md §7): Ein Entwurf hat Spalten
// (Positionen) und eine Zuordnung, welche Spalte welche Boje oder Aufgabe beobachtet. Daraus
// entsteht ein eigener Aufbau mit Positionen in Kurzform. Ohne Vue, damit es testbar bleibt.

/** Eine Hälfte eines Tores in der Tabelle: die Einzelboje aus dem Parcoursbild. */
export interface Haelfte {
  id: string
  name: string
}

/** Eine Zeile der Zuordnung: ein Tor mit zwei Hälften, eine Speedboje oder eine Aufgabe. */
export interface Zeile {
  id: string
  name: string
  /** Tore: die beiden Bojen. „Rechts“ ist die rechte Seite auf der Hinfahrt, im Bild unten. */
  haelften?: [Haelfte, Haelfte]
  /** Für welche Klassen es die Zeile gibt, als Hinweis. */
  klassen?: string
  /** Nicht Pflicht: Die Prüfung auf Lücken verlangt sie nicht. */
  freiwillig?: boolean
}

const tor = (n: number, innenOben: boolean): Zeile => ({
  id: `Tor${n}`,
  name: `Tor ${n}`,
  haelften: innenOben
    ? [
        { id: `Tor${n}_aussen`, name: 'rechts · außen' },
        { id: `Tor${n}_innen`, name: 'links · innen' },
      ]
    : [
        { id: `Tor${n}_innen`, name: 'rechts · innen' },
        { id: `Tor${n}_aussen`, name: 'links · außen' },
      ],
})

export const ZEILEN: readonly Zeile[] = [
  {
    id: 'StartZiel',
    name: 'Start / Ziel',
    haelften: [
      { id: 'StartZiel_unten', name: 'rechts' },
      { id: 'StartZiel_oben', name: 'links' },
    ],
  },
  tor(1, true),
  tor(2, false),
  tor(3, true),
  tor(4, false),
  {
    id: 'Tor5',
    name: 'Tor 5',
    haelften: [
      { id: 'Tor5_unten', name: 'rechts' },
      { id: 'Tor5_oben', name: 'links' },
    ],
  },
  { id: 'Speedboje_oben', name: 'Speed 1 (Tonne 7)', klassen: 'ab Klasse 5' },
  { id: 'Speedboje_unten', name: 'Speed 2 (Tonne 8)', klassen: 'nur Klasse 7' },
  { id: 'tor5', name: 'Fehler Tor 5' },
  { id: 'mueb', name: 'Mann-über-Bord', klassen: 'ab Klasse 4' },
  { id: 'parcours', name: 'Parcoursüberwachung', freiwillig: true },
]

/** Die Felder, denen eine Spalte zugeordnet wird: Einzelbojen und Aufgaben. */
export const FELDER: readonly string[] = ZEILEN.flatMap((z) => (z.haelften ? z.haelften.map((h) => h.id) : [z.id]))

const AUFGABEN_ZEILEN = new Set(['tor5', 'mueb', 'parcours'])

/** Eine Spalte des Assistenten: eine Position. */
export interface Spalte {
  id: string
  titel: string
  blick?: Blick
  /** Bild halb breit neben der Legende statt quer darunter. */
  bildNeben?: boolean
  /** Eine Zeitliste: die Geräte, je Gerät eine Spalte auf der Liste. */
  zeiten?: Geraet[]
}

export interface Entwurf {
  id: string
  name: string
  kurs?: string
  vorsteg: boolean
  steg: boolean
  knoten: boolean
  spalten: Spalte[]
  /** Einzelboje oder Aufgabe → IDs der Spalten, die sie beobachten. */
  zuordnung: Record<string, string[]>
}

/** Die Zeitnahme zur Auswahl, wie sie bei Veranstaltungen vorkommt. */
export const ZEITNAHMEN: ReadonlyArray<{ id: string; name: string; zeiten?: Geraet[] }> = [
  { id: '', name: 'keine Zeit' },
  { id: 'e', name: 'Elektronisch', zeiten: ['elektronisch'] },
  { id: 's', name: 'Stoppuhr', zeiten: ['stoppuhr'] },
  { id: 'e2s', name: 'Elektronisch + 2 Stoppuhren', zeiten: ['elektronisch', 'stoppuhr', 'stoppuhr'] },
  { id: '3s', name: '3 Stoppuhren', zeiten: ['stoppuhr', 'stoppuhr', 'stoppuhr'] },
]

export function zeitnahmeId(zeiten: Geraet[] | undefined): string {
  return ZEITNAHMEN.find((z) => (z.zeiten ?? []).join() === (zeiten ?? []).join())?.id ?? ''
}

// ---- IDs ------------------------------------------------------------------------------

const ZEICHEN = 'abcdefghijkmnpqrstuvwxyz23456789'

function zufall(n: number, wuerfel: () => number): string {
  return Array.from({ length: n }, () => ZEICHEN[Math.floor(wuerfel() * ZEICHEN.length)]).join('')
}

/** Der Name als ID-Anfang: Kleinbuchstaben und Ziffern, Umlaute ausgeschrieben. */
export function namensteil(name: string): string {
  const ersetzt = name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '')
  return ersetzt.slice(0, 12) || 'aufbau'
}

/**
 * Eine neue ID, die es noch nicht gibt: aus dem Namen und einem kurzen Zufallsteil, damit
 * sie nicht mit späteren Aufbauten aus dem Repo zusammenstößt (KONZEPT-POSITIONEN.md §8).
 */
export function neueId(anfang: string, vergeben: Set<string>, wuerfel: () => number = Math.random): string {
  for (;;) {
    const id = `${anfang}${zufall(4, wuerfel)}`
    if (!vergeben.has(id)) {
      vergeben.add(id)
      return id
    }
  }
}

// ---- Entwurf ↔ Aufbau --------------------------------------------------------------------

/** Ganze Tore in ihre Einzelbojen; was keine Boje eines Tores ist, bleibt. */
function einzeln(bojen: string[]): string[] {
  return bojen.flatMap((b) => ZEILEN.find((z) => z.id === b)?.haelften?.map((h) => h.id) ?? [b])
}

/** Beide Hälften eines Tores werden wieder das ganze Tor, das liest sich leichter. */
function kompakt(felder: string[]): string[] {
  const gesetzt = new Set(felder)
  return ZEILEN.flatMap((z) => {
    if (!z.haelften) return gesetzt.has(z.id) && !AUFGABEN_ZEILEN.has(z.id) ? [z.id] : []
    const da = z.haelften.filter((h) => gesetzt.has(h.id)).map((h) => h.id)
    return da.length === 2 ? [z.id] : da
  })
}

/** Ein leerer Entwurf mit den üblichen Bausteinen. */
export function leererEntwurf(id: string, name: string): Entwurf {
  return { id, name, vorsteg: false, steg: true, knoten: false, spalten: [], zuordnung: {} }
}

/**
 * Ein Entwurf aus einem vorhandenen Aufbau, z. B. als Vorlage. Positionen aus dem Repo werden
 * zu Spalten mit neuer ID; mit `behalteIds` bleiben die IDs eigener Positionen (Bearbeiten).
 * Positionen in ausführlicher Form lassen sich nicht abbilden und werden genannt.
 */
export function ausAufbau(
  aufbau: RawAufbau,
  quelle: RawQuelle,
  ziel: { id: string; name: string },
  neuePositionsId: () => string,
  behalteIds = false,
): { entwurf: Entwurf; nichtUebernommen: string[] } {
  const entwurf: Entwurf = { ...leererEntwurf(ziel.id, ziel.name), steg: false, ...(aufbau.kurs ? { kurs: aufbau.kurs } : {}) }
  const nichtUebernommen: string[] = []
  const zuordnen = (spalte: string, felder: string[]) => {
    for (const f of felder) entwurf.zuordnung[f] = [...(entwurf.zuordnung[f] ?? []), spalte]
  }
  for (const e of aufbau.positionen) {
    const id = eintragId(e)
    if (id === 'steg' || id === 'vorsteg' || id === 'knoten') {
      entwurf[id] = true
      continue
    }
    const inline = istInlineKurzform(e) ? e : undefined
    const imRepo: RawPosition | RawKurzform | undefined = inline ?? quelle.positionen.find((p) => p.id === id)
    if (id === 'zeit' && !inline) {
      // Die einfache Zeitliste aus dem Repo; abgewandelt mit ihren Geräten.
      const zeiten = (typeof e === 'object' && 'zeiten' in e && e.zeiten) || (['stoppuhr', 'stoppuhr', 'stoppuhr'] as Geraet[])
      entwurf.spalten.push({ id: neuePositionsId(), titel: zeitTitel(zeiten) ?? 'Zeit', zeiten })
      continue
    }
    if (!imRepo || !istKurzform(imRepo)) {
      nichtUebernommen.push(imRepo?.titel ?? id)
      continue
    }
    const spalte: Spalte = {
      id: inline && behalteIds ? inline.id : neuePositionsId(),
      titel: imRepo.titel,
      ...(imRepo.blick ? { blick: imRepo.blick } : {}),
      ...(imRepo.bildNeben ? { bildNeben: true } : {}),
      ...(imRepo.aufgaben?.includes('zeit') ? { zeiten: imRepo.zeiten ?? ['stoppuhr', 'stoppuhr', 'stoppuhr'] } : {}),
    }
    entwurf.spalten.push(spalte)
    zuordnen(spalte.id, [...einzeln(imRepo.bojen ?? []), ...(imRepo.aufgaben ?? []).filter((a) => a !== 'zeit')])
  }
  return { entwurf, nichtUebernommen }
}

/** Die Felder, die eine Spalte beobachtet. */
export function felderVon(entwurf: Entwurf, spalte: string): string[] {
  return FELDER.filter((f) => entwurf.zuordnung[f]?.includes(spalte))
}

/** Die Position einer Spalte in Kurzform; ohne Boje, Aufgabe und Zeit gibt es keine. */
export function spalteAlsPosition(entwurf: Entwurf, s: Spalte): RawKurzform | undefined {
  const felder = felderVon(entwurf, s.id)
  const bojen = kompakt(felder)
  const aufgaben: Aufgabe[] = [
    ...(s.zeiten ? (['zeit'] as const) : []),
    ...(['tor5', 'mueb', 'parcours'] as const).filter((a) => felder.includes(a)),
  ]
  if (bojen.length === 0 && aufgaben.length === 0) return undefined
  return {
    id: s.id,
    titel: s.titel.trim() || zeitTitel(s.zeiten ?? []) || 'Position',
    ...(s.blick ? { blick: s.blick } : {}),
    ...(bojen.length > 0 ? { bojen } : {}),
    ...(aufgaben.length > 0 ? { aufgaben } : {}),
    ...(s.zeiten ? { zeiten: s.zeiten } : {}),
    ...(s.bildNeben ? { bildNeben: true } : {}),
  }
}

/** Der eigene Aufbau aus dem Entwurf: Zeitlisten, Vorsteg, Steg, die übrigen Spalten, Knoten. */
export function zuAufbau(entwurf: Entwurf): RawAufbau {
  const positionen = (zeit: boolean) =>
    entwurf.spalten.filter((s) => !!s.zeiten === zeit).flatMap((s) => spalteAlsPosition(entwurf, s) ?? [])
  return {
    id: entwurf.id,
    // Kein Ersatzname: Ein leerer Name ist ein Befund der Prüfung, den die Oberfläche in ihrer Sprache nennt.
    name: entwurf.name.trim(),
    ...(entwurf.kurs ? { kurs: entwurf.kurs } : {}),
    positionen: [
      ...positionen(true),
      ...(entwurf.vorsteg ? ['vorsteg'] : []),
      ...(entwurf.steg ? ['steg'] : []),
      ...positionen(false),
      ...(entwurf.knoten ? ['knoten'] : []),
    ],
  }
}

// ---- Laufende Prüfung ------------------------------------------------------------------

export interface Befund {
  /** Pflichtfelder, die keine Spalte beobachtet (rot). */
  fehlt: string[]
  /** Felder auf mehr als einer Liste (gelb): Beide teilen sich einen Wert. */
  doppelt: string[]
  /** Spalten, die nichts beobachten und keine Zeit nehmen: Sie entfallen. */
  leer: string[]
}

/** Was die Tabelle markiert, ohne die volle Prüfung abzuwarten. */
export function befund(entwurf: Entwurf): Befund {
  const pflicht = ZEILEN.filter((z) => !z.freiwillig).flatMap((z) => (z.haelften ? z.haelften.map((h) => h.id) : [z.id]))
  const spalten = new Set(entwurf.spalten.map((s) => s.id))
  const auf = (f: string) => (entwurf.zuordnung[f] ?? []).filter((s) => spalten.has(s))
  return {
    fehlt: pflicht.filter((f) => auf(f).length === 0),
    doppelt: FELDER.filter((f) => auf(f).length > 1),
    leer: entwurf.spalten.filter((s) => !spalteAlsPosition(entwurf, s)).map((s) => s.id),
  }
}

/** Setzt oder löst den Punkt eines Feldes in einer Spalte; ganze Tore beide Hälften. */
export function umschalten(entwurf: Entwurf, zeile: Zeile, spalte: string, haelfte?: string): Entwurf {
  const felder = haelfte ? [haelfte] : (zeile.haelften?.map((h) => h.id) ?? [zeile.id])
  const alle = felder.every((f) => entwurf.zuordnung[f]?.includes(spalte))
  const zuordnung = { ...entwurf.zuordnung }
  for (const f of felder) {
    const ohne = (zuordnung[f] ?? []).filter((s) => s !== spalte)
    zuordnung[f] = alle ? ohne : [...ohne, spalte]
  }
  return { ...entwurf, zuordnung }
}

// ---- Zuordnen im Bild (KONZEPT-NAMEN-FREIHAND.md §2) -------------------------------------

/** Die Einzelbojen, die sich im Parcoursbild wählen lassen; ihre IDs stehen so im Bild. */
export const BILD_BOJEN: readonly string[] = FELDER.filter((f) => !AUFGABEN_ZEILEN.has(f))

/** Die Aufgaben ohne Boje: Sie stehen im Bild nicht und werden angehakt. */
export const AUFGABEN_FELDER: ReadonlyArray<{ id: string; name: string }> = ZEILEN.filter((z) => AUFGABEN_ZEILEN.has(z.id)).map(
  (z) => ({ id: z.id, name: z.name }),
)

/** Ein Punkt in Bildkoordinaten. */
export interface Punkt {
  x: number
  y: number
}

/** Abstand eines Punkts zur Strecke a–b. */
function abstandZurStrecke(p: Punkt, a: Punkt, b: Punkt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const laenge2 = dx * dx + dy * dy
  const t = laenge2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / laenge2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Liegt der Punkt in der geschlossenen Linie (Strahl-Verfahren, gerade-ungerade)? */
function innen(p: Punkt, linie: readonly Punkt[]): boolean {
  let drin = false
  for (let i = 0, j = linie.length - 1; i < linie.length; j = i++) {
    const a = linie[i]
    const b = linie[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) drin = !drin
  }
  return drin
}

/**
 * Trifft die Freihandlinie den Punkt? Ja, wenn er in der (geschlossen gedachten) Linie liegt
 * oder näher als `toleranz` an ihr: So zählt Umkreisen wie Durchstreichen.
 */
export function trifft(p: Punkt, linie: readonly Punkt[], toleranz: number): boolean {
  if (linie.length === 0) return false
  if (linie.length >= 3 && innen(p, linie)) return true
  if (linie.length === 1) return Math.hypot(p.x - linie[0].x, p.y - linie[0].y) <= toleranz
  for (let i = 1; i < linie.length; i++) if (abstandZurStrecke(p, linie[i - 1], linie[i]) <= toleranz) return true
  return false
}

/** Die Bojen, die eine Freihandlinie trifft, in der Reihenfolge von {@link BILD_BOJEN}. */
export function bojenAufLinie(mitten: Readonly<Record<string, Punkt>>, linie: readonly Punkt[], toleranz: number): string[] {
  return BILD_BOJEN.filter((f) => mitten[f] && trifft(mitten[f], linie, toleranz))
}

/** Die Felder gehören danach nur noch der Spalte: Andere Spalten verlieren sie (umhängen). */
export function zuordnen(entwurf: Entwurf, felder: readonly string[], spalte: string): Entwurf {
  if (felder.length === 0) return entwurf
  const zuordnung = { ...entwurf.zuordnung }
  for (const f of felder) zuordnung[f] = [spalte]
  return { ...entwurf, zuordnung }
}

/** Setzt oder löst ein einzelnes Feld (Einzelboje oder Aufgabe) in einer Spalte. */
export function feldUmschalten(entwurf: Entwurf, feld: string, spalte: string): Entwurf {
  const zeile = ZEILEN.find((z) => z.id === feld || z.haelften?.some((h) => h.id === feld))
  if (!zeile) return entwurf
  return umschalten(entwurf, zeile, spalte, zeile.haelften ? feld : undefined)
}

/** Der Name eines Feldes für Hinweise, z. B. „Tor 1 rechts · außen“. */
export function feldName(feld: string): string {
  for (const z of ZEILEN) {
    if (z.id === feld) return z.name
    const h = z.haelften?.find((x) => x.id === feld)
    if (h) return `${z.name} ${h.name}`
  }
  return feld
}

/** Farben der Positionen, gut zu unterscheiden und auf dem Parcoursbild sichtbar. */
export const SPALTEN_FARBEN: readonly string[] = ['#1f77b4', '#2ca02c', '#9467bd', '#d62728', '#17becf', '#8c564b', '#e377c2', '#bcbd22']

export function spaltenFarbe(entwurf: Entwurf, spalte: string): string {
  const i = entwurf.spalten.findIndex((s) => s.id === spalte)
  return SPALTEN_FARBEN[(i < 0 ? 0 : i) % SPALTEN_FARBEN.length]
}

/** Die Blickrichtungen zur Auswahl, in Klartext. */
export const BLICKE: ReadonlyArray<{ id: Blick | ''; name: string }> = [
  { id: '', name: 'ohne Blick' },
  { id: 'hinten', name: 'von hinten' },
  { id: 'vorne', name: 'von vorne' },
  { id: 'rechts', name: 'von rechts' },
  { id: 'links', name: 'von links' },
]
