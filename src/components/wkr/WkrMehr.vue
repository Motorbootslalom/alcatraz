<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Locale } from '../../i18n'
import type { AnsichtWahl, GeraetAnsicht } from '../../geraete/ablage'
import { BOJEN_FOLGEN, type BojenFolge } from '../../wkr/maske'
import { BILD_LAGE_SEITE, BILD_LAGEN, lageVonDrehung, type BildLage } from '../../wkr/bild'
import type { WkrNameLage } from '../../geraete/erfassen'
import { MASKEN_GEBAUT, type MaskenWahl } from '../../wkr/maskenWahl'
import AppDialog from '../AppDialog.vue'
import WkrVorziehen from './WkrVorziehen.vue'
import WkrBildNachweis from './WkrBildNachweis.vue'
import type { ClassId } from '../../types'
import { useWkrText } from './texte'

/**
 * „Mehr“ (W3.3/W3.4, Plan §5.1/§5.7/§5.8/§5.9): Bemerkung zum Start, der Status der Liste bzw. des eigenen Steg-Teils
 * (Pausieren, Abmelden mit Rückfrage, Weiter digital), die Ansicht (Wie Gerät/Sonne/Hell/
 * Dunkel, Linkshand; G1, GF1), die Sprache (F13/G9: Vorgabe die der Liste; schaltet die Bedientexte immer, Codes und
 * Titel nur, wenn die Sicht `andere` trägt – sonst sagt ein Satz, warum sie bleiben), „Probe“ (G10) und in der Übung
 * „Übung verlassen“. Die Bemerkung zählt nicht als Tipp (H2) und geht mit der Zeile des Starts.
 * Nutzer 24.11.2026 (WKR_ANNAHMEN NG1): „Nicht gestartet · Disq. X“ für den gezeigten Start (`nichtGestartet` =
 * Startnummer, sonst nicht angeboten) – erst nach einer großen Rückfrage („23 nicht gestartet?“ mit dem Satz, was
 * eingetragen wird), weil X den Start in diesem Lauf auf allen Listen und in der Wertung entfallen lässt. Ersetzt
 * „Nicht vorbeigekommen“ (W4.3, ⊘ bzw. Disq. J): „Ein J kommt, wenn der Starter seine Linie verlassen hat … Dort würde
 * aber nur ein Nicht gestartet mit einem X Sinn machen.“
 *
 * Nutzer 22.11.2026 (WKR_ANNAHMEN.bojenFolge, ersetzt „Wie der Parcours liegt“/Spiegeln vom 21.11.2026): Auf
 * Bojen-Listen (`bojenFolge` ≠ null) steht unter „Ansicht“ die Reihenfolge „Rückweg gedreht“ (Vorgabe) / „Fahrtfolge“ /
 * „Alles untereinander“ – Ereignis `bojenFolge`, gemerkt je Liste in WkrGeraet. Seit 24.11.2026 (Nutzer, BL1) nur,
 * wenn die Bojen-Knöpfe zu sehen sind; bei der Maske „Bild“ steht dort die Lage der Zeichnung (`bildLage`): „Steg
 * unten/links/oben/rechts“ (Parallelslalom „Start links/oben/rechts/unten“) und davor „Automatisch“ (Prüfbefund
 * 24.11.2026: der Weg zurück zu „keine Wahl“ = Lage nach Bogen und Platz, Ereignis mit `null`); ohne eigene Wahl ist
 * „Automatisch“ gedrückt, der Satz nennt die gerade wirksame Lage und dass sie wie auf dem Bogen liegt – Ereignis
 * `bildLage`, gemerkt wie die Folge.
 *
 * Nutzer 24.11.2026 (WKR_ANNAHMEN Y5): „Klasse vorziehen“ steht ganz unten unter „Übung verlassen“ – es gibt sie nur in
 * der Übung, sie soll nicht zwischen den Einstellungen stehen, die es auch im Betrieb gibt.
 *
 * W3-40 (Nutzer 21.11.2026, WKR_ANNAHMEN.abschlussNurBand, AM10): „Liste abschließen“ steht hier nicht mehr – es war
 * unklar, warum man mitten im Lauf und für alle Klassen abschließen sollte. Abgeschlossen wird nur über das Band nach
 * dem Lauf, das den Zweck nennt.
 *
 * W3-13 (Nutzer 21.11.2026, WKR_ANNAHMEN WN1/WN3): „Name“ – der Name des Wettkampfrichters dieser Liste, vorbelegt aus
 * der Einteilung der Veranstaltung, hier jederzeit änderbar (Ereignis `wkrName`, WkrMaske → quelle.setzeWkrName). Weicht
 * er ab, sagt ein Satz die Einteilung und ein Knopf stellt sie wieder her; ohne Einteilung fragt der Abschluss. Nicht in
 * der Übung (`wkrName` null).
 *
 * W5.1 (F14, 22.11.2026, WKR_ANNAHMEN MW1/MW2): Unter „Ansicht“ die Maske dieser Liste – nur, wenn der Bedienrechner
 * sie nicht `fest` vorgibt (dann ein Satz) und es mehr als eine gibt: die erlaubten (wkr/maskenWahl.ts), eine noch
 * nicht gebaute ausgegraut mit „… folgt“. Seit W5.5 (22.11.2026) auch „Tabelle“ – auf dem Handy ausgegraut mit „nur
 * Pad“ (`masken.aus`, TB1). Ereignis `maske`, gemerkt in WkrGeraet je Raum und Liste.
 *
 * Nutzer 22.11.2026 (R7-45, WKR_ANNAHMEN Y4): In der Übung „Klasse vorziehen“ (WkrVorziehen) mit den Klassen der Liste
 * (`vorziehen`, ab zwei Klassen) – Ereignis `vorziehen`, WkrMaske → quelle.zieheKlasseVor; „Mehr“ klappt dabei zu,
 * damit der vorgezogene Start gleich zu sehen ist.
 *
 * Diese Komponente schreibt nichts selbst ab: Ansicht und Sprache gehen als `ansicht` hinauf bis WkrGeraet, das sie
 * gerätelokal merkt (ablage.ts `alcatraz.geraet.ansicht`).
 */
