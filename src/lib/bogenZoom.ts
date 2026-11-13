import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { PX_PER_MM } from './paging'

/**
 * Schmale Fenster: Die Bögen eines Stapels (`.bogen-stapel`) werden als Ganzes verkleinert,
 * statt die Seite quer rollen zu lassen. Der Stapel misst seine Breite; bogen.css liest die
 * beiden Faktoren (Hoch- und Querformat) und verkleinert mit `transform` – das Layout und
 * damit die Seitenaufteilung bleiben in Druckmaßen. Im Druck gilt immer 1.
 *
 * `stapel` ist die Vorlagen-Referenz des Stapels (`ref="stapel"`) in der Ansicht.
 */
export function useBogenZoom(stapel: Ref<HTMLElement | null>) {
  const faktoren = ref({ portrait: 1, landscape: 1 })
  const zoom = computed(() => ({ '--bogen-zoom-hoch': String(faktoren.value.portrait), '--bogen-zoom-quer': String(faktoren.value.landscape) }))

  function anpassen() {
    const breite = stapel.value?.clientWidth ?? 0
    if (breite <= 0) return // ohne Layout (z. B. Test-DOM) bleibt es bei 1
    // Abgerundet – sonst ragte das Blatt um Bruchteile hinaus.
    const faktor = (mm: number) => Math.min(1, Math.floor((breite / (mm * PX_PER_MM)) * 1000) / 1000)
    faktoren.value = { portrait: faktor(210), landscape: faktor(297) }
  }

  let beobachter: ResizeObserver | undefined
  onMounted(() => {
    anpassen()
    if (typeof ResizeObserver !== 'undefined' && stapel.value) {
      beobachter = new ResizeObserver(anpassen)
      beobachter.observe(stapel.value)
    }
  })
  onBeforeUnmount(() => beobachter?.disconnect())

  return { faktoren, zoom }
}
