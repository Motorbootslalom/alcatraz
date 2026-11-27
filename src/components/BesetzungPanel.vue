<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { useEvent } from '../lib/event'
import { classColor } from '../domain/classes'
import { BESETZUNG_MAX, besetzungText, coPilotKlassenBesetzt, coPilotVorgesehen } from '../lib/besetzung'
import { coPilotAusgleichVon } from '../lib/ausgleich'
import { gewichtText, parseGewicht } from '../domain/gewicht'
import { adresse, sprungziel } from '../lib/router'
import { locale, t } from '../i18n'
import type { ClassId, CoPilotRolle } from '../types'
import WkrEinteilung from './WkrEinteilung.vue'

/**
 * Block „Besetzung“ der Ansicht „Veranstaltung“: was die Regattaleitung für diesen Wettkampf
 * einteilt – welches Boot jede Klasse fährt, wer als Co-Pilot mitfährt und wer an welcher
 * Liste sitzt (WkrEinteilung.vue). Wunsch des Nutzers: Für einen gewöhnlichen Wettkampf soll
 * niemand in die Einstellungen wechseln müssen.
 *
 * Zugeklappt, solange nichts eingetragen ist – die Ansicht bleibt beim Anlegen der
 * Veranstaltung kurz; die Kopfzeile sagt auch zugeklappt, was schon eingetragen ist. Offen,
 * sobald etwas eingetragen ist oder ein Verweis hierher führt (`#/veranstaltung?wkr`,
 * `…?besetzung`); von Hand auf- oder zugeklappt bleibt er so, auch über ein Neuladen.
 *
 * Boote sind Einstellungen (auch in der Vorlage). Co-Piloten und Wettkampfrichter sind
 * Personennamen: nur in der Sicherung (persistenz/backup.ts).
 *
 * Seit 26.11.2026 (R11-07, Nutzer: „gleich bei der Co-Piloten-Konfiguration mit abgefragt“) je Klasse auch ein
 * Ersatz-Co-Pilot und je Person optional das Gewicht; daneben das Ausgleichsgewicht, das daraus folgt
 * (lib/ausgleich.ts coPilotAusgleichVon – dieselbe Zahl wie auf den Listen). Ob es je Klasse oder über alle
 * Co-Piloten rechnet, ist eine Einstellung (SettingsView, „Durchschnittsgewichte“); der Satz unter der Tabelle
 * nennt die Wahl und führt hin.
 */
const { state, dispatch } = useStore()
const { regelwerk, classes, classLabel, classBadge } = useEvent()

const anzahl = (b: Partial<Record<ClassId, string>>) => classes.value.filter((c) => besetzungText(b, c.id) !== '').length
const boote = computed(() => anzahl(state.value.boote))
const coPiloten = computed(() => coPilotKlassenBesetzt(state.value.coPiloten, classes.value.map((c) => c.id)))
/** Klassen der Veranstaltung, in denen das Regelwerk einen Co-Piloten vorsieht. */
const coPilotKlassen = computed(() => classes.value.filter((c) => coPilotVorgesehen(state.value.regelwerk, c.id)))
const wkr = computed(() => Object.values(state.value.einteilung).reduce((n, listen) => n + Object.values(listen).filter((name) => name.trim() !== '').length, 0))
const leer = computed(() => boote.value + coPiloten.value + wkr.value === 0)

const block = ref<HTMLDetailsElement | null>(null)
const ziel = sprungziel()
const gerufen = ziel === 'wkr' || ziel === 'besetzung'
const offen = merke('veranstaltung.besetzung', () => !leer.value, { ueberNeuladen: true })
if (gerufen) offen.value = true
onMounted(async () => {
  if (!gerufen) return
  await nextTick()
  // `?wkr` meint die Tabelle der Wettkampfrichter (alte Verweise aus den Einstellungen), `?besetzung` den Block.
  const el = ziel === 'wkr' ? block.value?.querySelector('#wkr-einteilung') : block.value
  el?.scrollIntoView?.({ block: 'start' })
})

// Keine Beispiel-Knöpfe hier (Wunsch des Nutzers vom 21.11.2026): Beispielwerte entstehen an EINER
// Stelle, im Block „Beispieldaten“ (BeispieldatenPanel.vue), auch Beispiel-Boote und -Co-Piloten.

function setze(feld: 'boot' | CoPilotRolle, klasse: ClassId, e: Event) {
  const text = (e.target as HTMLInputElement).value
  dispatch(feld === 'boot' ? { type: 'SET_BOOT', klasse, text } : { type: 'SET_CO_PILOT', klasse, text, rolle: feld })
}

