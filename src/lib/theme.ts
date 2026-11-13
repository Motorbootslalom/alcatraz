import { computed, ref, watchEffect } from 'vue'

/**
 * Farbschema und Hell/Dunkel. Beides gilt je Gerät (wie die Sprache) und gehört
 * deshalb nicht in den Zustand der Veranstaltung: Wer eine Sicherung lädt, soll
 * nicht die Farben eines anderen bekommen.
 *
 * Die Farben selbst stehen in src/styles/themes.css; hier steht nur, welche es
 * gibt. `hue` und `chroma` zeigt die Auswahl als Farbmuster.
 */
export interface Scheme {
  id: string
  /** Farbton (OKLCH) – fehlt beim mitgelieferten Türkis, das feste Farben hat. */
  hue?: number
  /** Sättigung relativ zu den bunten Schemata; Graphit ist fast grau. */
  chroma?: number
}

export const SCHEMES: readonly Scheme[] = [
  { id: 'steg' },
  { id: 'blau', hue: 250 },
  { id: 'indigo', hue: 275 },
  { id: 'violett', hue: 305 },
  { id: 'beere', hue: 350 },
  { id: 'rot', hue: 25 },
  { id: 'kupfer', hue: 50 },
  { id: 'bronze', hue: 85 },
  { id: 'wald', hue: 150 },
  { id: 'graphit', hue: 250, chroma: 0.12 },
]

export const MODES = ['auto', 'light', 'dark'] as const
export type Mode = (typeof MODES)[number]

// Dieselben Schlüssel liest das kleine Skript in index.html vor dem ersten Bild.
const MODE_KEY = 'alcatraz:ui-mode'
const SCHEME_KEY = 'alcatraz:ui-scheme'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ohne Speicher (privates Fenster) gilt die Wahl eben nur bis zum Neuladen.
  }
}

const storedMode = read(MODE_KEY)
const storedScheme = read(SCHEME_KEY)

export const mode = ref<Mode>(MODES.includes(storedMode as Mode) ? (storedMode as Mode) : 'auto')
export const scheme = ref<string>(SCHEMES.some((s) => s.id === storedScheme) ? (storedScheme as string) : 'steg')

// „Wie das Gerät“ folgt dem System auch dann, wenn es mittendrin umschaltet (Abenddämmerung).
const system = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null
const systemDark = ref(system?.matches ?? false)
system?.addEventListener?.('change', (e) => (systemDark.value = e.matches))

/** Was tatsächlich gezeigt wird. */
export const dark = computed(() => mode.value === 'dark' || (mode.value === 'auto' && systemDark.value))

export function setMode(next: Mode) {
  mode.value = next
  write(MODE_KEY, next)
}

export function setScheme(id: string) {
  if (!SCHEMES.some((s) => s.id === id)) return
  scheme.value = id
  write(SCHEME_KEY, id)
}

/** Der Schalter im Kopf: immer zur jeweils anderen Fassung, egal was das Gerät vorgibt. */
export function toggleDark() {
  setMode(dark.value ? 'light' : 'dark')
}

watchEffect(() => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.mode = dark.value ? 'dark' : 'light'
  document.documentElement.dataset.scheme = scheme.value
})
