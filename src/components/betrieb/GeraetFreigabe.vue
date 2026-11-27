<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, watchEffect } from 'vue'
import type { PaarSeite, SichtBereich } from '../../types'
import type { BetriebAenderung } from '../../state/reducer/betrieb'
import { oeffneGekoppelt, oeffneKoppelLink, type GekoppeltesGeraet } from '../../geraete/gekoppelt'
import type { FassungsLage, LeseUmgebung } from '../../geraete/geraet'
import { AUTO_HALT, freigabeBereiche, listenAufgaben } from '../../geraete/aufgaben'
import { oeffneErfassung, type Erfassung } from '../../geraete/erfassen'
import { oeffneTabWache } from '../../geraete/tabWache'
import { liesListe } from '../../wkr/liste'
import { geraeteArt } from '../../geraete/geraeteName'
import { normalisiereCode } from '../../geraete/koppeln'
import { GERAET } from '../../geraete/paket'
import { verbindungsLage, type Fehlercode } from '../../geraete/transport/typen'
import { useUhr } from '../../lib/uhr'
import { UEBUNG_ADRESSE } from '../../lib/adressen'
import { t } from '../../i18n'
import AppDialog from '../AppDialog.vue'
import GeraeteLage from './GeraeteLage.vue'
import StartFreigabe from './StartFreigabe.vue'
import WkrGeraet from '../wkr/WkrGeraet.vue'
import { fingerabdruckText, startZeile } from './texte'

/**
 * Start-Freigabe auf einem gekoppelten Gerät (Etappe E7, Plan vom 16.11.2026 §4/§5; src/GeraetApp.vue zeigt sie für
 * `#/koppeln/<paket>` und `#/geraet`). Ohne Store: Das Gerät kennt nur die öffentliche Sicht, die der Bedienrechner an
 * die Anzeigetafel schickt, und schickt Actions über geraete/gekoppelt.ts – geprüft und angewandt am Host.
 *
 * - Koppel-Link mit QR-Token (gescannt): koppelt sofort mit dem vorgeschlagenen Namen (der Token gilt nur 30 s; am Steg
 *   tippt niemand). Koppel-Link ohne Token: Name und Geräte-Code eingeben. Danach ersetzt die Seite die Adresse durch
 *   `#/geraet` – der Token soll nicht in Verlauf und Lesezeichen stehen; die Kopplung liegt gerätelokal (ablage.ts).
 * - Gekoppelt: DIESELBE StartFreigabe wie am Bedienrechner, je eigenem Bereich; `sende` = geraet.sende. Bis die
 *   Quittung kommt, sind alle Knöpfe gesperrt (`<fieldset disabled>`, K32) mit „Wird gesendet …“, nach 10 s „Keine
 *   Bestätigung – Verbindung prüfen“ (die Schlange sendet weiter, mit wachsendem Abstand). Abgelehnt/unverändert
 *   steht als Satz da. Die Selbstanmeldung nach jedem Start sperrt nichts, sie zeigt nur „Verbinde …“ (meldetSich).
 * - W2.4: Stand der WKR-Erfassung (Geräteleiste, Rückstand, „Trotzdem freigeben?“) aus der Freigabe-Gruppe des
 *   Bereichs (geraete/gekoppelt.ts `freigabe`) – ohne Werte und Namen; ohne Schlüssel bleibt die Leiste einfach weg.
 * - Wiederholung nach Ausfall (Nutzer 27.11.2026, R13-01/R13-06): „Wiederholung (Ausfall) …“ und „Doch keine
 *   Wiederholung“ wie am Bedienrechner – dieselbe Wahl (AusfallWahl, `bereich.gefahren` aus der Sicht, sv 8) und
 *   Rückfrage; Abgemeldete ausgegraut aus der Freigabe-Sicht (`ausfallGesperrt`, fv 3). Geschickt werden die Actions der
 *   Erfassung WIEDERHOLUNG_AUSFALL/_AUFHEBEN; der Host prüft sie eng (geraete/aufgaben.ts erlaubteWiederholung) und
 *   lehnt mit Grund ab (`geraete.ablehnung.nicht-gezeigt`/`abgemeldet`), gesperrt bis zur Quittung wie jede Action.
 * - Entzogen: Hinweis, dazu nur lesend, wer im Boot sitzt und wer als Nächstes (K14, gewollt); neu koppeln mit Code.
 * - W3.3 (21.11.2026, Plan docs/plan-wkr-w3.md §5): Hat das Gerät Listen-Aufgaben, öffnet es EINMAL die WKR-Erfassung
 *   (geraete/erfassen.ts oeffneErfassung; stop beim Unmount, Entkoppeln oder einem anderen Gerät) und zeigt die Maske
 *   components/wkr/WkrGeraet.vue. Mit Start-Freigabe UND Liste unten Reiter „Freigabe“ / Listenname. Nach dem Entzug
 *   bleibt die Erfassung offen, damit nicht abgeschickte Entwürfe lesbar bleiben (Auslegung K3, WKR_ANNAHMEN) – sie
 *   schickt dann nichts mehr. Bildschirm wach: GeraetApp (E8), solange diese Seite offen ist.
 * - W3.4 (21.11.2026): WkrGeraet bekommt den Raum (`raum` = u/r/s des Pakets) für die Probe je Raum und Liste (G10);
 *   im Koppel-Formular (und ohne Gerät) der Verweis „Üben ohne Verbindung“ → `#/uebung` (G13, GeraetApp ohne Store).
 * - „Gerät entkoppeln“ löscht Kopplung und Schlüssel auf dem Gerät (verlasse); im Register des Hosts bleibt es, bis
 *   es dort entzogen wird – der Host erfährt davon nichts (keine Nachricht ohne Rechte, kein Kontingent dafür).
 */