// --- Co-Piloten: Name und Gewicht je Rolle (R11-07, 26.11.2026) ---
const ROLLEN: readonly { rolle: CoPilotRolle; name: string; kg: string }[] = [
  { rolle: 'haupt', name: 'coPilot', kg: 'coPilotKg' },
  { rolle: 'ersatz', name: 'ersatz', kg: 'ersatzKg' },
]
const person = (klasse: ClassId, rolle: CoPilotRolle) => state.value.coPiloten[klasse]?.[rolle]
const kgText = (kg: number | undefined) => (kg === undefined ? '' : gewichtText(kg, locale.value))

/** Gewicht lesen wie in der Verwiegung (Komma oder Punkt, „72,5 kg“); Unlesbares entfernt es, das Feld zeigt danach, was gilt. */
function setzeGewicht(klasse: ClassId, rolle: CoPilotRolle, e: Event) {
  const feld = e.target as HTMLInputElement
  dispatch({ type: 'SET_CO_PILOT_GEWICHT', klasse, rolle, gewicht: parseGewicht(feld.value) ?? null })
  feld.value = kgText(person(klasse, rolle)?.gewicht)
}

/**
 * Was neben dem Gewicht steht: das Ausgleichsgewicht („+3 kg Ausgleich“) oder „Gewicht fehlt“, wenn andere seiner
 * Gruppe gewogen sind (lib/ausgleich.ts coPilotAusgleichVon); sonst nichts – auch beim schwersten Co-Piloten.
 * Ein Gewicht ohne Namen zählt nicht (Prüfbefund 27.11.2026: Name gelöscht = Person fällt weg) – das sagt der Satz
 * „zählt erst mit Namen“, damit niemand rätselt, warum kein Ausgleich erscheint. Das Gewicht bleibt gespeichert (beim
 * Neutippen des Namens geht es nicht verloren): bestätigt 27.11.2026 (R12-06).
 */
function agText(klasse: ClassId, rolle: CoPilotRolle): string {
  const p = person(klasse, rolle)
  if (p && p.gewicht !== undefined && p.name.trim() === '') return t('crew.coPilot.nameMissing')
  const ag = coPilotAusgleichVon(state.value, klasse, rolle)
  return ag === 'fehlt' ? t('crew.coPilot.weightMissing') : ag ? t('crew.coPilot.ballast', { kg: kgText(ag) }) : ''
}

// Enter springt ins Feld darunter – erst alle Boote, dann alle Co-Piloten mit Gewicht, dann die Ersatz-Co-Piloten mit
// Gewicht, wie man es vom Zettel abliest.
const SPALTEN = ['boot', 'coPilot', 'coPilotKg', 'ersatz', 'ersatzKg']
const tabelle = ref<HTMLTableElement>()
function weiter(e: Event) {
  const feld = e.target as HTMLInputElement
  const spalte = [...(tabelle.value?.querySelectorAll<HTMLInputElement>(`input[data-spalte="${feld.dataset.spalte}"]`) ?? [])]
  const folgende = SPALTEN[SPALTEN.indexOf(feld.dataset.spalte ?? '') + 1]
  const naechstes = spalte[spalte.indexOf(feld) + 1] ?? (folgende ? tabelle.value?.querySelector<HTMLInputElement>(`input[data-spalte="${folgende}"]`) : undefined)
  naechstes?.focus()
  naechstes?.select()
}
</script>

