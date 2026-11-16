<script setup lang="ts">
import { computed, nextTick, ref, type ComponentPublicInstance } from 'vue'
import type { OeffentlicheSicht, SichtBereich, SichtStart, VerschiebeZiel } from '../../types'
import type { BetriebAenderung } from '../../state/reducer/betrieb'
import { locale, t, tn } from '../../i18n'
import { bereichAngehalten, mmss, seitSekunden, wartezeiten } from '../../betrieb/prognose'
import EinreihenListe from './EinreihenListe.vue'
import { ganzeFolge, punktText, punktVon, startZeile, tBereich, verschiebeZiele, wartezeitText, type StartZeile } from './texte'

/**
 * Startliste im Betrieb (Etappe E3, Plan vom 16.11.2026; Vorbild: Tafel-Prototyp ListView.vue): die ganze Folge eines
 * Bereichs mit geschätzter Wartezeit – „ca. in“ bis zum Start und „Zum Vorsteg“ bis der Starter am Vorsteg sein muss
 * (docs/stand.md, „Zeit bis zum Vorsteg“) –, gegliedert nach Lauf; dazu „Boot fehlt“ am Ende seines Laufs, die
 * zurückgestellten und die nachzuholenden Starts. Für die Bedienung am Bedienrechner, in deren Sprache.
 *
 * Die Wartezeiten rechnet der Bildschirm aus der Sicht und `jetzt` (betrieb/prognose.ts wartezeiten; die Uhr kommt
 * von außen, lib/uhr.ts) – nie die Sicht, nie der Reducer (Kritik K28). Ohne Zahl bleiben Starts eines Laufs, der
 * nicht begonnen hat (L-2), „Boot fehlt“ (L-7) und alles, solange die Tafel eine Pause oder Störung zeigt
 * (BETRIEB_ANNAHMEN.keineZahlBeiPause).
 *
 * Umstellen: Ziehen auf einen anderen offenen Start schickt BETRIEB_VERSCHIEBEN mit `{ vor }` (nach oben gezogen) bzw.
 * `{ nach }` (nach unten) – dieselbe Action und damit dieselben Regeln wie „Verschieben …“ an der Start-Freigabe
 * (betrieb/schritte.ts `verschiebe`: Blöcke je Lauf, nie vor den Zeiger, mit „Verzahnung halten“ rutscht die Spur im
 * Block mit). Wo die Spur mitrutscht, landet der Start deshalb nicht immer genau am Ablageort. Für die Tastatur und
 * Lauf-Grenzen gibt es dasselbe Menü „Verschieben …“ (texte.ts verschiebeZiele). Liest NUR die öffentliche Sicht,
 * schickt Actions über `sende`; ohne festgeschriebene Verzahnung ruht beides (`bereich.fest`).
 *
 * Parallelslalom (E4): je Zeile ein Paar (Nummern und Namen beider Racecourses), Spalte „Versuch“; ohne Wartezeit
 * (BETRIEB_ANNAHMEN.parallelOhnePrognose – „am Steg“/„vor Steg“ bleiben) und ohne Ziehen und Menü
 * (BETRIEB_ANNAHMEN.parallelOhneUmstellen); zurückgestellte und nachzuholende Paare wie im Manövrieren.
 */
const props = defineProps<{
  sicht: OeffentlicheSicht
  bereich: SichtBereich
  /** Zeit des Hosts in ms (am Bedienrechner die eigene Uhr). */
  jetzt: number
  sende: (action: BetriebAenderung) => void
}>()

const b = computed(() => props.bereich)
const gesperrt = computed(() => !b.value.fest)
const parallel = computed(() => b.value.art === 'parallel')
/** Ziehen und „Verschieben …“: nicht ohne Festschreiben und nie im Parallelslalom. */
const umstellbar = computed(() => !gesperrt.value && !parallel.value)