const props = defineProps<{
  /** Paket eines Koppel-Links; ohne = die abgelegte Kopplung (`#/geraet`). */
  paket?: string
  /** Nur Tests: Speicher, Zeiten, Uhr (geraete/geraet.ts LeseUmgebung). */
  umgebung?: LeseUmgebung
  /** Der Host spricht eine neuere Fassung (F7) – GeraetApp lädt gezielt neu. */
  aktualisiere: () => void
  /** E8: Der Bildschirm lässt sich nicht wach halten (GeraetApp, lib/wachBleiben.ts) – leiser Hinweis in der Leiste. */
  bildschirmKannAus?: boolean
}>()

/** So lange bleibt eine Action ohne Quittung „Wird gesendet …“, dann der Hinweis auf die Verbindung (Plan §4, K32). */
const OHNE_QUITTUNG_MS = 10_000
/** So lange wartet eine Anmeldung auf Antwort: Auf einen falschen Code antwortet niemand (sein Thema hört keiner). */
const KEINE_ANTWORT_MS = 15_000

type Lage = { art: 'ohne' } | { art: 'entkoppelt' } | { art: 'andererTab' } | { art: 'ungueltig' } | { art: 'fassung'; lage: FassungsLage } | { art: 'geraet'; geraet: GekoppeltesGeraet }
const lage = shallowRef<Lage>({ art: 'ohne' })
const geraet = computed(() => (lage.value.art === 'geraet' ? lage.value.geraet : null))
let geoeffnet: string | undefined

const vorschlag = () => t(`geraete.name.${geraeteArt()}`)
const name = ref(vorschlag())
const code = ref('')
const codeFalsch = ref(false)

/**
 * Befund 15 (21.11.2026): Nur EIN Tab je Gerät sendet und schreibt die Geräte-Ablage – der zuletzt geöffnete
 * (geraete/tabWache.ts). Gerät und Erfassung bekommen die bewachte Ablage; wird dieser Tab verdrängt, stoppen beide
 * sofort (flush 'sync': vor dem nächsten POST) und die Seite bietet „Hier weitermachen“ an.
 */