<template>
  <details id="besetzung" ref="block" class="panel besetzung" data-block="besetzung" :open="offen" @toggle="offen = ($event.target as HTMLDetailsElement).open">
    <summary>
      {{ t('crew.title') }}
      <span class="besetzung-stand" data-hinweis="besetzung-stand">{{
        leer ? t('crew.status.empty') : t('crew.status', { boats: boote, classes: classes.length, copilots: coPiloten, copilotClasses: coPilotKlassen.length, judges: wkr })
      }}</span>
    </summary>
    <p class="hint">{{ t('crew.intro') }}</p>

    <div class="besetzung-teil" data-teil="klassen">
      <h3 class="subhead">{{ t('crew.classes.title') }}</h3>
      <p class="hint">
        {{ t('crew.classes.hint') }}
        <template v-if="coPilotKlassen.length > 0">{{ t('crew.classes.coPilotRule', { rulebook: regelwerk.label, classes: coPilotKlassen.map((c) => classLabel(c.id)).join(', ') }) }}</template>
      </p>
      <table ref="tabelle" class="besetzung-tabelle">
        <thead>
          <tr>
            <th scope="col">{{ t('lists.class') }}</th>
            <th scope="col">{{ t('crew.boat') }}</th>
            <th scope="col">{{ t('crew.coPilot') }}</th>
            <th scope="col" class="besetzung-kg">{{ t('crew.weight') }}</th>
            <th scope="col">{{ t('crew.coPilotSubstitute') }}</th>
            <th scope="col" class="besetzung-kg">{{ t('crew.weight') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in classes" :key="c.id" :data-klasse="c.id">
            <th scope="row">
              <span class="class-badge sm" :style="{ background: classColor(c.id) }">{{ classBadge(c.id) }}</span>
              {{ classLabel(c.id) }}
            </th>
            <td :data-titel="t('crew.boat')">
              <input
                class="cell-input"
                autocomplete="off"
                data-spalte="boot"
                :data-feld="`boot|${c.id}`"
                :maxlength="BESETZUNG_MAX"
                :value="state.boote[c.id] ?? ''"
                :placeholder="t('crew.boatPlaceholder')"
                :aria-label="t('crew.boatFor', { name: classLabel(c.id) })"
                @input="setze('boot', c.id, $event)"
                @keydown.enter.prevent="weiter"
              />
            </td>
            <!-- Wo das Regelwerk keinen Co-Piloten vorsieht, bleiben die Felder – unauffällig: Club- und
                 Landesmeisterschaften dürfen begründet abweichen (DM-Reglement, Abschnitt C). Je Rolle Name und
                 Gewicht (R11-07, 26.11.2026); unter dem Gewicht das Ausgleichsgewicht, das daraus folgt. -->
            <template v-for="r in ROLLEN" :key="r.rolle">
              <td :data-titel="r.rolle === 'haupt' ? t('crew.coPilot') : t('crew.coPilotSubstitute')">
                <input
                  :class="['cell-input', coPilotVorgesehen(state.regelwerk, c.id) ? '' : 'besetzung-ohne']"
                  autocomplete="off"
                  :data-spalte="r.name"
                  :data-feld="`${r.name}|${c.id}`"
                  :maxlength="BESETZUNG_MAX"
                  :value="person(c.id, r.rolle)?.name ?? ''"
                  :placeholder="coPilotVorgesehen(state.regelwerk, c.id) ? t('wkr.name') : t('crew.coPilotNone')"
                  :aria-label="t(r.rolle === 'haupt' ? 'crew.coPilotFor' : 'crew.coPilotSubstituteFor', { name: classLabel(c.id) })"
                  @input="setze(r.rolle, c.id, $event)"
                  @keydown.enter.prevent="weiter"
                />
              </td>
              <td class="besetzung-kg" :data-titel="t('crew.weight')">
                <input
                  :class="['cell-input', coPilotVorgesehen(state.regelwerk, c.id) ? '' : 'besetzung-ohne']"
                  autocomplete="off"
                  inputmode="decimal"
                  :data-spalte="r.kg"
                  :data-feld="`${r.kg}|${c.id}`"
                  :value="kgText(person(c.id, r.rolle)?.gewicht)"
                  placeholder="kg"
                  :aria-label="t(r.rolle === 'haupt' ? 'crew.coPilotWeightFor' : 'crew.coPilotSubstituteWeightFor', { name: classLabel(c.id) })"
                  @change="setzeGewicht(c.id, r.rolle, $event)"
                  @keydown.enter.prevent="weiter"
                />
                <span v-if="agText(c.id, r.rolle)" class="besetzung-ag" :data-ag="`${c.id}|${r.rolle}`">{{ agText(c.id, r.rolle) }}</span>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
      <!-- Wogegen das Ausgleichsgewicht der Co-Piloten rechnet – die Wahl selbst ist eine Einstellung (Projektregel:
           Einstellungen in SettingsView), der Verweis führt hin (R11-07, 26.11.2026; bestätigt 27.11.2026, R12-08). -->
      <p class="note" data-hinweis="co-pilot-ausgleich">
        {{ t(state.coPilotAusgleich === 'alle' ? 'crew.coPilot.compensationAll' : 'crew.coPilot.compensationClass') }}
        <a :href="adresse('einstellungen', { ziel: 'gewichte' })" data-verweis="co-pilot-ausgleich">{{ t('crew.coPilot.compensationChange') }}</a>
      </p>
      <p class="note">{{ t('crew.privacyNote') }}</p>
    </div>

    <WkrEinteilung eingebettet />
  </details>
</template>
