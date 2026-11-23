import type { AppState, BereichId, StartRef, Starter, WkrPunkt } from '../types'
import type { Konfig } from '../config/konfig'
import { bereicheZumStand, istParallel, laeufeVonPunkt, laufPunkt, PARALLEL_BEREICH, punktVonLauf, rundenPunkt } from '../betrieb/folge'
import { veranstaltungsListen } from '../lib/listen'
import { parallelListen } from '../lib/parallelBogen'
import { attemptSchluessel, RACECOURSE_PARCOURS, RACECOURSES, type Racecourse } from '../lib/parallelSchluessel'
import type { WkrBogen } from '../lib/wkrListen'
import { istHaken, laufSchluessel, listenLauf, OHNE_LAUF, teilHaken, type ListenTeil } from '../lib/eingaben'
import { WKR_ANNAHMEN, type ListenTeile } from './annahmen'

// Welche Listen ein WKR-Gerät erfassen kann und wie sie heißen – rein, ohne DOM, ohne Store, nichts aus geraete/.
// Eine Liste ist eine Position (typeId) in einem Bereich des Betriebs (Parcours der Verzahnung bzw. `parallel`), im
// Parallelslalom dazu der Racecourse. Ihre Kennung ist gebaut wie `refKey` (betrieb/folge.ts): ein JSON-Array, ohne
// Annahmen über die Form der IDs.

export { istHaken, teilHaken }
export type { ListenTeil }

/**
 * Bereich der Listen ohne Lauf (Knoten, W5.3, 22.11.2026, WKR_ANNAHMEN KN1): eine Liste je Veranstaltung, abgenommen
 * am Tisch – kein Bereich des Betriebs (keine Folge, nichts gezeigt, keine Ampel, nie ein Rückstand).
 */
export const TISCH_BEREICH: BereichId = 'tisch'

/** Ist das eine Liste ohne Lauf (Bereich `tisch`)? */
export function istTischListe(liste: Pick<Liste, 'bereich'>): boolean {
  return liste.bereich === TISCH_BEREICH
}

/** Hat die Position keinen Lauf (YAML `lauf: false`, Knoten)? Unbekannte Positionen: nein. */
export function istOhneLauf(konfig: Pick<Konfig, 'getPositions' | 'getSheetDef'>, typeId: string): boolean {
  return konfig.getPositions().some((p) => p.typeId === typeId) && konfig.getSheetDef(typeId).showLauf === false
}

/**
 * Kennung eines Starts ohne Lauf (W5.3, KN2): der Starter selbst, `JSON.stringify(['o', starterId])` – gebaut wie
 * `refKey`, damit sie nie mit einer Kennung des Betriebs (`m`, `p`) zusammenfällt.
 */
export function ohneLaufKennung(starterId: string): string {
  return JSON.stringify(['o', starterId])
}

/** Die Starter-ID einer Kennung ohne Lauf; `null`, wenn sie keine ist. */
export function liesOhneLauf(kennung: unknown): string | null {
  if (typeof kennung !== 'string' || !kennung.startsWith('["o"')) return null
  try {
    const teile: unknown = JSON.parse(kennung)
    return Array.isArray(teile) && teile.length === 2 && teile[0] === 'o' && typeof teile[1] === 'string' && teile[1] !== '' ? teile[1] : null
  } catch {
    return null
  }
}

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
 * `bereicheZumStand`) die Listen MIT Lauf der Veranstaltung (lib/listen.ts), im Parallelslalom je Liste Racecourse A
 * und B (lib/parallelBogen.ts). Seit W5.3 (22.11.2026, KN1) dahinter je Liste OHNE Lauf (Knoten) eine im Bereich
 * `tisch` – einmal je Veranstaltung, auch ohne Bereich des Betriebs (Knoten nimmt man oft vor der Verzahnung ab).
 */
