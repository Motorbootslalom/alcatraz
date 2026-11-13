<script setup lang="ts">
import BlickErklaerung from './BlickErklaerung.vue'
import ParcoursNachweis from './ParcoursNachweis.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { listenSprache } from '../lib/listensprache'
import { configFor } from '../config/konfig'
import { manoeverAufbauten } from '../config/catalog'
import type { Meldung } from '../config/eigene'
import type { Blick, RawAufbau } from '../config/schema'
import ZuordnungImBild from './ZuordnungImBild.vue'
import WkrVorschau from './WkrVorschau.vue'
import {
  ausAufbau,
  befund,
  BLICKE,
  leererEntwurf,
  lueckenJeFeld,
  ohneEnglischenTitel,
  namensteil,
  neueId,
  spaltenFarbe,
  umschalten,
  zeitnahmeId,
  ZEILEN,
  ZEITNAHMEN,
  zuAufbau,
  type Entwurf,
  type Spalte,
  type Zeile,
} from '../lib/assistent'
import { BLICK_NAME, feldName, haelfteName, lueckenName, ZEILEN_KLASSEN, ZEITNAHME_NAME, zeilenName } from '../lib/assistentTexte'
import { parcoursSvg } from '../lib/parcoursQuelle'
import { t, type MessageKey } from '../i18n'

/**
 * Assistent für eigene Aufbauten (Vorbild: AufbauAssistent.vue im Fehlerpunkte-Prototyp,
 * KONZEPT-POSITIONEN.md §7). Je Position eine Spalte; ein Klick in die Tabelle legt fest,
 * welche Boje oder Aufgabe sie beobachtet. „Im Bild“ geht dasselbe mit einer Freihandlinie
 * um die Bojen (ZuordnungImBild.vue, KONZEPT-NAMEN-FREIHAND.md §2); die Tabelle bleibt der
 * Weg für die Tastatur.
 *
 * Anders als im Prototyp läuft der Entwurf nicht als Vorschau durch den Zustand: Er lebt
 * nur in dieser Komponente und wird erst mit „Speichern“ – nach der Prüfung – als Action
 * abgeschickt. „Abbrechen“ muss deshalb nichts zurückdrehen. Die Beispielansicht der Listen
 * (WkrVorschau.vue) bekommt dafür eine eigene Konfiguration, die den Entwurf enthält.
 */
const props = defineProps<{
  modus: 'neu' | 'bearbeiten'
  /** `bearbeiten`: der eigene Aufbau. `neu`: die Vorlage, leer = ohne Vorlage beginnen. */
  aufbauId: string
}>()
const emit = defineEmits<{ schliessen: [] }>()
const { state, dispatch } = useStore()
const konfig = useKonfig()

// Zufall gehört hierher und nicht in den Reducer: Die Action bringt die fertigen IDs mit.
const vergeben = konfig.value.vergebeneIds()
const neuePositionsId = () => neueId('p', vergeben)
const bearbeitet = props.modus === 'bearbeiten' ? state.value.eigeneAufbauten.find((a) => a.id === props.aufbauId) : undefined
const entwurfsId = bearbeitet?.id ?? neueId('entwurf', vergeben)

const BLICK_ERKLAERUNG: MessageKey[] = [
  'assist.viewHelp.hinten',
  'assist.viewHelp.vorne',
  'assist.viewHelp.rechts',
  'assist.viewHelp.links',
]
// Zuordnen in der Tabelle oder im Bild. Die Wahl gehört zum Gerät (Tablet mit Stift oder
// Rechner mit Tastatur), nicht zur Veranstaltung: Sie steht im Browser, nicht im Stand.
const ANSICHT_KEY = 'alcatraz:assistent-zuordnen'
type Ansicht = 'tabelle' | 'bild'
function gemerkteAnsicht(): Ansicht {
  try {
    return localStorage.getItem(ANSICHT_KEY) === 'bild' ? 'bild' : 'tabelle'
  } catch {
    return 'tabelle'
  }
}
const ansicht = ref<Ansicht>(gemerkteAnsicht())
function ansichtWaehlen(a: Ansicht) {
  ansicht.value = a
  try {
    localStorage.setItem(ANSICHT_KEY, a)
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Schließen.
  }
}

