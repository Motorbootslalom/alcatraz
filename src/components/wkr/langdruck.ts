import { getCurrentInstance, onBeforeUnmount, ref, type Ref } from 'vue'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'

/**
 * Langes Drücken auf eine Boje (R7-21, R8-23 – Nutzer 22.11.2026; WKR_ANNAHMEN LD1–LD4, bestätigt 23.11.2026, R9-03/R9-04): ein
 * zweiter Weg zum Disq. an DIESER Boje, gedacht für Handschuhe – neben „Disq. an Boje …“ und DISQ im Fuß.
 *
 * Warum Pointer-Events statt `@click`: Ein Langdruck darf nie zusätzlich als Tipp zählen (LD2). Der Tipp zählt darum
 * beim Loslassen (`pointerup`), nicht beim Aufsetzen; ist der Langdruck ausgelöst, verwirft das Loslassen den Tipp.
 * `setPointerCapture` hält die Berührung am Knopf, auch wenn der Finger leicht abrutscht. Der Browser schickt nach
 * `pointerup` noch ein `click` – das verwirft die Hilfe (kurz nach einer Berührung). Ein `click` OHNE vorherige Berührung
 * (Tastatur Enter/Leertaste, Hilfstechnik, Tests mit `trigger('click')`) bleibt ein kurzer Tipp.
 *
 * Abbruch (LD3): Bewegung über `langdruckWegPx` (Wischen, Scrollen) oder `pointercancel` → weder Tipp noch Langdruck.
 * Rückmeldung: Nach `langdruckRingMs` steht der Knopf in `fuellt` (Füllring über CSS, nur --wkr-*), beim Auslösen
 * `navigator.vibrate?.(30)`. Gesperrt (LD4: Übertragen, Pause) → nichts. Wo kein Langdruck möglich ist (`langMoeglich`
 * false: Boje ohne Disq.-Buchstaben), zählt auch ein langer Druck als Tipp – sonst ginge eine Berührung mit Handschuh
 * still verloren (Auslegung LD1, 22.11.2026, bestätigt 23.11.2026, R9-03).
 */
export interface LangdruckOptionen<T> {
  kurz: (x: T) => void
  lang: (x: T) => void
  /** Ab wann ein Druck lang ist (Vorgabe WKR_ANNAHMEN.langdruckMs). */
  ms?: number
  /** Bewegung, ab der abgebrochen wird (Vorgabe WKR_ANNAHMEN.langdruckWegPx). */
  wegPx?: number
  /** Kann dieses Ziel überhaupt lang gedrückt werden? Sonst zählt jeder Druck als Tipp. */
  langMoeglich?: (x: T) => boolean
  gesperrt?: () => boolean
}

export interface Langdruck<T> {
  /** Ereignisse für `v-on` am Knopf. */
  an: (x: T) => Record<string, (ev: Event) => void>
  /** Ziel, dessen Füllring gerade läuft (für `data-langdruck`). */
  fuellt: Ref<T | null>
}

interface Lauf<T> {
  ziel: T
  id: number
  x: number
  y: number
  lang: boolean
  abgebrochen: boolean
  uhren: ReturnType<typeof setTimeout>[]
}

/** Wie lange nach einer Berührung ein `click` als ihr Nachläufer gilt (danach wieder Tastatur/Hilfstechnik). */
const CLICK_NACHLAUF_MS = 1000

