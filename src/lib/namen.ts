import type { AppState, ErgebnisFassung, ErgebnisNamen, Starter } from '../types'

// Namen auf Listen, die ausgehängt werden (Wertungslisten, Pokalauswertung nach UIM-Punkten).
// Die Regel steht einmal hier, damit eine Änderung am Datenschutz alle Listen trifft.

/** Wie Namen auf einem Blatt stehen: voll, Nachname gekürzt („M.“) oder gar nicht. */
export type NamenArt = ErgebnisNamen

/** Die Fassung „Aushang“ folgt den Einstellungen der Veranstaltung; „Intern“ zeigt immer volle Namen. */
export function namenDerFassung(fassung: ErgebnisFassung, stand: Pick<AppState, 'ergebnisListen'>): NamenArt {
  return fassung === 'aushang' ? stand.ergebnisListen.aushang.namen : 'voll'
}

/** Der Nachname, wie er auf dem Blatt steht: gekürzt auf den ersten Buchstaben („M.“), wenn verlangt. */
export function listenNachname(p: Pick<Starter, 'nachname'>, namen: NamenArt | undefined): string {
  return namen === 'kurz' && p.nachname.trim() ? `${[...p.nachname.trim()][0]}.` : p.nachname
}
