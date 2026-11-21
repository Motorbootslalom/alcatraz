import { effectScope, ref, watch, type Ref } from 'vue'

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
 * Dasselbe gilt für die Auswahl innerhalb der Listen (Parcours, Klasse, Lauf …): Die Seite lädt
 * auch von selbst neu, wenn eine neue Fassung da ist – danach will man dort sein, wo man war.
 * Der Reiter selbst steht in der Adresse (`useReiter` in lib/router.ts).
 * Ebenso bleibt, was man sich in den übrigen Ansichten zurechtgelegt hat: die aufgeklappten
 * Klassen bei „Starter“, die Herkunft bei „Verwiegung“, die Vorschau der Veranstaltung und die
 * Wahl bei den Beispieldaten (Zahl je Klasse, Herkünfte, Beispielwerte).
 * Mit der Veranstaltung endet das: `vergissAuswahl` (Zurücksetzen, Laden einer Sicherung).
 *
 * Ausnahme `dauerhaft` (21.11.2026, Team-Filter der Zuschauerliste): im localStorage statt im sessionStorage – ein
 * Bildschirm am Steg oder ein Zuschauer-Handy soll seine Wahl auch nach dem Schließen des Tabs behalten. Nur für
 * Ansichten ohne Stand (Zuschauerliste, Lese-Link-Geräte); es bleibt Bedienung dieses Browsers, nie im AppState.
 *
 * Ein gemerkter Wert kann veralten (die Klasse, die Herkunft gibt es nicht mehr): Gelesen wird
 * nur, was die Form des Anfangswerts hat oder `gueltig` besteht; ob es das Gewählte noch gibt,
 * prüft jede Ansicht dort, wo sie es verwendet.
 */
const speicher = new Map<string, { wert: Ref<unknown>; anfang: () => unknown }>()
const PREFIX = 'alcatraz.merke.'

function lager(dauerhaft = false): Storage | undefined {
  try {
    if (dauerhaft) return typeof localStorage === 'undefined' ? undefined : localStorage
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage
  } catch {
    return undefined
  }
}

function lies(schluessel: string, dauerhaft = false): unknown {
  try {
    const roh = lager(dauerhaft)?.getItem(PREFIX + schluessel)
    return roh ? JSON.parse(roh) : undefined
  } catch {
    return undefined
  }
}

/** Wie `ref(anfang)`, aber unter `schluessel` über den Wechsel der Ansicht hinweg erhalten. */
export function merke<T>(
  schluessel: string,
  anfang: T | (() => T),
  optionen: {
    ueberNeuladen?: boolean
    /** Im localStorage (übersteht auch das Schließen des Tabs); schließt `ueberNeuladen` ein. */
    dauerhaft?: boolean
    /**
     * Prüft, was nach dem Neuladen gelesen wurde – nötig, wo der Anfangswert die Form nicht
     * verrät (`undefined`) oder nur bestimmte Werte gelten. Ob es das Gewählte noch GIBT (eine
     * Klasse, eine Herkunft), prüft die Ansicht selbst: Das kann sich auch ohne Neuladen ändern.
     */
    gueltig?: (gelesen: unknown) => boolean
  } = {},
): Ref<T> {
  let r = speicher.get(schluessel)?.wert as Ref<T> | undefined
  if (!r) {
    const beginn = () => (typeof anfang === 'function' ? (anfang as () => T)() : anfang)
    const start = beginn()
    const dauerhaft = optionen.dauerhaft === true
    const ueberNeuladen = optionen.ueberNeuladen === true || dauerhaft
    const gelesen = ueberNeuladen ? lies(schluessel, dauerhaft) : undefined
    // Nur übernehmen, was die Form des Anfangswerts hat (ein Objekt bleibt ein Objekt).
    const form = optionen.gueltig ? optionen.gueltig(gelesen) : typeof gelesen === typeof start && Array.isArray(gelesen) === Array.isArray(start)
    const passt = gelesen !== undefined && gelesen !== null && form
    r = ref(passt ? gelesen : start) as Ref<T>
    speicher.set(schluessel, { wert: r as Ref<unknown>, anfang: beginn })
    if (ueberNeuladen) {
      const wert = r
      // Losgelöst von der Ansicht, die zuerst fragt: Der Wert lebt so lange wie das Fenster.
      // Ein Beobachter im Geltungsbereich der Ansicht endete mit ihr – wer die Ansicht verlässt
      // und wiederkommt, änderte dann die Auswahl, ohne dass sie das Neuladen überstünde.
      effectScope(true).run(() =>
        watch(
          wert,
          (neu) => {
            try {
              lager(dauerhaft)?.setItem(PREFIX + schluessel, JSON.stringify(neu))
            } catch {
              // Voller oder gesperrter Speicher: Dann gilt die Auswahl eben nur bis zum Neuladen.
            }
          },
          { deep: true, flush: 'sync' },
        ),
      )
    }
  }
  return r
}

/**
 * Jede Auswahl wieder auf ihren Anfang – nach „Alles zurücksetzen“ und nach dem Laden einer
 * Sicherung: Was für die vorige Veranstaltung gewählt war (Klasse, Parcours, Herkunft,
 * zugeklappte Klassen), hat mit der neuen nichts zu tun und überstünde sonst im Fenster auch
 * das Neuladen. Die Werte werden an Ort und Stelle zurückgesetzt, damit eine gerade gezeigte
 * Ansicht und das Gemerkte dieselbe Auswahl behalten.
 */
export function vergissAuswahl(): void {
  for (const { wert, anfang } of speicher.values()) wert.value = anfang()
  raeumeLager()
}

/** Alles vergessen, auch das Gedächtnis des Fensters selbst (Tests). */
export function vergissAlles(): void {
  speicher.clear()
  raeumeLager()
}

function raeumeLager(): void {
  for (const dauerhaft of [false, true]) {
    try {
      const s = lager(dauerhaft)
      if (!s) continue
      for (let i = s.length - 1; i >= 0; i--) {
        const k = s.key(i)
        if (k?.startsWith(PREFIX)) s.removeItem(k)
      }
    } catch {
      // ohne Speicher gibt es nichts zu vergessen
    }
  }
}
