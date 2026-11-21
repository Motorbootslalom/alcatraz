<script setup lang="ts">
import { computed } from 'vue'
import KopfLogos from './KopfLogos.vue'
import { useStore } from '../state/store'
import { useEvent } from '../lib/event'
import { useListenSprache } from '../lib/listensprache'
import { listenNachname, type NamenArt } from '../lib/namen'
import { herkunftAnzeige, originLabelKey, starterHerkunft } from '../lib/origin'
import type { Herkunft } from '../lib/starterlisten'
import { rundenStartliste, type StartlistenZeile } from '../lib/parallelStartliste'
import { SEITEN_VORGABE } from '../lib/seiten'
import { rundenName } from '../planung/parallelRunden'
import type { ErgebnisHerkunft, ParallelRunde, Starter } from '../types'
import type { Racecourse } from '../lib/parallelSchluessel'
import HerkunftText from './HerkunftText.vue'
import ListenDokument from './ListenDokument.vue'

/**
 * Die Startlisten von Runden des Parallelslaloms (lib/parallelStartliste.ts): je Runde ein
 * eigenes Dokument im Hochformat – je Start eine Zeile mit Attempt, Klasse und wer auf
 * Racecourse A und B fährt, in den Blöcken des festgeschriebenen Plans. Ein Block bleibt auf
 * einer Seite (ListenDokument.vue); zwischen zwei Blöcken steht eine kräftige Linie.
 *
 * Für die Druckdatei (DruckdateiListen.vue): Dort steht die Liste vor den Wertungslisten ihrer
 * Runde, in der Fassung der Datei – Namen und Herkunft wie auf den Wertungslisten daneben.
 *
 * `racecourse`: statt A und B nebeneinander die Startliste EINES Racecourse – zum Aushang am
 * jeweiligen Parcours (Entscheidung des Nutzers vom 15.11.2026; unter „Listen → Starterlisten“,
 * nicht in der Druckdatei). Spalten Start, Attempt, Klasse, Nr., Name, Herkunft; die Start-Nummern
 * sind die der gemeinsamen Liste und der Listen der race officials, ein Dummy und ein entfallener
 * Start stehen als schraffierte Zeile da.
 *
 * Beide Formen sind abwechselnd weiß und grau wie die Listen der race officials (dieselbe
 * Einstellung `parallelZebra`; lib/bogen.ts): Jede zweite Zeile der Liste ist grau, gezählt über
 * die ganze Liste. Eine Zeile ohne Starter (Dummy auf der Liste eines Racecourse, entfallener
 * Start) zählt mit, bleibt aber weiß und schraffiert; auf der gemeinsamen Liste bleibt die Zelle
 * des Dummys schraffiert. Die Seiten werden NICHT ausgeglichen – nur ein Block bleibt auf einer
 * Seite; eine letzte Seite mit 2 oder 4 Zeilen ist in Ordnung (Entscheidung des Nutzers vom
 * 15.11.2026).
 */
const props = defineProps<{
  runden: readonly ParallelRunde[]
  /** Namen: voll, Nachname gekürzt („M.“) oder gar nicht – dann steht nur die Startnummer da. */
  namen?: NamenArt
  /** Wie die Herkunft dasteht; `aus` oder fehlt = keine. */
  herkunft?: ErgebnisHerkunft
  /** Nur die Starts dieses Racecourse, je Start eine Zeile; fehlt = A und B nebeneinander. */
  racecourse?: Racecourse
  /**
   * Markierung für eine Herkunft (Wunsch des Nutzers vom 21.11.2026, wie die verzahnte
   * Starterliste mit Markierung, lib/starterlisten.ts): die vollständige Liste, die Starter der
   * Herkunft fett und mit Dreieck am Rand der Tabelle – auf der gemeinsamen Liste links für A,
   * rechts für B, damit man sieht, auf welchem Racecourse sie fahren. Die Herkunft steht im Kopf.
   */
  markierung?: Herkunft
}>()

const { state } = useStore()
const { classCell } = useEvent()
const { t: lt, listenLocale, kuerzelNorm } = useListenSprache()

