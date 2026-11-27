<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import type { ClassId } from '../../types'
import type { BestandEintrag, ErfassungsQuelle, PruefZeile } from '../../geraete/erfassen'
import type { ListenAufgabe } from '../../geraete/aufgaben'
import { entwurfAus, fertig, leererEntwurf, maskeFuer, pruefOffen, punkteVon, restRichtig, tippePruef, zellenAus, type Entwurf, type MaskenAufbau, type PruefWahl } from '../../wkr/maske'
import { naechsterOffener } from '../../wkr/tisch'
import { OHNE_PUNKT } from '../../wkr/abschluss'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import WkrAbschluss from './WkrAbschluss.vue'
import WkrKopf from './WkrKopf.vue'
import WkrRuhe from './WkrRuhe.vue'
import WkrZiffern from './WkrZiffern.vue'
import WkrVorziehen from './WkrVorziehen.vue'
import { rolleAnDenRand, zielNachErklaerung } from './systemModus'
import { stufeZeichen, useWkrText } from './texte'

/**
 * Knoten-Prüfliste am Tisch (W5.3, Plan docs/plan-wkr-w5.md §6.2, 22.11.2026, WKR_ANNAHMEN KN3/KN7/KN8; umgebaut
 * 22.11.2026 nach R8-27/R8-31/R8-32, KN9–KN11, Plan docs/plan-antworten-runde7-8.md §6) – die Maske einer Liste OHNE
 * Lauf. Es fährt kein Boot: keine Schlange der Startfolge, keine Starterkarte, kein Overlay, kein Startwechsel-Takt.
 * Das leere Nummernfeld schlägt groß den nächsten offenen Starter vor (KN9, wkr/tisch.ts naechsterOffener: nach dem
 * zuletzt abgeschickten in der Folge des Bestands) und ist mit ihm vorbelegt (KN12, Prüfbefund 22.11.2026): Knoten und
 * „Alle richtig“ gelten gleich für ihn; Antippen hält ihn fest, Eintippen über WkrZiffern ersetzt ihn. Der WKR
 * sieht Klasse und „offen 14 / 38“, setzt je Knoten ✓ (= leere Zelle) oder ✗ (Fehlerpunkte, „5“). Der Hauptknopf ist
 * aktiv, sobald eine Nummer gewählt ist (KN10): „Alle richtig“ bzw. „Rest richtig“ setzt die offenen auf ✓ und
 * schickt ab – so markiert der WKR nur die falschen. Danach leert sich das Nummernfeld; darunter steht klein, was mit
 * der letzten Zeile geschah (Stufe aus dem Kern: ↑ unterwegs, ✓ übernommen, ! Rückfrage, ✗ abgelehnt).
 *
 * Eine schon erfasste Nummer (erledigt laut Sicht oder selbst geschickt) fragt zuerst „Nr. 23 ist schon erfasst –
 * korrigieren?“ (KN11) – in der Maske an Stelle der Knoten, nicht als Dialog, damit Weitertippen („1“ → „12“) geht.
 * Ja: Hat dieses Gerät eine Zeile, die Korrektur (Grundlage `quelle.stand(z)` wie in WkrMaske: ✓-Knoten stehen dort
 * nicht, weil leere Zellen ohne `vorher` nie hinausgehen – fehlende Knoten gelten daher als ✓); sonst (vom
 * Bedienrechner bzw. einem anderen Gerät) eine neue Zeile, der Bedienrechner fragt bei Abweichung zurück. Nein: Feld
 * leer, der Vorschlag steht wieder da. Auf dem Pad stehen die offenen Nummern rechts zum
 * Antippen, auf dem Handy aufklappbar darunter. „Liste abschließen“ (KN5) schließt die ganze Liste (Punkt `ohne`),
 * offene Starter nur mit „Rest auf Papier“ (WkrAbschluss).
 *
 * Liest nur die ErfassungsQuelle (echte Erfassung oder Übung), nie einen Store; Werte nur über wkr/maske.ts zellenAus.
 */