export function listenDerVeranstaltung(stand: AppState, konfig: Konfig): Liste[] {
  const mitLauf = (typeId: string) => konfig.getSheetDef(typeId).showLauf !== false
  const out: Liste[] = []
  for (const b of bereicheZumStand(stand)) {
    if (b.art === 'parallel') {
      for (const typeId of parallelListen(konfig).filter(mitLauf)) for (const racecourse of RACECOURSES) out.push({ bereich: b.id, typeId, racecourse })
    } else {
      for (const typeId of veranstaltungsListen(konfig, stand).filter(mitLauf)) out.push({ bereich: b.id, typeId, racecourse: null })
    }
  }
  if (!WKR_ANNAHMEN.listenOhneLaufErstW5) {
    for (const typeId of veranstaltungsListen(konfig, stand).filter((t) => !mitLauf(t))) out.push({ bereich: TISCH_BEREICH, typeId, racecourse: null })
  }
  return out
}

/**
 * Die Liste eines Bogens der Erfassung (W2: Marken „Papier ansehen“, ◆): Manövrieren = Parcours des Bogens und Position,
 * Parallelslalom = Bereich `parallel` mit dem Racecourse (aus der Runde des Bogens, sonst rückwärts über
 * RACECOURSE_PARCOURS). Knoten und andere Listen ohne Lauf: die Liste im Bereich `tisch` (seit W5.3, 22.11.2026).
 * `null` für Positionen, die das Regelwerk nicht kennt.
 */
export function listeVonBogen(bogen: Pick<WkrBogen, 'parcoursId' | 'typeId' | 'runde'>, konfig: Konfig): Liste | null {
  if (!konfig.getPositions().some((p) => p.typeId === bogen.typeId)) return null
  // Listen ohne Lauf (Knoten): EINE Liste am Tisch, gleich von welchem Parcours der Bogen ist (W5.3, KN1).
  if (konfig.getSheetDef(bogen.typeId).showLauf === false) return WKR_ANNAHMEN.listenOhneLaufErstW5 ? null : { bereich: TISCH_BEREICH, typeId: bogen.typeId, racecourse: null }
  const racecourse = bogen.runde?.racecourse ?? RACECOURSES.find((rc) => RACECOURSE_PARCOURS[rc] === bogen.parcoursId) ?? null
  if (racecourse !== null) return { bereich: PARALLEL_BEREICH, typeId: bogen.typeId, racecourse }
  return { bereich: bogen.parcoursId, typeId: bogen.typeId, racecourse: null }
}

/**
 * Ist die Liste eine Parcours-Liste (Nutzer 21.11.2026, P-03: „Die Freigabe bezieht sich immer auf den Parcours und nie
 * auf den Steg oder Vorsteg“)? Erkannt an den Feldern, nicht an der Kennung – wie maskeNachFeldarten, damit eigene
 * Aufbauten und neue Positionen von selbst richtig fallen (WKR_ANNAHMEN.parcoursListeAnFeldern, AM1): eine Liste mit
 * Lauf, nicht geteilt (Steg), nicht „einmal je Starter“ (Vorsteg) und mit mindestens einem Feld außer Summe. Reine
 * Zeit-Listen zählen mit (AM2, umgebaut 22.11.2026 R7-01: „Zeit … ist relevant für die Ampel“). Unbekannte Listen sind
 * keine.
 */
export function istParcoursListe(konfig: Pick<Konfig, 'getPositions' | 'getSheetDef'>, typeId: string): boolean {
  if (!konfig.getPositions().some((p) => p.typeId === typeId)) return false
  const def = konfig.getSheetDef(typeId)
  if (def.showLauf === false || def.einmalJeStarter === true || teileVon(typeId)) return false
  return def.columns.some((c) => c.kind !== 'sum' && (WKR_ANNAHMEN.zeitIstParcoursListe || c.kind !== 'time'))
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
  /** Punkt des Starts; `ohne` bei einer Liste ohne Lauf (W5.3). */
  punkt: WkrPunkt
}