const props = withDefaults(
  defineProps<{
    /** Feld der Bemerkung vorhanden und ein Start da. */
    mitBemerkung: boolean
    bemerkung: string
    status: 'aktiv' | 'pausiert' | 'abgemeldet'
    /** Pausieren/Abmelden/Weiter anbieten (in Ruhe-Zuständen mit eigenem Knopf nicht doppelt). */
    mitStatus?: boolean
    modus: AnsichtWahl
    hand: 'rechts' | 'links'
    /** Sprache, in der die Maske gerade spricht, und die der Liste (Vorgabe). */
    sprache: Locale
    listenSprache: Locale
    /** Trägt die Sicht die Masken in der anderen Sprache (UIM)? */
    mitAndere: boolean
    uebung: boolean
    /** Startnummer des gezeigten Starts, wenn „Nicht gestartet“ geht (Liste mit eigenem Disq.-Feld, nicht Korrektur). */
    nichtGestartet?: string | null
    /** Nur Bojen-Listen mit Bojen-Knöpfen: Reihenfolge dieser Liste (22.11.2026); `null` = keine Bojen-Knöpfe zu sehen. */
    bojenFolge?: BojenFolge | null
    /**
     * Nur Maske „Bild“ mit Zeichnung (Nutzer 24.11.2026, BL1): Lage der Zeichnung – `art` steg (Klassen) | start
     * (Parallelslalom), die Wahl des WKR (`null` = keine) und die wirksame Drehung; `null` = kein Bild.
     */
    bildLage?: { art: 'steg' | 'start'; wahl: BildLage | null; wirksam: number } | null
    /** WKR-Name dieser Liste (W3-13); `null` = kein Namensfeld (Übung). */
    wkrName?: WkrNameLage | null
    /** Maskenwahl dieser Liste (F14, W5.1): erlaubte Masken, die gezeigte, ob fest vorgegeben; `null` = keine Wahl. */
    masken?: { erlaubt: MaskenWahl[]; wirksam: MaskenWahl; fest: boolean; aus?: MaskenWahl[] } | null
    /** Nur Übung (Y4): die Klassen der Liste zum Vorziehen, Namen wie in der Maske; `null` = kein Eintrag. */
    vorziehen?: { id: ClassId; titel: string }[] | null
    /**
     * Zeigt die Liste eine Parcours-Zeichnung (Maske „Bild“ oder Zeichnung unter den Knöpfen)? Dann steht hier die
     * Namensnennung (CC BY-NC-SA 4.0) – Nutzer 23.11.2026: unter der Zeichnung „nimmt das kostbaren Platz weg“.
     */
    nachweis?: boolean
  }>(),
  { mitStatus: true, nichtGestartet: null, bojenFolge: null, bildLage: null, wkrName: null, masken: null, vorziehen: null, nachweis: false },
)
const emit = defineEmits<{
  bemerkung: [text: string]
  pausiere: []
  meldeAb: []
  weiter: []
  probe: []
  ansicht: [aenderung: Partial<GeraetAnsicht>]
  uebungEnde: []
  nichtGestartet: []
  bojenFolge: [folge: BojenFolge]
  /** `null` = „Automatisch“ (keine Wahl mehr, Prüfbefund 24.11.2026). */
  bildLage: [lage: BildLage | null]
  wkrName: [name: string]
  maske: [maske: MaskenWahl]
  vorziehen: [klasse: ClassId]
}>()
const { w } = useWkrText()