const props = defineProps<{
  quelle: ErfassungsQuelle
  aufgabe: ListenAufgabe
  spracheWahl: 'liste' | 'andere'
  hand: 'rechts' | 'links'
  /** Pad-Anordnung (W5.1): offene Nummern als Spalte daneben. */
  pad?: boolean
  /** Vorbelegter WKR-Name für den Abschluss (G12). */
  name?: string
}>()
const emit = defineEmits<{ name: [name: string] }>()
const { w } = useWkrText()

const liste = computed(() => props.aufgabe.liste)
const sicht = computed(() => props.quelle.sichten.value[liste.value] ?? null)
const bestand = computed<BestandEintrag[]>(() => props.quelle.bestand.value[liste.value] ?? [])
const offen = computed(() => bestand.value.filter((b) => !b.erledigt))
/** Buchstaben vor den Startnummern („E“, „D“) – je einer eine Taste (wie WkrAusweichen, K8). */
const buchstaben = computed(() => [...new Set(bestand.value.flatMap((b) => [...b.startNr.toUpperCase()].filter((c) => /[A-Z]/.test(c))))].sort())

// --- Nummer und Treffer ---
const nr = ref('')
// --- Vorschlag (KN9): nach der Startnummer der neuesten eigenen Zeile dieser Liste (gerätelokal im Kern) ---
const zuletztKey = computed(() => props.quelle.zuletzt.value.find((z) => z.liste === liste.value)?.s ?? null)
// Übung (Nutzer 22.11.2026, R7-45, Y4): „Klasse vorziehen“ lässt den Vorschlag auf den ersten offenen dieser Klasse
// springen, bis die nächste Zeile abgeschickt ist (geraete/uebung.ts `vorgezogen`).
const vorschlag = computed(() => (nr.value === '' ? naechsterOffener(bestand.value, zuletztKey.value, props.quelle.vorgezogen?.value) : null))
const getippt = computed(() => {
  const n = nr.value.trim().toUpperCase()
  return n === '' ? null : (bestand.value.find((b) => b.startNr.toUpperCase() === n) ?? null)
})
// KN12 (Prüfbefund 22.11.2026 zu R8-27/R8-31, noch zu bestätigen): Der Vorschlag ist VORBELEGT – bei leerem Feld gilt
// er als gewählt, Knoten und „✓ Alle richtig“ stehen sofort bereit. Ein fehlerfreier Starter braucht so EINEN Tipp,
// ein falscher nur das ✗ – „so muss dann nur der falsche markiert werden“. Eintippen ersetzt ihn.
const treffer = computed(() => (nr.value === '' ? (vorschlag.value ?? null) : getippt.value))
/** Die Nummer ist vollständig getippt, aber nicht auf der Liste (erst, wenn keine längere Nummer mehr passt). */
const unbekannt = computed(() => {
  const n = nr.value.trim().toUpperCase()
  return n !== '' && !treffer.value && !bestand.value.some((b) => b.startNr.toUpperCase().startsWith(n))
})
const aufbau = computed<MaskenAufbau | null>(() => (sicht.value && treffer.value ? maskeFuer(sicht.value, treffer.value.klasse, props.spracheWahl) : null))
const titelVon = (k: ClassId | undefined): string =>
  !k ? '' : ((props.spracheWahl === 'andere' ? sicht.value?.andere?.klassen[k]?.titel : undefined) ?? sicht.value?.klassen[k]?.titel ?? k)
const klassenTitel = computed(() => titelVon(treffer.value?.klasse))

const vorziehKlassen = computed(() =>
  props.quelle.uebung && props.quelle.zieheKlasseVor && sicht.value ? (Object.keys(sicht.value.klassen) as ClassId[]).map((id) => ({ id, titel: titelVon(id) })) : null,
)
const vorziehOffen = ref(false)
function ziehVor(k: ClassId): void {
  vorziehOffen.value = false
  props.quelle.zieheKlasseVor?.(liste.value, k)
}
function waehle(b: BestandEintrag): void {
  nr.value = b.startNr
}

