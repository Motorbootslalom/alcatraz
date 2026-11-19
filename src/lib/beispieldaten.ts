import type { Besetzung, ClassId, Einteilung, Starter } from '../types'
import { NACHNAMEN, VORNAMEN_M, VORNAMEN_W } from '../data/names'
import { BOOTSNAMEN } from '../data/boote'
import { parseGewicht } from '../domain/gewicht'
import { setzeName, type WkrZelle } from './einteilung'

// Beispieldaten neben Starterfeld (domain/generate.ts) und Werten (lib/beispielwerte.ts): eine
// erfundene WKR-Einteilung und erfundene Gewichte aus der Verwiegung – damit sich Bögen mit Namen
// und die Liste der Ausgleichsgewichte ansehen lassen, ohne etwas abzutippen (Entscheidung des
// Nutzers vom 15.11.2026). Beides ruft der Reducer: rein, der Zufall kommt als Saat mit der
// Action (lib/beispielwerte.ts `zufallAus`). Namen nur aus src/data – erfunden.

type Zufall = () => number

/**
 * Personen je Liste: zwei oder drei. So viele sitzen meist an einer Position (Zeitnehmer mit
 * Stoppuhren, Beobachter und Schreiber), und ihr gemeinsamer Eintrag zeigt, wie das Namensfeld
 * mehrere Personen aufnimmt.
 */
export const BESETZUNG_PERSONEN = { min: 2, max: 3 } as const

/**
 * Mehrere Personen in einem Namensfeld: durch Komma getrennt, wie man sie auch von Hand
 * einträgt. Im Kopf eines Bogens steht der Eintrag als Text auf der Namenslinie
 * (components/bogen/BogenKopf.vue); dort passen rund 40 Zeichen auf eine Zeile, auch neben dem
 * QR-Code und der zweisprachigen Beschriftung „WKR / Race official:“ (im Browser gemessen,
 * 16.11.2026). Länger bräche die Linie um – siehe {@link besetzungsText}.
 */
export const BESETZUNG_TRENNER = ', '
export const BESETZUNG_HOECHSTENS = 40

