import type { AppState, BereichId, PunktId, StartRef, Starter } from '../types'
import type { Konfig } from '../config/konfig'
import { bereicheZumStand, istParallel, laeufeVonPunkt, laufPunkt, PARALLEL_BEREICH, punktVonLauf, rundenPunkt } from '../betrieb/folge'
import { veranstaltungsListen } from '../lib/listen'
import { parallelListen } from '../lib/parallelBogen'
import { attemptSchluessel, RACECOURSE_PARCOURS, RACECOURSES, type Racecourse } from '../lib/parallelSchluessel'
import type { WkrBogen } from '../lib/wkrListen'
import { istHaken, laufSchluessel, listenLauf, teilHaken, type ListenTeil } from '../lib/eingaben'
import { WKR_ANNAHMEN, type ListenTeile } from './annahmen'

// Welche Listen ein WKR-Gerät erfassen kann und wie sie heißen – rein, ohne DOM, ohne Store, nichts aus geraete/.
// Eine Liste ist eine Position (typeId) in einem Bereich des Betriebs (Parcours der Verzahnung bzw. `parallel`), im
// Parallelslalom dazu der Racecourse. Ihre Kennung ist gebaut wie `refKey` (betrieb/folge.ts): ein JSON-Array, ohne
// Annahmen über die Form der IDs.

export { istHaken, teilHaken }
export type { ListenTeil }

/** Kennung einer Liste: `JSON.stringify(['l', bereich, typeId, racecourse | null])`. */
export type ListenKennung = string

export interface Liste {
  bereich: BereichId
  typeId: string
  /** Im Parallelslalom der Racecourse; sonst `null`. */
  racecourse: Racecourse | null
}

export function listenKennung(liste: Liste): ListenKennung {
  return JSON.stringify(['l', liste.bereich, liste.typeId, liste.racecourse ?? null])
}

const text = (x: unknown): x is string => typeof x === 'string' && x !== ''

/** Die Liste zu einer Kennung; `null`, wenn sie nicht von `listenKennung` stammen kann. */
export function liesListe(kennung: unknown): Liste | null {
  if (typeof kennung !== 'string') return null
  let teile: unknown
  try {
    teile = JSON.parse(kennung)
  } catch {
    return null
  }
  if (!Array.isArray(teile) || teile.length !== 4 || teile[0] !== 'l' || !text(teile[1]) || !text(teile[2])) return null
  const rc = teile[3]
  if (rc !== null && !(RACECOURSES as readonly unknown[]).includes(rc)) return null
  // Racecourse genau dann, wenn der Bereich der Parallelslalom ist.
  if ((rc === null) === istParallel(teile[1])) return null
  return { bereich: teile[1], typeId: teile[2], racecourse: rc as Racecourse | null }
}

/**
 * Die Listen der Veranstaltung, die ein Gerät erfassen kann: je Bereich des Betriebs (betrieb/folge.ts
 * `bereicheZumStand`) die Listen der Veranstaltung (lib/listen.ts), im Parallelslalom je Liste Racecourse A und B
 * (lib/parallelBogen.ts). Ohne Listen ohne Lauf – Knoten erst mit W5 (WKR_ANNAHMEN.listenOhneLaufErstW5).
 */
export function listenDerVeranstaltung(stand: AppState, konfig: Konfig): Liste[] {
  const mitLauf = (typeId: string) => konfig.getSheetDef(typeId).showLauf !== false || !WKR_ANNAHMEN.listenOhneLaufErstW5
  const out: Liste[] = []
  for (const b of bereicheZumStand(stand)) {
    if (b.art === 'parallel') {
      for (const typeId of parallelListen(konfig).filter(mitLauf)) for (const racecourse of RACECOURSES) out.push({ bereich: b.id, typeId, racecourse })
    } else {
      for (const typeId of veranstaltungsListen(konfig, stand).filter(mitLauf)) out.push({ bereich: b.id, typeId, racecourse: null })
    }
  }
  return out
}

/**
 * Die Liste eines Bogens der Erfassung (W2: Marken „Papier ansehen“, ◆): Manövrieren = Parcours des Bogens und Position,
 * Parallelslalom = Bereich `parallel` mit dem Racecourse (aus der Runde des Bogens, sonst rückwärts über
 * RACECOURSE_PARCOURS). `null` für Bögen ohne Liste der WKR-Erfassung: Knoten und andere Listen ohne Lauf (W5) und
 * Positionen, die das Regelwerk nicht kennt.
 */
