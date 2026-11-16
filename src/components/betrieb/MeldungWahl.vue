<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Meldung, OeffentlicheSicht } from '../../types'
import { t } from '../../i18n'
import { ALLE_VORLAGEN, MELDUNGS_VORLAGEN, gruppenTitel, vorlagenMeldung, vorlagenTitel } from '../../betrieb/meldungen'

/**
 * Meldungsvorlagen (B-8): Begrüßung, Dank, Pause, Störung. Eine Vorlage landet zuerst im Eingabefeld der
 * Start-Freigabe, nie direkt auf der Anzeigetafel – Uhrzeiten und Tage sind Beispiele zum Anpassen, und ein
 * Fehlgriff im Menü stünde sonst sofort vor allen Zuschauern. Text in der Sprache der Anzeigetafel mit dem
 * Namen der Veranstaltung, beschriftet in der Sprache der Oberfläche (BETRIEB_ANNAHMEN.vorlagenInTafelSprache).
 *
 * Wählen allein tut nichts; erst „Übernehmen“ schreibt ins Textfeld. Das Auswahlfeld ist kein Befehl: In Chromium
 * feuert change schon bei einer Pfeiltaste auf dem zugeklappten Feld – ↓ hätte einen getippten Entwurf
 * überschrieben (Prüfung E2, 16.11.2026). Liest nur die öffentliche Sicht.
 */
const props = defineProps<{
  sicht: Pick<OeffentlicheSicht, 'sprache' | 'veranstaltung'>
  gesperrt?: boolean
}>()
const emit = defineEmits<{ wahl: [meldung: Meldung] }>()

const gewaehlt = ref('')
const vorlage = computed(() => ALLE_VORLAGEN.find((v) => v.id === gewaehlt.value) ?? null)

function uebernehmen() {
  // Die Wahl bleibt stehen: Dieselbe Vorlage noch einmal zu übernehmen, füllt das Feld erneut.
  if (vorlage.value) emit('wahl', vorlagenMeldung(props.sicht, vorlage.value))
}
</script>

<template>
  <div class="row betrieb-vorlagen">
    <select v-model="gewaehlt" class="input" data-meldung-vorlage :aria-label="t('meldung.vorlagen')" :title="t('meldung.vorlagen.hint')" :disabled="gesperrt">
      <option value="">{{ t('meldung.vorlagen.waehlen') }}</option>
      <optgroup v-for="g in MELDUNGS_VORLAGEN" :key="g.gruppe" :label="t(gruppenTitel(g.gruppe))">
        <option v-for="v in g.vorlagen" :key="v.id" :value="v.id">{{ t(vorlagenTitel(v.id)) }}</option>
      </optgroup>
    </select>
    <button type="button" class="btn" data-action="vorlage-uebernehmen" :disabled="gesperrt || !vorlage" :title="t('meldung.vorlagen.uebernehmen.title')" @click="uebernehmen">
      {{ t('meldung.vorlagen.uebernehmen') }}
    </button>
  </div>
</template>