function mische<T>(liste: readonly T[], zufall: Zufall): T[] {
  const a = [...liste]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const waehle = <T>(liste: readonly T[], zufall: Zufall): T => liste[Math.floor(zufall() * liste.length)]

/**
 * Der Eintrag für eine Liste: die Personen durch Komma. Ist er länger als
 * {@link BESETZUNG_HOECHSTENS}, stehen die Vornamen abgekürzt da („A. Müller, B. Schmidt“);
 * reicht auch das nicht, entfällt die dritte Person – zwei bleiben immer.
 */
export function besetzungsText(personen: readonly { vorname: string; nachname: string }[]): string {
  const voll = personen.map((p) => `${p.vorname} ${p.nachname}`).join(BESETZUNG_TRENNER)
  if (voll.length <= BESETZUNG_HOECHSTENS) return voll
  const kurz = personen.map((p) => `${p.vorname[0]}. ${p.nachname}`).join(BESETZUNG_TRENNER)
  if (kurz.length <= BESETZUNG_HOECHSTENS || personen.length <= BESETZUNG_PERSONEN.min) return kurz
  return besetzungsText(personen.slice(0, -1))
}

/**
 * Füllt die genannten Zellen der Einteilung (lib/einteilung.ts `einteilungsZellen`) mit zwei bis
 * drei erfundenen Personen je Liste. Was dort stand, wird ersetzt – gefragt hat vorher die
 * Oberfläche; alle übrigen Einträge bleiben. Kein Nachname kommt doppelt vor, solange der Vorrat
 * reicht: Auf jeder Position sitzen andere Leute.
 */
export function beispielEinteilung(einteilung: Einteilung, zellen: readonly WkrZelle[], zufall: Zufall): Einteilung {
  let vorrat: string[] = []
  const nachname = () => {
    if (vorrat.length === 0) vorrat = mische(NACHNAMEN, zufall)
    return vorrat.pop()!
  }
  let e = einteilung
  for (const { parcoursId, typeId } of zellen) {
    const zahl = BESETZUNG_PERSONEN.min + Math.floor(zufall() * (BESETZUNG_PERSONEN.max - BESETZUNG_PERSONEN.min + 1))
    const personen = Array.from({ length: zahl }, () => ({ vorname: waehle(zufall() < 0.5 ? VORNAMEN_W : VORNAMEN_M, zufall), nachname: nachname() }))
    e = setzeName(e, parcoursId, typeId, besetzungsText(personen))
  }
  return e
}

/**
 * Beispiel-Boote (Wunsch des Nutzers vom 19.11.2026): ein erfundener Bootsname (src/data/boote.ts)
 * für jede genannte Klasse, kein Name doppelt, solange der Vorrat reicht – so sieht man im Kopf
 * der Ausgleichsgewichte, welche Klasse welches Boot fährt. Ersetzt die Angaben dieser Klassen
 * (gefragt hat vorher die Oberfläche); die übrigen bleiben.
 */
export function beispielBoote(boote: Besetzung, klassen: readonly ClassId[], zufall: Zufall): Besetzung {
  let vorrat: string[] = []
  const neu: Besetzung = { ...boote }
  for (const klasse of klassen) {
    if (vorrat.length === 0) vorrat = mische(BOOTSNAMEN, zufall)
    neu[klasse] = vorrat.pop()!
  }
  return neu
}

/**
 * Beispiel-Co-Piloten (Wunsch des Nutzers vom 19.11.2026): eine erfundene Person aus src/data
 * für jede genannte Klasse – eine je Klasse, denn „within the same class is to be the same
 * co-driver“ (UIM 960 Pkt. 2). Kein Nachname doppelt, solange der Vorrat reicht. Welche Klassen,
 * entscheidet der Aufrufer (die, in denen das Regelwerk einen Co-Piloten vorsieht); ersetzt
 * deren Angaben, die übrigen bleiben.
 */
export function beispielCoPiloten(coPiloten: Besetzung, klassen: readonly ClassId[], zufall: Zufall): Besetzung {
  let vorrat: string[] = []
  const neu: Besetzung = { ...coPiloten }
  for (const klasse of klassen) {
    if (vorrat.length === 0) vorrat = mische(NACHNAMEN, zufall)
    neu[klasse] = `${waehle(zufall() < 0.5 ? VORNAMEN_W : VORNAMEN_M, zufall)} ${vorrat.pop()!}`
  }
  return neu
}

/**
 * Anteil der Starter einer Klasse, die leichter sind als ihr Durchschnittsgewicht – sie bekommen
 * ein Ausgleichsgewicht. Etwas weniger als die Hälfte, damit die Liste der Ausgleichsgewichte
 * beides zeigt.
 */
export const ANTEIL_LEICHTER = 0.4

/**
 * Glaubhafte Gewichte für alle Starter: je Klasse um ihr Durchschnittsgewicht (`soll`: das des
 * Regelwerks oder das abweichende der Veranstaltung, config/catalog.ts `sollgewichtOf`). Ein Teil
 * ({@link ANTEIL_LEICHTER}, ab zwei Startern mindestens einer) ist leichter – mindestens 1 kg,
 * damit ein Ausgleichsgewicht entsteht –, die übrigen wiegen das Durchschnittsgewicht oder mehr.
 * Auf 0,1 kg wie die Eingabe in der Verwiegung (domain/gewicht.ts `parseGewicht`). Starter einer
 * Klasse ohne Durchschnittsgewicht bleiben, wie sie sind. Die übrigen Felder bleiben unverändert.
 */
export function beispielGewichte(starters: readonly Starter[], soll: (klasse: ClassId) => number, zufall: Zufall): Starter[] {
  const neu = new Map<string, number>()
  const klassen = [...new Set(starters.map((p) => p.klasse))]
  for (const klasse of klassen) {
    const kg = soll(klasse)
    if (!(kg > 0)) continue
    const ids = mische(starters.filter((p) => p.klasse === klasse).map((p) => p.id), zufall)
    const leichter = ids.length === 1 ? (zufall() < ANTEIL_LEICHTER ? 1 : 0) : Math.max(1, Math.round(ids.length * ANTEIL_LEICHTER))
    ids.forEach((id, i) => {
      // Leichter: 1 kg bis gut 15 % darunter; sonst bis 25 % darüber – Erwachsene streuen nach oben mehr.
      const wert = i < leichter ? kg - 1 - zufall() * kg * 0.15 : kg + zufall() * kg * 0.25
      const gewicht = parseGewicht(wert.toFixed(1))
      if (gewicht !== undefined) neu.set(id, gewicht)
    })
  }
  return starters.map((p) => (neu.has(p.id) ? { ...p, gewicht: neu.get(p.id)! } : p))
}