// Vorlagen: die wählbaren Aufbauten für das Manövrieren, mitgelieferte und eigene.
const vorlagen = computed(() => manoeverAufbauten(state.value.eigeneAufbauten))

/** Ein Entwurf aus einer Vorlage ('' = leer); Name und ID bleiben die des Entwurfs. */
function ausVorlage(id: string, ziel: { id: string; name: string }) {
  const quelle = konfig.value.rohQuelle
  const vorlage: RawAufbau | undefined =
    state.value.eigeneAufbauten.find((a) => a.id === id) ?? quelle.aufbauten?.find((a) => a.id === id)
  if (!vorlage) return { entwurf: leererEntwurf(ziel.id, ziel.name), nichtUebernommen: [] }
  return ausAufbau(vorlage, quelle, ziel, neuePositionsId)
}

const start = bearbeitet
  ? ausAufbau(bearbeitet, konfig.value.rohQuelle, { id: bearbeitet.id, name: bearbeitet.name }, neuePositionsId, true)
  : ausVorlage(props.aufbauId, { id: entwurfsId, name: t('assist.defaultName') })
const entwurf = ref<Entwurf>(start.entwurf)
const nichtUebernommen = ref<string[]>(start.nichtUebernommen)
const vorlageId = ref(props.modus === 'neu' ? props.aufbauId : '')
const offen = ref(new Set<string>())
const fehler = ref<Meldung[]>([])

function vorlageWaehlen(id: string) {
  vorlageId.value = id
  const neu = ausVorlage(id, { id: entwurf.value.id, name: entwurf.value.name })
  entwurf.value = neu.entwurf
  nichtUebernommen.value = neu.nichtUebernommen
}

// ---- Laufende Prüfung -----------------------------------------------------------------
const aufbau = computed(() => zuAufbau(entwurf.value))
const markiert = computed(() => befund(entwurf.value))
const luecken = computed(() => lueckenJeFeld(konfig.value.entwurfsLuecken(aufbau.value)))

// Das Bild zum Zeichnen: Klasse 7 zeigt alle Bojen; eine Kursvariante bringt ihr eigenes mit.
// Der Entwurf steht noch nicht in der Konfiguration, deshalb hier über den Kurs statt über bildDatei().
const bild = computed(() => {
  const eigenes = konfig.value.rohQuelle.kurse?.find((k) => k.id === entwurf.value.kurs)?.bilder?.['7']
  return parcoursSvg(eigenes ?? 'Klasse7') ?? parcoursSvg('Klasse7') ?? ''
})

// ---- Beispielansicht: der Entwurf als eigener Aufbau ------------------------------------
// Die Konfiguration ist eine reine Funktion der Auswahl: Für die Ansicht wird sie mit dem
// Entwurf an Stelle des gespeicherten Aufbaus gebaut – nichts davon berührt den Stand.
// Die Ansicht gehört zum Assistenten und steht immer darunter: Wer Bojen zuordnet, sieht
// sofort, was auf den Listen ankommt. Gebaut wird mit kurzer Verzögerung, damit nicht jeder
// Tastendruck im Namensfeld die Liste neu aufbaut.
const vorschauOffen = ref(true)
const vorschauAufbau = ref<RawAufbau>()
let vorschauTimer: ReturnType<typeof setTimeout> | undefined
watch(
  [aufbau, vorschauOffen],
  ([a, offen]) => {
    clearTimeout(vorschauTimer)
    if (!offen) return
    const uebernehmen = () => (vorschauAufbau.value = JSON.parse(JSON.stringify(a)) as RawAufbau)
    if (vorschauAufbau.value) vorschauTimer = setTimeout(uebernehmen, 200)
    else uebernehmen()
  },
  // Sofort: Die Ansicht steht schon da, wenn der Assistent aufgeht.
  { deep: true, immediate: true },
)
onBeforeUnmount(() => clearTimeout(vorschauTimer))
const vorschauKonfig = computed(() => {
  const a = vorschauAufbau.value
  if (!a) return undefined
  const k = configFor({
    regelwerk: state.value.regelwerk,
    sprache: listenSprache.value,
    eigeneAufbauten: [...state.value.eigeneAufbauten.filter((x) => x.id !== a.id), a],
  })
  // Ein Entwurf, den die Prüfung (noch) ablehnt, steht nicht in der Konfiguration.
  return k.getAufbauten().some((x) => x.id === a.id) ? k : undefined
})

