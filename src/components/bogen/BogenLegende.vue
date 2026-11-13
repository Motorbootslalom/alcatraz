<script setup lang="ts">
import { computed } from 'vue'
import type { SheetDef } from '../../types'

/**
 * Fußbereich eines Bogens: Fehlertabelle, Hinweise und Disqualifikations-Codes. Unverändert
 * nach Legend.vue im Fehlerpunkte-Prototyp; die Texte kommen fertig übersetzt aus der
 * Konfiguration (Listensprache), deshalb steht hier kein `t()`.
 */
const props = defineProps<{ def: SheetDef }>()

const hasGroups = computed(() => !!props.def.errorGroups && props.def.errorGroups.length > 0)

// Mehrspaltig (z. B. Steg Ablegen | Anlegen): Der längste Block bestimmt die Zeilenzahl,
// kürzere werden mit Leerzeilen aufgefüllt.
const groupRowIndices = computed(() =>
  Array.from({ length: hasGroups.value ? Math.max(...props.def.errorGroups!.map((g) => g.rows.length)) : 0 }, (_, i) => i),
)
</script>

<template>
  <div class="bl">
    <!-- Mehrere Fehlerblöcke nebeneinander (getrennte Kataloge). -->
    <div v-if="hasGroups" class="bl-block bl-fehler">
      <table class="bl-errors bl-grouped">
        <!-- Feste Breiten: Alle Blöcke sind gleich breit, egal wie lang ihre Texte sind. -->
        <colgroup>
          <template v-for="nr in def.errorGroups?.length ?? 0" :key="`s${nr}`">
            <col v-if="nr > 1" class="bl-col-buffer" />
            <col class="bl-col-code" />
            <col />
            <col class="bl-col-pts" />
          </template>
        </colgroup>
        <thead>
          <tr>
            <template v-for="(g, gi) in def.errorGroups" :key="`h${gi}`">
              <th v-if="gi > 0" class="bl-buffer" aria-hidden="true"></th>
              <th class="bl-grouptitle" :colspan="3">{{ g.title }}</th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ri in groupRowIndices" :key="`r${ri}`">
            <template v-for="(g, gi) in def.errorGroups" :key="`c${gi}`">
              <td v-if="gi > 0" class="bl-buffer" aria-hidden="true"></td>
              <td class="bl-code">{{ g.rows[ri]?.code ?? '' }}</td>
              <td class="bl-text">{{ g.rows[ri]?.text ?? '' }}</td>
              <td class="bl-pts">{{ g.rows[ri] ? g.rows[ri].punkte : '' }}</td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Einzelner Fehler-Katalog. -->
    <div v-else-if="def.errorTable" class="bl-block bl-fehler">
      <div v-if="def.errorTableTitle" class="bl-titel">{{ def.errorTableTitle }}</div>
      <table class="bl-errors">
        <tbody>
          <tr v-for="e in def.errorTable" :key="e.code">
            <td class="bl-code">{{ e.code }}</td>
            <td class="bl-text">{{ e.text }}</td>
            <td class="bl-pts">{{ e.punkte }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="def.legendNoteSpalten" class="bl-note bl-note--2">
      <div v-for="(spalte, i) in def.legendNoteSpalten" :key="i">{{ spalte }}</div>
    </div>
    <div v-else-if="def.legendNote" class="bl-note">{{ def.legendNote }}</div>

    <div v-if="def.disqTable && def.disqTable.length > 0" class="bl-block bl-disqblock">
      <div v-if="def.disqTableTitle" class="bl-titel">{{ def.disqTableTitle }}</div>
      <table :class="['bl-disq', { 'bl-disq--2': def.disqZweispaltig }]">
        <tbody>
          <tr v-for="d in def.disqTable" :key="d.code">
            <td class="bl-code">{{ d.code }}</td>
            <td class="bl-text">{{ d.text }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
