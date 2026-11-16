<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useStore } from '../state/store'
import { t, type MessageKey } from '../i18n'
import {
  dateiFehler,
  LOGO_BREITE_MAX_MM,
  LOGO_DATEI_MAX_BYTES,
  LOGO_DPI_WARNUNG,
  LOGO_HOEHE_MAX_MM,
  LOGO_HOEHE_MIN_MM,
  LOGO_HOEHE_VORGABE_MM,
  LOGO_HOEHE_BOGEN_MAX_MM,
  LOGO_MAX_MEGAPIXEL,
  logoDpi,
  logoInfo,
  logoMasseMm,
  logoWert,
} from '../lib/logo'
import { LogoFehler, verkleinereLogo, type LogoFehlerCode } from '../lib/logoBild'
import type { LogoBild, LogoSeite } from '../types'

/**
 * Einstellung „Logos auf den Listen“ (Entscheidung des Nutzers vom 16.11.2026): zwei frei belegbare Plätze,
 * links und rechts im Kopf jeder gedruckten Liste – unter DM und UIM gleich, anfangs leer. Ein gewähltes Bild
 * wird hier verkleinert (lib/logoBild.ts) und erst dann gesetzt; was nicht geht, meldet der Platz selbst, und
 * das bisherige Logo bleibt. Die Höhe gilt für beide Logos auf allen Listen (lib/logo.ts).
 */
const { state, dispatch, saved } = useStore()

const SEITEN: readonly LogoSeite[] = ['links', 'rechts']
const NAMEN: Record<LogoSeite, MessageKey> = { links: 'listopt.logo.links', rechts: 'listopt.logo.rechts' }
// Nur der Code wird gemerkt, der Text entsteht in der Vorlage und wechselt mit der Sprache.
const FEHLER: Record<LogoFehlerCode, MessageKey> = {
  typ: 'listopt.logo.error.typ',
  gross: 'listopt.logo.error.gross',
  lesbar: 'listopt.logo.error.lesbar',
  speicher: 'listopt.logo.error.speicher',
}
const name = (seite: LogoSeite) => t(NAMEN[seite])

const fehler = ref<Record<LogoSeite, LogoFehlerCode | null>>({ links: null, rechts: null })
const arbeitet = ref<Record<LogoSeite, boolean>>({ links: false, rechts: false })
// Je Seite gilt nur das jüngste Verkleinern: Ein älteres Ergebnis (oder eins nach „Entfernen“) wird verworfen.
const folge: Record<LogoSeite, number> = { links: 0, rechts: 0 }
const feld: Partial<Record<LogoSeite, HTMLInputElement>> = {}
const knopf: Partial<Record<LogoSeite, HTMLButtonElement>> = {}

function auskunft(bild: LogoBild): string {
  const { format, kb } = logoInfo(bild.src)
  return t('listopt.logo.info', { breite: bild.breite, hoehe: bild.hoehe, format, kb })
}
const dpi = (bild: LogoBild) => logoDpi(bild, state.value.logoHoeheMm)
function vorschauStil(bild: LogoBild) {
  const { breiteMm, hoeheMm } = logoMasseMm(bild, state.value.logoHoeheMm)
  return { width: `${breiteMm}mm`, height: `${hoeheMm}mm` }
}

async function waehle(seite: LogoSeite, e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  // Leeren, damit dieselbe Datei noch einmal gewählt werden kann (etwa nach einem Fehler).
  input.value = ''
  if (!file) return
  const diese = ++folge[seite]
  fehler.value[seite] = null
  const vorab = dateiFehler(file)
  if (vorab) {
    fehler.value[seite] = vorab
    return
  }
  arbeitet.value[seite] = true
  try {
    let bild: LogoBild | null
    try {
      bild = logoWert(await verkleinereLogo(file))
    } catch (err) {
      if (diese === folge[seite]) fehler.value[seite] = err instanceof LogoFehler ? err.code : 'lesbar'
      return
    }
    if (diese !== folge[seite]) return
    if (!bild) fehler.value[seite] = 'gross'
    else setze(seite, bild)
  } finally {
    if (diese === folge[seite]) arbeitet.value[seite] = false
  }
}

/**
 * Setzen mit Speicherschutz: Wäre der Speicher des Browsers mit dem neuen Logo voll (vorher gespeichert,
 * danach nicht), kommt sofort das vorige zurück – sonst hinge der Speicherfehler fest, und jede weitere
 * Eingabe ginge beim Neuladen verloren.
 */
function setze(seite: LogoSeite, bild: LogoBild) {
  const vorher = state.value.logos[seite]
  const warGespeichert = saved.value
  dispatch({ type: 'SET_LOGO', seite, logo: bild })
  if (warGespeichert && !saved.value) {
    dispatch({ type: 'SET_LOGO', seite, logo: vorher })
    fehler.value[seite] = 'speicher'
  }
}

