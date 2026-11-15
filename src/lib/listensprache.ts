import { computed, type ComputedRef } from 'vue'
import { texteIn, type Locale } from '../i18n'
import { useStore } from '../state/store'
import { REGELWERK_INFOS, resolveRegelwerkId } from '../config/konfig'
import type { KuerzelNorm } from '../domain/kuerzel'
import type { AppState, Sprache } from '../types'

// Die Sprache der gedruckten Listen – an EINER Stelle. Wer die Listensprache braucht, fragt
// hier und nicht `locale`: Die Sprache der Oberfläche gehört zum Gerät, die der Listen zur
// Veranstaltung.
//
// Es gibt zwei Arten von Listen, und für jede eine Antwort:
//
// - Alle Listen außer den Wettkampfrichter-Bögen (Starter-, Gewichts-, Vorsteg- und
//   Wertungslisten, Laufzettel, Aushang der Codes) stehen in der Sprache des Regelwerks:
//   DM deutsch, UIM englisch. Der Aushang gehört zur Ausschreibung – er darf nicht davon
//   abhängen, in welcher Sprache gerade jemand das Programm bedient. Die Sprache steht im
//   YAML des Regelwerks (`listenSprache`), nicht hier: `regelwerkSprache`, `listenLocale`.
// - Die Wettkampfrichter-Bögen haben ihre Sprache je Parcours und Liste (`wkrSprachen` im
//   Stand, gebaut wie die WKR-Einteilung): Am Steg sitzt, wer da ist – die eine Position braucht
//   den Bogen deutsch, die andere englisch, eine dritte zweisprachig –, und auf jedem Parcours
//   (im Parallelslalom auf jedem Racecourse) sitzt eine eigene Gruppe (Entscheidung des Nutzers
//   vom 15.11.2026). Ohne Wahl gilt die Sprache des Regelwerks: `wkrSpracheFuer`.
//
// Wählen lässt sich nur, wo das Regelwerk Englisch anbietet (`sprachen` im YAML): Die DM hat
// keine englischen Texte, dort bleiben alle Bögen deutsch. Die Wahl bleibt dabei im Stand und
// gilt wieder, sobald das Regelwerk wechselt.

const infoVon = (regelwerk: string) => {
  const id = resolveRegelwerkId(regelwerk)
  return REGELWERK_INFOS.find((r) => r.id === id)
}

/** Bietet das Regelwerk Englisch an? Nur dann lässt sich die Sprache der Bögen wählen. */
export function bietetEnglisch(regelwerk: string): boolean {
  return !!infoVon(regelwerk)?.sprachen.includes('en')
}

/** Die Sprache des Regelwerks: die aller Listen außer den Bögen, für diese die Vorgabe. */
export function regelwerkSprache(regelwerk: string): Locale {
  return infoVon(regelwerk)?.listenSprache ?? 'de'
}

/** Die Kürzel der Länder auf den Listen des Regelwerks (domain/kuerzel.ts `KuerzelNorm`). */
export function laenderKuerzelFuer(regelwerk: string): KuerzelNorm {
  return infoVon(regelwerk)?.laenderKuerzel ?? 'iso'
}

type SprachStand = Pick<AppState, 'regelwerk'> & Partial<Pick<AppState, 'wkrSprachen'>>

/** Nur eigene Einträge: „constructor“ o. Ä. als Kennung träfe sonst das Objekt-Urbild. */
const eigen = (objekt: object, schluessel: string) => Object.prototype.hasOwnProperty.call(objekt, schluessel)

/**
 * Die Sprache des Bogens einer Liste auf einem Parcours (im Parallelslalom: auf einem
 * Racecourse, lib/parallelSchluessel.ts `RACECOURSE_PARCOURS`), auch zweisprachig. Ohne
 * Parcours – eine Klasse, die noch auf keinem fährt – gilt die Sprache des Regelwerks.
 */
export function wkrSpracheFuer(stand: SprachStand, parcoursId: string | undefined, typeId: string): Sprache {
  const vorgabe = regelwerkSprache(stand.regelwerk)
  if (!bietetEnglisch(stand.regelwerk) || parcoursId === undefined) return vorgabe
  const wahl = stand.wkrSprachen ?? {}
  const liste = eigen(wahl, parcoursId) ? wahl[parcoursId] : undefined
  return liste && eigen(liste, typeId) ? liste[typeId] : vorgabe
}

/**
 * Die Sprache einer Liste über mehrere Parcours, für eine Auswahl, die sie zusammenfasst (z. B.
 * „Liste“ unter „Listen“): die ihrer Bögen, wenn alle Parcours dieselbe haben – sonst die des
 * Regelwerks, denn jede einzelne nannte nur einen Teil der Bögen richtig.
 */
export function wkrSpracheAller(stand: SprachStand, parcoursIds: readonly string[], typeId: string): Sprache {
  const sprachen = new Set(parcoursIds.map((p) => wkrSpracheFuer(stand, p, typeId)))
  return sprachen.size === 1 ? [...sprachen][0] : regelwerkSprache(stand.regelwerk)
}

/**
 * Die geltende Listensprache zum Stand der Veranstaltung, reaktiv. `t`, `tn`, `formatDate`
 * und `formatDateTime` sind die Funktionen aus src/i18n, an `listenLocale` gebunden: für
 * alles, was auf dem Blatt steht. Bedienelemente bleiben bei den Funktionen der Oberfläche.
 */
export function useListenSprache() {
  const { state } = useStore()
  /** Lässt sich die Sprache der Bögen wählen? */
  const waehlbar = computed(() => bietetEnglisch(state.value.regelwerk))
  const listenLocale: ComputedRef<Locale> = computed(() => regelwerkSprache(state.value.regelwerk))
  /** Die Kürzel der Länder auf den Listen: wie die Sprache eine Angabe des Regelwerks (UIM: IOC, Regel 209). */
  const kuerzelNorm: ComputedRef<KuerzelNorm> = computed(() => laenderKuerzelFuer(state.value.regelwerk))
  /** Die Sprache des Bogens einer Liste auf einem Parcours – reaktiv, wenn in `computed` oder Vorlage gelesen. */
  const wkrSprache = (parcoursId: string | undefined, typeId: string): Sprache => wkrSpracheFuer(state.value, parcoursId, typeId)
  return { waehlbar, listenLocale, kuerzelNorm, wkrSprache, ...texteIn(() => listenLocale.value) }
}
