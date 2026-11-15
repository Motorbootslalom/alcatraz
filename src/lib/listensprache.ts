import { computed, type ComputedRef } from 'vue'
import { texteIn, type Locale } from '../i18n'
import { useStore } from '../state/store'
import { REGELWERK_INFOS, resolveRegelwerkId } from '../config/konfig'
import type { AppState, Sprache } from '../types'

// Die Sprache der gedruckten Listen – an EINER Stelle. Wer die Listensprache braucht, fragt
// hier und nicht `locale`: Die Sprache der Oberfläche gehört zum Gerät, die der Listen zur
// Veranstaltung.
//
// Es gibt zwei Arten von Listen, und für jede eine Antwort:
//
// - Alle Listen außer den Wettkampfrichter-Bögen (Starter-, Gewichts-, Vorsteg- und
//   Ergebnislisten, Laufzettel, Aushang der Codes) stehen in der Sprache des Regelwerks:
//   DM deutsch, UIM englisch. Der Aushang gehört zur Ausschreibung – er darf nicht davon
//   abhängen, in welcher Sprache gerade jemand das Programm bedient. Die Sprache steht im
//   YAML des Regelwerks (`listenSprache`), nicht hier: `regelwerkSprache`, `listenLocale`.
// - Die Wettkampfrichter-Bögen haben ihre Sprache je Liste (`wkrSprachen` im Stand): Am Steg
//   sitzt, wer da ist – die eine Position braucht den Bogen deutsch, die andere englisch,
//   eine dritte zweisprachig. Ohne Wahl gilt die Sprache des Regelwerks: `wkrSpracheFuer`.
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

/** Die Sprache des Bogens einer Liste (auch zweisprachig). */
export function wkrSpracheFuer(stand: Pick<AppState, 'regelwerk'> & Partial<Pick<AppState, 'wkrSprachen'>>, typeId: string): Sprache {
  const vorgabe = regelwerkSprache(stand.regelwerk)
  if (!bietetEnglisch(stand.regelwerk)) return vorgabe
  const wahl = stand.wkrSprachen ?? {}
  // Nur eigene Einträge: „constructor“ o. Ä. als Kennung träfe sonst das Objekt-Urbild.
  return Object.prototype.hasOwnProperty.call(wahl, typeId) ? wahl[typeId] : vorgabe
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
  /** Die Sprache des Bogens einer Liste – reaktiv, wenn in `computed` oder Vorlage gelesen. */
  const wkrSprache = (typeId: string): Sprache => wkrSpracheFuer(state.value, typeId)
  return { waehlbar, listenLocale, wkrSprache, ...texteIn(() => listenLocale.value) }
}