const stand = computed(() => {
  if (!b.value.punkt) return tBereich(b.value, 'betrieb.nichtBegonnen')
  return `${t('betrieb.laufend', { punkt: punktText(b.value.punkt) })} · ${tn('betrieb.offen', b.value.offenZahl)}`
})
const aktuell = computed(() => (b.value.aktuell && props.sicht.starter[b.value.aktuell.starter] ? startZeile(props.sicht, b.value.aktuell) : null))
const seit = computed(() => seitSekunden(b.value, props.jetzt))
/**
 * „seit 1:05“; ab einer Stunde nur „seit über 1 h“ – etwa am Morgen des zweiten Tags, wenn die Anzeigetafel noch auf dem
 * letzten Start vom Vorabend steht (S-8): „seit 862:10“ läse niemand, „14:22:10“ hielte man für eine Uhrzeit.
 */
const seitText = computed(() => (seit.value === null ? '' : seit.value < 3600 ? t('betrieb.liste.seit', { zeit: mmss(seit.value) }) : t('betrieb.liste.seitLange')))

interface Zeile extends StartZeile {
  s: SichtStart
  art: 'offen' | 'bootFehlt'
  /** Überschrift über der Zeile, wenn hier ein anderer Lauf beginnt als in der Zeile davor. */
  kopf: string
  ca: string
  vorsteg: string
}

const zeiten = computed(() => wartezeiten(props.sicht, b.value, props.jetzt))
const angehalten = computed(() => bereichAngehalten(b.value))
const zeilen = computed<Zeile[]>(() => {
  const begonnen = new Set(b.value.begonnen)
  let vorig = ''
  return ganzeFolge(b.value).map(({ s, art }) => {
    const p = punktVon(b.value, s.punkt)
    const kopf = s.punkt !== vorig && p ? (begonnen.has(s.punkt) ? punktText(p) : t('betrieb.liste.wartet', { punkt: punktText(p) })) : ''
    vorig = s.punkt
    const w = zeiten.value.get(s.key)
    let ca = '–'
    let vorsteg = '–'
    if (w?.art === 'zeit') {
      ca = wartezeitText(w.bisStart, locale.value)
      vorsteg = w.steg ? t(`anzeige.steg.${w.steg}`) : wartezeitText(w.bisVorsteg, locale.value)
    } else if (w?.art === 'angehalten') {
      // Pause/Störung auf der Tafel: keine Zahl, aber wer am Steg wartet, wartet dort weiter.
      if (w.steg) vorsteg = t(`anzeige.steg.${w.steg}`)
    } else if (w?.art === 'bootFehlt') {
      ca = t('anzeige.bootFehlt')
      vorsteg = ''
    }
    return { ...startZeile(props.sicht, s), s, art, kopf, ca, vorsteg }
  })
})

// --- Ziehen ---
const gezogen = ref<string | null>(null)
const ablage = ref<{ key: string; wo: 'vor' | 'nach' } | null>(null)
const offeneKeys = computed(() => zeilen.value.filter((z) => z.art === 'offen').map((z) => z.key))
/** Nach oben gezogen: vor den Start; nach unten: dahinter. Auf sich selbst oder einen anderen als offenen: nichts. */
function wohin(ziel: string): 'vor' | 'nach' | null {
  const von = gezogen.value === null ? -1 : offeneKeys.value.indexOf(gezogen.value)
  const nach = offeneKeys.value.indexOf(ziel)
  if (von < 0 || nach < 0 || von === nach) return null
  return von < nach ? 'nach' : 'vor'
}
function ziehen(z: Zeile, e: DragEvent) {
  if (!umstellbar.value || z.art !== 'offen') {
    e.preventDefault()
    return
  }
  gezogen.value = z.key
  menue.value = null
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    // Manche Browser ziehen nur, wenn etwas mitgegeben wird; gelesen wird es nicht (die Kennung steht in `gezogen`).
    e.dataTransfer.setData('text/plain', z.startNr)
  }
}
function ueber(z: Zeile, e: DragEvent) {
  const wo = gezogen.value !== null && z.art === 'offen' ? wohin(z.key) : null
  if (!wo) {
    // Über einem Start, auf den nicht abgelegt werden kann: keine Linie mehr zeigen, auch nicht die des vorigen Ziels.
    ablage.value = null
    return
  }
  // Nur hier darf abgelegt werden – ohne preventDefault verweigert der Browser das Ablegen.
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  ablage.value = { key: z.key, wo }
}
function ablegen(z: Zeile, e: DragEvent) {
  e.preventDefault()
  const key = gezogen.value
  const wo = key !== null ? wohin(z.key) : null
  ziehenEnde()
  if (key === null || !wo || !umstellbar.value) return
  verschiebe(key, wo === 'vor' ? { vor: z.key } : { nach: z.key })
}
function ziehenEnde() {
  gezogen.value = null
  ablage.value = null
}