const wache = oeffneTabWache(props.umgebung?.ablage !== undefined ? { ablage: props.umgebung.ablage } : {})
const umgebungBewacht = (): LeseUmgebung => ({ ...props.umgebung, ablage: wache.ablage, aktualisiere: props.aktualisiere })
watch(
  wache.verdraengt,
  (weg) => {
    if (!weg) return
    stoppeWkr()
    geraet.value?.stop()
    lage.value = { art: 'andererTab' }
  },
  { flush: 'sync' },
)
function hierWeiter(): void {
  wache.uebernimm()
  oeffne(undefined)
}

function oeffne(text: string | undefined): void {
  geraet.value?.stop()
  geoeffnet = text
  if (!wache.meins()) return
  if (!text) {
    const g = oeffneGekoppelt(umgebungBewacht())
    lage.value = g ? { art: 'geraet', geraet: g } : { art: 'ohne' }
    // Nach dem Neuladen mitten im Koppeln: Die Wartezeit auf die Antwort beginnt jetzt.
    if (g?.lage.value === 'koppelt') seitKoppeln.value = Date.now()
    if (g) void g.start()
    return
  }
  const r = oeffneKoppelLink(text, umgebungBewacht())
  if (!r.ok) {
    lage.value = r.code === 'fassung' ? { art: 'fassung', lage: r.lage } : { art: 'ungueltig' }
    return
  }
  const g = r.geraet
  lage.value = { art: 'geraet', geraet: g }
  // Paket aus der Adresse (QR-Token); GeraetApp bleibt dieselbe Wurzel (main.ts), das Paket hier unverändert.
  location.replace(`#/${GERAET}`)
  void g.start().then(() => {
    // Gescannt: sofort koppeln – außer das Gerät ist es in diesem Raum schon (dann gälte der Token nichts Neues).
    if (g.koppelPaket.q && g.lage.value !== 'gekoppelt' && lage.value.art === 'geraet' && lage.value.geraet === g) {
      g.koppeln(name.value)
      seitKoppeln.value = Date.now()
      ueberQr.value = true
    }
  })
}

// Ein neuer Koppel-Link in der Adresse (etwa ein zweiter QR-Code) – das Ersetzen durch `#/geraet` selbst nicht.
watch(
  () => props.paket,
  (neu) => {
    if (neu && neu !== geoeffnet) oeffne(neu)
  },
)
onMounted(() => oeffne(props.paket))
onBeforeUnmount(() => {
  stoppeWkr()
  geraet.value?.stop()
  wache.stop()
})

// --- Koppeln ---
const seitKoppeln = ref(0)
/** Die laufende Anmeldung kam aus einem gescannten QR-Code (für den Hinweis „noch einmal scannen“). */
const ueberQr = ref(false)
const uhr = useUhr(1000)
const koppelLage = computed(() => geraet.value?.lage.value ?? 'ungekoppelt')
const keineAntwort = computed(() => koppelLage.value === 'koppelt' && seitKoppeln.value > 0 && uhr.value - seitKoppeln.value >= KEINE_ANTWORT_MS)
const formZeigen = computed(() => {
  const l = koppelLage.value
  return l === 'ungekoppelt' || l === 'abgelehnt' || keineAntwort.value
})
function koppeln(): void {
  const g = geraet.value
  if (!g) return
  const wert = normalisiereCode(code.value)
  codeFalsch.value = !wert
  if (!wert) return
  if (g.koppeln(name.value.trim() || vorschlag(), wert) === 'gesendet') {
    seitKoppeln.value = Date.now()
    ueberQr.value = false
    code.value = ''
  }
}

// --- Gekoppelt: Sicht und eigene Bereiche ---
const sicht = computed(() => (geraet.value && !geraet.value.beendet.value ? geraet.value.anzeige.value : null))
const eigene = computed<SichtBereich[]>(() => {
  const g = geraet.value
  if (!g || !sicht.value) return []
  const frei = freigabeBereiche(g.aufgaben.value)
  return sicht.value.bereiche.filter((b) => frei.includes(b.id))
})

/** W2.4: Stand der WKR-Erfassung je eigenem Bereich – aus der Freigabe-Gruppe (gekoppelt.ts), nie aus der Tafel-Sicht. */
const erfassung = computed(() => geraet.value?.freigabe.value ?? {})