// Englische Titel: nur, wo das Regelwerk Englisch anbietet (UIM). Das Feld ist freiwillig;
// ohne Eintrag steht auf englischen Listen der deutsche Titel. Genannt wird das als Hinweis.
const mitEnglisch = computed(() => konfig.value.regelwerk.sprachen.includes('en'))
// Mitgelieferte Übersetzungen (deutscher Titel → englischer): Für „Steg“ oder „Tor 1 / 3 / 5“
// ist nichts einzutragen; das Feld zeigt dann, was ohnehin gilt.
const enTexte = computed<Readonly<Record<string, string>>>(() => konfig.value.rohQuelle.uebersetzungen?.en?.texte ?? {})
const ohneEnglisch = computed(() => (mitEnglisch.value ? ohneEnglischenTitel(entwurf.value, enTexte.value) : []))

function klassenText(k: string[]): string {
  return k.length === 8 ? t('assist.allClasses') : t('assist.classesShort', { classes: k.join(', ') })
}

// ---- Tabelle --------------------------------------------------------------------------
function felder(z: Zeile): string[] {
  return z.haelften ? z.haelften.map((h) => h.id) : [z.id]
}

function symbol(z: Zeile, spalte: string, haelfte?: string): string {
  const fs = haelfte ? [haelfte] : felder(z)
  const n = fs.filter((f) => entwurf.value.zuordnung[f]?.includes(spalte)).length
  return n === 0 ? '' : n === fs.length ? '●' : '◐'
}

/** Der Zustand einer Zelle für Vorleseprogramme: ganz, gar nicht oder nur eine Boje des Tores. */
function gedrueckt(z: Zeile, spalte: string, haelfte?: string): 'true' | 'false' | 'mixed' {
  const zeichen = symbol(z, spalte, haelfte)
  return zeichen === '●' ? 'true' : zeichen === '◐' ? 'mixed' : 'false'
}

function zelleDoppelt(z: Zeile, spalte: string, haelfte?: string): boolean {
  return (haelfte ? [haelfte] : felder(z)).some(
    (f) => markiert.value.doppelt.includes(f) && entwurf.value.zuordnung[f]?.includes(spalte),
  )
}

function zeileFehlt(z: Zeile, haelfte?: string): boolean {
  return (haelfte ? [haelfte] : felder(z)).some((f) => markiert.value.fehlt.includes(f))
}

function klick(z: Zeile, spalte: string, haelfte?: string) {
  entwurf.value = umschalten(entwurf.value, z, spalte, haelfte)
}

function aufklappen(id: string) {
  const neu = new Set(offen.value)
  if (neu.has(id)) neu.delete(id)
  else neu.add(id)
  offen.value = neu
}

function spalteDazu() {
  entwurf.value.spalten.push({
    id: neuePositionsId(),
    titel: t('assist.defaultPosition', { n: entwurf.value.spalten.length + 1 }),
  })
}

function spalteWeg(id: string) {
  // Eine neue Zuordnung statt Ändern am Platz: „Rückgängig“ im Bild hält frühere Stände fest
  // (auch die entfernte Position selbst, siehe ZuordnungImBild.vue).
  entwurf.value = {
    ...entwurf.value,
    spalten: entwurf.value.spalten.filter((s) => s.id !== id),
    zuordnung: Object.fromEntries(Object.entries(entwurf.value.zuordnung).map(([f, spalten]) => [f, spalten.filter((s) => s !== id)])),
  }
}

function blickSetzen(s: Spalte, blick: string) {
  if (blick) s.blick = blick as Blick
  else delete s.blick
}

function zeitnahmeSetzen(s: Spalte, id: string) {
  const z = ZEITNAHMEN.find((x) => x.id === id)
  if (z?.zeiten) s.zeiten = [...z.zeiten]
  else delete s.zeiten
}

