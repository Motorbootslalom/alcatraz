import { ref, watch, type Ref } from 'vue'

/**
 * Was man in einer Ansicht gewählt hat (Listenart, Parcours, Klasse, Lauf, aufgeklappte
 * Blöcke …), bleibt beim Wechsel der Ansicht stehen: Wer aus den Einstellungen zurückkommt,
 * ist wieder dort, wo er war. Die Ansichten werden beim Wechsel neu aufgebaut; ein
 * gewöhnliches `ref` begänne deshalb jedes Mal von vorn.
 *
 * Gemerkt wird für dieses Fenster, bis es neu geladen wird – bewusst nicht im Stand der
 * Veranstaltung (das ist Bedienung, kein Inhalt) und in der Regel nicht dauerhaft (nach dem
 * Neuladen beginnt man übersichtlich von vorn).
 *
 * Ausnahme `ueberNeuladen`: Die Auswahl der Erfassung muss ein Neuladen überstehen. Wer dort
 * nach einem Neuladen weitertippt, ohne auf die Auswahl zu sehen, schriebe sonst in den
 * 1. Lauf der ersten Klasse. Sie liegt im sessionStorage – je Fenster, wie die Auswahl selbst.
 */
const speicher = new Map<string, Ref<unknown>>()
const PREFIX = 'alcatraz.merke.'

function lager(): Storage | undefined {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage
  } catch {
    return undefined
  }
}

function lies(schluessel: string): unknown {
  try {
    const roh = lager()?.getItem(PREFIX + schluessel)
    return roh ? JSON.parse(roh) : undefined
  } catch {
    return undefined
  }
}

/** Wie `ref(anfang)`, aber unter `schluessel` über den Wechsel der Ansicht hinweg erhalten. */
export function merke<T>(schluessel: string, anfang: T | (() => T), optionen: { ueberNeuladen?: boolean } = {}): Ref<T> {
  let r = speicher.get(schluessel) as Ref<T> | undefined
  if (!r) {
    const start = typeof anfang === 'function' ? (anfang as () => T)() : anfang
    const gelesen = optionen.ueberNeuladen ? lies(schluessel) : undefined
    // Nur übernehmen, was die Form des Anfangswerts hat (ein Objekt bleibt ein Objekt).
    const passt = gelesen !== undefined && gelesen !== null && typeof gelesen === typeof start && Array.isArray(gelesen) === Array.isArray(start)
    r = ref(passt ? gelesen : start) as Ref<T>
    speicher.set(schluessel, r as Ref<unknown>)
    if (optionen.ueberNeuladen) {
      watch(
        r,
        (wert) => {
          try {
            lager()?.setItem(PREFIX + schluessel, JSON.stringify(wert))
          } catch {
            // Voller oder gesperrter Speicher: Dann gilt die Auswahl eben nur bis zum Neuladen.
          }
        },
        { deep: true, flush: 'sync' },
      )
    }
  }
  return r
}

/** Alles vergessen (Tests; „Alles zurücksetzen“). */
export function vergissAlles(): void {
  speicher.clear()
  try {
    const s = lager()
    if (!s) return
    for (let i = s.length - 1; i >= 0; i--) {
      const k = s.key(i)
      if (k?.startsWith(PREFIX)) s.removeItem(k)
    }
  } catch {
    // ohne Speicher gibt es nichts zu vergessen
  }
}