/** Je Runde die Liste und je Block die Zahl der Zeilen davor – die graue Zeile zählt über die ganze Liste. */
const listen = computed(() =>
  props.runden.flatMap((r) => {
    const l = rundenStartliste(state.value, r)
    if (!l) return []
    const beginn: number[] = []
    l.bloecke.reduce((n, b, i) => ((beginn[i] = n), n + b.length), 0)
    return [{ ...l, beginn }]
  }),
)
const zebra = computed(() => state.value.parallelZebra !== false)
/** Grau ist jede zweite Zeile der Liste (`nr` ab 1) – außer einer Zeile ohne Starter: Sie zählt mit, bleibt aber weiß. */
const grau = (nr: number, ohne: boolean) => zebra.value && nr % 2 === 0 && !ohne
const heading = computed(() => [state.value.eventName, state.value.eventJahr].filter(Boolean).join(' '))
const mitNamen = computed(() => props.namen !== 'ohne')
const mitHerkunft = computed(() => state.value.originMode !== 'none' && props.herkunft !== undefined && props.herkunft !== 'aus')
const name = (p: Starter) => [listenNachname(p, props.namen), p.vorname].filter(Boolean).join(', ')
const herkunft = (p: Starter) => starterHerkunft(p, state.value.originMode, props.herkunft === undefined || props.herkunft === 'aus' ? 'kurz' : props.herkunft, state.value.originShort, listenLocale.value, kuerzelNorm.value)
/** Spalten je Racecourse auf der gemeinsamen Liste: Nummer, Name, Herkunft. */
const jeRacecourse = computed(() => 1 + (mitNamen.value ? 1 : 0) + (mitHerkunft.value ? 1 : 0))
/** Auf der Liste eines Racecourse: Nummer, Name und Vorname (wie auf den Starterlisten), Herkunft. */
const amStarter = computed(() => 1 + (mitNamen.value ? 2 : 0) + (mitHerkunft.value ? 1 : 0))
/** Alle Spalten: Start, Attempt, Klasse und die des Starters (gemeinsam: je Racecourse). */
const spalten = computed(() => 3 + (props.racecourse === undefined ? 2 * jeRacecourse.value : amStarter.value))
const racecourseText = (rc: Racecourse) => lt(rc === 'A' ? 'parallel.parcoursA' : 'parallel.parcoursB')
/** Wer in einem Start auf dem gewählten Racecourse fährt; `null` = der Dummy. */
const amRacecourse = (z: StartlistenZeile) => (props.racecourse === 'B' ? z.b : z.a)
const fit = (text: string, normal: number) => (text.length > normal * 1.9 ? 'fit-3' : text.length > normal * 1.35 ? 'fit-2' : text.length > normal ? 'fit-1' : '')

// Markierung: wer zur gewählten Herkunft gehört (über die ID – Schreibweisen sind dort schon zusammengefasst).
const eigene = computed(() => new Set(props.markierung?.starter.map((p) => p.id) ?? []))
const eigen = (p: Starter | null) => p !== null && eigene.value.has(p.id)
const titelHerkunft = computed(() =>
  props.markierung ? herkunftAnzeige(props.markierung.name, state.value.originMode, state.value.listOrigin.startsWith('flagge') ? 'flagge-lang' : 'lang', state.value.originShort, listenLocale.value) : undefined,
)