// --- W3.3: WKR-Erfassung, wenn das Gerät Listen hat ---
const wkr = shallowRef<Erfassung | null>(null)
let wkrVon: GekoppeltesGeraet | null = null
function stoppeWkr(): void {
  wkr.value?.stop()
  wkr.value = null
  wkrVon = null
}
watch(
  [geraet, () => geraet.value?.aufgaben.value],
  () => {
    const g = geraet.value
    if (wkrVon && wkrVon !== g) stoppeWkr()
    if (!g || wkr.value || listenAufgaben(g.aufgaben.value).length === 0) return
    const u = props.umgebung
    wkr.value = oeffneErfassung(g, { ablage: wache.ablage, ...(u?.uhr ? { uhr: u.uhr } : {}) })
    wkrVon = g
  },
  { immediate: true },
)
const mitFreigabe = computed(() => !!geraet.value && freigabeBereiche(geraet.value.aufgaben.value).length > 0)
// Abgemeldete Listen (Nutzer 21.11.2026) bleiben als Reiter mit ihrer Ruhe-Ansicht, auch nachdem der Bedienrechner sie
// vom Gerät genommen hat (WkrGeraet zeigt dort „Von … abgemeldet“ mit Entwürfen und „Zuletzt“).
const wkrListen = computed(() => {
  const eigene = wkr.value?.listen.value ?? []
  const weg = (wkr.value?.abgemeldet.value ?? []).filter((a) => !eigene.some((l) => l.liste === a.liste))
  return [...eigene.map((l) => ({ liste: l.liste })), ...weg.map((a) => ({ liste: a.liste }))]
})
/** Reiter unten, nur mit Freigabe UND Liste: 'freigabe' oder die Kennung einer Liste. */
const reiter = ref('freigabe')
const zeigeWkr = computed(() => !!wkr.value && wkrListen.value.length > 0 && (!mitFreigabe.value || reiter.value !== 'freigabe'))
const wkrListe = computed(() => (mitFreigabe.value ? wkrListen.value.find((a) => a.liste === reiter.value)?.liste : undefined))
const raum = computed(() => (geraet.value ? { u: geraet.value.paket.u, r: geraet.value.paket.r, s: geraet.value.paket.s } : null))
const wkrTitel = (liste: string) => wkr.value?.sichten.value[liste]?.titel || wkr.value?.abgemeldet.value.find((a) => a.liste === liste)?.titel || '…'
/** Meldung der Start-Freigabe im Bereich der Liste – aus der öffentlichen Sicht, wie auf der Anzeigetafel. */
function meldungFuer(liste: string): string | null {
  const bereich = liesListe(liste)?.bereich
  return sicht.value?.bereiche.find((b) => b.id === bereich)?.meldung?.text ?? null
}

// --- Senden, Quittung ---
const offen = computed(() => (geraet.value?.offen.value.length ?? 0) > 0)
const seitOffen = ref(0)
watch(offen, (jetzt) => (seitOffen.value = jetzt ? Date.now() : 0))
const ohneQuittung = computed(() => offen.value && seitOffen.value > 0 && uhr.value - seitOffen.value >= OHNE_QUITTUNG_MS)
/** Nur die Quittung auf die zuletzt hier gesendete Action zählt für den Satz unter den Knöpfen. */
const gesendet = ref<number | null>(null)
const rueckmeldung = computed(() => {
  const q = geraet.value?.quittung.value
  if (!q || q.nr !== gesendet.value) return null
  if (q.ergebnis === 'abgelehnt') return { art: 'abgelehnt', text: t('geraete.freigabe.abgelehnt', { grund: t(`geraete.ablehnung.${q.grund ?? 'nicht-erlaubt'}`) }) }
  if (q.ergebnis === 'unveraendert') return { art: 'unveraendert', text: t('geraete.freigabe.unveraendert') }
  return null
})
function sende(action: BetriebAenderung): void {
  const g = geraet.value
  // Ein Doppelklick während des Sendens geht nicht durch: Das Fieldset ist gesperrt, aber erst nach dem Neuzeichnen.
  if (!g || offen.value) return
  const nr = g.sende(action)
  if (nr !== null) gesendet.value = nr
}
/**
 * Wiederholung nach Ausfall vom Handy (Nutzer 27.11.2026, R13-01/R13-06; BETRIEB_ANNAHMEN.wiederholungAnDerStartFreigabe):
 * Actions der Erfassung, nicht des Betriebs – deshalb eigene Wege neben `sende`, aber dieselbe Schlange und Sperre bis
 * zur Quittung. `nur` im Parallelslalom: nur das Boot dieser Seite wiederholt (R13-02).
 */
