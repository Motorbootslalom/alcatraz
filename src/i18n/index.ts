import { ref, watch } from 'vue'
import de from './de'
import en from './en'

/**
 * Mehrsprachigkeit der Bedienoberfläche.
 *
 * Bewusst ein eigenes, winziges Modul statt einer Bibliothek: Die Kataloge sind
 * schlichte Objekte, `de.ts` gibt die Schlüssel vor, und jede weitere Sprache
 * muss dieselben Schlüssel liefern – fehlt einer, schlägt der Typecheck fehl.
 *
 * Die Sprache gehört zum **Gerät**, nicht zur Veranstaltung: Wer am Tablet auf
 * Englisch umstellt, ändert nichts am Bedienrechner. Der Wechsel wirkt sofort,
 * weil `t()` die reaktive `locale` liest.
 */
export type MessageKey = keyof typeof de
export type Catalog = Record<MessageKey, string>

export const LOCALES = [
  { id: 'de', name: 'Deutsch', catalog: de },
  { id: 'en', name: 'English', catalog: en },
] as const satisfies readonly { id: string; name: string; catalog: Catalog }[]

export type Locale = (typeof LOCALES)[number]['id']

const LOCALE_KEY = 'alcatraz:ui-locale'

function isLocale(value: unknown): value is Locale {
  return LOCALES.some((l) => l.id === value)
}

/** Gespeicherte Wahl, sonst die Browsersprache, sonst Deutsch. */
function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    // Speicher nicht verfügbar – mit der Browsersprache weiter.
  }
  const languages = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : []
  for (const lang of languages) {
    const short = String(lang).slice(0, 2).toLowerCase()
    if (isLocale(short)) return short
  }
  return 'de'
}

export const locale = ref<Locale>(initialLocale())

export function setLocale(next: Locale): void {
  locale.value = next
}

watch(
  locale,
  (value) => {
    try {
      localStorage.setItem(LOCALE_KEY, value)
    } catch {
      // nicht speicherbar – die Wahl gilt dann nur für diese Sitzung
    }
    if (typeof document !== 'undefined') document.documentElement.lang = value
  },
  { immediate: true },
)

function catalogOf(id: Locale): Catalog {
  return LOCALES.find((l) => l.id === id)!.catalog
}

/** Werte für die Platzhalter; bewusst weit gefasst, damit auch Schnittstellen-Objekte passen. */
type Params = object

function fill(text: string, params?: Params): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String((params as Record<string, unknown>)[name]) : match))
}

/** Übersetzter Text in einer bestimmten Sprache; `{name}` wird aus `params` ersetzt. */
export function tIn(sprache: Locale, key: MessageKey, params?: Params): string {
  return fill(catalogOf(sprache)[key] ?? de[key] ?? key, params)
}

/** Übersetzter Text in der Sprache der Oberfläche. */
export function t(key: MessageKey, params?: Params): string {
  return tIn(locale.value, key, params)
}

/**
 * Übersetzter Text mit Zahlform in einer bestimmten Sprache. Der Katalogeintrag hat die
 * Gestalt „Einzahl | Mehrzahl“; `{n}` steht für die Zahl.
 */
export function tnIn(sprache: Locale, key: MessageKey, n: number, params?: Params): string {
  const forms = (catalogOf(sprache)[key] ?? de[key] ?? key).split(' | ')
  const form = forms.length > 1 && n !== 1 ? forms[1] : forms[0]
  return fill(form, { n, ...params })
}

/** Übersetzter Text mit Zahlform in der Sprache der Oberfläche. */
export function tn(key: MessageKey, n: number, params?: Params): string {
  return tnIn(locale.value, key, n, params)
}

const two = (n: number) => String(n).padStart(2, '0')

/**
 * Datum (ISO `JJJJ-MM-TT`) in der Schreibweise einer Sprache: deutsch
 * `TT.MM.JJJJ`, englisch bewusst `JJJJ-MM-TT` – bei internationalen Wettkämpfen
 * ist das die einzige Schreibweise, die niemand falsch liest.
 */
export function formatDateIn(sprache: Locale, iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  return sprache === 'de' ? `${m[3]}.${m[2]}.${m[1]}` : `${m[1]}-${m[2]}-${m[3]}`
}

/** Datum in der Schreibweise der Oberfläche. */
export function formatDate(iso: string): string {
  return formatDateIn(locale.value, iso)
}

/**
 * Zeitpunkt (ISO) in Ortszeit: deutsch `TT.MM.JJJJ, HH:MM`, englisch `JJJJ-MM-TT HH:MM`.
 * `sekunden`: mit Sekunden – für Angaben, an denen sich zwei Fassungen unterscheiden lassen.
 */
export function formatDateTimeIn(sprache: Locale, iso: string | number, sekunden = false): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const day = `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`
  const time = `${two(date.getHours())}:${two(date.getMinutes())}${sekunden ? `:${two(date.getSeconds())}` : ''}`
  return sprache === 'de' ? `${formatDateIn('de', day)}, ${time}` : `${day} ${time}`
}

/** Zeitpunkt in der Schreibweise der Oberfläche. */
export function formatDateTime(iso: string | number, sekunden = false): string {
  return formatDateTimeIn(locale.value, iso, sekunden)
}

/**
 * Dieselben Funktionen an eine Sprache gebunden, die nicht die der Oberfläche sein muss: Die
 * gedruckten Listen haben ihre eigene (lib/listensprache.ts). `sprache` wird bei jedem Aufruf
 * gefragt, die Texte bleiben also reaktiv.
 */
export function texteIn(sprache: () => Locale) {
  return {
    t: (key: MessageKey, params?: Params) => tIn(sprache(), key, params),
    tn: (key: MessageKey, n: number, params?: Params) => tnIn(sprache(), key, n, params),
    formatDate: (iso: string) => formatDateIn(sprache(), iso),
    formatDateTime: (iso: string | number, sekunden = false) => formatDateTimeIn(sprache(), iso, sekunden),
  }
}
