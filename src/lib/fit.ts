import type { Directive } from 'vue'

/**
 * Zwei Anpassungen, damit auf der Anzeigetafel nichts abgeschnitten wird oder
 * übereinanderläuft. Übernommen aus dem Tafel-Prototyp (src/lib/fit.ts, 16.11.2026);
 * geändert ist nur der Name der Zeilen-Klasse ({@link FIT_ZEILE}, im Prototyp
 * `board-line`): Im Code heißt die Tafel `anzeige` – „Tafel“ ist das Aushangbrett.
 *
 * Die Schriftgrößen sind feste Bruchteile der Bereichshöhe – ausgelegt auf 50 m
 * Leseabstand. Sie dürfen nicht generell kleiner werden, müssen sich aber dort
 * beugen, wo der Inhalt länger ist als vorgesehen: ein sehr langer Vereinsname
 * (in der Breite) oder eine mehrzeilige Meldung unter dem Starter (in der Höhe).
 *
 * Beide laufen ausschließlich in den Vue-Hooks `mounted` und `updated`. Die
 * greifen **vor** dem Zeichnen, die Anpassung ist also unsichtbar. Bewusst kein
 * `ResizeObserver` auf den Elementen: Der meldet sich nach jedem `observe()`
 * einmal von selbst – und zwar nach dem Zeichnen. Beim Weiterschalten entsteht
 * jedes Mal ein neues Element, und dieser zusätzliche Durchgang war als Zucken
 * zu sehen. Fenstergrößen ändern sich dagegen selten; dafür genügt `resize`.
 */

/** Klasse der Zeilen in einem Block, die {@link fitBlock} bei jedem Maßstab neu anpasst (wie `v-fit`). */
export const FIT_ZEILE = 'anzeige-zeile'

/** Schrumpft eine einzelne Zeile, bis sie in ihre Breite passt. */
export function fitLine(el: HTMLElement): void {
  el.style.removeProperty('--fit-scale')
  const available = el.clientWidth
  const needed = el.scrollWidth
  if (available <= 0 || needed <= available) return

  // Die Breite skaliert nahezu linear mit der Schriftgröße; ein zweiter
  // Durchgang fängt den Rest ab (Zeichenabstände runden nicht exakt mit).
  let scale = available / needed
  el.style.setProperty('--fit-scale', String(scale))
  if (el.scrollWidth > el.clientWidth) {
    scale *= el.clientWidth / el.scrollWidth
    el.style.setProperty('--fit-scale', String(scale))
  }
}

/**
 * Schrumpft einen umbrechenden Text, bis er höchstens `zeilen` Zeilen hoch ist – für den Hinweis unter
 * dem Starter. Ohne Grenze verkleinerte ein langer Hinweis über {@link fitBlock} den ganzen Block samt
 * Startnummer (Prüfung E1, 16.11.2026: hochkant auf etwa 29 %); so trägt er seine Länge selbst.
 *
 * Die Höhe einer Zeile wird ohne Umbruch gemessen, der erste Maßstab folgt aus dem Verhältnis der Breiten
 * (mit etwas Luft, weil Wörter eine Zeile nie ganz füllen); danach in kleinen Schritten, bis es passt.
 * Feste Zeilenwechsel im Text zählen mit; mehr als `zeilen` davon fängt am Ende {@link fitBlock} ab.
 */
export function fitZeilen(el: HTMLElement, zeilen: number): void {
  el.style.removeProperty('--fit-scale')
  el.style.setProperty('white-space', 'nowrap')
  const zeile = el.offsetHeight
  const breite = el.clientWidth
  const noetig = el.scrollWidth
  el.style.removeProperty('white-space')
  if (zeile <= 0 || breite <= 0 || noetig <= 0) return
  // Die Zeilenhöhe wächst mit der Schrift (line-height ohne Einheit); ein Pixel Spiel fürs Runden.
  const passt = (scale: number) => el.offsetHeight <= zeilen * zeile * scale + 1
  if (passt(1)) return
  let scale = Math.min(1, ((zeilen * breite) / noetig) * 0.92)
  for (let i = 0; i < 6; i++) {
    el.style.setProperty('--fit-scale', String(scale))
    if (passt(scale)) return
    scale *= 0.9
  }
}

/** Eine Zeile im Block neu anpassen – wie ihre Direktive es täte (`v-fit` bzw. `v-fit-zeilen`). */
function passeAn(el: HTMLElement): void {
  const zeilen = Number(el.dataset.fitZeilen)
  if (zeilen >= 1) fitZeilen(el, zeilen)
  else fitLine(el)
}

/** Höchstens so viele Runden verkleinert {@link fitBlock} nach der ersten Messung; danach bleibt es, wie es ist. */
const BLOCK_RUNDEN = 8

