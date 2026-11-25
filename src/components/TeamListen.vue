<script setup lang="ts">
import { computed } from 'vue'
import KopfLogos from './KopfLogos.vue'
import { useStore } from '../state/store'
import { useEvent } from '../lib/event'
import { useListenSprache } from '../lib/listensprache'
import { geburtsdatumAufListe } from '../i18n'
import { SEITEN_VORGABE } from '../lib/seiten'
import type { TeamListe } from '../lib/teamListe'
import ListenDokument from './ListenDokument.vue'
import { geschlechtAufListe } from '../domain/geschlecht'
import { herkunftAnzeige } from '../lib/origin'
// Dasselbe Dezimalzeichen wie auf der Gewichtsliste je Herkunft (Sprache der Liste).
import { gewichtText } from '../domain/gewicht'

/**
 * Die Liste der Fahrer je Team nach Regel 960, Pkt. 3.7 (lib/teamListe.ts): je Team ein eigenes
 * Dokument im Querformat, nach Startnummer. Die Spalten in der Folge des Wortlauts von Pkt. 3.7
 * („Race number; Name and surname; Sex; Date of birth (day/month/year); Verified weight and
 * ballast required; Class. For classes Dolphin, 1 - 3 also the name of the co-driver“): Race
 * number, Name, Vorname, Sex, Date of birth, Verified weight, Ballast required, Class und
 * (Klassen Dolphin, 1 – 3) der Co-Driver. Der Kopf folgt den übrigen Listen: Liste | Team |
 * Veranstaltung.
 *
 * Eine interne Liste: Sie steht nur hier unter „Gewichtslisten“, nie in der Druckdatei. Das
 * Geburtsdatum folgt der Listen-Option der Veranstaltung (`geburtsdatum`); alles steht in der
 * Sprache des Regelwerks (lib/listensprache.ts).
 */
const props = defineProps<{ listen: TeamListe[]; geburtsdatum: boolean }>()

const { state } = useStore()
const { classCell } = useEvent()
const { t: lt, listenLocale } = useListenSprache()

const heading = computed(() => [state.value.eventName, state.value.eventJahr].filter(Boolean).join(' '))
// Nationen international (Entscheidung des Nutzers vom 15.11.2026): Auf einer englischen Liste der englische Name des Staates.
const teamName = (name: string) => herkunftAnzeige(name, state.value.originMode, 'lang', state.value.originShort, listenLocale.value).text
const spalten = computed(() => 8 + (props.geburtsdatum ? 1 : 0))
// Lange Namen kleiner statt umbrochen – wie auf den Starterlisten.
const fit = (text: string, normal: number) => (text.length > normal * 1.9 ? 'fit-3' : text.length > normal * 1.35 ? 'fit-2' : text.length > normal ? 'fit-1' : '')
</script>

<template>
  <div class="sheet weights team-liste">
    <!-- Je Team ein Dokument: Es teilt sich selbst in Seiten und zählt nur die eigenen. -->
    <div v-for="l in listen" :key="l.schluessel" class="sheet-section" :data-liste="`team:${l.schluessel}`">
      <ListenDokument v-slot="{ teile }" class="sheet-page" :laengen="[l.zeilen.length]" format="landscape" :vorgabe="SEITEN_VORGABE.team" :sprache="listenLocale">
        <table class="sheet-table">
          <thead>
            <tr class="sheet-title">
              <th :colspan="spalten">
                <KopfLogos>
                  <div class="sheet-title-box">
                    <span class="list" data-feld="liste">{{ lt('lists.title.team') }}</span>{{ ' ' }}
                    <span class="feld" data-feld="team">{{ teamName(l.name) }}</span>{{ ' ' }}
                    <span class="event" data-feld="veranstaltung">{{ heading }}</span>
                  </div>
                </KopfLogos>
              </th>
            </tr>
            <tr class="sheet-cols">
              <th class="narrow">{{ lt('common.startNr') }}</th>
              <th>{{ lt('common.lastName') }}</th>
              <th>{{ lt('common.firstName') }}</th>
              <th class="narrow" data-spalte="geschlecht">{{ lt('lists.sex') }}</th>
              <th v-if="geburtsdatum" class="narrow" data-spalte="geburtsdatum">{{ lt('common.birthdate') }}</th>
              <th class="weight">{{ lt('lists.weightVerified') }}</th>
              <th class="weight">{{ lt('lists.ballastRequired') }}</th>
              <th class="narrow" data-spalte="klasse">{{ lt('lists.class') }}</th>
              <th>{{ lt('lists.coPilot') }}</th>
            </tr>
          </thead>
          <tbody v-for="teil in teile" :key="teil.block">
            <!-- Jede fünfte Zeile grau, über das Dokument durchgezählt. -->
            <tr v-for="(z, i) in l.zeilen.slice(teil.von, teil.bis)" :key="z.starter.id" :class="{ shade: (teil.von + i + 1) % 5 === 0 }" :data-starter="z.starter.id">
              <td class="narrow">{{ z.starter.startNr }}</td>
              <td :class="fit(z.starter.nachname, 22)">{{ z.starter.nachname }}</td>
              <td :class="fit(z.starter.vorname, 22)">{{ z.starter.vorname }}</td>
              <td class="narrow" data-spalte="geschlecht">{{ geschlechtAufListe(z.starter.geschlecht, listenLocale) }}</td>
              <td v-if="geburtsdatum" class="narrow" data-spalte="geburtsdatum">{{ z.starter.geburtsdatum ? geburtsdatumAufListe(listenLocale, z.starter.geburtsdatum) : '' }}</td>
              <!-- Leer hieße „kein Ballast nötig“ – wer nicht gewogen ist, steht deshalb ausdrücklich da. -->
              <td v-if="z.ausgleich === undefined" class="weight ungewogen" colspan="2">{{ lt('lists.notWeighed') }}</td>
              <template v-else>
                <td class="weight">{{ z.starter.gewicht === undefined ? '' : gewichtText(z.starter.gewicht, listenLocale) }} kg</td>
                <!-- Auf 0 gerundet (weniger als eine halbe Stufe leichter) = „keiner nötig“, also auch „–“ – nicht „0 kg“
                     neben „–“ für dasselbe; wie die Liste „Ausgleichsgewichte“ (leer) und das Steg-Gerät („kein AG“).
                     Prüfbefund 24.11.2026 zur Abstufung: Bei 2 kg trifft das jeden, der weniger als 1 kg leichter ist. -->
                <td class="weight ausgleich-kg">{{ !z.ausgleich ? '–' : `${gewichtText(z.ausgleich, listenLocale)} kg` }}</td>
              </template>
              <td class="narrow" data-spalte="klasse">{{ classCell(z.starter.klasse) }}</td>
              <!-- Nur Dolphin, 1 – 3 (Pkt. 3.7); die übrigen Klassen fahren ohne Co-Driver. -->
              <td :class="z.coDriver === undefined ? 'ohne' : fit(z.coDriver, 22)">{{ z.coDriver === undefined ? '–' : z.coDriver }}</td>
            </tr>
          </tbody>
        </table>
      </ListenDokument>
    </div>
  </div>
</template>
