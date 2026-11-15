import { computed, reactive } from 'vue'
import { useStore } from '../state/store'
import { useKonfig } from './konfig'
import { useEvent } from './event'
import { pokalRegeln, type PokalVariante } from '../config/pokal'
import { plaetzeWertung, pokalKlassen, pokalZuordnung, uimWertung, type PokalStich } from './pokal'
import { einzelPokalKlassen, einzelwertungen, kenntEinzelwertung } from './einzelwertung'
import { disziplinGefahren, gestricheneKlassen, nichtGewertet as klasseNichtGewertet, WERTUNGS_DISZIPLINEN } from './disziplinen'
import { merke } from './merken'
import type { MessageKey } from '../i18n'
import type { ClassId, ErgebnisFassung, OriginStyle, ParallelRunde, WertungsDisziplin } from '../types'

/**
 * Was im Reiter „Mannschaftswertung“ gewählt ist. Die Herkunft steht ausgeschrieben da, solange
 * nichts anderes gewählt ist: Sie ist hier der Gegenstand der Liste, und ein Kürzel sagt
 * Außenstehenden wenig. Die Wahl gehört zur Ansicht, nicht zur Veranstaltung (wie Reihenfolge
 * und Abstand der Wertungslisten). Die Druckdatei liest daraus, wie die Herkunft auf ihren
 * Mannschaftswertungen steht – dort soll dasselbe Blatt liegen wie im Reiter.
 */
export const pokalWahl = () => merke<{ variante?: PokalVariante; fassung: ErgebnisFassung; herkunft: OriginStyle }>('listen.pokal', { fassung: 'aushang', herkunft: 'lang' }, { ueberNeuladen: true })

/**
 * Der Stichentscheid der Mannschaftswertung in Worten („Bei gleicher Punktzahl entscheidet die
 * Anzahl der 1. Plätze, dann der 2. und 3. Plätze.“) – für das Blatt (in der Listensprache) und
 * die Einstellungen (in der Sprache der Oberfläche); `t` ist der Übersetzer der jeweiligen.
 */
export function pokalStichText(stich: PokalStich, t: (key: MessageKey, params?: object) => string): string {
  const bis = stich.plaetze
  const then = bis === undefined ? t('cup.tie.then.all') : bis <= 1 ? '' : bis === 2 ? t('cup.tie.then.second') : bis === 3 ? t('cup.tie.then.third') : t('cup.tie.then.upTo', { n: bis })
  return t('cup.tie.rule', { what: t(`cup.tie.what.${stich.zaehlt}`), then })
}