// Feste Spaltenbreiten der gemeinsamen Liste (A und B nebeneinander). Ohne sie machten lange
// Herkünfte („Mecklenburg-Vorpommern“ zweimal in einer Zeile) die Tabelle breiter als das Blatt
// (186 mm, styles/app.css `.sheet-section`): Am Bildschirm ragte sie aus dem Blatt, im Druck
// verkleinerte der Browser die Seite (gemeldet vom Nutzer am 21.11.2026).
// Zweiter Anlauf (21.11.2026, „die Wörter gehen über die Linien“): Je SPALTE eine Schriftgröße
// nach ihrem längsten Eintrag – nicht je Zelle, das sprang von Zeile zu Zeile. Name und Herkunft
// teilen sich den Platz nach Bedarf; was auch in der kleinsten Größe nicht passt, bricht in der
// Zelle um (`psl-umbruch`), statt über die Linie zu laufen. Die Zeilen misst ListenDokument danach,
// die Seitenteilung bleibt richtig.
/** Breite eines Zeichens in mm bei 10,5 pt Arial – eher reichlich, damit auch Fettes (Markierung) passt. */
const ZEICHEN_MM = 2
/** Innenabstand der Zelle (6 px links und rechts, styles/app.css `.sheet-table td`) und Linien. */
const INNEN_MM = 3.4
/** Kleinste Schrift (Bruchteil von 10,5 pt); darunter wird umbrochen. */
const KLEINST = 0.7
/** Breite des Blatts: quer 273 mm (styles/app.css `.parallel-startliste.quer`), hoch 186 mm. */
const BLATT_MM = 273
const FEST_MM = { start: 11, attempt: 16 }
/** Mit Markierung ist die Tabelle beidseits 6 mm schmaler – Platz für die Dreiecke (`.sheet-table--markierung`). */
const breite = computed(() => BLATT_MM - (props.markierung ? 12 : 0))
// Um welche Plätze ein Finale geht, sagt seit 21.11.2026 der Titel der Runde (Kleines Finale, Finale) – kein Zusatz mehr.
const klasseText = (z: StartlistenZeile) => (z.klasse ? classCell(z.klasse) : '')
const bedarf = (zeichen: number) => zeichen * ZEICHEN_MM + INNEN_MM
/** Schrift und Umbruch einer Spalte: so groß, wie der längste Eintrag es zulässt, höchstens 1, mindestens KLEINST. */
const schrift = (zeichen: number, mm: number) => {
  const s = zeichen === 0 ? 1 : (mm - INNEN_MM) / (zeichen * ZEICHEN_MM)
  return { groesse: Math.min(1, Math.max(KLEINST, s)), umbruch: s < KLEINST }
}
const satz = computed(() => {
  let nameZ = 0
  let herk = 0
  let klasse = 0
  let nr = 0
  for (const l of listen.value)
    for (const b of l.bloecke)
      for (const z of b) {
        klasse = Math.max(klasse, klasseText(z).length)
        for (const p of [z.a, z.b]) {
          if (!p) continue
          nr = Math.max(nr, p.startNr.length)
          if (mitNamen.value) nameZ = Math.max(nameZ, name(p).length)
          if (mitHerkunft.value) herk = Math.max(herk, herkunft(p).mass.length)
        }
      }
  // Klasse darf etwas kleiner stehen; Nummern nie.
  const klasseMm = Math.min(30, Math.max(15, bedarf(klasse) * 0.85))
  const nrMm = Math.min(14, Math.max(10, bedarf(nr)))
  const rest = (breite.value - FEST_MM.start - FEST_MM.attempt - klasseMm) / 2 - nrMm
  // Name und Herkunft: dieselbe Verkleinerung für beide, solange es reicht; die Herkunft höchstens 55 % der Breite.
  const inhalt = rest - (mitNamen.value ? INNEN_MM : 0) - (mitHerkunft.value ? INNEN_MM : 0)
  const s = Math.min(1, Math.max(KLEINST, inhalt / ((nameZ + herk) * ZEICHEN_MM || 1)))
  const herkMm = !mitHerkunft.value ? 0 : !mitNamen.value ? rest : Math.min(rest * 0.55, herk * ZEICHEN_MM * s + INNEN_MM)
  const nameMm = mitNamen.value ? rest - herkMm : 0
  return {
    mm: { klasse: klasseMm, nr: nrMm, name: nameMm, herkunft: herkMm },
    klasse: schrift(klasse, klasseMm),
    name: schrift(nameZ, nameMm),
    herkunft: schrift(herk, herkMm),
  }
})
/** Stil einer Zelle der gemeinsamen Liste nach ihrer Spalte. */
const zellStil = (sp: { groesse: number }) => (sp.groesse < 1 ? { fontSize: `${sp.groesse.toFixed(3)}em` } : undefined)
</script>