const offen = ref(false)
const text = ref(props.bemerkung)
watch(
  () => props.bemerkung,
  (b) => (text.value = b),
)
const frageAb = ref(false)
/** Eingabe des Namens – folgt dem Stand, solange der WKR nichts tippt (z. B. Einteilung geändert). */
const nameText = ref(props.wkrName?.name ?? '')
watch(
  () => props.wkrName?.name ?? '',
  (n) => (nameText.value = n),
)
function setzeName(n: string): void {
  nameText.value = n.trim()
  emit('wkrName', n.trim())
}
const frageNg = ref(false)

// „Wie Gerät“ zuerst: die Vorgabe (GF1, Nutzer 21.11.2026 P-18) – dahin kommt man nach einem Wechsel zurück.
const MODI: AnsichtWahl[] = ['geraet', 'sonne', 'hell', 'dunkel']
const SPRACHEN: ('de' | 'en')[] = ['de', 'en']
/** Die Sprache der Liste heißt „keine eigene Wahl“ – dann folgt das Gerät der Liste, auch wenn sie wechselt. */
function waehleSprache(s: 'de' | 'en'): void {
  emit('ansicht', { sprache: s === props.listenSprache ? undefined : s })
}
/** Sichtbar sind alle erlaubten Masken; nicht gebaute bzw. auf diesem Gerät nicht mögliche (TB1) ausgegraut. */
const maskenKnoepfe = computed(() => (props.masken ? props.masken.erlaubt : []))
const maskeAus = (m: MaskenWahl) => !MASKEN_GEBAUT[m] || !!props.masken?.aus?.includes(m)
function maskenText(m: MaskenWahl): string {
  if (!MASKEN_GEBAUT[m]) return w('wkr.geraet.maske.folgt', { maske: w(`wkr.geraet.maske.${m}`) })
  if (props.masken?.aus?.includes(m)) return w('wkr.geraet.maske.nurPad', { maske: w(`wkr.geraet.maske.${m}`) })
  return w(`wkr.geraet.maske.${m}`)
}
function tue(f: () => void): void {
  offen.value = false
  f()
}
/**
 * Der Satz unter den Knöpfen nennt die Lage, in der die Zeichnung gerade liegt: die Wahl des WKR, ohne Wahl die
 * wirksame Drehung (BL1, 24.11.2026). Gedrückt ist seit dem Prüfbefund 24.11.2026 die Wahl bzw. „Automatisch“.
 */
