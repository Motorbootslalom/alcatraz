import { computed, reactive } from 'vue'
import { useStore } from '../state/store'
import { useKonfig } from './konfig'
import { useEvent } from './event'
import { pokalRegeln, type PokalVariante } from '../config/pokal'
import { plaetzeWertung, pokalKlassen, pokalZuordnung, uimWertung } from './pokal'
import { merke } from './merken'
import type { ClassId, ErgebnisFassung, OriginStyle } from '../types'

/**
 * Was im Reiter „Mannschaftswertung“ gewählt ist. Die Herkunft steht ausgeschrieben da, solange
 * nichts anderes gewählt ist: Sie ist hier der Gegenstand der Liste, und ein Kürzel sagt
 * Außenstehenden wenig. Die Wahl gehört zur Ansicht, nicht zur Veranstaltung (wie Reihenfolge
 * und Abstand der Ergebnislisten). Die Druckdatei liest daraus, wie die Herkunft auf ihren
 * Mannschaftswertungen steht – dort soll dasselbe Blatt liegen wie im Reiter.
 */
export const pokalWahl = () => merke<{ variante?: PokalVariante; fassung: ErgebnisFassung; herkunft: OriginStyle }>('listen.pokal', { fassung: 'aushang', herkunft: 'lang' }, { ueberNeuladen: true })

/**
 * Die Mannschaftswertungen (im Code „pokal“) zum Stand der Veranstaltung, reaktiv: welche
 * Varianten eingeschaltet sind, die Wertung jeder gezeigten und was noch fehlt. Gerechnet wird
 * in lib/pokal.ts; hier steht, was der Reiter „Mannschaftswertung“ (components/PokalListen.vue)
 * und die Druckdatei (components/DruckdateiListen.vue) gleichermaßen brauchen. Die Blätter
 * zeichnet components/PokalStapel.vue aus dem, was hier herauskommt.
 *
 * `nur`: die Variante, auf die die Auswahl beschränkt ist; `undefined` = alle eingeschalteten.
 * Eine, die es nicht (mehr) gibt, gilt als „alle“.
 */
export function usePokalWertung(nur: () => PokalVariante | undefined = () => undefined) {
  const { state } = useStore()
  const konfig = useKonfig()
  const { classes, regelwerk } = useEvent()
  const klasseKurz = (k: ClassId) => regelwerk.value.klassenNamen[k] ?? k

  const regeln = computed(() => pokalRegeln(state.value))
  /** Ohne Herkunft gibt es keine Mannschaften. */
  const ohneHerkunft = computed(() => state.value.originMode === 'none')
  const variante = computed(() => {
    const v = nur()
    return v !== undefined && regeln.value.an.includes(v) ? v : undefined
  })
  const gezeigt = computed(() => (ohneHerkunft.value ? [] : regeln.value.an.filter((v) => variante.value === undefined || v === variante.value)))

  const klassen = computed(() =>
    pokalKlassen(
      state.value,
      konfig.value,
      classes.value.map((c) => c.id),
    ),
  )
  /** Gibt es schon ein gewertetes Ergebnis? Vorher wäre jede Zeile der Auswertung leer. */
  const hatErgebnis = computed(() => klassen.value.some((k) => k.zeilen.some((z) => z.platz >= 1 && !z.offen)))
  const zuordnung = computed(() => pokalZuordnung(state.value, regeln.value.nurAuswahl))
  const plaetze = (v: 'plaetze3' | 'plaetze6') => plaetzeWertung(klassen.value, regeln.value.punkte[v], zuordnung.value)
  const wertungen = computed(() => ({
    plaetze3: gezeigt.value.includes('plaetze3') ? plaetze('plaetze3') : undefined,
    plaetze6: gezeigt.value.includes('plaetze6') ? plaetze('plaetze6') : undefined,
    uim: gezeigt.value.includes('uim') ? uimWertung(klassen.value, { punkte: regeln.value.punkte.uim, beste: regeln.value.beste, mindestens: regeln.value.mindestens }, zuordnung.value) : undefined,
  }))
  /** Listen, auf denen etwas steht: Eine Variante ohne eine einzige Herkunft, die zählt, hat kein Blatt. */
  const blaetter = computed(() =>
    hatErgebnis.value ? gezeigt.value.filter((v) => (v === 'uim' ? (wertungen.value.uim?.gruppen.length ?? 0) > 0 : (wertungen.value[v]?.zeilen.length ?? 0) > 0)) : [],
  )

  /** Klassen ohne Endergebnis – solange es welche gibt, ist die Wertung ein Zwischenstand. */
  const offen = computed(() => klassen.value.filter((k) => !k.fertig).map((k) => k.klasse))
  // Im Zwischenstand zählt eine Klasse mit ihren vollständig gefahrenen Läufen (lib/pokal.ts).
  // Der Hinweis auf dem Blatt nennt je offener Klasse, wie viele das sind – wer zwei Aushänge
  // vergleicht, sieht daran, worauf die Punkte beruhen.
  const offenText = (k: ClassId) => `${klasseKurz(k)}: ${klassen.value.find((x) => x.klasse === k)?.laeufe.length ?? 0}/${Math.max(1, state.value.laufCount)}`
  const ohneHerkunftZahl = computed(() => klassen.value.reduce((n, k) => n + k.zeilen.filter((z) => !zuordnung.value.herkunft(z.starter)).length, 0))
  const abgewaehlt = computed(() => (regeln.value.nurAuswahl ? state.value.starters.filter((p) => p.pokal === false).length : 0))
  /** UIM: Herkünfte, die mangels Startern nicht gewertet werden. */
  const nichtGewertet = computed(() => wertungen.value.uim?.gruppen.filter((g) => g.platz === null).length ?? 0)

  return reactive({ regeln, ohneHerkunft, variante, gezeigt, klassen, hatErgebnis, wertungen, blaetter, offen, offenText, ohneHerkunftZahl, abgewaehlt, nichtGewertet })
}
export type PokalWertung = ReturnType<typeof usePokalWertung>
