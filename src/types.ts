// Sammelpunkt der Typen: Sie stehen nach Bereichen in types/ und werden hier nur weitergereicht,
// damit jeder Import aus '…/types' bleibt. Welcher Typ wo steht:
//   types/zustand.ts        AppState
//   types/starter.ts        ClassId, Geschlecht, Starter, StartNrMode
//   types/planung.ts        Parcours, Spuren, Boote, laufende Nummern, PlanState; ParallelRunde, ParallelPlaene …
//   types/wertung.ts        Eingaben, Streichlaeufe, ListenStand, NichtWerten, PokalEinstellungen, Ergebnis…
//   types/einstellungen.ts  OriginMode, OriginStyle, EventKind, Einteilung, WkrSprachen, Besetzung, LaufzettelLayout,
//                           LogoSeite, LogoBild, Logos
//   types/bogen.ts          SheetDef, Column, CellKind, ErrorDef, DisqDef, Sprache, Geraet, TrennerDesign
//   types/betrieb.ts        BereichId, PunktId, StartRef, Meldung, BereichBetrieb, Betrieb, AnzeigeEinstellungen,
//                           OeffentlicheSicht (Sicht…)
// Die Teile enthalten nur Typen; der einzige Wert, SCHEMA_VERSION, bleibt hier.

export type * from './types/zustand'
export type * from './types/starter'
export type * from './types/planung'
export type * from './types/wertung'
export type * from './types/einstellungen'
export type * from './types/bogen'
export type * from './types/betrieb'

/** Aktuelle Fassung des gespeicherten Zustands, siehe state/migrate.ts. */
export const SCHEMA_VERSION = 1
