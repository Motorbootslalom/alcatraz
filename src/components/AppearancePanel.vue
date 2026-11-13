<script setup lang="ts">
import { mode, MODES, scheme, SCHEMES, setMode, setScheme, type Scheme } from '../lib/theme'
import { t } from '../i18n'

/**
 * Farbschema und Helligkeit wählen. Das Muster zeigt Kopfzeile und Akzentfarbe
 * des Schemas – dieselben Formeln wie in src/styles/themes.css.
 */
function swatch(s: Scheme): Record<string, string> {
  if (s.hue === undefined) return { '--sw-top': '#0f3d3a', '--sw-accent': '#0f766e', '--sw-light': '#5eead4' }
  const c = s.chroma ?? 1
  return {
    '--sw-top': `oklch(0.31 ${0.06 * c} ${s.hue})`,
    '--sw-accent': `oklch(0.5 ${0.115 * c} ${s.hue})`,
    '--sw-light': `oklch(0.85 ${0.12 * c} ${s.hue})`,
  }
}
</script>

<template>
  <div class="panel">
    <h2>{{ t('theme.title') }}</h2>
    <p class="hint">{{ t('theme.hint') }}</p>
    <div class="field">
      <label id="theme-scheme-label">{{ t('theme.scheme') }}</label>
      <div class="scheme-grid" role="radiogroup" aria-labelledby="theme-scheme-label">
        <button
          v-for="s in SCHEMES"
          :key="s.id"
          type="button"
          role="radio"
          class="scheme-chip"
          :class="{ active: scheme === s.id }"
          :aria-checked="scheme === s.id"
          @click="setScheme(s.id)"
        >
          <span class="scheme-swatch" :style="swatch(s)" aria-hidden="true"><i /></span>
          {{ t(`theme.scheme.${s.id}` as 'theme.scheme.steg') }}
        </button>
      </div>
    </div>
    <div class="field" style="margin-top: 14px">
      <label>{{ t('theme.mode') }}</label>
      <div class="segmented" style="align-self: flex-start">
        <button
          v-for="m in MODES"
          :key="m"
          type="button"
          :class="mode === m ? 'active' : ''"
          :aria-pressed="mode === m"
          @click="setMode(m)"
        >
          {{ t(`theme.mode.${m}`) }}
        </button>
      </div>
    </div>
  </div>
</template>