// ---- Speichern ------------------------------------------------------------------------
const ISSUE_KEYS: Record<string, MessageKey> = {
  AUFBAU_ID: 'own.issue.AUFBAU_ID',
  AUFBAU_NAME: 'own.issue.AUFBAU_NAME',
  AUFBAU_VORHANDEN: 'own.issue.AUFBAU_VORHANDEN',
  AUFBAU_LEER: 'own.issue.AUFBAU_LEER',
  POSITION_ID: 'own.issue.POSITION_ID',
  POSITION_VORHANDEN: 'own.issue.POSITION_VORHANDEN',
  NAME_FEHLT: 'assist.nameMissing',
}
const meldungText = (m: Meldung) => (ISSUE_KEYS[m.code] ? t(ISSUE_KEYS[m.code], m.params) : m.message)

function speichern() {
  // Ohne Namen wird nicht gespeichert – und kein Ersatzname in einer festen Sprache gesetzt.
  if (!entwurf.value.name.trim()) {
    fehler.value = [{ code: 'NAME_FEHLT', params: {}, message: '' }]
    return
  }
  // Ohne Reaktivitäts-Hüllen: In den Stand gehören schlichte Daten.
  const a = JSON.parse(JSON.stringify(aufbau.value)) as RawAufbau
  // Ein neuer Aufbau bekommt seine ID erst jetzt, aus dem endgültigen Namen.
  const id = bearbeitet ? a.id : neueId(namensteil(a.name), konfig.value.vergebeneIds())
  const fertig: RawAufbau = { ...a, id }
  const eigene = state.value.eigeneAufbauten
  // Gegen die brauchbaren eigenen: Ein beschädigter anderer Aufbau hindert das Speichern nicht.
  const pruefung = konfig.value.pruefeEigeneAufbauten({ aufbauten: [fertig] })
  if (pruefung.fehler.length > 0) {
    fehler.value = pruefung.fehler
    return
  }
  // Ein bearbeiteter Aufbau behält seinen Platz in der Liste, ein neuer kommt ans Ende.
  const aufbauten = eigene.some((x) => x.id === id) ? eigene.map((x) => (x.id === id ? fertig : x)) : [...eigene, fertig]
  dispatch({ type: 'SET_EIGENE_AUFBAUTEN', aufbauten })
  emit('schliessen')
}
</script>

