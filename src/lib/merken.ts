import { ref, type Ref } from 'vue'

/**
 * Was man in einer Ansicht gewählt hat (Listenart, Parcours, Klasse, Lauf, aufgeklappte
 * Blöcke …), bleibt beim Wechsel der Ansicht stehen: Wer aus den Einstellungen zurückkommt,
 * ist wieder dort, wo er war. Die Ansichten werden beim Wechsel neu aufgebaut; ein
 * gewöhnliches `ref` begänne deshalb jedes Mal von vorn.
 *
 * Gemerkt wird für dieses Fenster, bis es neu geladen wird – bewusst nicht im Stand der
 * Veranstaltung (das ist Bedienung, kein Inhalt) und nicht dauerhaft (nach dem Neuladen
 * beginnt man übersichtlich von vorn).
 */
const speicher = new Map<string, Ref<unknown>>()

/** Wie `ref(anfang)`, aber unter `schluessel` über den Wechsel der Ansicht hinweg erhalten. */
export function merke<T>(schluessel: string, anfang: T | (() => T)): Ref<T> {
  let r = speicher.get(schluessel) as Ref<T> | undefined
  if (!r) {
    r = ref(typeof anfang === 'function' ? (anfang as () => T)() : anfang) as Ref<T>
    speicher.set(schluessel, r as Ref<unknown>)
  }
  return r
}

/** Alles vergessen (Tests; „Alles zurücksetzen“). */
export function vergissAlles(): void {
  speicher.clear()
}