export function listeVonBogen(bogen: Pick<WkrBogen, 'parcoursId' | 'typeId' | 'runde'>, konfig: Konfig): Liste | null {
  if (!konfig.getPositions().some((p) => p.typeId === bogen.typeId)) return null
  if (konfig.getSheetDef(bogen.typeId).showLauf === false && WKR_ANNAHMEN.listenOhneLaufErstW5) return null
  const racecourse = bogen.runde?.racecourse ?? RACECOURSES.find((rc) => RACECOURSE_PARCOURS[rc] === bogen.parcoursId) ?? null
  if (racecourse !== null) return { bereich: PARALLEL_BEREICH, typeId: bogen.typeId, racecourse }
  return { bereich: bogen.parcoursId, typeId: bogen.typeId, racecourse: null }
}

/** Die Teile einer Liste (Steg: Ablegen/Anlegen); `undefined`, wenn sie nicht geteilt wird. */
export function teileVon(typeId: string): ListenTeile | undefined {
  return Object.hasOwn(WKR_ANNAHMEN.teile, typeId) ? WKR_ANNAHMEN.teile[typeId] : undefined
}

/**
 * Zu welchem Teil eine Spalte (Spalten-Key, `Feld.zelle` ohne „#n“) gehört: `ab`, `an`, `gemeinsam` – oder
 * `undefined`, wenn die Liste keine Teile hat oder die Spalte keinem zugeordnet ist.
 */
export function teilVonZelle(typeId: string, zelle: string): ListenTeil | 'gemeinsam' | undefined {
  const teile = teileVon(typeId)
  if (!teile) return undefined
  const spalte = zelle.split('#')[0]
  if (teile.ab.includes(spalte)) return 'ab'
  if (teile.an.includes(spalte)) return 'an'
  if (teile.gemeinsam.includes(spalte)) return 'gemeinsam'
  return undefined
}

/** Ein Start, wie er auf einer Liste steht: wer dort fährt und unter welchem Lauf-Schlüssel die Werte liegen. */
export interface StartAufListe {
  starter: Starter
  /** Lauf-Schlüssel der Werte (Vorsteg mit „Versuche nacheinander“: der erste Versuch). */
  lauf: string
  /** Weitere Lauf-Schlüssel, in die dieselben Werte gehen (nur Vorsteg mit „Versuche nacheinander“). */
  weitere: string[]
  punkt: PunktId
}

/**
 * Wer bei einem Start auf dieser Liste steht und wo seine Werte liegen. Manövrieren: der Starter des Starts, der Lauf
 * (Vorsteg mit „Versuche direkt nacheinander“: alle Versuche, WKR_ANNAHMEN.vorstegAlleVersuche). Parallelslalom: der
 * Starter der eigenen Seite laut festem Plan (Kennung aus `fest.starts`), der Attempt der Runde. `null`, wenn der
 * Start nicht zur Art des Bereichs passt, die eigene Seite leer ist, es den Starter oder die Liste im Regelwerk nicht
 * (mehr) gibt. Ob der Start im Bereich vorkommt und ob die Klasse die Liste hat, prüft der Aufrufer.
 */
export function startAufListe(stand: AppState, konfig: Konfig, liste: Liste, ref: StartRef): StartAufListe | null {
  // Eine Liste, die das Regelwerk nicht kennt, hat keine Starts (getSheetDef würfe).
  if (!konfig.getPositions().some((p) => p.typeId === liste.typeId)) return null
  const nachId = (id: string | null) => (id === null ? undefined : stand.starters.find((s) => s.id === id))
  if (ref.art === 'p') {
    if (!istParallel(liste.bereich) || liste.racecourse === null) return null
    const starter = nachId(liste.racecourse === 'A' ? ref.a : ref.b)
    return starter ? { starter, lauf: attemptSchluessel(ref.runde, ref.attempt), weitere: [], punkt: rundenPunkt(ref.runde) } : null
  }
  if (istParallel(liste.bereich) || liste.racecourse !== null) return null
  const starter = nachId(ref.starter)
  if (!starter) return null
  const def = konfig.getSheetDef(liste.typeId)
  const disziplin = konfig.getAufbau(stand.aufbau).disziplin
  const punkt = punktVonLauf(stand, ref.lauf)
  const versuche = laeufeVonPunkt(stand, laufPunkt(1))
  if (def.einmalJeStarter === true && versuche.length > 1 && WKR_ANNAHMEN.vorstegAlleVersuche) {
    const [erster, ...weitere] = versuche.map((l) => laufSchluessel(disziplin, l))
    return { starter, lauf: erster, weitere, punkt }
  }
  return { starter, lauf: laufSchluessel(disziplin, listenLauf(def, ref.lauf)), weitere: [], punkt }
}