<template>
  <section class="assistent">
    <h3>{{ t(`assist.title.${modus}`) }}</h3>
    <p class="hint">{{ t('assist.help') }}</p>
    <details class="sub-details assistent-blick">
      <summary>{{ t('assist.viewHelp.title') }}</summary>
      <div class="assistent-blick-inhalt">
        <BlickErklaerung />
        <div>
          <ul>
            <li v-for="key in BLICK_ERKLAERUNG" :key="key">{{ t(key) }}</li>
          </ul>
          <p class="note">{{ t('assist.viewHelp.text') }}</p>
        </div>
      </div>
      <ParcoursNachweis />
    </details>

    <div class="row" style="align-items: flex-end">
      <div class="field" style="flex: 1; min-width: 200px">
        <label for="as-name">{{ t('assist.name') }}</label>
        <input id="as-name" v-model="entwurf.name" class="input" :placeholder="t('assist.namePlaceholder')" />
      </div>
      <div v-if="modus === 'neu'" class="field">
        <label for="as-vorlage">{{ t('assist.template') }}</label>
        <select id="as-vorlage" class="input" :value="vorlageId" @change="vorlageWaehlen(($event.target as HTMLSelectElement).value)">
          <option value="">{{ t('assist.template.empty') }}</option>
          <option v-for="a in vorlagen" :key="a.id" :value="a.id">
            {{ a.eigen ? t('event.setupOwn', { name: a.name }) : a.name }}
          </option>
        </select>
      </div>
      <div class="field">
        <label for="as-kurs">{{ t('assist.course') }}</label>
        <select
          id="as-kurs"
          class="input"
          :value="entwurf.kurs ?? ''"
          @change="entwurf.kurs = ($event.target as HTMLSelectElement).value || undefined"
        >
          <option value="">{{ t('assist.course.standard') }}</option>
          <option v-for="k in konfig.kurse" :key="k.id" :value="k.id">{{ k.name }}</option>
        </select>
      </div>
      <div class="field">
        <label>{{ t('assist.also') }}</label>
        <div class="assistent-bausteine">
          <label class="boat-check"><input v-model="entwurf.vorsteg" type="checkbox" /> {{ t('assist.vorsteg') }}</label>
          <label class="boat-check"><input v-model="entwurf.steg" type="checkbox" /> {{ t('assist.steg') }}</label>
          <label class="boat-check"><input v-model="entwurf.knoten" type="checkbox" /> {{ t('assist.knoten') }}</label>
        </div>
      </div>
    </div>
    <p v-if="nichtUebernommen.length > 0" class="boat-banner warn" role="status">
      {{ t('assist.notTaken', { names: nichtUebernommen.join(', ') }) }}
    </p>

    <div class="row assistent-ansicht">
      <span id="as-ansicht" class="assistent-ansicht-label">{{ t('assist.mode.label') }}</span>
      <div class="segmented" role="group" aria-labelledby="as-ansicht">
        <button
          v-for="a in ['tabelle', 'bild'] as const"
          :key="a"
          type="button"
          :class="ansicht === a ? 'active' : ''"
          :aria-pressed="ansicht === a"
          @click="ansichtWaehlen(a)"
        >
          {{ t(`assist.mode.${a}`) }}
        </button>
      </div>
    </div>

    <ZuordnungImBild
      v-if="ansicht === 'bild'"
      :entwurf="entwurf"
      :befund="markiert"
      :bild="bild"
      :mit-englisch="mitEnglisch"
      @update:entwurf="entwurf = $event"
      @spalte-dazu="spalteDazu"
      @spalte-weg="spalteWeg"
    />

    <div v-else class="assistent-rahmen">
      <table class="assistent-tabelle">
        <thead>
          <tr>
            <th class="zeilenkopf">{{ t('assist.rowHead') }}</th>
            <!-- Die Farbe der Position ist dieselbe wie im Bild. -->
            <th
              v-for="s in entwurf.spalten"
              :key="s.id"
              :class="{ leer: markiert.leer.includes(s.id) }"
              :style="{ borderTop: `4px solid ${spaltenFarbe(entwurf, s.id)}` }"
            >
              <input v-model="s.titel" class="cell-input spalte-titel" :placeholder="t('assist.positionName')" :aria-label="t('assist.positionName')" />
              <input
                v-if="mitEnglisch"
                v-model="s.titelEn"
                class="cell-input"
                lang="en"
                :placeholder="enTexte[s.titel.trim()] ?? t('assist.positionNameEn')"
                :title="t('assist.positionNameEnTitle')"
                :aria-label="t('assist.positionNameEnFor', { position: s.titel })"
              />
              <select
                class="cell-input"
                :value="s.blick ?? ''"
                :title="t('assist.viewTitle')"
                :aria-label="t('assist.viewTitle')"
                @change="blickSetzen(s, ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="b in BLICKE" :key="b.id" :value="b.id">{{ t(BLICK_NAME[b.id]) }}</option>
              </select>
              <select
                class="cell-input"
                :value="zeitnahmeId(s.zeiten)"
                :title="t('assist.timing.title')"
                :aria-label="t('assist.timing.title')"
                @change="zeitnahmeSetzen(s, ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="z in ZEITNAHMEN" :key="z.id" :value="z.id">{{ t(ZEITNAHME_NAME[z.id]) }}</option>
              </select>
              <label class="boat-check" :title="t('assist.smallImageTitle')">
                <input v-model="s.bildNeben" type="checkbox" /> {{ t('assist.smallImage') }}
              </label>
              <button type="button" class="btn sm danger" @click="spalteWeg(s.id)">{{ t('assist.removePosition') }}</button>
            </th>
            <th class="spalte-dazu">
              <button type="button" class="btn sm" @click="spalteDazu">{{ t('assist.addPosition') }}</button>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="z in ZEILEN" :key="z.id">
            <tr :class="{ fehlt: zeileFehlt(z) }">
              <th class="zeilenkopf">
                <button
                  v-if="z.haelften"
                  type="button"
                  class="aufklappen"
                  :aria-expanded="offen.has(z.id)"
                  :aria-label="t('assist.expand', { name: zeilenName(z) })"
                  @click="aufklappen(z.id)"
                >
                  {{ offen.has(z.id) ? '▾' : '▸' }}
                </button>
                {{ zeilenName(z) }}
                <small v-if="ZEILEN_KLASSEN[z.id]">{{ t(ZEILEN_KLASSEN[z.id]) }}</small>
              </th>
              <!-- Schaltflächen statt klickbarer Zellen: mit Tab erreichbar, Enter und Leertaste wirken. -->
              <td v-for="s in entwurf.spalten" :key="s.id" :class="{ doppelt: zelleDoppelt(z, s.id) }">
                <button
                  type="button"
                  class="zelle"
                  :aria-pressed="gedrueckt(z, s.id)"
                  :aria-label="t('assist.cell', { row: zeilenName(z), position: s.titel })"
                  @click="klick(z, s.id)"
                >
                  {{ symbol(z, s.id) }}
                </button>
              </td>
              <td class="rand"></td>
            </tr>
            <template v-if="z.haelften && offen.has(z.id)">
              <tr v-for="h in z.haelften" :key="h.id" class="haelfte" :class="{ fehlt: zeileFehlt(z, h.id) }">
                <th class="zeilenkopf">{{ haelfteName(z, h.id) }}</th>
                <td v-for="s in entwurf.spalten" :key="s.id" :class="{ doppelt: zelleDoppelt(z, s.id, h.id) }">
                  <button
                    type="button"
                    class="zelle"
                    :aria-pressed="gedrueckt(z, s.id, h.id)"
                    :aria-label="t('assist.cell', { row: `${zeilenName(z)} ${haelfteName(z, h.id)}`, position: s.titel })"
                    @click="klick(z, s.id, h.id)"
                  >
                    {{ symbol(z, s.id, h.id) }}
                  </button>
                </td>
                <td class="rand"></td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>

    <div class="assistent-pruefung">
      <div v-if="luecken.length > 0" class="boat-banner warn" role="status">
        {{ t('assist.gaps') }}
        <ul>
          <li v-for="l in luecken" :key="l.feld ?? l.katalog ?? l.element">{{ lueckenName(l) }} ({{ klassenText(l.klassen) }})</li>
        </ul>
      </div>
      <p v-if="markiert.doppelt.length > 0" class="boat-banner warn" role="status">
        {{ t('assist.double', { names: markiert.doppelt.map(feldName).join(', ') }) }}
      </p>
      <p v-if="markiert.leer.length > 0" class="boat-banner warn" role="status">
        {{
          t('assist.emptyCols', {
            names: entwurf.spalten
              .filter((s) => markiert.leer.includes(s.id))
              .map((s) => s.titel)
              .join(', '),
          })
        }}
      </p>
      <p v-if="ohneEnglisch.length > 0" class="note" role="status">
        {{ t('assist.noEnglish', { names: ohneEnglisch.map((s) => s.titel.trim() || t('assist.img.unnamed')).join(', ') }) }}
      </p>
      <div v-if="fehler.length > 0" class="boat-banner warn" role="alert">
        {{ t('assist.notSaved') }}
        <ul>
          <li v-for="f in fehler" :key="f.code + f.message">{{ meldungText(f) }}</li>
        </ul>
      </div>
      <p v-if="luecken.length === 0 && markiert.doppelt.length === 0 && markiert.leer.length === 0" class="boat-banner ok" role="status">
        {{ t('assist.ok') }}
      </p>
    </div>

    <div class="assistent-vorschau">
      <WkrVorschau
        v-if="vorschauKonfig"
        :konfig="vorschauKonfig"
        :aufbau-id="entwurf.id"
        :namen-pflegen="false"
        :einleitung="t('assist.previewIntro')"
      />
      <p v-else class="boat-banner warn" role="status">{{ t('assist.previewNotYet') }}</p>
    </div>

    <div class="row" style="justify-content: flex-end">
      <button type="button" class="btn" @click="emit('schliessen')">{{ t('assist.cancel') }}</button>
      <button type="button" class="btn primary" @click="speichern">{{ t('assist.save') }}</button>
    </div>
  </section>
</template>