// --- Rückfrage bei erfasster Nummer (KN11) ---
/** Kennung, für die der WKR „korrigieren“ schon bejaht hat (bzw. aus der Prüfansicht gewählt). */
const bejaht = ref<string | null>(null)
const erfasst = computed(() => !!treffer.value && (treffer.value.erledigt || treffer.value.z !== undefined))
const frage = computed(() => erfasst.value && bejaht.value !== treffer.value!.key)
// Eine andere Nummer vergisst das „Ja“ – kommt der WKR später wieder auf sie, fragt es neu.
watch(
  () => treffer.value?.key ?? null,
  (k) => {
    if (k !== bejaht.value) bejaht.value = null
  },
)
function frageJa(): void {
  if (treffer.value) bejaht.value = treffer.value.key
}
function frageNein(): void {
  bejaht.value = null
  nr.value = ''
}
/** Korrektur: Dieses Gerät hat für den Starter schon eine Zeile (KN8). */
const korrekturZ = computed(() => (treffer.value?.erledigt && treffer.value.z !== undefined ? treffer.value.z : null))
const anderswoErledigt = computed(() => !!treffer.value?.erledigt && korrekturZ.value === null)

// --- Entwurf: neu je Starter; in der Korrektur aus dem eigenen Stand ---
const entwurf = shallowRef<Entwurf>(leererEntwurf())
watch(
  () => `${treffer.value?.key ?? ''}|${korrekturZ.value ?? ''}|${aufbau.value?.art ?? ''}`,
  () => {
    const a = aufbau.value
    const z = korrekturZ.value
    if (!a || z === null) {
      entwurf.value = leererEntwurf()
      return
    }
    // Leere Zellen gehen ohne `vorher` nie hinaus: Was im Stand fehlt, war ✓ (die Zeile ging nur vollständig).
    const stand = props.quelle.stand(z) ?? {}
    entwurf.value = entwurfAus({ ...Object.fromEntries(a.pruef.map((p) => [p.feld, ''])), ...stand }, a)
  },
  { immediate: true },
)
function setze(feld: string, wahl: PruefWahl): void {
  const a = aufbau.value
  if (a) entwurf.value = tippePruef(entwurf.value, a, feld, wahl)
}
const nochOffen = computed(() => (aufbau.value ? pruefOffen(entwurf.value, aufbau.value) : 0))
const summe = computed(() => (aufbau.value ? punkteVon(entwurf.value, aufbau.value) : 0))
const darf = computed(() => !!aufbau.value && aufbau.value.art === 'pruefliste' && !frage.value && fertig(entwurf.value, aufbau.value))
/** Text des Hauptknopfs (KN10): „Alle richtig“ (nichts gesetzt), „Rest richtig“ (teils gesetzt), sonst „Abschicken“. */
const hauptText = computed(() => {
  const a = aufbau.value
  if (!a) return w('wkr.geraet.pruef.tippen')
  if (frage.value) return w('wkr.geraet.pruef.frageOffen')
  if (nochOffen.value > 0) return nochOffen.value === a.pruef.length ? w('wkr.geraet.pruef.alleRichtig') : w('wkr.geraet.pruef.restRichtig', { n: summe.value })
  return w(korrekturZ.value !== null ? 'wkr.geraet.pruef.korrigieren' : 'wkr.geraet.pruef.abschicken', { n: summe.value })
})

// --- Abschicken (KN8: kein Takt, Nummernfeld leer, Rückmeldung klein darunter) ---
const letzte = ref<{ nr: string; z: number } | null>(null)
const letzteStufe = computed(() => (letzte.value ? (props.quelle.stufen.value[letzte.value.z] ?? null) : null))
function abschicken(): void {
  const a = aufbau.value
  const t = treffer.value
  if (!a || !t || !darf.value) return
  // KN10: offene Knoten gehen als ✓ hinaus (dieselben Zellen wie von Hand gesetzt).
  entwurf.value = restRichtig(entwurf.value, a)
  const zellen = zellenAus(entwurf.value, a)
  const z = korrekturZ.value !== null ? props.quelle.korrigiere(korrekturZ.value, zellen) : props.quelle.schicke(liste.value, { s: t.key, zellen })
  if (z === null) return
  letzte.value = { nr: t.startNr, z }
  bejaht.value = null
  nr.value = ''
  void nextTick(erklaerungAusDemBild)
}

