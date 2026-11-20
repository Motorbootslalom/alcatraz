<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BereichId } from '../../types'
import { useStore } from '../../state/store'
import { useGeraeteHost } from '../../geraete/host'
import { freigabeBereiche } from '../../geraete/aufgaben'
import type { RegisterEintrag } from '../../geraete/register'
import { sichtOeffentlich } from '../../betrieb/sicht'
import { useUhr } from '../../lib/uhr'
import { t } from '../../i18n'
import AppDialog from '../AppDialog.vue'
import { uhrzeitText } from './texte'

/**
 * Betrieb → Geräte, Geräteliste (Etappe E7, Plan vom 16.11.2026 §4/§5; Vorbild tafel DeviceList.vue, neu geschrieben):
 * je gekoppeltem Gerät Name (änderbar), die Bereiche seiner Start-Freigabe (Häkchen – wirkt sofort: `aufgaben` an das
 * Gerät, `darf` am Host, P-6), wann gekoppelt und zuletzt gehört, „Entziehen“ mit Rückfrage (K14: das Gerät liest
 * Öffentliches weiter). Darunter die zuletzt entzogenen.
 *
 * „Zuletzt gehört“ statt „verbunden“: Ein Gerät meldet sich nur, wenn es schaltet oder neu startet (kein Herzschlag –
 * jede Nachricht kostet Kontingent am fremden Server). Ein Bereich, den es im Stand nicht mehr gibt, bleibt im Register
 * (der Parcours kann zurückkommen), wird hier aber nicht gezeigt; der Host lässt ihn ohnehin nicht gelten.
 */
const { state } = useStore()
const host = useGeraeteHost()
const raum = computed(() => host?.raum.value ?? null)
const geraete = computed(() => raum.value?.geraete ?? [])
const entzogen = computed(() => raum.value?.entzogen ?? [])
const jetzt = useUhr(30_000)

const bereiche = computed(() => sichtOeffentlich(state.value, { logos: false }).bereiche.map((b) => ({ id: b.id, name: b.name })))

function schalte(g: RegisterEintrag, id: BereichId, an: boolean): void {
  const neu = new Set(freigabeBereiche(g.aufgaben))
  if (an) neu.add(id)
  else neu.delete(id)
  host?.setzeAufgaben(g.id, [{ art: 'startfreigabe', bereiche: [...neu] }])
}

function benenne(g: RegisterEintrag, e: Event): void {
  const feld = e.target as HTMLInputElement
  const name = feld.value.trim()
  // Leer heißt: zurück zum alten Namen – ein Gerät ohne Namen fände niemand in der Liste wieder.
  if (!name) feld.value = g.name
  else if (name !== g.name) host?.benenne(g.id, name)
}

const frageEntziehen = ref<RegisterEintrag | null>(null)
function entziehe(): void {
  const g = frageEntziehen.value
  frageEntziehen.value = null
  if (g) host?.entziehe(g.id)
}
</script>

<template>
  <section class="geraete-liste" data-teil="geraeteliste">
    <h3>{{ t('geraete.liste') }}</h3>
    <p v-if="geraete.length === 0" class="note" data-hinweis="keine-geraete">{{ t('geraete.liste.leer') }}</p>
    <template v-else>
      <p class="note">{{ t('geraete.liste.hint') }}</p>
      <ul class="geraete-eintraege">
        <li v-for="g in geraete" :key="g.id" class="geraete-eintrag" :data-geraet="g.id">
          <div class="geraete-eintrag-kopf">
            <input class="input geraete-name" :value="g.name" maxlength="40" :aria-label="t('geraete.liste.name', { name: g.name })" data-feld="name" @change="benenne(g, $event)" />
            <span class="note" data-teil="seit">{{ t('geraete.liste.seit', { zeit: g.seit ? uhrzeitText(g.seit, jetzt) : '–' }) }}</span>
            <span class="note" data-teil="zuletzt">{{ t('geraete.liste.zuletzt', { zeit: g.zuletzt ? uhrzeitText(g.zuletzt, jetzt) : '–' }) }}</span>
            <button type="button" class="btn danger sm" data-action="entziehen" @click="frageEntziehen = g">{{ t('geraete.entziehen') }}</button>
          </div>
          <fieldset class="geraete-bereiche">
            <legend>{{ t('geraete.liste.bereiche') }}</legend>
            <label v-for="b in bereiche" :key="b.id" class="geraete-bereich">
              <input
                type="checkbox"
                :data-bereich="b.id"
                :checked="freigabeBereiche(g.aufgaben).includes(b.id)"
                @change="schalte(g, b.id, ($event.target as HTMLInputElement).checked)"
              />
              {{ b.name }}
            </label>
          </fieldset>
          <p v-if="!freigabeBereiche(g.aufgaben).some((id) => bereiche.some((b) => b.id === id))" class="note" data-hinweis="nichts-frei">
            {{ t('geraete.liste.keine') }}
          </p>
        </li>
      </ul>
    </template>
    <p v-if="entzogen.length" class="note" data-teil="entzogen">
      {{ t('geraete.liste.entzogen', { namen: entzogen.map((e) => `${e.name} (${uhrzeitText(e.um, jetzt)})`).join(', ') }) }}
    </p>

    <AppDialog v-if="frageEntziehen" :titel="t('geraete.entziehen.frage', { name: frageEntziehen.name })" data-dialog="entziehen" @abbrechen="frageEntziehen = null">
      <p>{{ t('geraete.entziehen.text') }}</p>
      <template #knoepfe>
        <button type="button" class="btn danger" data-action="entziehen-ja" @click="entziehe">{{ t('geraete.entziehen.ja') }}</button>
        <button type="button" class="btn" data-action="entziehen-nein" autofocus @click="frageEntziehen = null">{{ t('common.cancel') }}</button>
      </template>
    </AppDialog>
  </section>
</template>
