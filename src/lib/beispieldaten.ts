import type { Besetzung, ClassId, CoPiloten, Einteilung, Starter } from '../types'
import { NACHNAMEN, VORNAMEN_M, VORNAMEN_W } from '../data/names'
import { BOOTSNAMEN } from '../data/boote'
import { AUSGLEICH_STUFE_VORGABE, ausgleichKg, parseGewicht } from '../domain/gewicht'
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
 * Gewichte der Beispiel-Co-Piloten in kg (R11-07, 26.11.2026): Erwachsene – ein Co-Pilot ist nach DM-Reglement C3
 * mindestens 16 Jahre alt. Die Spanne ist so breit, dass zwischen Co-Pilot und Ersatz meist ein Ausgleichsgewicht
 * entsteht, das man auf der Liste sieht.
 */
export const BEISPIEL_CO_PILOT_KG = { min: 55, max: 95 } as const

/**
 * Beispiel-Co-Piloten (Wunsch des Nutzers vom 19.11.2026): je genannter Klasse eine erfundene Person aus src/data
 * als Co-Pilot und seit 26.11.2026 (R11-07) eine als Ersatz-Co-Pilot, beide mit einem erfundenen Gewicht
 * ({@link BEISPIEL_CO_PILOT_KG}, auf 0,1 kg wie in der Verwiegung) – so zeigen die Ausgleichsgewichte beide
 * untereinander, mit Ausgleichsgewicht in Klammern. Kein Nachname doppelt, solange der Vorrat reicht. Welche
 * Klassen, entscheidet der Aufrufer (die, in denen das Regelwerk einen Co-Piloten vorsieht); ersetzt deren Angaben
 * ganz, die übrigen bleiben.
 */
export function beispielCoPiloten(coPiloten: CoPiloten, klassen: readonly ClassId[], zufall: Zufall): CoPiloten {
  let vorrat: string[] = []
  const neu: CoPiloten = { ...coPiloten }
  const person = () => {
    if (vorrat.length === 0) vorrat = mische(NACHNAMEN, zufall)
    const name = `${waehle(zufall() < 0.5 ? VORNAMEN_W : VORNAMEN_M, zufall)} ${vorrat.pop()!}`
    const gewicht = Math.round((BEISPIEL_CO_PILOT_KG.min + zufall() * (BEISPIEL_CO_PILOT_KG.max - BEISPIEL_CO_PILOT_KG.min)) * 10) / 10
    return { name, gewicht }
  }
  for (const klasse of klassen) neu[klasse] = { haupt: person(), ersatz: person() }
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
 * ({@link ANTEIL_LEICHTER}, ab zwei Startern mindestens einer) ist leichter – mindestens 1 kg und
 * mindestens eine halbe `stufe` (die Abstufung des Ausgleichsgewichts, 24.11.2026; genau die
 * Mitte rundet aufwärts), damit nach der Rundung wirklich ein Ausgleichsgewicht entsteht –, die übrigen
 * wiegen das Durchschnittsgewicht oder mehr. Auf 0,1 kg wie die Eingabe in der Verwiegung
 * (domain/gewicht.ts `parseGewicht`). Starter einer Klasse ohne Durchschnittsgewicht bleiben, wie sie
 * sind. Die übrigen Felder bleiben unverändert. Mit der Vorgabe-Stufe (1 kg) dieselben Gewichte wie vorher.
 */
export function beispielGewichte(starters: readonly Starter[], soll: (klasse: ClassId) => number, zufall: Zufall, stufe: number = AUSGLEICH_STUFE_VORGABE): Starter[] {
  const neu = new Map<string, number>()
  const mindestens = Math.max(1, stufe / 2)
  const klassen = [...new Set(starters.map((p) => p.klasse))]
  for (const klasse of klassen) {
    const kg = soll(klasse)
    if (!(kg > 0)) continue
    const ids = mische(starters.filter((p) => p.klasse === klasse).map((p) => p.id), zufall)
    const leichter = ids.length === 1 ? (zufall() < ANTEIL_LEICHTER ? 1 : 0) : Math.max(1, Math.round(ids.length * ANTEIL_LEICHTER))
    ids.forEach((id, i) => {
      // Leichter: 1 kg (bzw. eine halbe Stufe) bis gut 15 % darunter; sonst bis 25 % darüber – Erwachsene streuen
      // nach oben mehr.
      const wert = i < leichter ? kg - mindestens - zufall() * kg * 0.15 : kg + zufall() * kg * 0.25
      let gewicht = parseGewicht(wert.toFixed(1))
      // toFixed rundet zum nächsten 0,1 kg – bei einer Stufe mit Hundertsteln (0,25 kg → Mitte 0,125) oder einem
      // Durchschnittsgewicht mit zwei Nachkommastellen kann das über die Mitte der Stufe heben und das
      // Ausgleichsgewicht auf 0 runden. Dann 0,1 kg weniger (mehr als die 0,05 kg, die toFixed verschoben hat).
      if (i < leichter && gewicht !== undefined && !((ausgleichKg(gewicht, kg, stufe) ?? 0) > 0)) gewicht = parseGewicht((gewicht - 0.1).toFixed(1))
      if (gewicht !== undefined) neu.set(id, gewicht)
    })
  }
  return starters.map((p) => (neu.has(p.id) ? { ...p, gewicht: neu.get(p.id)! } : p))
}