/**
 * Übung am Tisch (WKR_ANNAHMEN UK6, seit 26.11.2026 wie UK7 – Nutzer zu R11-14: „Oh, dann besser wieder raus damit.
 * Ich dachte, es ist eine extra Zeile.“): Nach „Alle richtig“/„Abschicken“ rollt nur die Erklärung „So läuft die Übung“
 * oben hinaus; der Kopf mit „ÜBUNG“ bleibt und steht am Rand, darunter der Block „Nr. 9 · Klasse · offen“ mit dem
 * Vorschlag (vorher rollte der Kopf mit hinaus). Ziel ist die Spalte der Liste (ohne Spalte die Liste selbst), bzw. der
 * Hinweis „Bildschirm kann ausgehen“, wenn er steht (zielNachErklaerung, 27.11.2026 – er bleibt wie der Kopf). Kein
 * Takt am Tisch: Der nächste Starter ist sofort vorbelegt (KN12), ein Nachrollen wie UK5 braucht es nicht. Nur in der
 * Übung.
 */
const wurzelRef = ref<HTMLElement | null>(null)
function erklaerungAusDemBild(): void {
  if (!props.quelle.uebung || !WKR_ANNAHMEN.uebungErklaerungAusDemBild || !WKR_ANNAHMEN.uebungKopfAmTisch) return
  rolleAnDenRand(zielNachErklaerung(wurzelRef.value))
}

// --- Liste abschließen (KN5) ---
const abschluss = ref(false)
const abgeschlossen = computed(() => !!sicht.value?.abgeschlossen.includes(OHNE_PUNKT))
const eigenerAbschluss = computed(() => props.quelle.abschluesse.value.find((a) => a.liste === liste.value && a.punkt === OHNE_PUNKT && a.stufe !== 'abgelehnt') ?? null)
const zeileText = (z: PruefZeile): { klasse: string; codes: string; punkte: number | null } => {
  const k = z.klasse && sicht.value ? maskeFuer(sicht.value, z.klasse as ClassId, props.spracheWahl) : null
  const fehler = k ? k.pruef.filter((p) => (z.zellen[p.feld] ?? '') !== '').map((p) => p.titel) : []
  return { klasse: k?.titel ?? z.klasse ?? '', codes: fehler.length ? `✗ ${fehler.join(', ')}` : '✓', punkte: k ? punkteVon(entwurfAus(z.zellen, k), k) : null }
}
const korrigierbar = computed(() => new Set(bestand.value.filter((b) => b.z !== undefined).map((b) => b.key)))
function korrigiereAusPruefung(s: string): void {
  const b = bestand.value.find((x) => x.key === s)
  if (!b) return
  abschluss.value = false
  // „Korrigieren“ in der Prüfansicht ist schon die Antwort auf KN11 – nicht noch einmal fragen.
  bejaht.value = b.key
  nr.value = b.startNr
}

const status = computed(() => sicht.value?.status ?? 'aktiv')
const stufeText = computed(() => {
  const s = letzteStufe.value
  return s ? `${stufeZeichen(s)} ${w(`wkr.geraet.stufe.${s.stufe}`)}` : ''
})
</script>