/**
 * Die Mannschaftswertungen (im Code „pokal“) zum Stand der Veranstaltung, reaktiv: welche
 * Varianten eingeschaltet sind, die Wertung jeder gezeigten und was noch fehlt. Gerechnet wird
 * in lib/pokal.ts; hier steht, was der Reiter „Mannschaftswertung“ (components/PokalListen.vue)
 * und die Druckdatei (components/DruckdateiListen.vue) gleichermaßen brauchen. Die Blätter
 * zeichnet components/PokalStapel.vue aus dem, was hier herauskommt.
 *
 * `nur`: die Variante, auf die die Auswahl beschränkt ist; `undefined` = alle eingeschalteten.
 * Eine, die es nicht (mehr) gibt, gilt als „alle“.
 *
 * Zwei Grundlagen: Die Wertungen nach Plätzen lesen immer die Gesamtlisten des Manövrierens
 * (`klassen`). Die Wertung nach UIM-Punkten liest sie ebenfalls – außer unter Regel 960, sobald
 * der Parallelslalom gefahren wird oder eine Disziplin per Schalter nicht gewertet wird
 * (lib/disziplinen.ts): Dann zählen je Starter die Punkte der Einzelwertung, also die addierten
 * Punkte der Disziplinen, die für seine Klasse zählen (Pkt. 5.1, 5.2.4 „overall individual
 * competitions“), und `ausEinzel` ist gesetzt. Das gilt in jeder Reihenfolge der Disziplinen –
 * auch nur mit dem Parallelslalom. Nur mit dem Manövrieren und unter der DM bleibt alles, wie
 * es war; unter Regel 960 gibt es die Punkte des Manövrierens erst mit den Knoten.
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

  /** Regel 960: Es gibt die Einzelwertung aus zwei Disziplinen (unter der DM nicht). */
  const uimRegel = computed(() => kenntEinzelwertung(konfig.value))
  /** Die gefahrenen Disziplinen (erster Wert erfasst) – unter der DM immer nur das Manövrieren. */
  const gefahren = computed<WertungsDisziplin[]>(() => (uimRegel.value ? WERTUNGS_DISZIPLINEN.filter((d) => disziplinGefahren(state.value, d)) : ['manoever']))
  /** „Disziplin nicht werten“ je Disziplin mit ihren Klassen – nur gefahrene Disziplinen, nur unter Regel 960. */
  const gestrichen = computed(() =>
    uimRegel.value
      ? gestricheneKlassen(
          state.value.nichtWerten,
          classes.value.map((c) => c.id),
        ).filter((g) => gefahren.value.includes(g.disziplin))
      : [],
  )
  const klassen = computed(() =>
    pokalKlassen(
      state.value,
      konfig.value,
      classes.value.map((c) => c.id),
      { knoten: uimRegel.value },
    ).map((k) =>
      // Wird das Manövrieren für die Klasse nicht gewertet, trägt sie auch zu den Wertungen nach
      // Plätzen nichts bei – und hält sie nicht als „offen“ auf.
      uimRegel.value && klasseNichtGewertet(state.value.nichtWerten, 'manoever', k.klasse) ? { ...k, fertig: true, zeilen: k.zeilen.map((z) => ({ ...z, platz: 0, disq: false, offen: true })) } : k,
    ),
  )
  /** Die Mannschaftswertung UIM rechnet aus der Einzelwertung (statt allein aus der Gesamtliste des Manövrierens). */
  const ausEinzel = computed(() => uimRegel.value && (gefahren.value.includes('parallel') || gestrichen.value.length > 0))
  const einzel = computed(() =>
    ausEinzel.value
      ? einzelwertungen(
          state.value,
          konfig.value,
          classes.value.map((c) => c.id),
          regeln.value.punkte.uim,
        )
      : [],
  )
  /** Die Grundlage der Wertung nach UIM-Punkten: die Einzelwertung – oder, nur mit dem Manövrieren, dessen Gesamtlisten. */
  const klassenUim = computed(() => (ausEinzel.value ? einzelPokalKlassen(einzel.value) : klassen.value))
  /** Gibt es schon ein gewertetes Ergebnis? Vorher wäre jede Zeile der Auswertung leer. */
  const hatErgebnis = computed(() => [...klassen.value, ...(ausEinzel.value ? klassenUim.value : [])].some((k) => k.zeilen.some((z) => z.platz >= 1 && !z.offen)))
  const zuordnung = computed(() => pokalZuordnung(state.value, regeln.value.nurAuswahl))
  const plaetze = (v: 'plaetze3' | 'plaetze6') => plaetzeWertung(klassen.value, regeln.value.punkte[v], zuordnung.value, regeln.value.stich)
  const wertungen = computed(() => ({
    plaetze3: gezeigt.value.includes('plaetze3') ? plaetze('plaetze3') : undefined,
    plaetze6: gezeigt.value.includes('plaetze6') ? plaetze('plaetze6') : undefined,
    uim: gezeigt.value.includes('uim') ? uimWertung(klassenUim.value, { punkte: regeln.value.punkte.uim, beste: regeln.value.beste, mindestens: regeln.value.mindestens, stich: regeln.value.stich }, zuordnung.value) : undefined,
  }))
  /** Listen, auf denen etwas steht: Eine Variante ohne eine einzige Herkunft, die zählt, hat kein Blatt. */
  const blaetter = computed(() =>
    hatErgebnis.value ? gezeigt.value.filter((v) => (v === 'uim' ? (wertungen.value.uim?.gruppen.length ?? 0) > 0 : (wertungen.value[v]?.zeilen.length ?? 0) > 0)) : [],
  )

  /** Klassen ohne Endergebnis – solange es welche gibt, ist die Wertung ein Zwischenstand. */
  // Rechnet die Wertung nach UIM-Punkten aus der Einzelwertung und wird sie gezeigt, gehört dazu
  // jede Klasse, in der eine Disziplin, die zählt, noch läuft. Das Manövrieren allein hält nur
  // auf, wenn es gebraucht wird: von einer Wertung nach Plätzen – oder weil es die Grundlage ist.
  const offen = computed(() => {
    const uimOffen = new Set(ausEinzel.value && gezeigt.value.includes('uim') ? klassenUim.value.filter((k) => !k.fertig).map((k) => k.klasse) : [])
    const manoeverGebraucht = !ausEinzel.value || gezeigt.value.some((v) => v !== 'uim')
    return klassen.value.filter((k) => (manoeverGebraucht && !k.fertig) || uimOffen.has(k.klasse)).map((k) => k.klasse)
  })
  /**
   * Die Runde des Parallelslaloms, an der eine Klasse noch hängt, deren Manövrieren fertig ist
   * (oder nicht zählt) – nur, wenn aus der Einzelwertung gerechnet wird. Das Blatt nennt sie im
   * Hinweis zum Zwischenstand.
   */
  const offeneRunde = (k: ClassId): ParallelRunde | undefined => {
    const e = einzel.value.find((x) => x.klasse === k)
    return e && e.manoeverFertig && !e.parallelFertig ? (e.offeneRunde ?? 'pre') : undefined
  }
  // Im Zwischenstand zählt eine Klasse mit ihrer Gesamtliste, wie sie gerade steht – auch im
  // angefangenen Lauf (lib/pokal.ts). Der Hinweis auf dem Blatt nennt je offener Klasse, in
  // welchem Lauf sie steht und wie viele Starter schon einen Platz haben („1: 2/3 · 5/8“ = im
  // zweiten von drei Läufen, fünf von acht gefahren) – wer zwei Aushänge vergleicht, sieht
  // daran, worauf die Punkte beruhen.
  const offenText = (k: ClassId) => {
    const x = klassen.value.find((y) => y.klasse === k)
    const laeufe = `${klasseKurz(k)}: ${x?.laeufe.length ?? 0}/${Math.max(1, state.value.laufCount)}`
    return x && x.laeufe.length > 0 && x.gefahren < x.zeilen.length ? `${laeufe} · ${x.gefahren}/${x.zeilen.length}` : laeufe
  }
  const ohneHerkunftZahl = computed(() => klassen.value.reduce((n, k) => n + k.zeilen.filter((z) => !zuordnung.value.herkunft(z.starter)).length, 0))
  const abgewaehlt = computed(() => (regeln.value.nurAuswahl ? state.value.starters.filter((p) => p.pokal === false).length : 0))
  /** UIM: Herkünfte, die mangels Startern nicht gewertet werden. */
  const nichtGewertet = computed(() => wertungen.value.uim?.gruppen.filter((g) => g.platz === null).length ?? 0)

  return reactive({ regeln, ohneHerkunft, variante, gezeigt, klassen, uimRegel, gefahren, gestrichen, ausEinzel, offeneRunde, hatErgebnis, wertungen, blaetter, offen, offenText, ohneHerkunftZahl, abgewaehlt, nichtGewertet })
}
export type PokalWertung = ReturnType<typeof usePokalWertung>