const lageGezeigt = computed<BildLage>(() => props.bildLage?.wahl ?? lageVonDrehung(props.bildLage?.wirksam ?? 0))
</script>

<template>
  <div class="wkr-mehr" data-teil="mehr">
    <button type="button" class="wkr-knopf" data-ziel="klein" data-action="mehr" :aria-expanded="offen" @click="offen = !offen">{{ w(offen ? 'wkr.geraet.mehr.zu' : 'wkr.geraet.mehr') }}</button>
    <div v-if="offen" class="wkr-mehr-inhalt">
      <label v-if="mitBemerkung" class="wkr-feld">
        {{ w('wkr.geraet.bemerkung') }}
        <input v-model="text" class="wkr-eingabe" data-feld="bemerkung" maxlength="200" autocomplete="off" @change="emit('bemerkung', text)" />
      </label>
      <div v-if="mitStatus" class="wkr-reihe">
        <button v-if="status === 'aktiv'" type="button" class="wkr-knopf" data-ziel="klein" data-action="pausieren" @click="emit('pausiere')">{{ w('wkr.geraet.pausieren') }}</button>
        <button v-if="status === 'aktiv'" type="button" class="wkr-knopf" data-ziel="klein" data-action="abmelden" @click="frageAb = true">{{ w('wkr.geraet.abmelden') }}</button>
        <button v-else type="button" class="wkr-knopf" data-ziel="klein" data-action="weiter" @click="emit('weiter')">{{ w('wkr.geraet.weiter') }}</button>
      </div>
      <button v-if="nichtGestartet" type="button" class="wkr-knopf" data-ziel="klein" data-action="nicht-gestartet" @click="frageNg = true">
        {{ w('wkr.geraet.nichtGestartet') }}
      </button>

      <fieldset v-if="wkrName" class="wkr-feldgruppe" data-teil="wkr-name" :data-eigen="wkrName.eigen || undefined">
        <legend>{{ w('wkr.geraet.name') }}</legend>
        <input v-model="nameText" class="wkr-eingabe" data-feld="wkr-name-mehr" maxlength="60" autocomplete="name" :aria-label="w('wkr.geraet.name')" />
        <p v-if="wkrName.eigen && wkrName.einteilung" class="wkr-hinweis" data-teil="wkr-name-abweichend">{{ w('wkr.geraet.name.abweichend', { name: wkrName.einteilung }) }}</p>
        <p v-else-if="wkrName.eigen" class="wkr-hinweis" data-teil="wkr-name-eigen">{{ w('wkr.geraet.name.eigen') }}</p>
        <p v-else-if="wkrName.einteilung" class="wkr-hinweis" data-teil="wkr-name-einteilung">{{ w('wkr.geraet.name.einteilung') }}</p>
        <p v-else class="wkr-hinweis" data-teil="wkr-name-ohne">{{ w('wkr.geraet.name.ohne') }}</p>
        <div class="wkr-reihe">
          <button type="button" class="wkr-knopf" data-ziel="klein" data-action="wkr-name-setzen" :disabled="nameText.trim() === wkrName.name" @click="setzeName(nameText)">
            {{ w('wkr.geraet.name.setzen') }}
          </button>
          <button v-if="wkrName.eigen && wkrName.einteilung" type="button" class="wkr-knopf" data-ziel="klein" data-action="wkr-name-einteilung" @click="setzeName(wkrName.einteilung)">
            {{ w('wkr.geraet.name.zurueck') }}
          </button>
        </div>
      </fieldset>

      <fieldset class="wkr-feldgruppe" data-teil="ansicht">
        <legend>{{ w('wkr.geraet.ansicht') }}</legend>
        <div class="wkr-reihe">
          <button
            v-for="m in MODI"
            :key="m"
            type="button"
            class="wkr-knopf"
            data-ziel="klein"
            data-action="modus"
            :data-modus="m"
            :aria-pressed="modus === m"
            @click="emit('ansicht', { modus: m })"
          >
            {{ w(`wkr.geraet.ansicht.${m}`) }}
          </button>
        </div>
        <button
          type="button"
          class="wkr-knopf"
          data-ziel="klein"
          data-action="linkshand"
          :aria-pressed="hand === 'links'"
          @click="emit('ansicht', { hand: hand === 'links' ? 'rechts' : 'links' })"
        >
          {{ w('wkr.geraet.ansicht.links') }}
        </button>
        <div v-if="bojenFolge" class="wkr-mehr-bojen" data-teil="bojen-ansicht">
          <p class="wkr-mehr-untertitel">{{ w('wkr.geraet.bojen.ansicht') }}</p>
          <div class="wkr-reihe">
            <button
              v-for="f in BOJEN_FOLGEN"
              :key="f"
              type="button"
              class="wkr-knopf"
              data-ziel="klein"
              data-action="bojen-folge"
              :data-folge="f"
              :aria-pressed="bojenFolge === f"
              @click="emit('bojenFolge', f)"
            >
              {{ w(`wkr.geraet.bojen.ansicht.${f}`) }}
            </button>
          </div>
          <p class="wkr-hinweis" data-teil="bojen-folge-text">{{ w(`wkr.geraet.bojen.ansicht.${bojenFolge}.text`) }}</p>
        </div>
        <div v-if="bildLage" class="wkr-mehr-bojen" data-teil="bild-lage" :data-art="bildLage.art" :data-gewaehlt="bildLage.wahl !== null || undefined">
          <p class="wkr-mehr-untertitel">{{ w('wkr.geraet.bild.lage') }}</p>
          <div class="wkr-reihe">
            <!-- Prüfbefund 24.11.2026 (BL1): zurück zu „keine Wahl“ – die Lage nach Bogen und Platz. -->
            <button
              type="button"
              class="wkr-knopf"
              data-ziel="klein"
              data-action="bild-lage-auto"
              :aria-pressed="bildLage.wahl === null"
              @click="emit('bildLage', null)"
            >
              {{ w('wkr.geraet.bild.lage.auto') }}
            </button>
            <button
              v-for="l in BILD_LAGEN"
              :key="l"
              type="button"
              class="wkr-knopf"
              data-ziel="klein"
              data-action="bild-lage"
              :data-lage="l"
              :aria-pressed="bildLage.wahl === l"
              @click="emit('bildLage', l)"
            >
              {{ w(`wkr.geraet.bild.lage.${bildLage.art}.${BILD_LAGE_SEITE[l][bildLage.art]}`) }}
            </button>
          </div>
          <p class="wkr-hinweis" data-teil="bild-lage-text">{{ w(`wkr.geraet.bild.lage.${bildLage.art}.${BILD_LAGE_SEITE[lageGezeigt][bildLage.art]}.text`) }}</p>
          <p v-if="bildLage.wahl === null" class="wkr-hinweis" data-teil="bild-lage-vorgabe">{{ w('wkr.geraet.bild.lage.vorgabe') }}</p>
        </div>
        <div v-if="masken && (masken.fest || maskenKnoepfe.length > 1)" class="wkr-mehr-bojen" data-teil="masken-wahl" :data-fest="masken.fest || undefined">
          <p class="wkr-mehr-untertitel">{{ w('wkr.geraet.maske') }}</p>
          <p v-if="masken.fest" class="wkr-hinweis" data-teil="maske-fest">{{ w(`wkr.geraet.maske.${masken.wirksam}`) }} · {{ w('wkr.geraet.maske.fest') }}</p>
          <div v-else class="wkr-reihe">
            <button
              v-for="m in maskenKnoepfe"
              :key="m"
              type="button"
              class="wkr-knopf"
              data-ziel="klein"
              data-action="maske"
              :data-maske="m"
              :disabled="maskeAus(m)"
              :aria-pressed="masken.wirksam === m"
              @click="emit('maske', m)"
            >
              {{ maskenText(m) }}
            </button>
          </div>
        </div>
      </fieldset>

      <fieldset class="wkr-feldgruppe" data-teil="sprache">
        <legend>{{ w('wkr.geraet.sprache') }}</legend>
        <div class="wkr-reihe">
          <button
            v-for="s in SPRACHEN"
            :key="s"
            type="button"
            class="wkr-knopf"
            data-ziel="klein"
            data-action="sprache"
            :data-sprache="s"
            :lang="s"
            :aria-pressed="sprache === s"
            @click="waehleSprache(s)"
          >
            {{ w(`wkr.geraet.sprache.${s}`) }}
          </button>
        </div>
        <p v-if="sprache !== listenSprache && !mitAndere" class="wkr-hinweis" data-teil="nur-bedientexte">{{ w('wkr.geraet.sprache.nurBedien') }}</p>
      </fieldset>

      <div class="wkr-reihe">
        <button type="button" class="wkr-knopf" data-ziel="klein" data-action="probe" @click="tue(() => emit('probe'))">{{ w('wkr.geraet.probe') }}</button>
        <button v-if="uebung" type="button" class="wkr-knopf" data-ziel="klein" data-action="uebung-ende" @click="tue(() => emit('uebungEnde'))">{{ w('wkr.geraet.uebung.ende') }}</button>
      </div>
      <!-- Nutzer 24.11.2026 (WKR_ANNAHMEN Y5): „Klasse vorziehen“ unter „Übung verlassen“ – das gibt es nur in der Übung. -->
      <WkrVorziehen v-if="uebung && vorziehen && vorziehen.length > 1" :klassen="vorziehen" @wahl="(k) => tue(() => emit('vorziehen', k))" />
      <WkrBildNachweis v-if="nachweis" />
    </div>
    <AppDialog
      v-if="frageNg && nichtGestartet"
      class="wkr-dialog"
      :titel="w('wkr.geraet.nichtGestartet.frage', { nr: nichtGestartet })"
      data-dialog="wkr-nicht-gestartet"
      @abbrechen="frageNg = false"
    >
      <p>{{ w('wkr.geraet.nichtGestartet.hint') }}</p>
      <template #knoepfe>
        <button type="button" class="wkr-knopf wkr-knopf--haupt" data-ziel="gross" data-action="nicht-gestartet-ja" @click="(frageNg = false), tue(() => emit('nichtGestartet'))">
          {{ w('wkr.geraet.nichtGestartet') }}
        </button>
        <button type="button" class="wkr-knopf" data-ziel="gross" data-action="nicht-gestartet-nein" autofocus @click="frageNg = false">{{ w('wkr.geraet.abbrechen') }}</button>
      </template>
    </AppDialog>
    <AppDialog v-if="frageAb" class="wkr-dialog" :titel="w('wkr.geraet.abmelden.frage')" data-dialog="wkr-abmelden" @abbrechen="frageAb = false">
      <p>{{ w('wkr.geraet.abmelden.text') }}</p>
      <template #knoepfe>
        <button type="button" class="wkr-knopf wkr-knopf--gefahr" data-ziel="gross" data-action="abmelden-ja" @click="(frageAb = false), emit('meldeAb')">{{ w('wkr.geraet.abmelden') }}</button>
        <button type="button" class="wkr-knopf" data-ziel="gross" data-action="abmelden-nein" autofocus @click="frageAb = false">{{ w('wkr.geraet.abbrechen') }}</button>
      </template>
    </AppDialog>
  </div>
</template>