<template>
  <div ref="wurzelRef" class="wkr-maske wkr-pruefliste" data-teil="maske" data-maske="pruefliste" :data-liste="liste" :data-pad="pad || undefined">
    <WkrRuhe v-if="!sicht" art="warte" />
    <template v-else>
      <WkrKopf
        :titel="sicht.titel"
        :bereich="sicht.bereich"
        :lauf="null"
        :invers="false"
        :uebung="quelle.uebung"
        :verbindung="quelle.verbindung.value"
        :getrennt-sek="0"
        :wartend="quelle.wartend.value"
        :ohne-quittung="false"
        :papier-ab="null"
        :hinweis="null"
      />
      <WkrRuhe v-if="sicht.modus === 'papier'" art="papier" />
      <WkrRuhe v-else-if="status !== 'aktiv'" :art="status === 'pausiert' ? 'pausiert' : 'abgemeldet'" @weiter="quelle.weiter(liste)" />
      <WkrAbschluss
        v-else-if="abschluss"
        :quelle="quelle"
        :liste="liste"
        :listen-titel="sicht.titel"
        :punkt="OHNE_PUNKT"
        :punkt-titel="sicht.punkt?.titel ?? ''"
        :name="quelle.uebung ? (name ?? '') : quelle.wkrName(liste).name || (name ?? '')"
        :zeile-text="zeileText"
        :korrigierbar="korrigierbar"
        @korrigiere="korrigiereAusPruefung"
        @zurueck="abschluss = false"
        @name="(n) => emit('name', n)"
      />
      <div v-else class="wkr-pruef-rahmen">
        <div class="wkr-pruef-haupt">
          <p class="wkr-pruef-kopf" data-teil="pruef-kopf">
            <span data-teil="pruef-nr">{{ w('wkr.geraet.pruef.nr') }} {{ nr || treffer?.startNr || '–' }}</span>
            <span v-if="treffer" data-teil="pruef-klasse">{{ klassenTitel }}</span>
            <span data-teil="pruef-offen">{{ w('wkr.geraet.pruef.offen', { n: sicht.offen?.n ?? offen.length, m: sicht.offen?.m ?? bestand.length }) }}</span>
          </p>
          <button
            v-if="vorschlag"
            type="button"
            class="wkr-knopf wkr-pruef-vorschlag"
            data-ziel="gross"
            data-action="pruef-vorschlag"
            :data-start="vorschlag.key"
            @click="waehle(vorschlag)"
          >
            {{ w('wkr.geraet.pruef.vorschlag', { nr: vorschlag.startNr, klasse: titelVon(vorschlag.klasse) }) }}
          </button>
          <WkrZiffern v-model="nr" :buchstaben="buchstaben" :titel="w('wkr.geraet.pruef.nr')" />
          <p v-if="unbekannt" class="wkr-band wkr-band--warn" role="alert" data-teil="pruef-unbekannt">{{ w('wkr.geraet.pruef.unbekannt', { nr }) }}</p>
          <div v-else-if="frage" class="wkr-band wkr-band--hinweis wkr-pruef-frage" role="alertdialog" data-teil="pruef-frage">
            <p>{{ w('wkr.geraet.pruef.frage', { nr: treffer!.startNr }) }}</p>
            <div class="wkr-reihe">
              <button type="button" class="wkr-knopf wkr-knopf--haupt" data-ziel="gross" data-action="pruef-frage-ja" @click="frageJa">{{ w('wkr.geraet.pruef.frageJa') }}</button>
              <button type="button" class="wkr-knopf" data-ziel="gross" data-action="pruef-frage-nein" @click="frageNein">{{ w('wkr.geraet.pruef.frageNein') }}</button>
            </div>
          </div>
          <p v-else-if="korrekturZ !== null" class="wkr-band wkr-band--hinweis" role="status" data-teil="pruef-korrektur">{{ w('wkr.geraet.pruef.korrektur', { nr: treffer!.startNr }) }}</p>
          <p v-else-if="anderswoErledigt" class="wkr-band wkr-band--hinweis" role="status" data-teil="pruef-erledigt">{{ w('wkr.geraet.pruef.erledigt', { nr: treffer!.startNr }) }}</p>
          <p v-if="letzte && stufeText" class="wkr-hinweis" role="status" data-teil="pruef-letzte" :data-stufe="letzteStufe?.stufe">
            {{ w('wkr.geraet.pruef.letzte', { nr: letzte.nr, stand: stufeText }) }}
          </p>

          <ul v-if="aufbau && aufbau.art === 'pruefliste' && !frage" class="wkr-pruef-knoten" data-teil="pruef-knoten">
            <li v-for="p in aufbau.pruef" :key="p.feld" class="wkr-pruef-knoten-zeile" :data-feld="p.feld" :data-wahl="entwurf.pruef[p.feld] ?? 'offen'">
              <span class="wkr-pruef-knoten-titel">{{ p.titel }}</span>
              <button
                type="button"
                class="wkr-knopf wkr-pruef-wahl"
                data-ziel="gross"
                data-action="pruef-ok"
                :data-feld="p.feld"
                :aria-pressed="entwurf.pruef[p.feld] === 'ok'"
                @click="setze(p.feld, 'ok')"
              >
                ✓ {{ w('wkr.geraet.pruef.richtig') }}
              </button>
              <button
                type="button"
                class="wkr-knopf wkr-pruef-wahl wkr-pruef-wahl--fehler"
                data-ziel="gross"
                data-action="pruef-fehler"
                :data-feld="p.feld"
                :aria-pressed="entwurf.pruef[p.feld] === 'fehler'"
                @click="setze(p.feld, 'fehler')"
              >
                ✗ {{ w('wkr.geraet.pruef.falsch', { n: p.punkte }) }}
              </button>
            </li>
          </ul>
        </div>

        <!-- Offene Nummern: Pad rechts, Handy aufklappbar darunter (KN8). -->
        <aside v-if="pad" class="wkr-pruef-seite" data-teil="pruef-offene">
          <h3>{{ w('wkr.geraet.pruef.offene', { n: offen.length }) }}</h3>
          <div class="wkr-pruef-nummern">
            <button v-for="b in offen" :key="b.key" type="button" class="wkr-knopf" data-ziel="klein" data-action="pruef-waehle" :data-start="b.key" @click="waehle(b)">{{ b.startNr }}</button>
          </div>
        </aside>
        <details v-else-if="offen.length > 0" class="wkr-pruef-seite" data-teil="pruef-offene">
          <summary class="wkr-knopf" data-ziel="klein">{{ w('wkr.geraet.pruef.offene', { n: offen.length }) }}</summary>
          <div class="wkr-pruef-nummern">
            <button v-for="b in offen" :key="b.key" type="button" class="wkr-knopf" data-ziel="klein" data-action="pruef-waehle" :data-start="b.key" @click="waehle(b)">{{ b.startNr }}</button>
          </div>
        </details>

        <footer class="wkr-fuss" :class="{ 'wkr-fuss--links': hand === 'links' }" data-teil="fuss" :data-hand="hand">
          <div class="wkr-fuss-neben">
            <button
              v-if="!abgeschlossen && !eigenerAbschluss"
              type="button"
              class="wkr-knopf"
              data-ziel="klein"
              data-action="pruef-abschliessen"
              @click="abschluss = true"
            >
              {{ w('wkr.geraet.abschluss') }}
            </button>
            <span v-else class="wkr-hinweis" data-teil="pruef-abgeschlossen">{{ w('wkr.geraet.pruef.abgeschlossen') }}</span>
          </div>
          <button type="button" class="wkr-knopf wkr-knopf--haupt" data-ziel="gross" data-action="haupt" :disabled="!darf" @click="abschicken">
            {{ hauptText }}
          </button>
        </footer>

        <!-- Übung (Y4): andere Klasse vorziehen – die Knoten-Liste hat kein „Mehr“, darum hier aufklappbar. Seit
             24.11.2026 (Nutzer, Y5) ganz unten unter dem Hauptknopf, direkt über „Übung beenden“: nur die Übung hat es. -->
        <details v-if="vorziehKlassen && vorziehKlassen.length > 1" class="wkr-pruef-seite" data-teil="pruef-vorziehen" :open="vorziehOffen" @toggle="(e) => (vorziehOffen = (e.target as HTMLDetailsElement).open)">
          <summary class="wkr-knopf" data-ziel="klein">{{ w('wkr.geraet.uebung.vorziehen') }}</summary>
          <WkrVorziehen :klassen="vorziehKlassen" @wahl="ziehVor" />
        </details>
      </div>
    </template>
  </div>
</template>
