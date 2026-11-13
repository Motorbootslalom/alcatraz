import { computed, type ComputedRef } from 'vue'
import { locale, texteIn, type Locale } from '../i18n'
import { useStore } from '../state/store'
import { REGELWERK_INFOS, resolveRegelwerkId } from '../config/konfig'
import type { ListenSprache, Sprache } from '../types'

// Die Sprache der gedruckten Listen – an EINER Stelle. Die Veranstaltung legt sie fest
// (`listenSprache` im Stand: wie die Oberfläche, deutsch, englisch oder zweisprachig); wer
// die Listensprache braucht, fragt hier und nicht `locale`.
//
// Es gibt zwei Arten von Listen, und für jede eine Antwort:
//
// - Die Wettkampfrichter-Bögen und der Aushang der Codes nehmen ihre Texte aus der
//   Konfiguration (config/sprache.ts). Sie können zweisprachig sein: `bogenSprache`.
// - Alle übrigen Listen (Starter-, Gewichts-, Vorsteg-, Ergebnislisten, Laufzettel) nehmen
//   ihre Texte aus src/i18n und haben genau eine Sprache: `listenLocale`. Zweisprachig hieße
//   dort doppelt so breite Spaltenköpfe in Tabellen, die schon jetzt jede Zeile brauchen
//   (Ergebnisliste Klasse 7: rund 30 Spalten). Bei „zweisprachig“ stehen sie deshalb in der
//   Sprache der Oberfläche – wer druckt, wählt sie mit einem Griff, und für den Aushang
//   lassen sich beide Fassungen nacheinander drucken.
//
// Wirksam wird die Wahl nur, wo das Regelwerk Englisch anbietet (config/build.ts): Nach den
// DM-Regeln bleiben die Bögen deutsch, und die übrigen Listen folgen wie bisher der
// Oberfläche. Die Wahl bleibt dabei im Stand und gilt wieder, sobald das Regelwerk wechselt.

/** Die Listensprache zu einer Sprache der Oberfläche. */
export function listenSpracheVon(oberflaeche: Locale): Sprache {
  return oberflaeche === 'en' ? 'en' : 'de'
}

/** Bietet das Regelwerk Englisch an? Nur dann lässt sich die Listensprache wählen. */
export function bietetEnglisch(regelwerk: string): boolean {
  const id = resolveRegelwerkId(regelwerk)
  return !!REGELWERK_INFOS.find((r) => r.id === id)?.sprachen.includes('en')
}

/** Sprache der Bögen und des Aushangs der Codes (auch zweisprachig). */
export function bogenSpracheFuer(wahl: ListenSprache, oberflaeche: Locale, englisch: boolean): Sprache {
  if (!englisch) return 'de'
  return wahl === 'ui' ? listenSpracheVon(oberflaeche) : wahl
}

/** Sprache der Listen aus src/i18n: immer genau eine (siehe oben). */
export function listenLocaleFuer(wahl: ListenSprache, oberflaeche: Locale, englisch: boolean): Locale {
  return englisch && (wahl === 'de' || wahl === 'en') ? wahl : oberflaeche
}

/**
 * Die geltende Listensprache zum Stand der Veranstaltung, reaktiv. `t`, `tn`, `formatDate`
 * und `formatDateTime` sind die Funktionen aus src/i18n, an `listenLocale` gebunden: für
 * alles, was auf dem Blatt steht. Bedienelemente bleiben bei den Funktionen der Oberfläche.
 */
export function useListenSprache() {
  const { state } = useStore()
  const waehlbar = computed(() => bietetEnglisch(state.value.regelwerk))
  const bogenSprache: ComputedRef<Sprache> = computed(() => bogenSpracheFuer(state.value.listenSprache, locale.value, waehlbar.value))
  const listenLocale: ComputedRef<Locale> = computed(() => listenLocaleFuer(state.value.listenSprache, locale.value, waehlbar.value))
  return { waehlbar, bogenSprache, listenLocale, ...texteIn(() => listenLocale.value) }
}