function wiederholen(bereich: string, ref: string, nur: PaarSeite | undefined, abbrueche: number): void {
  const g = geraet.value
  if (!g || offen.value) return
  // `abbrueche` (Prüfbefund 27.11.2026): Die Nachricht kann im Funkloch in der Schlange stehen – der Host wendet sie nur
  // auf den Versuch an, den die Wahl zeigte (geraete/aufgaben.ts erlaubteWiederholung, sonst `konflikt`).
  const nr = g.sende({ type: 'WIEDERHOLUNG_AUSFALL', bereich, ref, ...(nur ? { nur } : {}), abbrueche })
  if (nr !== null) gesendet.value = nr
}
function aufheben(bereich: string, ref: string, abbrueche: number): void {
  const g = geraet.value
  if (!g || offen.value) return
  const nr = g.sende({ type: 'WIEDERHOLUNG_AUFHEBEN', bereich, ref, abbrueche })
  if (nr !== null) gesendet.value = nr
}
/**
 * „Anhalten“ des Auto-Modus (Nutzer 21.11.2026, P-03; BETRIEB_ANNAHMEN.autoAnhaltenLokal, AM7): eine Nachricht an den
 * Host, keine Reducer-Action – der Host merkt es sich bis zum nächsten gezeigten Start (geraete/host.ts AUTO_HALT).
 */
function autoAnhalten(bereich: string, ref: string): void {
  const g = geraet.value
  if (!g || offen.value) return
  const nr = g.sende({ type: AUTO_HALT, bereich, ref })
  if (nr !== null) gesendet.value = nr
}

// --- Entzogen: nur lesen, wer dran ist ---
const lesend = computed(() =>
  (sicht.value?.bereiche ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    imBoot: b.aktuell && sicht.value!.starter[b.aktuell.starter] ? startZeile(sicht.value!, b.aktuell) : null,
    naechster: b.offen[0] && sicht.value!.starter[b.offen[0].starter] ? startZeile(sicht.value!, b.offen[0]) : null,
  })),
)

// --- Leiste ---
const verbindung = computed(() => (geraet.value ? verbindungsLage(geraet.value.status.value, geraet.value.fehler.value) : 'aus'))
const fehler = computed<Fehlercode | null>(() => {
  const c = geraet.value?.fehler.value?.code ?? null
  return c === 'verbindung-gestoert' || c === 'zu-viele-anfragen' || c === 'fassung' ? null : c
})
const fassung = computed<FassungsLage | null>(() => (lage.value.art === 'fassung' ? lage.value.lage : (geraet.value?.fassung.value ?? null)))

watchEffect(() => {
  const s = sicht.value
  document.title = [t('geraete.freigabe.titel'), s?.kopf].filter(Boolean).join(' – ')
})

const frageEntkoppeln = ref(false)
function entkopple(): void {
  frageEntkoppeln.value = false
  stoppeWkr()
  geraet.value?.verlasse()
  lage.value = { art: 'entkoppelt' }
}
</script>