// --- Menü „Verschieben …“ (wie an der Start-Freigabe, components/betrieb/BetriebsFolge.vue) ---
const menue = ref<string | null>(null)
const menueKnoepfe = new Map<string, HTMLElement>()
function merkeKnopf(key: string, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) menueKnoepfe.set(key, el)
  else menueKnoepfe.delete(key)
}
async function schliesseMenue() {
  const key = menue.value
  menue.value = null
  await nextTick()
  if (key !== null) menueKnoepfe.get(key)?.focus()
}
function verschiebe(key: string, ziel: VerschiebeZiel) {
  props.sende({ type: 'BETRIEB_VERSCHIEBEN', bereich: b.value.id, ref: key, ziel })
}
function waehle(z: Zeile, ziel: VerschiebeZiel) {
  verschiebe(z.key, ziel)
  void schliesseMenue()
}

// Zurückgestellte und nachzuholende: wie an der Start-Freigabe zeigen oder einreihen.
function zeige(key: string) {
  props.sende({ type: 'BETRIEB_ZEIGEN', bereich: b.value.id, ref: key, vorher: b.value.aktuell?.key ?? null })
}
function einreihen(key: string, wo: 'naechster' | 'ende') {
  props.sende({ type: 'BETRIEB_EINREIHEN', bereich: b.value.id, ref: key, wo })
}
</script>