/** Ein Start ohne Lauf (W5.3, KN2): der Starter selbst. */
export interface OhneLaufRef {
  art: 'o'
  starter: string
}

/** Die Kennung eines Starts auf einer WKR-Liste: des Betriebs (`refKey`) oder ohne Lauf. */
export function liesStartKennung(key: unknown, lies: (k: unknown) => StartRef | null): StartRef | OhneLaufRef | null {
  const ohne = liesOhneLauf(key)
  return ohne !== null ? { art: 'o', starter: ohne } : lies(key)
}

/**
 * Ein Starter auf einer Liste ohne Lauf (W5.3, KN2): nur auf einer Liste im Bereich `tisch`, deren Position keinen Lauf
 * hat; der Starter gibt es, seine Klasse hat die Liste und er ist nicht abgemeldet (WKR_ANNAHMEN.ohneLaufStartIstStarter).
 */
function startOhneLauf(stand: AppState, konfig: Konfig, liste: Liste, starterId: string): StartAufListe | null {
  if (!istTischListe(liste) || liste.racecourse !== null || !istOhneLauf(konfig, liste.typeId)) return null
  const starter = stand.starters.find((s) => s.id === starterId)
  if (!starter || !konfig.positionAllowsClass(liste.typeId, starter.klasse) || stand.abgemeldet.includes(starter.id)) return null
  const disziplin = konfig.getAufbau(stand.aufbau).disziplin
  return { starter, lauf: laufSchluessel(disziplin, OHNE_LAUF), weitere: [], punkt: 'ohne' }
}

/**
 * Der Bestand einer Liste ohne Lauf (W5.3, KN2/KN3): alle Starter, die sie abnehmen soll, in der Folge des Stands
 * (Starter-Reiter), mit Kennung. Leer für andere Listen.
 */
export function bestandOhneLauf(stand: AppState, konfig: Konfig, liste: Liste): { key: string; start: StartAufListe }[] {
  if (!istTischListe(liste)) return []
  return stand.starters.flatMap((s) => {
    const start = startOhneLauf(stand, konfig, liste, s.id)
    return start ? [{ key: ohneLaufKennung(s.id), start }] : []
  })
}

/**
 * Wer bei einem Start auf dieser Liste steht und wo seine Werte liegen. Manövrieren: der Starter des Starts, der Lauf
 * (Vorsteg mit „Versuche direkt nacheinander“: alle Versuche, WKR_ANNAHMEN.vorstegAlleVersuche). Parallelslalom: der
 * Starter der eigenen Seite laut festem Plan (Kennung aus `fest.starts`), der Attempt der Runde. `null`, wenn der
 * Start nicht zur Art des Bereichs passt, die eigene Seite leer ist, es den Starter oder die Liste im Regelwerk nicht
 * (mehr) gibt. Seit W5.3 (22.11.2026, KN2) auch ein Start ohne Lauf (`o`, nur auf der Liste am Tisch): Lauf-Schlüssel
 * `<disziplin>/0`, Punkt `ohne`, nur Klassen mit der Liste und nicht abgemeldet. Ob der Start im Bereich vorkommt und ob die Klasse die Liste hat, prüft der Aufrufer.
 */
export function startAufListe(stand: AppState, konfig: Konfig, liste: Liste, ref: StartRef | OhneLaufRef): StartAufListe | null {
  // Eine Liste, die das Regelwerk nicht kennt, hat keine Starts (getSheetDef würfe).
  if (!konfig.getPositions().some((p) => p.typeId === liste.typeId)) return null
  // Ohne Lauf (W5.3): nur Starts `o` auf der Liste am Tisch, und dort nur sie.
  if (ref.art === 'o') return startOhneLauf(stand, konfig, liste, ref.starter)
  if (istTischListe(liste)) return null
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
