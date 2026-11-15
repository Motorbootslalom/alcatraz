import { computed, inject, nextTick, onBeforeUnmount, onMounted, onUpdated, provide, ref, watch, type ComputedRef, type InjectionKey, type Ref } from 'vue'

// Doppelseitig drucken (Schalter neben dem Druckknopf, views/ListsView.vue): Stehen mehrere
// Dokumente in einem Druck – Starterlisten „alle“, Gewichtslisten je Herkunft, Wertungslisten,
// Mannschaftswertung, Druckdatei –, soll jedes auf einem neuen BLATT beginnen. Nach einem
// Dokument mit ungerader Seitenzahl folgt deshalb eine leere Seite (components/
// LeereRueckseite.vue), sonst stünde die erste Seite des nächsten auf der Rückseite des
// vorigen. Nach dem letzten Dokument des Drucks folgt keine.
//
// Die leere Seite gehört zu keinem Dokument: Sie zählt in dessen Seitenzählung nicht mit und
// trägt nichts (kein Kopf, keine Seitenzahl, kein Zeit-Feld). Sie hat das Format des Dokuments
// davor, weil sie dessen Seitenart erbt.
//
// Welches Dokument das letzte ist, weiß keines von sich aus – sie stehen in verschiedenen
// Komponenten (in der Druckdatei vier Arten hintereinander). Deshalb sieht jedes im DOM nach:
// Jede gedruckte Seite trägt `data-druckseite`; das Dokument, dem die letzte davon gehört, ist
// das letzte. Nachgesehen wird, wenn sich an den Dokumenten etwas ändert (`folge`): Jedes
// meldet, wenn es kommt und geht, und solange der Schalter an ist, meldet ein Beobachter jede
// Änderung am DOM (eine andere Reihenfolge der Listen tauscht nur Elemente).

/** Dieses Attribut trägt jede gedruckte Seite eines Dokuments – die leeren Rückseiten nicht. */
export const DRUCKSEITE = 'data-druckseite'

interface Kontext {
  /** Der Schalter „doppelseitig drucken“ für die gezeigte Listenart. */
  an: Readonly<Ref<boolean>>
  /** Zählt hoch, wenn sich an den Dokumenten des Drucks etwas geändert haben kann. */
  folge: Ref<number>
}
const SCHLUESSEL: InjectionKey<Kontext> = Symbol('doppelseitig')

/** In der Ansicht mit dem Druckknopf: gibt den Schalter an alle Dokumente darunter weiter. */
export function gibDoppelseitig(an: Readonly<Ref<boolean>>): void {
  const folge = ref(0)
  provide(SCHLUESSEL, { an, folge })
  let beobachter: MutationObserver | undefined
  const stopp = () => {
    beobachter?.disconnect()
    beobachter = undefined
  }
  watch(
    an,
    (ein) => {
      stopp()
      if (!ein || typeof MutationObserver === 'undefined' || typeof document === 'undefined') return
      // Nur der Aufbau zählt (Elemente kommen, gehen, tauschen), nicht Texte oder Attribute.
      beobachter = new MutationObserver(() => folge.value++)
      beobachter.observe(document.body, { childList: true, subtree: true })
    },
    { immediate: true },
  )
  onBeforeUnmount(stopp)
}

/**
 * Für ein Dokument: Folgt ihm eine leere Rückseite? `seiten` = so viele Seiten hat es,
 * `ende` = das Element seiner letzten Seite (es trägt {@link DRUCKSEITE}). Ohne Schalter
 * darüber (Vorschau, Tests einzelner Blätter) nie.
 */
export function useLeereRueckseite(seiten: () => number, ende: () => Element | null | undefined): ComputedRef<boolean> {
  const k = inject(SCHLUESSEL, null)
  if (!k) return computed(() => false)
  // Bis nachgesehen ist, gilt das Dokument als das letzte: lieber kurz keine leere Seite als eine zu viel.
  const letztes = ref(true)
  const pruefe = () => {
    const el = ende()
    if (!el || !k.an.value) return
    const alle = document.querySelectorAll(`[${DRUCKSEITE}]`)
    letztes.value = alle.length === 0 || alle[alle.length - 1] === el
  }
  onMounted(() => {
    pruefe()
    k.folge.value++
  })
  onUpdated(pruefe)
  // Erst wenn das Dokument aus dem DOM ist, sehen die anderen richtig nach.
  onBeforeUnmount(() => void nextTick(() => k.folge.value++))
  watch([k.folge, k.an], pruefe, { flush: 'post' })
  return computed(() => k.an.value && !letztes.value && seiten() % 2 === 1)
}

/** Die Listenarten mit mehreren Dokumenten in einem Druck – nur sie haben den Schalter. */
export const DOPPELSEITIG_ARTEN = ['starter', 'gewicht', 'vorsteg', 'ergebnis', 'pokal', 'druckdatei'] as const
export type DoppelseitigArt = (typeof DOPPELSEITIG_ARTEN)[number]
export const istDoppelseitigArt = (x: unknown): x is DoppelseitigArt => (DOPPELSEITIG_ARTEN as readonly unknown[]).includes(x)

/** Gelesene Wahl je Listenart in gültiger Form: nur bekannte Arten, nur ja/nein. */
export function istDoppelseitigWahl(x: unknown): x is Partial<Record<DoppelseitigArt, boolean>> {
  return !!x && typeof x === 'object' && !Array.isArray(x) && Object.entries(x).every(([art, an]) => istDoppelseitigArt(art) && typeof an === 'boolean')
}