<template>
  <!-- A und B nebeneinander im Querformat (Vorschlag des Nutzers vom 21.11.2026): doppelt so viele Spalten wie die Liste eines Racecourse. -->
  <div :class="['sheet', 'parallel-startliste', { quer: !racecourse }]">
    <div v-for="l in listen" :key="l.runde" class="sheet-section" :data-liste="racecourse ? `startliste:${l.runde}:${racecourse}` : `startliste:${l.runde}`" :data-racecourse="racecourse">
      <ListenDokument v-slot="{ teile }" class="sheet-page" :laengen="l.bloecke.map((b) => b.length)" :format="racecourse ? 'portrait' : 'landscape'" :vorgabe="racecourse ? SEITEN_VORGABE.starter : SEITEN_VORGABE.ergebnisLauf" :sprache="listenLocale">
        <table :class="['sheet-table', { 'sheet-table--markierung': markierung, 'psl-fest': !racecourse }]">
          <!-- Gemeinsame Liste: feste Breiten (siehe oben), je Racecourse Nr., Name, Herkunft. -->
          <colgroup v-if="!racecourse">
            <col :style="{ width: `${FEST_MM.start}mm` }" />
            <col :style="{ width: `${FEST_MM.attempt}mm` }" />
            <col :style="{ width: `${satz.mm.klasse}mm` }" />
            <template v-for="i in 2" :key="i">
              <col :style="{ width: `${satz.mm.nr}mm` }" />
              <col v-if="mitNamen" :style="{ width: `${satz.mm.name}mm` }" />
              <col v-if="mitHerkunft" :style="{ width: `${satz.mm.herkunft}mm` }" />
            </template>
          </colgroup>
          <thead>
            <tr class="sheet-title">
              <th :colspan="spalten">
                <KopfLogos>
                  <div class="sheet-title-box">
                    <span class="list" data-feld="liste">{{ lt('parallel.startlist.title') }}</span>{{ ' ' }}
                    <span class="feld" data-feld="runde">{{ lt('parallel.title') }} · {{ rundenName(l.runde, lt) }}<template v-if="racecourse"> · {{ racecourseText(racecourse) }}</template></span>{{ ' ' }}
                    <span v-if="titelHerkunft" class="feld" data-feld="herkunft"><HerkunftText :anzeige="titelHerkunft" /></span>{{ ' ' }}
                    <span class="event" data-feld="veranstaltung">{{ heading }}</span>
                  </div>
                </KopfLogos>
              </th>
            </tr>
            <!-- Ein Racecourse: Start, Attempt, Klasse, Nr., Name, Herkunft – eine Zeile je Start. -->
            <tr v-if="racecourse" class="sheet-cols">
              <th class="narrow">{{ lt('parallel.startlist.start') }}</th>
              <th class="narrow">{{ lt('parallel.attempt') }}</th>
              <th class="narrow">{{ lt('lists.class') }}</th>
              <th class="narrow">{{ lt('common.startNr') }}</th>
              <template v-if="mitNamen">
                <th>{{ lt('common.lastName') }}</th>
                <th>{{ lt('common.firstName') }}</th>
              </template>
              <th v-if="mitHerkunft" class="narrow">{{ lt(originLabelKey(state.originMode)) }}</th>
            </tr>
            <tr v-else class="sheet-cols">
              <th class="narrow" rowspan="2">{{ lt('parallel.startlist.start') }}</th>
              <th class="narrow" rowspan="2">{{ lt('parallel.attempt') }}</th>
              <th class="narrow" rowspan="2">{{ lt('lists.class') }}</th>
              <th :colspan="jeRacecourse" class="psl-a">{{ lt('parallel.parcoursA') }}</th>
              <th :colspan="jeRacecourse" class="psl-b">{{ lt('parallel.parcoursB') }}</th>
            </tr>
          </thead>
          <!-- Je Block (oder Stück eines Blocks) ein tbody: Die kräftige Linie trennt die Blöcke. -->
          <tbody v-for="teil in teile" :key="`${teil.block}:${teil.von}`" class="psl-block" :data-block="teil.block">
            <template v-for="(z, j) in l.bloecke[teil.block].slice(teil.von, teil.bis)" :key="z.start">
              <!-- Liste eines Racecourse: Ein Dummy und ein entfallener Start sind schraffierte Zeilen. -->
              <tr
                v-if="racecourse"
                :data-start="z.start"
                :data-ohne="z.entfaellt ? 'entfaellt' : amRacecourse(z) === null ? 'dummy' : undefined"
                :class="{ 'psl-ohne': z.entfaellt || amRacecourse(z) === null, shade: grau(l.beginn[teil.block] + teil.von + j + 1, z.entfaellt || amRacecourse(z) === null), markiert: !z.entfaellt && eigen(amRacecourse(z)) }"
                :data-markiert="!z.entfaellt && eigen(amRacecourse(z)) ? '' : undefined"
              >
                <td class="narrow">{{ z.start }}</td>
                <td class="narrow">{{ z.attempt }}</td>
                <td class="narrow">
                  {{ klasseText(z) }}
                </td>
                <td v-if="z.entfaellt || amRacecourse(z) === null" :colspan="amStarter" class="psl-dummy">{{ z.entfaellt ? lt('parallel.startlist.cancelled') : lt('parallel.dummy') }}</td>
                <template v-else>
                  <td class="narrow">{{ amRacecourse(z)!.startNr }}</td>
                  <template v-if="mitNamen">
                    <td :class="['psl-name', fit(listenNachname(amRacecourse(z)!, namen), 22)]">{{ listenNachname(amRacecourse(z)!, namen) }}</td>
                    <td :class="['psl-name', fit(amRacecourse(z)!.vorname, 18)]">{{ amRacecourse(z)!.vorname }}</td>
                  </template>
                  <td v-if="mitHerkunft" class="narrow"><HerkunftText :anzeige="herkunft(amRacecourse(z)!)" /></td>
                </template>
              </tr>
              <tr
                v-else
                :data-start="z.start"
                :data-markiert="!z.entfaellt && (eigen(z.a) || eigen(z.b)) ? (eigen(z.a) && eigen(z.b) ? 'ab' : eigen(z.a) ? 'a' : 'b') : undefined"
                :class="{ 'psl-entfaellt': z.entfaellt, shade: grau(l.beginn[teil.block] + teil.von + j + 1, z.entfaellt), 'markiert-a': !z.entfaellt && eigen(z.a), 'markiert-b': !z.entfaellt && eigen(z.b) }"
              >
                <td class="narrow">{{ z.start }}</td>
                <td class="narrow">{{ z.attempt }}</td>
                <td :class="['narrow', { 'psl-umbruch': satz.klasse.umbruch }]" :style="zellStil(satz.klasse)">{{ klasseText(z) }}</td>
                <td v-if="z.entfaellt" :colspan="2 * jeRacecourse" class="psl-dummy">{{ lt('parallel.startlist.cancelled') }}</td>
                <template v-for="(p, i) in [z.a, z.b]" v-else :key="i">
                  <td v-if="p === null" :colspan="jeRacecourse" :class="['psl-dummy', i === 0 ? 'psl-a' : 'psl-b']">{{ lt('parallel.dummy') }}</td>
                  <template v-else>
                    <td :class="['narrow', i === 0 ? 'psl-a' : 'psl-b', { 'psl-eigen': eigen(p) }]">{{ p.startNr }}</td>
                    <td v-if="mitNamen" :class="['psl-name', { 'psl-eigen': eigen(p), 'psl-umbruch': satz.name.umbruch }]" :style="zellStil(satz.name)">{{ name(p) }}</td>
                    <td v-if="mitHerkunft" :class="{ 'psl-eigen': eigen(p), 'psl-umbruch': satz.herkunft.umbruch }" :style="zellStil(satz.herkunft)"><HerkunftText :anzeige="herkunft(p)" /></td>
                  </template>
                </template>
              </tr>
            </template>
          </tbody>
        </table>
      </ListenDokument>
    </div>
  </div>
</template>