export function useLangdruck<T>(o: LangdruckOptionen<T>): Langdruck<T> {
  const ms = o.ms ?? WKR_ANNAHMEN.langdruckMs
  const wegPx = o.wegPx ?? WKR_ANNAHMEN.langdruckWegPx
  const fuellt = ref<T | null>(null) as Ref<T | null>
  let lauf: Lauf<T> | null = null
  let letzteBeruehrung = -Infinity

  // Loslassen auch am Fenster hören, solange ein Druck läuft (Prüfbefund 22.11.2026): Öffnet der Langdruck eine Wahl,
  // die den gedrückten Knopf aus dem DOM nimmt (WkrBild: `v-if="disqBoje"`), geht die Capture verloren und das
  // `pointerup` erreicht den Knopf nie – `lauf` bliebe hängen, jeder weitere Druck würde verworfen. Capture-Phase, damit
  // auch ein Ziel mit stopPropagation es nicht verschluckt; fängt der Knopf selbst es danach, ist `lauf` schon leer.
  const fensterUp = (ev: Event): void => up(ev as PointerEvent)
  const fensterCancel = (ev: Event): void => cancel(ev as PointerEvent)
  function hoereFenster(an: boolean): void {
    if (typeof window === 'undefined') return
    const f = an ? window.addEventListener.bind(window) : window.removeEventListener.bind(window)
    f('pointerup', fensterUp, true)
    f('pointercancel', fensterCancel, true)
  }

  function stoppe(): void {
    if (lauf) {
      for (const u of lauf.uhren) clearTimeout(u)
      hoereFenster(false)
    }
    lauf = null
    fuellt.value = null
  }
  if (getCurrentInstance()) onBeforeUnmount(stoppe)

  function down(x: T, ev: PointerEvent): void {
    // Nur die Hauptberührung (Maus links, Finger, Stift); ein zweiter Finger ändert nichts am laufenden Druck.
    if (ev.button > 0 || lauf || o.gesperrt?.()) return
    const l: Lauf<T> = { ziel: x, id: ev.pointerId, x: ev.clientX, y: ev.clientY, lang: false, abgebrochen: false, uhren: [] }
    lauf = l
    hoereFenster(true)
    const el = ev.currentTarget as Element | null
    try {
      el?.setPointerCapture?.(ev.pointerId)
    } catch {
      // Ohne Capture (alte Browser, Test-DOM) bleibt der Abbruch über die Bewegung.
    }
    if (o.langMoeglich && !o.langMoeglich(x)) return
    l.uhren.push(setTimeout(() => lauf === l && !l.abgebrochen && (fuellt.value = x), WKR_ANNAHMEN.langdruckRingMs))
    l.uhren.push(
      setTimeout(() => {
        if (lauf !== l || l.abgebrochen || o.gesperrt?.()) return
        l.lang = true
        fuellt.value = null
        try {
          navigator.vibrate?.(30)
        } catch {
          // Vibrieren ist nur Zugabe.
        }
        o.lang(x)
      }, ms),
    )
  }
  function move(ev: PointerEvent): void {
    const l = lauf
    if (!l || l.id !== ev.pointerId || l.lang || l.abgebrochen) return
    if (Math.hypot(ev.clientX - l.x, ev.clientY - l.y) > wegPx) {
      l.abgebrochen = true
      for (const u of l.uhren) clearTimeout(u)
      fuellt.value = null
    }
  }
  function up(ev: PointerEvent): void {
    const l = lauf
    if (!l || l.id !== ev.pointerId) return
    letzteBeruehrung = Date.now()
    stoppe()
    if (!l.lang && !l.abgebrochen && !o.gesperrt?.()) o.kurz(l.ziel)
  }
  function cancel(ev: PointerEvent): void {
    if (!lauf || lauf.id !== ev.pointerId) return
    letzteBeruehrung = Date.now()
    stoppe()
  }
  function click(x: T): void {
    // Nachläufer einer Berührung: schon in pointerup gezählt (oder bewusst verworfen, LD2/LD3).
    if (Date.now() - letzteBeruehrung < CLICK_NACHLAUF_MS) {
      letzteBeruehrung = -Infinity
      return
    }
    if (!o.gesperrt?.()) o.kurz(x)
  }

  return {
    fuellt,
    an: (x: T) => ({
      pointerdown: (ev) => down(x, ev as PointerEvent),
      pointermove: (ev) => move(ev as PointerEvent),
      pointerup: (ev) => up(ev as PointerEvent),
      pointercancel: (ev) => cancel(ev as PointerEvent),
      // Kein Kontextmenü (Android: Langdruck öffnet es sonst über dem Knopf).
      contextmenu: (ev) => ev.preventDefault(),
      click: () => click(x),
    }),
  }
}