async function entferne(seite: LogoSeite) {
  folge[seite]++
  fehler.value[seite] = null
  arbeitet.value[seite] = false
  dispatch({ type: 'SET_LOGO', seite, logo: null })
  // Der Knopf „Entfernen“ ist danach weg: Der Fokus bleibt auf dem Platz, beim Wahl-Knopf.
  await nextTick()
  knopf[seite]?.focus()
}

function setzeHoehe(e: Event) {
  const input = e.target as HTMLInputElement
  const n = parseFloat(input.value)
  dispatch({ type: 'SET_LOGO_HOEHE', mm: Number.isNaN(n) ? null : n })
  // Der Reducer rundet und klemmt; das Feld soll zeigen, was gilt.
  input.value = String(state.value.logoHoeheMm)
}

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.svg'
</script>

<template>
  <div id="logos" class="panel">
    <h2>{{ t('listopt.logo.title') }}</h2>
    <p class="hint">{{ t('listopt.logo.hint') }}</p>
    <div class="logo-slots">
      <fieldset v-for="seite in SEITEN" :key="seite" class="logo-slot" :data-logo="seite" :aria-busy="arbeitet[seite] ? 'true' : undefined">
        <legend>{{ name(seite) }}</legend>
        <template v-if="state.logos[seite]">
          <img class="logo-vorschau" :src="state.logos[seite]!.src" :alt="t('listopt.logo.preview', { seite: name(seite) })" :style="vorschauStil(state.logos[seite]!)" />
          <p class="note" data-hinweis="logo-info">{{ auskunft(state.logos[seite]!) }}</p>
          <p v-if="dpi(state.logos[seite]!) < LOGO_DPI_WARNUNG" class="note" data-hinweis="logo-aufloesung">
            {{ t('listopt.logo.lowRes', { mm: state.logoHoeheMm, dpi: dpi(state.logos[seite]!) }) }}
          </p>
        </template>
        <span v-else class="logo-leer">{{ t('listopt.logo.empty') }}</span>
        <div class="row logo-knoepfe">
          <!-- Eine echte Schaltfläche: Ein Feld mit `hidden` ist mit der Tastatur nicht erreichbar. Kein
               aria-label: Der Name bleibt der sichtbare Text (WCAG 2.5.3, Sprachsteuerung „Ersetzen klicken“),
               den Platz nennt die legend des fieldset (Befund der Prüfung, 16.11.2026). -->
          <button
            :ref="(el) => (knopf[seite] = (el as HTMLButtonElement | null) ?? undefined)"
            type="button"
            class="btn"
            :data-action="`logo-waehlen|${seite}`"
            :disabled="arbeitet[seite]"
            @click="feld[seite]?.click()"
          >
            {{ t(state.logos[seite] ? 'listopt.logo.replace' : 'listopt.logo.choose') }}
          </button>
          <button
            v-if="state.logos[seite]"
            type="button"
            class="btn sm danger"
            :data-action="`logo-entfernen|${seite}`"
            :disabled="arbeitet[seite]"
            @click="entferne(seite)"
          >
            {{ t('listopt.logo.remove') }}
          </button>
        </div>
        <input
          :ref="(el) => (feld[seite] = (el as HTMLInputElement | null) ?? undefined)"
          type="file"
          hidden
          :data-feld="`logo|${seite}`"
          :accept="ACCEPT"
          @change="waehle(seite, $event)"
        />
        <p v-if="arbeitet[seite]" class="note" role="status">{{ t('listopt.logo.busy') }}</p>
        <p v-if="fehler[seite]" class="boat-banner warn" role="status" :data-fehler="fehler[seite]">
          {{ t(FEHLER[fehler[seite]!], { mb: LOGO_DATEI_MAX_BYTES / 1024 / 1024, mp: LOGO_MAX_MEGAPIXEL }) }}
        </p>
      </fieldset>
    </div>
    <div class="row" style="align-items: flex-end; gap: 20px; margin-top: 14px">
      <div class="field" style="width: 200px">
        <label for="logo-hoehe">{{ t('listopt.logo.height') }}</label>
        <input
          id="logo-hoehe"
          class="input"
          type="number"
          :min="LOGO_HOEHE_MIN_MM"
          :max="LOGO_HOEHE_MAX_MM"
          step="1"
          data-feld="logo-hoehe"
          :value="state.logoHoeheMm"
          :class="state.logoHoeheMm !== LOGO_HOEHE_VORGABE_MM ? 'own' : ''"
          @change="setzeHoehe"
        />
      </div>
    </div>
    <p class="note">
      {{ t('listopt.logo.heightHint', { min: LOGO_HOEHE_MIN_MM, max: LOGO_HOEHE_MAX_MM, vorgabe: LOGO_HOEHE_VORGABE_MM, bogen: LOGO_HOEHE_BOGEN_MAX_MM, breite: LOGO_BREITE_MAX_MM }) }}
    </p>
  </div>
</template>