<template>
  <div class="geraet-freigabe" :data-lage="geraet ? (geraet.beendet.value ? 'beendet' : koppelLage) : lage.art">
    <!-- Ohne Gerät: kein oder kaputter Link, andere Fassung, eben entkoppelt. -->
    <section v-if="!geraet" class="geraet-meldung" role="status" :data-meldung="lage.art">
      <template v-if="lage.art === 'andererTab'">
        <h1>{{ t('geraete.freigabe.andererTab') }}</h1>
        <p>{{ t('geraete.freigabe.andererTab.hint') }}</p>
        <p>
          <button type="button" class="btn primary" data-action="hier-weiter" @click="hierWeiter">{{ t('geraete.freigabe.hierWeiter') }}</button>
        </p>
      </template>
      <template v-else-if="lage.art === 'entkoppelt'">
        <h1>{{ t('geraete.freigabe.entkoppelt') }}</h1>
        <p>{{ t('geraete.freigabe.keinGeraet.hint') }}</p>
      </template>
      <h1 v-else-if="lage.art === 'ungueltig'">{{ t('geraete.fehler.link-ungueltig') }}</h1>
      <template v-else-if="lage.art === 'fassung'">
        <h1>{{ t(lage.lage === 'host-neuer' ? 'geraete.sehen.hostNeuer' : 'geraete.sehen.hostAelter') }}</h1>
        <p v-if="lage.lage === 'host-neuer'">
          <button type="button" class="btn" data-action="neu-laden" @click="aktualisiere">{{ t('geraete.sehen.neuLaden') }}</button>
        </p>
      </template>
      <template v-else>
        <h1>{{ t('geraete.freigabe.keinGeraet') }}</h1>
        <p>{{ t('geraete.freigabe.keinGeraet.hint') }}</p>
      </template>
      <p v-if="lage.art === 'ohne' || lage.art === 'entkoppelt'">
        <a class="btn" :href="UEBUNG_ADRESSE" data-action="ueben">{{ t('wkr.geraet.uebung.link') }}</a>
      </p>
    </section>

    <section v-else-if="geraet.beendet.value" class="geraet-meldung" role="status" data-meldung="beendet">
      <h1>{{ t('geraete.sehen.beendet') }}</h1>
    </section>

    <template v-else>
      <!-- Entzogen: Hinweis und nur lesend, wer dran ist (K14). -->
      <template v-if="koppelLage === 'entzogen'">
        <p class="boat-banner warn geraet-banner" role="alert" data-teil="entzogen">{{ t('geraete.freigabe.entzogen') }}</p>
        <WkrGeraet v-if="wkr && wkr.entwuerfe.value.length > 0" :quelle="wkr" :ablage="umgebung?.ablage" />
        <div class="geraet-lesend" data-teil="lesend">
          <section v-for="b in lesend" :key="b.id" class="panel geraet-lesend-bereich" :data-bereich="b.id">
            <h2>{{ b.name }}</h2>
            <p>
              <span class="note">{{ t('betrieb.imBoot') }}</span>
              <b data-teil="imboot">{{ b.imBoot ? `${b.imBoot.startNr} ${b.imBoot.name}`.trim() : t('betrieb.keiner') }}</b>
            </p>
            <p>
              <span class="note">{{ t('betrieb.naechster') }}</span>
              {{ b.naechster ? `${b.naechster.startNr} ${b.naechster.name}`.trim() : '–' }}
            </p>
          </section>
        </div>
      </template>

      <!-- Gekoppelt: dieselbe Start-Freigabe wie am Bedienrechner, nur die eigenen Bereiche. -->
      <template v-else-if="koppelLage === 'gekoppelt'">
        <WkrGeraet v-if="zeigeWkr && wkr" :class="{ 'wkr-mit-reiter': mitFreigabe && wkrListen.length > 0 }" :quelle="wkr" :ablage="umgebung?.ablage" :nur-liste="wkrListe" :meldung-fuer="meldungFuer" :raum="raum" :bildschirm-kann-aus="bildschirmKannAus" />
        <section v-else-if="!sicht" class="geraet-meldung" role="status" data-meldung="warte">
          <h1>{{ t('geraete.freigabe.warte') }}</h1>
        </section>
        <section v-else-if="eigene.length === 0" class="geraet-meldung" role="status" data-meldung="keine-bereiche">
          <h1>{{ t('geraete.freigabe.keineBereiche') }}</h1>
        </section>
        <template v-else>
          <p v-if="offen" class="boat-banner geraet-banner" :class="ohneQuittung ? 'warn' : ''" role="status" data-teil="sendet" :data-ohne-quittung="ohneQuittung">
            {{ t(ohneQuittung ? 'geraete.freigabe.ohneQuittung' : 'geraete.freigabe.sendet') }}
          </p>
          <p v-else-if="rueckmeldung" class="boat-banner warn geraet-banner" role="alert" data-teil="rueckmeldung" :data-art="rueckmeldung.art">{{ rueckmeldung.text }}</p>
          <!-- Selbstanmeldung (P-7) läuft: nur ein Hinweis, die Knöpfe bleiben frei (Prüfung E7, 20.11.2026). -->
          <p v-else-if="geraet.meldetSich.value" class="note geraet-banner" role="status" data-teil="verbinde">{{ t('geraete.freigabe.verbinde') }}</p>
          <fieldset class="geraet-sperre" :disabled="offen" :aria-busy="offen">
            <StartFreigabe
              v-for="b in eigene"
              :key="b.id"
              :sicht="sicht"
              :bereich="b"
              :sende="sende"
              :erfassung="erfassung[b.id]"
              :auto-anhalten="(ref: string) => autoAnhalten(b.id, ref)"
              :wiederholen="(ref: string, nur: PaarSeite | undefined, abbrueche: number) => wiederholen(b.id, ref, nur, abbrueche)"
              :aufheben="(ref: string, abbrueche: number) => aufheben(b.id, ref, abbrueche)"
              :ausfall-gesperrt="erfassung[b.id]?.ausfallGesperrt"
              nur-dieser
            />
          </fieldset>
        </template>
        <nav v-if="mitFreigabe && wkrListen.length > 0" class="geraet-reiter" role="tablist" data-teil="geraet-reiter">
          <button type="button" role="tab" class="btn" data-action="reiter" data-reiter="freigabe" :aria-selected="reiter === 'freigabe'" @click="reiter = 'freigabe'">
            {{ t('wkr.geraet.reiter.freigabe') }}
          </button>
          <button
            v-for="a in wkrListen"
            :key="a.liste"
            type="button"
            role="tab"
            class="btn"
            data-action="reiter"
            :data-reiter="a.liste"
            :aria-selected="reiter === a.liste"
            @click="reiter = a.liste"
          >
            {{ wkrTitel(a.liste) }}
          </button>
        </nav>
      </template>

      <section v-else-if="koppelLage === 'koppelt' && !keineAntwort" class="geraet-meldung" role="status" data-meldung="koppelt">
        <h1>{{ t('geraete.freigabe.koppelt') }}</h1>
      </section>

      <!-- Koppeln mit Geräte-Code: ungekoppelt, abgelehnt, keine Antwort – und nach einem Entzug (neuer Code). -->
      <component :is="koppelLage === 'entzogen' ? 'details' : 'section'" v-if="formZeigen || koppelLage === 'entzogen'" class="panel geraet-koppeln" data-teil="koppeln">
        <component :is="koppelLage === 'entzogen' ? 'summary' : 'h1'">{{ t(koppelLage === 'entzogen' ? 'geraete.freigabe.wiederKoppeln' : 'geraete.freigabe.koppeln') }}</component>
        <p v-if="koppelLage === 'abgelehnt' && geraet.grund.value" class="boat-banner warn" role="alert" data-teil="abgelehnt" :data-grund="geraet.grund.value">
          {{ t(`geraete.ablehnung.${geraet.grund.value}`) }}
        </p>
        <p v-else-if="keineAntwort" class="boat-banner warn" role="alert" data-teil="keine-antwort">{{ t('geraete.freigabe.keineAntwort') }}</p>
        <!-- Gescannt und gescheitert (etwa Token abgelaufen, bevor die Anmeldung hinausging): Wer gescannt hat, hat keinen Code. -->
        <p v-if="ueberQr && (koppelLage === 'abgelehnt' || keineAntwort)" class="note" data-teil="qr-nochmal">{{ t('geraete.freigabe.qrNochmal') }}</p>
        <!-- Befund 6 (21.11.2026): Wer den Koppel-Link (ohne Token) gescannt hat, wollte meist den QR-Code zum Koppeln. -->
        <p v-if="koppelLage === 'ungekoppelt' && !ueberQr" class="boat-banner" role="note" data-teil="ohne-token">{{ t('geraete.freigabe.ohneToken') }}</p>
        <p class="note">{{ t('geraete.freigabe.koppeln.hint') }}</p>
        <form class="geraet-koppel-form" @submit.prevent="koppeln">
          <label>
            {{ t('geraete.freigabe.code') }}
            <input
              v-model="code"
              class="input geraet-code"
              data-feld="code"
              autocomplete="one-time-code"
              autocapitalize="characters"
              spellcheck="false"
              maxlength="9"
              @input="codeFalsch = false"
            />
          </label>
          <p v-if="codeFalsch" class="note betrieb-warn" role="alert" data-teil="code-falsch">{{ t('geraete.freigabe.code.falsch') }}</p>
          <label>
            {{ t('geraete.freigabe.name') }}
            <input v-model="name" class="input" data-feld="name" maxlength="40" autocomplete="off" />
          </label>
          <button type="submit" class="btn primary betrieb-gross" data-action="koppeln">{{ t('geraete.freigabe.koppelnKnopf') }}</button>
        </form>
        <!-- G13: üben, ohne gekoppelt zu sein – eigene Wurzel ohne Netz (GeraetApp `#/uebung`). -->
        <p class="geraet-ueben">
          <a class="btn" :href="UEBUNG_ADRESSE" data-action="ueben">{{ t('wkr.geraet.uebung.link') }}</a>
        </p>
      </component>
    </template>

    <footer v-if="geraet && !geraet.beendet.value" class="geraet-leiste" data-teil="leiste">
      <span data-teil="verbindung" :data-lage="verbindung"><GeraeteLage :lage="verbindung" /></span>
      <span v-if="fehler" class="geraet-hinweis" data-teil="fehler" :data-fehler="fehler">{{ t(`geraete.fehler.${fehler}`) }}</span>
      <span v-if="fassung" class="geraet-hinweis" data-teil="fassung" :data-fassung="fassung">
        {{ t(fassung === 'host-neuer' ? 'geraete.sehen.hostNeuer' : 'geraete.sehen.hostAelter') }}
        <button v-if="fassung === 'host-neuer'" type="button" class="btn sm" data-action="neu-laden" @click="aktualisiere">{{ t('geraete.sehen.neuLaden') }}</button>
      </span>
      <span v-if="bildschirmKannAus" class="note" data-teil="wach">{{ t('geraete.sehen.bildschirmKannAus') }}</span>
      <span class="geraet-fingerabdruck" data-teil="fingerabdruck">{{ t('geraete.sehen.fingerabdruck', { f: fingerabdruckText(geraet.fingerabdruck) }) }}</span>
      <span class="geraet-knoepfe">
        <button type="button" class="btn sm" data-action="entkoppeln" @click="frageEntkoppeln = true">{{ t('geraete.freigabe.entkoppeln') }}</button>
      </span>
    </footer>

    <AppDialog v-if="frageEntkoppeln" :titel="t('geraete.freigabe.entkoppeln.frage')" data-dialog="entkoppeln" @abbrechen="frageEntkoppeln = false">
      <p>{{ t('geraete.freigabe.entkoppeln.text') }}</p>
      <template #knoepfe>
        <button type="button" class="btn danger" data-action="entkoppeln-ja" @click="entkopple">{{ t('geraete.freigabe.entkoppeln.ja') }}</button>
        <button type="button" class="btn" data-action="entkoppeln-nein" autofocus @click="frageEntkoppeln = false">{{ t('common.cancel') }}</button>
      </template>
    </AppDialog>
  </div>
</template>