<template>
  <section class="panel betrieb-startliste" :data-bereich="bereich.id">
    <div class="betrieb-karte-kopf">
      <h3>{{ bereich.name }}</h3>
      <span class="note" data-teil="stand">{{ stand }}</span>
    </div>

    <p class="betrieb-startliste-imboot" data-teil="imboot">
      <span class="note">{{ t('betrieb.imBoot') }}:</span>
      <template v-if="aktuell">
        <b>{{ aktuell.startNr }}</b>
        <span v-if="aktuell.name">{{ aktuell.name }}</span>
        <span class="note">{{ aktuell.was }}</span>
      </template>
      <span v-else-if="bereich.aktuell" class="note">{{ t('betrieb.geloescht') }}</span>
      <span v-else class="note">{{ t('betrieb.keiner') }}</span>
      <span v-if="seitText" class="betrieb-aktiv" data-teil="seit">{{ seitText }}</span>
    </p>

    <p v-if="angehalten && zeilen.length > 0" class="note betrieb-warn" data-teil="angehalten">{{ t('betrieb.liste.angehalten') }}</p>
    <p v-if="parallel" class="note" data-hinweis="parallel">{{ t('betrieb.liste.parallel') }}</p>
    <p v-if="zeilen.length === 0" class="note" data-teil="liste-leer">{{ t('betrieb.folge.leer') }}</p>
    <div v-else class="betrieb-startliste-rahmen">
      <table class="betrieb-startliste-tabelle" @keydown.esc="menue !== null && schliesseMenue()">
        <thead>
          <tr>
            <th class="griff" aria-hidden="true"></th>
            <th>{{ t('betrieb.liste.col.nr') }}</th>
            <th>{{ t('betrieb.liste.col.name') }}</th>
            <th>{{ t('betrieb.liste.col.klasse') }}</th>
            <th>{{ t(parallel ? 'betrieb.liste.col.versuch' : 'betrieb.liste.col.lauf') }}</th>
            <th class="zahl">{{ t('betrieb.liste.col.caIn') }}</th>
            <th class="zahl" :title="t('betrieb.liste.col.vorsteg.title')">{{ t('betrieb.liste.col.vorsteg') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="z in zeilen" :key="z.key">
            <tr v-if="z.kopf" class="betrieb-startliste-punkt" data-teil="punkt">
              <th colspan="8">{{ z.kopf }}</th>
            </tr>
            <tr
              :data-start="z.key"
              :data-art="z.art"
              :class="{
                aus: z.art === 'bootFehlt',
                gezogen: gezogen === z.key,
                'ziel-vor': ablage?.key === z.key && ablage.wo === 'vor',
                'ziel-nach': ablage?.key === z.key && ablage.wo === 'nach',
              }"
              :draggable="z.art === 'offen' && umstellbar"
              @dragstart="ziehen(z, $event)"
              @dragover="ueber(z, $event)"
              @drop="ablegen(z, $event)"
              @dragend="ziehenEnde"
            >
              <td class="griff" :title="z.art === 'offen' && umstellbar ? t('betrieb.liste.ziehen.title') : undefined" aria-hidden="true">
                {{ z.art === 'offen' && umstellbar ? '⠿' : '' }}
              </td>
              <td><b>{{ z.startNr }}</b></td>
              <td>
                {{ z.name }}
                <span v-if="z.herkunft" class="note">{{ z.herkunft }}</span>
              </td>
              <td>
                <span class="class-badge sm" :style="{ background: z.art === 'bootFehlt' || !z.farbe ? 'var(--muted)' : z.farbe }">{{ z.klasse || '?' }}</span>
              </td>
              <td>{{ t(parallel ? 'betrieb.versuch' : 'betrieb.lauf', { n: z.s.lauf }) }}</td>
              <td :class="['zahl', z.art === 'bootFehlt' ? 'betrieb-warn' : '']" data-teil="ca">{{ z.ca }}</td>
              <td class="zahl" data-teil="vorsteg">{{ z.vorsteg }}</td>
              <td class="betrieb-startliste-knopf">
                <button
                  v-if="z.art === 'offen' && !parallel"
                  :ref="(el) => merkeKnopf(z.key, el)"
                  type="button"
                  :class="['btn', 'sm', menue === z.key ? 'active' : '']"
                  data-action="verschieben"
                  aria-haspopup="true"
                  :aria-expanded="menue === z.key"
                  :disabled="gesperrt"
                  @click="menue = menue === z.key ? null : z.key"
                >
                  {{ t('betrieb.folge.verschieben') }}
                </button>
              </td>
            </tr>
            <tr v-if="menue === z.key && !gesperrt" class="betrieb-startliste-menue">
              <td colspan="8">
                <span class="betrieb-menue" role="group" :aria-label="t('betrieb.folge.verschieben')" data-teil="verschieben">
                  <button v-for="w in verschiebeZiele(bereich, z.s)" :key="w.id" type="button" class="btn sm" :data-ziel="w.id" @click="waehle(z, w.ziel)">{{ w.text }}</button>
                </span>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <EinreihenListe :sicht="sicht" :bereich="bereich" :eintraege="bereich.zurueckgestellt" art="zurueckgestellt" :gesperrt="gesperrt" @zeigen="zeige" @einreihen="einreihen" />
    <EinreihenListe :sicht="sicht" :bereich="bereich" :eintraege="bereich.nachzuholen" art="nachzuholen" :gesperrt="gesperrt" @zeigen="zeige" @einreihen="einreihen" />
  </section>
</template>