/**
 * Verkleinert einen ganzen Block, bis er in die Höhe seines Bereichs passt.
 *
 * Das greift, wenn alle Angaben zusammenkommen – Parcours, Klasse und Lauf, die
 * große Startnummer, Name, Verein, der Starter davor und dazu noch eine
 * mehrzeilige Meldung. Verkleinert wird alles gemeinsam, damit die
 * Größenverhältnisse stimmen: Die Startnummer bleibt das mit Abstand Größte.
 *
 * Der Block darf den Bereich füllen (styles/anzeige.css: die Kopfzeile steht so immer oben); gemessen
 * wird seine natürliche Höhe – während des Messens wächst er nicht mit (`flex-grow: 0`).
 *
 * Die Zeilen ({@link FIT_ZEILE}) werden bei JEDEM Maßstab neu angepasst, bevor gemessen wird: Ihre Schrift
 * hängt am Maßstab des Blocks (--anzeige-u enthält --block-scale). Eine Zeile, die bei Maßstab 1 zu breit war
 * (hochkant die Startnummer), passt bei einem kleineren wieder in ganzer Größe. Mit dem alten --fit-scale
 * gemessen, wäre sie doppelt verkleinert (--fit-scale mal --block-scale) – der Block schiene klein genug, die
 * Zeile wüchse beim Anpassen danach wieder, und er liefe über. So geschah es hochkant mit Racecourse A und B
 * untereinander nach jedem „Nächster Start“, bis ein `resize` kam (Prüfung, 16.11.2026).
 */
export function fitBlock(el: HTMLElement): void {
  const region = el.parentElement
  if (!region) return

  const zeilen = [...el.querySelectorAll<HTMLElement>(`.${FIT_ZEILE}`)]
  /** Maßstab setzen, die Zeilen dazu anpassen, dann die Höhe des Blocks messen. */
  const hoeheBei = (scale: number): number => {
    if (scale < 1) el.style.setProperty('--block-scale', String(scale))
    else el.style.removeProperty('--block-scale')
    zeilen.forEach(passeAn)
    return el.offsetHeight
  }

  el.style.setProperty('flex-grow', '0')

  // Der Innenabstand des Bereichs zählt nicht als Platz – sonst klebte der
  // Inhalt nach dem Verkleinern doch wieder an der Trennlinie.
  const style = getComputedStyle(region)
  const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
  const available = region.clientHeight - (Number.isFinite(padding) ? padding : 0)

  let hoehe = hoeheBei(1)
  if (available > 0 && hoehe > available) {
    // Jede Runde im Verhältnis von Platz und Höhe. Das nähert sich dem passenden Maßstab von oben und wird nie
    // kleiner als nötig: Teile, die an ihrer Breite gedeckelt sind, schrumpfen erst spät mit, die Höhe fällt also
    // langsamer als der Maßstab. Gerade deshalb braucht es mehrere Runden (hochkant, A über B: drei bis vier), dazu
    // brechen Zeilen beim Verkleinern anders um. Ein Pixel Rest bleibt im Innenabstand des Bereichs unsichtbar.
    let scale = 1
    for (let i = 0; i < BLOCK_RUNDEN; i++) {
      scale *= available / hoehe
      hoehe = hoeheBei(scale)
      if (hoehe <= available + 1) break
    }
  }

  el.style.removeProperty('flex-grow')
}

/**
 * Hängt einen Fenster-Handler an ein Element und räumt ihn wieder ab.
 * Nur die Fenstergröße kann eine Anpassung nachträglich nötig machen.
 */
const onResize = new WeakMap<HTMLElement, () => void>()

function watchResize(el: HTMLElement, fn: () => void): void {
  const handler = () => fn()
  onResize.set(el, handler)
  window.addEventListener('resize', handler)
}

function unwatchResize(el: HTMLElement): void {
  const handler = onResize.get(el)
  if (handler) window.removeEventListener('resize', handler)
  onResize.delete(el)
}

/** `v-fit` auf eine einzelne Zeile mit fester Höhe. */
export const vFit: Directive<HTMLElement> = {
  mounted(el) {
    fitLine(el)
    watchResize(el, () => fitLine(el))
  },
  updated(el) {
    fitLine(el)
  },
  unmounted(el) {
    unwatchResize(el)
  },
}

/**
 * `v-fit-zeilen="2"` auf einen umbrechenden Text: höchstens so viele Zeilen. Setzt `data-fit-zeilen`,
 * damit {@link fitBlock} ihn nach dem Verkleinern ebenso anpasst (und nicht mit {@link fitLine}).
 */
export const vFitZeilen: Directive<HTMLElement, number> = {
  mounted(el, { value }) {
    el.dataset.fitZeilen = String(value)
    fitZeilen(el, value)
    watchResize(el, () => fitZeilen(el, Number(el.dataset.fitZeilen)))
  },
  updated(el, { value }) {
    el.dataset.fitZeilen = String(value)
    fitZeilen(el, value)
  },
  unmounted(el) {
    unwatchResize(el)
  },
}

/** `v-fit-block` auf den Inhalt eines Tafel-Bereichs. */
export const vFitBlock: Directive<HTMLElement> = {
  mounted(el) {
    fitBlock(el)
    watchResize(el, () => fitBlock(el))
  },
  updated(el) {
    fitBlock(el)
  },
  unmounted(el) {
    unwatchResize(el)
  },
}
