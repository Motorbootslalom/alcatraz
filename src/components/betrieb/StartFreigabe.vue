<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { Meldung, MeldungArt, OeffentlicheSicht, SichtBereich, SichtStart } from '../../types'
import type { BetriebAenderung } from '../../state/reducer/betrieb'
import { t, tn } from '../../i18n'
import { merke } from '../../lib/merken'
import type { FreigabeErfassung, FreigabeListe } from '../../wkr/freigabe'
import type { Ampel } from '../../wkr/lage'
import AppDialog from '../AppDialog.vue'
import AusfallWahl from './AusfallWahl.vue'
import BetriebsFolge from './BetriebsFolge.vue'
import EinreihenListe from './EinreihenListe.vue'
import EinsteigenAb from './EinsteigenAb.vue'
import KlassenAussetzen from './KlassenAussetzen.vue'
import MeldungWahl from './MeldungWahl.vue'
import { beginnenText, punktText, startZeile, tBereich, tnBereich, type StartZeile } from './texte'

/**
 * Start-Freigabe eines Bereichs (Parcours): wer im Boot sitzt, wer als Nächstes dran ist, „Nächster Start“,
 * „Zurück“, „Lauf N beginnen“ und die Meldung auf der Anzeigetafel (E1); dazu die Steuerung der Etappe E2
 * (Plan vom 16.11.2026): den Nächsten zurückstellen, einen anderen Starter wählen und zeigen, verschieben,
 * zurückgestellte und nachzuholende einreihen, Klassen aussetzen („Boot fehlt“) und vorziehen, Meldungsvorlagen,
 * „Einsteigen ab …“. Nach dem Tafel-Prototyp (StegPanel.vue), neu auf die Sicht geschrieben.
 *
 * Anordnung für den Laptop am Steg: oben groß, was jeder Start braucht (Im Boot, Als Nächstes, „Nächster
 * Start“); daneben die seltenen Griffe als Knöpfe; alles Weitere zugeklappt darunter, damit nicht bei jedem
 * Starter gescrollt wird. Rückfrage nur bei „Lauf beginnen“, solange Starts offen sind – alles andere ist
 * umkehrbar. Nur betriebliche Knöpfe; Einstellungen (etwa „Verzahnung beim Verschieben halten“) stehen in den
 * Einstellungen (BETRIEB_ANNAHMEN.wohin).
 *
 * Parallelslalom (E4): Runden statt Läufe, je Start ein Paar (Racecourse A und B). Zurückstellen nimmt das ganze Paar
 * (BETRIEB_ANNAHMEN.parallelPaarAlsEinheit); Klassen aussetzen/vorziehen und Verschieben gibt es dort nicht – statt
 * „Klassen · Boot fehlt“ steht ein Hinweis (BETRIEB_ANNAHMEN.parallelOhneUmstellen).
 *
 * Liest NUR die öffentliche Sicht und schickt Actions über `sende` – am Bedienrechner dispatch, später (E7)
 * vom Handy über den Host. Jede Action ist bedingt (state/reducer/betrieb.ts): „Nächster Start“ trägt den
 * Start, der gerade steht (`vorher`), ein Doppelklick schaltet so nicht zweimal. Bedienung in der Sprache
 * der Oberfläche; Namen von Parcours und Klassen kommen aus der Sicht (Sprache der Tafel).
 *
 * WKR-Erfassung (W2.4, Plan docs/plan-wkr-w2.md §6.3, 21.11.2026): optional `erfassung` – reine Daten (wkr/freigabe.ts
 * FreigabeErfassung), am Bedienrechner aus erfassungsLage, auf dem Handy aus der Freigabe-Gruppe; keine Store-Abhängigkeit.
 * Geräteleiste je Liste, sobald eine Liste des Bereichs einen Eintrag hat; ein Feld, das neu auf ✕ oder „!“ geht, wird
 * einmal hervorgehoben und bleibt rot (kein Ton, kein Dialog). Warnt eine Liste (Rückstand ≥ R): Rückstandszeile und
 * gelber Rand um „Als Nächstes“; bei „nachfragen“ vor JEDEM Zeigen ein AppDialog „Trotzdem weiter?“ mit Liste und
 * Startnummern (auch aus „Anderen Starter wählen“, A8/D5). Gesperrt wird nie (F4).
 * Feldtest 21.11.2026 (WKR_ANNAHMEN N8–N10): Vorgabe ab 1 offenem Start nachfragen; das große Zeichen je Feld nennt den
 * Erfassungsstand (✓ fertig, ⧗ wartet n, ✕ Gerät weg, ▭ Papier), die Verbindung steht klein dahinter – der grüne
 * Punkt neben „1 offen“ las sich als „fertig“.
 *
 * Parcours-Ampel (Nutzer 21.11.2026, P-03/P-04; WKR_ANNAHMEN AM1–AM5, BETRIEB_ANNAHMEN AM6/AM7): Die Freigabe gilt nur dem
 * Parcours. Am gezeigten Start ein Ampelzeichen aus `erfassung.ampel` (wkr/ampel.ts): ● grün „Start frei“ mit dem Knopf
 * „Durchs Start-Tor“ (BETRIEB_DURCHFAHRT), ● rot „Im Parcours“ mit den offenen Parcours-Listen (per Knopf rot: „Doch
 * nicht durch“), ● frei. Die Rückfrage vor „Nächster Start“ kommt nur über warnende PARCOURS-Listen; der gezeigte Start
 * zählt darin erst ab rot (lage.ts) – ein Starter, der noch nicht losfuhr, lässt nie fragen. Nie gesperrt (F4).
 * Auto-Modus: Countdown aus `erfassung.autoIn` (Sekunden beim Senden; hier mit eigener Uhr heruntergezählt) mit
 * „Anhalten“ (`autoAnhalten`: am Bedienrechner der Host, auf dem Handy eine Nachricht an ihn) bzw. „Auto aus: …“.
 *
 * Wiederholung nach Ausfall (Nutzer 26.11.2026, R11-11; BETRIEB_ANNAHMEN WH1–WH5): Nur mit `wiederholen` (am
 * Bedienrechner) der Knopf „Wiederholung (Ausfall) …“ mit der Wahl unter den gezeigten Starts (AusfallWahl, Rückfrage), mit
 * `aufheben` „Doch keine Wiederholung“ (holt die verworfenen Werte zurück, Prüfbefund 27.11.2026). Die Liste „Wiederholung offen“ steht überall (auch auf dem Freigabe-Handy) – Einreihen und
 * Zeigen sind gewöhnliche Schritte. Ein abgebrochener Versuch im Boot trägt „Ausfall – wird wiederholt“; „Zurück“ nimmt
 * ihn nicht mehr.
 */
const props = defineProps<{
  sicht: OeffentlicheSicht
  bereich: SichtBereich
  sende: (action: BetriebAenderung) => void
  /** Nur am Bedienrechner: eine eigene Anzeigetafel für diesen Bereich öffnen. */
  anzeigeOeffnen?: () => void
  /**
   * Auf einem gekoppelten Gerät (E7): ohne „Meldung auf allen“ – ein Gerät schreibt nie auf die Anzeigetafel anderer
   * Bereiche (geraete/aufgaben.ts lehnt Bereich '*' ab; der Knopf soll gar nicht erst locken).
   */
  nurDieser?: boolean
  /** W2.4: Stand der WKR-Erfassung des Bereichs (Geräteleiste, Rückstand, Nachfrage); ohne = keine Leiste. */
  erfassung?: FreigabeErfassung
  /** W2.4, nur am Bedienrechner: Klick auf die Geräteleiste – zum Unterreiter WKR dieses Bereichs. */
  erfassungOeffnen?: () => void
  /** Auto-Modus anhalten (AM7) – bis zum nächsten gezeigten Start; ohne = kein Knopf. */
  autoAnhalten?: (ref: string) => void
  /**
   * Nur am Bedienrechner (R11-11, WH3): Wiederholung nach Ausfall für einen gezeigten Start auslösen – BetriebView
   * schickt WIEDERHOLUNG_AUSFALL (eine Action der Erfassung, nicht über `sende`). Ohne = kein Knopf, kein „Doch keine
   * Wiederholung“.
   */
  wiederholen?: (ref: string) => void
  /**
   * Nur am Bedienrechner, mit `wiederholen`: „Doch keine Wiederholung“ – BetriebView schickt WIEDERHOLUNG_AUFHEBEN (eine
   * Action der Erfassung: die verworfenen Werte kommen zurück, Prüfbefund 27.11.2026). Ohne = kein Knopf.
   */
  aufheben?: (ref: string) => void
  /**
   * Starter-IDs, für die „Wiederholung (Ausfall)“ nicht geht – abgemeldete (WH10; Prüfbefund 27.11.2026: vorher bestätigte
   * man die Rückfrage, und es geschah still nichts). Kommt vom Bedienrechner; die Sicht trägt nie Abmeldungen.
   */
  ausfallGesperrt?: readonly string[]
}>()

const b = computed(() => props.bereich)
/** Ohne festgeschriebene Verzahnung ruhen Zeigen, Beginnen und alle Schritte der Folge (BETRIEB_ANNAHMEN.schritteNurFestgeschrieben). */
const gesperrt = computed(() => !b.value.fest)
const parallel = computed(() => b.value.art === 'parallel')

/** Ein Start mit seinem Starter (einem Paar mit mindestens einem); `null`, wenn keiner (mehr) in der Sicht steht (gelöscht). */
function zeile(s: SichtStart | null): StartZeile | null {
  if (!s || !props.sicht.starter[s.starter]) return null
  return startZeile(props.sicht, s)
}

const aktuell = computed(() => zeile(b.value.aktuell))
const vorig = computed(() => zeile(b.value.vorig))
const naechster = computed(() => zeile(b.value.offen[0] ?? null))
const vorher = computed(() => b.value.aktuell?.key ?? null)

const stand = computed(() => {
  if (!b.value.punkt) return tBereich(b.value, 'betrieb.nichtBegonnen')
  return `${t('betrieb.laufend', { punkt: punktText(b.value.punkt) })} · ${tn('betrieb.offen', b.value.offenZahl)}`
})
/**
 * Starts begonnener Punkte, die nicht von selbst drankommen: zurückgestellt, „Boot fehlt“, nachzuholen. Ist
 * nichts mehr frei, aber hier noch etwas, stockt der Lauf – er ist nicht zu Ende (die Bedienung muss etwas tun).
 */
const wartend = computed(() => {
  const begonnen = new Set(b.value.begonnen)
  return [...b.value.zurueckgestellt, ...b.value.wiederholung, ...b.value.bootFehlt, ...b.value.nachzuholen].filter((s) => begonnen.has(s.punkt)).length
})
/** Kein Nächster: Der Lauf stockt, der laufende Punkt ist zu Ende (die Tafel bleibt stehen) – oder alle sind es. */
const ohneNaechsten = computed(() => {
  if (b.value.offen.length > 0 || !b.value.punkt) return ''
  if (wartend.value > 0) return tnBereich(b.value, 'betrieb.stockt', wartend.value)
  return b.value.naechsterPunkt ? t('betrieb.punktZuEnde', { punkt: punktText(b.value.punkt) }) : tBereich(b.value, 'betrieb.alleZuEnde')
})

// --- WKR-Erfassung (W2.4) ---
/** Die Verbindung, klein hinter dem Namen (N9) – nicht mehr das große Zeichen. */
const AMPEL: Record<Ampel, string> = { gehoert: '●', still: '◐', weg: '✕', ruht: '○' }
const leiste = computed<FreigabeListe[]>(() => props.erfassung?.listen ?? [])
const warnende = computed(() => leiste.value.filter((l) => l.warnt && l.offen > 0))
const nachfragen = computed(() => warnende.value.length > 0 && props.erfassung?.warnung === 'nachfragen')
/**
 * Digital, aktiv, offene Starts, aber kein Gerät (nie gekoppelt oder entzogen; Prüfbefund 21.11.2026): Da sendet
 * niemand – „⧗ wartet“ läse sich wie „kommt gleich“ (genau die Verwechslung aus N9). Also wie „Gerät weg“: ✕ rot.
 */
const ohneGeraet = (l: FreigabeListe) => l.stand === 'aktiv' && !l.ampel && l.offen > 0
const istRot = (l: FreigabeListe) => l.stand !== 'papier' && (l.ampel === 'weg' || ohneGeraet(l) || l.rueckfragen > 0)

/**
 * Erfassungsstand eines Feldes (N9, Befunde 9 und 12): Papier (auch pausiert/abgemeldet – dann gilt der Bogen) vor
 * „Gerät weg“ (schlechteste Ampel ✕, auch mit offenen Starts: dann hilft Warten nicht) vor „wartet“ vor „fertig“.
 */
type ErfStand = 'fertig' | 'wartet' | 'weg' | 'papier'
const ERF_ZEICHEN: Record<ErfStand, string> = { fertig: '✓', wartet: '⧗', weg: '✕', papier: '▭' }
function erfStand(l: FreigabeListe): ErfStand {
  if (l.stand !== 'aktiv') return 'papier'
  if (l.ampel === 'weg' || ohneGeraet(l)) return 'weg'
  return l.offen > 0 ? 'wartet' : 'fertig'
}
function feldText(l: FreigabeListe): string {
  if (l.stand === 'papier') return ''
  if (l.stand !== 'aktiv') return t(`betrieb.wkr.stand.${l.stand}`)
  const e = erfStand(l)
  const wegText = ohneGeraet(l) ? t('betrieb.freigabe.ohneGeraet') : t('betrieb.freigabe.weg')
  if (e === 'weg') return l.offen > 0 ? `${wegText} · ${t('betrieb.freigabe.wartet', { n: l.offen })}` : wegText
  return e === 'wartet' ? t('betrieb.freigabe.wartet', { n: l.offen }) : t('betrieb.freigabe.fertig')
}
const nummern = (l: FreigabeListe) => (l.von === l.bis ? l.von : `${l.von}–${l.bis}`)
function feldTitel(l: FreigabeListe): string {
  if (l.stand === 'papier') return `${l.titel}: ${t('betrieb.freigabe.papier')}`
  const teile: string[] = []
  if (l.stand !== 'aktiv') teile.push(t(`betrieb.wkr.stand.${l.stand}`))
  else teile.push(l.offen > 0 ? t('betrieb.wkr.stand.offen', { n: l.offen, von: l.von, bis: l.bis }) : t('betrieb.freigabe.fertig'))
  teile.push(t('betrieb.freigabe.verbindung', { ampel: l.ampel ? t(`betrieb.wkr.ampel.${l.ampel}`) : t('betrieb.freigabe.ohneGeraet') }))
  if (l.wartend) teile.push(tn('betrieb.wkr.stand.wartend', l.wartend))
  if (l.rueckfragen) teile.push(tn('betrieb.wkr.stand.rueckfragen', l.rueckfragen))
  return `${l.titel}: ${teile.join(' · ')}`
}
const leisteTitel = computed(() => (props.erfassungOeffnen ? `${t('betrieb.freigabe.legende')} – ${t('betrieb.freigabe.leiste.title')}` : t('betrieb.freigabe.legende')))
const rueckstandText = computed(() => warnende.value.map((l) => t('betrieb.freigabe.rueckstand.liste', { liste: l.titel, n: l.offen, nr: nummern(l) })).join(' · '))
/** Je warnender Liste ein Satz für die Rückfrage (N10): „Mann-über-Bord hat 604 noch nicht abgeschickt.“ */
const frageSaetze = computed(() => warnende.value.map((l) => tn('betrieb.freigabe.frage.liste', l.offen, { liste: l.titel, nr: nummern(l) })))
/** Felder, die eben neu rot wurden – einmal hervorgehoben (D1), danach nur noch rot. */
const neuRot = ref<Set<string>>(new Set())
const HERVORHEBEN_MS = 4000
const uhren = new Set<ReturnType<typeof setTimeout>>()
watch(
  leiste,
  (jetzt, vorher) => {
    const warRot = new Set((vorher ?? []).filter(istRot).map((l) => l.titel))
    const neu = jetzt.filter((l) => istRot(l) && !warRot.has(l.titel)).map((l) => l.titel)
    if (!neu.length || vorher === undefined) return
    neuRot.value = new Set([...neuRot.value, ...neu])
    const u = setTimeout(() => {
      uhren.delete(u)
      const rest = new Set(neuRot.value)
      for (const x of neu) rest.delete(x)
      neuRot.value = rest
    }, HERVORHEBEN_MS)
    uhren.add(u)
  },
)
onBeforeUnmount(() => uhren.forEach(clearTimeout))

// --- Parcours-Ampel (P-03) und Auto-Modus (AM6/AM7) ---
/** Die Ampel gilt nur, wenn sie zum Start im Boot gehört (Sicht und Freigabe-Sicht kommen auf dem Handy getrennt). */
const ampel = computed(() => {
  const e = props.erfassung
  if (!e || e.ampel === 'aus' || !b.value.aktuell || e.ampelRef !== b.value.aktuell.key) return 'aus' as const
  return e.ampel
})
const ampelText = computed(() => {
  if (ampel.value === 'rot') {
    const offen = leiste.value.filter((l) => l.parcours && l.stand === 'aktiv' && l.offen > 0).map((l) => l.titel)
    return offen.length ? t('betrieb.ampel.rot.offen', { listen: offen.join(', ') }) : t('betrieb.ampel.rot')
  }
  return ampel.value === 'gruen' ? t('betrieb.ampel.gruen') : ampel.value === 'frei' ? t('betrieb.ampel.frei') : ''
})
function durchfahrt(an: boolean) {
  const k = b.value.aktuell?.key
  if (k) props.sende({ type: 'BETRIEB_DURCHFAHRT', bereich: b.value.id, ref: k, an })
}
const autoOhneText = computed(() => (props.erfassung?.autoOhne.length ? t('betrieb.auto.aus', { listen: props.erfassung.autoOhne.join(', ') }) : ''))
/** Countdown: Sekunden beim Senden → eigene Frist; eine eigene Uhr (250 ms) nur, solange er läuft. */
const autoBis = ref<number | null>(null)
const autoJetzt = ref(Date.now())
const angehaltenFuer = ref<string | null>(null)
let autoUhr: ReturnType<typeof setInterval> | null = null
const stoppeAutoUhr = () => {
  if (autoUhr) clearInterval(autoUhr)
  autoUhr = null
}
watch(
  () => [props.erfassung?.autoIn ?? null, props.erfassung?.ampelRef ?? null] as const,
  ([sek]) => {
    stoppeAutoUhr()
    if (sek === null) {
      autoBis.value = null
      return
    }
    autoJetzt.value = Date.now()
    autoBis.value = autoJetzt.value + sek * 1000
    autoUhr = setInterval(() => {
      autoJetzt.value = Date.now()
      if (autoBis.value !== null && autoJetzt.value >= autoBis.value) stoppeAutoUhr()
    }, 250)
  },
  { immediate: true },
)
onBeforeUnmount(stoppeAutoUhr)
const autoRest = computed(() => {
  if (autoBis.value === null || ampel.value !== 'frei' || angehaltenFuer.value === b.value.aktuell?.key) return null
  return Math.max(0, Math.ceil((autoBis.value - autoJetzt.value) / 1000))
})
const angehalten = computed(() => !!props.erfassung?.autoMoeglich && angehaltenFuer.value !== null && angehaltenFuer.value === b.value.aktuell?.key)
function anhalten() {
  const k = b.value.aktuell?.key
  if (!k) return
  angehaltenFuer.value = k
  props.autoAnhalten?.(k)
}

/** „Nachfragen“ (F4): Ein Zeigen wartet auf „Trotzdem freigeben“; alles andere geht gleich hinaus. Nie gesperrt. */
const frageZeigen = ref<BetriebAenderung | null>(null)
function sendeGeprueft(action: BetriebAenderung) {
  if (action.type === 'BETRIEB_ZEIGEN' && nachfragen.value) {
    frageZeigen.value = action
    return
  }
  props.sende(action)
}
function zeigenJa() {
  const a = frageZeigen.value
  frageZeigen.value = null
  if (a) props.sende(a)
}

function zeige(key: string) {
  sendeGeprueft({ type: 'BETRIEB_ZEIGEN', bereich: b.value.id, ref: key, vorher: vorher.value })
}
function naechsterStart() {
  const n = b.value.offen[0]
  if (n) zeige(n.key)
}
function zurueck() {
  if (b.value.aktuell) props.sende({ type: 'BETRIEB_ZURUECK', bereich: b.value.id, ref: b.value.aktuell.key })
}
/** B-3: Der Nächste ist kurzfristig verhindert – er fährt vorerst nicht, bleibt aber sichtbar (wie „Nächsten zurückstellen“ im Prototyp). */
function zurueckstellen() {
  const n = b.value.offen[0]
  if (n) props.sende({ type: 'BETRIEB_ZURUECKSTELLEN', bereich: b.value.id, ref: n.key })
}
function einreihen(key: string, wo: 'naechster' | 'ende') {
  props.sende({ type: 'BETRIEB_EINREIHEN', bereich: b.value.id, ref: key, wo })
}

// --- Wiederholung nach Ausfall (R11-11) ---
/** Die Wahl „Wiederholung (Ausfall) …“: aufgeklappt bleibt, wie man es gelassen hat (lib/merken.ts) – nach dem Auslösen zu. */
const ausfallOffen = merke(`betrieb.ausfall.${props.bereich.id}`, false)
const ausfallKnopf = ref<HTMLButtonElement | null>(null)
const ausfallMoeglich = computed(() => !!props.wiederholen && !parallel.value)
async function ausfallZu() {
  ausfallOffen.value = false
  await nextTick()
  ausfallKnopf.value?.focus()
}
function wiederholungAufheben(key: string) {
  props.aufheben?.(key)
}

// „Anderen Starter wählen“: aufgeklappt bleibt, wie man es gelassen hat (lib/merken.ts) – nach dem Zeigen zu.
const wahlOffen = merke(`betrieb.wahl.${props.bereich.id}`, false)
const zeigenKnopf = ref<HTMLButtonElement | null>(null)
const wahlKnopf = ref<HTMLButtonElement | null>(null)
/**
 * Die Wahl schließt sich (die Komponente wird ausgehängt): Der Fokus fiele auf <body>, und wer mit der Tastatur
 * arbeitet, müsste vom Seitenanfang her wieder hintabben. Nach „Zeigen“ daher auf „Nächster Start“ (der nächste
 * Griff), nach Escape zurück auf „Anderen Starter wählen“.
 */
async function wahlZu(grund: 'gezeigt' | 'geschlossen') {
  wahlOffen.value = false
  await nextTick()
  const naechsterKnopf = zeigenKnopf.value && !zeigenKnopf.value.disabled ? zeigenKnopf.value : null
  ;(grund === 'gezeigt' ? (naechsterKnopf ?? wahlKnopf.value) : wahlKnopf.value)?.focus()
}

// „Lauf N beginnen“: Sind im laufenden noch Starts offen, erst fragen – sie bleiben freigegeben und kommen vorher dran.
const frageBeginnen = ref(false)
function beginnen() {
  if (b.value.offenZahl > 0) frageBeginnen.value = true
  else beginnenJa()
}
function beginnenJa() {
  frageBeginnen.value = false
  const p = b.value.naechsterPunkt
  if (p) props.sende({ type: 'BETRIEB_BEGINNEN', bereich: b.value.id, punkt: p.id })
}

// --- Meldung ---
const ARTEN: MeldungArt[] = ['info', 'stoerung', 'pause']
const text = ref(b.value.meldung?.text ?? '')
const art = ref<MeldungArt>(b.value.meldung?.art ?? 'info')
// Ändert sich die Meldung anderswo (anderer Bereich mit „auf allen“, später ein Gerät), folgt der Entwurf –
// aber nur, solange hier nichts Eigenes getippt ist.
watch(
  () => b.value.meldung,
  (neu, alt) => {
    if (text.value.trim() === (alt?.text ?? '')) text.value = neu?.text ?? ''
    if (neu) art.value = neu.art
  },
)
const mehrere = computed(() => props.sicht.bereiche.length > 1 && !props.nurDieser)
/** Eine Vorlage füllt nur den Entwurf (B-8); auf die Anzeigetafel kommt sie erst mit „Meldung zeigen“. */
function vorlage(m: Meldung) {
  text.value = m.text
  art.value = m.art
}
function meldungSetzen(alle: boolean) {
  props.sende({ type: 'BETRIEB_MELDUNG', bereich: alle ? '*' : b.value.id, meldung: { text: text.value, art: art.value } })
}
function meldungLoeschen() {
  text.value = ''
  props.sende({ type: 'BETRIEB_MELDUNG', bereich: b.value.id, meldung: null })
}
</script>

<template>
  <section class="panel betrieb-karte" :data-bereich="bereich.id">
    <div class="betrieb-karte-kopf">
      <h3>{{ bereich.name }}</h3>
      <span class="note" data-teil="stand">{{ stand }}</span>
      <button v-if="anzeigeOeffnen" type="button" class="btn sm" data-action="anzeige-oeffnen-bereich" :title="t('betrieb.oeffnen.bereichTitel', { name: bereich.name })" @click="anzeigeOeffnen()">
        {{ t('betrieb.oeffnen.bereich') }}
      </button>
    </div>

    <div class="betrieb-imboot" data-teil="imboot">
      <span class="note">{{ t('betrieb.imBoot') }}</span>
      <template v-if="aktuell?.seiten">
        <!-- Ein Paar: Racecourse A und B, eine leere Seite (Dummy, gelöscht, X) als „leer“. -->
        <!-- Zwischenräume ausdrücklich: Sie gehören zum Text (Vorlesen, Kopieren), nicht nur zur Anordnung. -->
        <span v-for="x in aktuell.seiten" :key="x.rc" class="betrieb-seite" :data-racecourse="x.rc">
          <span class="note">{{ x.titel }}:</span>{{ ' ' }}<template v-if="x.faehrt"
            ><span class="betrieb-nr">{{ x.startNr }}</span>{{ ' ' }}<span class="betrieb-name">{{ x.name }}</span></template
          ><span v-else class="note">{{ t('betrieb.paar.leer') }}</span>
        </span>
        <span class="note">{{ aktuell.was }}</span>
      </template>
      <template v-else-if="aktuell">
        <span class="betrieb-nr">{{ aktuell.startNr }}</span>
        <span class="betrieb-name">{{ aktuell.name }}</span>
        <span class="note">{{ [aktuell.was, aktuell.herkunft].filter(Boolean).join(' · ') }}</span>
        <span v-if="bereich.aktuell?.abgebrochen" class="betrieb-aktiv stoerung" data-teil="abgebrochen">{{ t('betrieb.abgebrochen') }}</span>
      </template>
      <!-- Ein Start ohne Starter in der Sicht: Der Starter wurde gelöscht. Der Start bleibt im Boot, bis der nächste kommt. -->
      <span v-else-if="bereich.aktuell" class="note" data-teil="geloescht">{{ t('betrieb.geloescht') }}</span>
      <span v-else class="note">{{ t('betrieb.keiner') }}</span>
      <span v-if="vorig" class="note" data-teil="vorig">{{ t('betrieb.davor') }}: {{ [vorig.startNr, vorig.was, vorig.name].filter(Boolean).join(' · ') }}</span>
    </div>

    <!-- Parcours-Ampel (P-03): nur mit digitaler Parcours-Liste; Zeichen UND Wort, nie nur Farbe. -->
    <div v-if="ampel !== 'aus'" class="betrieb-ampel" :data-ampel="ampel" data-teil="ampel" role="status">
      <span class="betrieb-ampel-licht" aria-hidden="true">●</span>
      <span class="betrieb-ampel-text"><span class="note">{{ t('betrieb.ampel') }}:</span> {{ ampelText }}</span>
      <button v-if="ampel === 'gruen'" type="button" class="btn" data-action="durchfahrt" :title="t('betrieb.ampel.durchfahrt.title')" @click="durchfahrt(true)">
        {{ t('betrieb.ampel.durchfahrt') }}
      </button>
      <button v-else-if="ampel === 'rot' && erfassung?.perKnopf" type="button" class="btn sm" data-action="durchfahrt-zurueck" :title="t('betrieb.ampel.zurueck.title')" @click="durchfahrt(false)">
        {{ t('betrieb.ampel.zurueck') }}
      </button>
    </div>
    <p v-if="erfassung?.autoMoeglich" class="note betrieb-auto" data-teil="auto" :data-countdown="autoRest ?? undefined">
      <template v-if="autoRest !== null">
        <b data-teil="auto-countdown">{{ t('betrieb.auto.countdown', { n: autoRest }) }}</b>
        <button v-if="autoAnhalten" type="button" class="btn sm" data-action="auto-anhalten" @click="anhalten">{{ t('betrieb.auto.anhalten') }}</button>
      </template>
      <template v-else-if="angehalten">{{ t('betrieb.auto.angehalten') }}</template>
      <template v-else>{{ t('betrieb.auto') }}</template>
    </p>
    <p v-else-if="autoOhneText" class="note" data-teil="auto-aus">{{ autoOhneText }}</p>

    <!-- W2.4: Stand der WKR-Erfassung – nur, wenn eine Liste des Bereichs einen Eintrag hat. -->
    <!-- Am Bedienrechner führt ein Klick irgendwo auf die Leiste zum Unterreiter WKR; für die Tastatur steht dafür ein
         eigener Knopf am Ende (ein gebundenes :type wäre hier verboten, components/DatumFeld.test.ts). -->
    <div
      v-if="leiste.length"
      :class="['wkr-leiste', erfassungOeffnen ? 'klickbar' : '']"
      data-teil="wkr-leiste"
      role="group"
      :aria-label="t('betrieb.freigabe.leiste')"
      :title="leisteTitel"
      @click="erfassungOeffnen?.()"
    >
      <span
        v-for="l in leiste"
        :key="l.titel"
        :class="['wkr-leiste-feld', istRot(l) ? 'rot' : '', neuRot.has(l.titel) ? 'neu' : '', l.warnt ? 'warnt' : '']"
        :data-liste="l.titel"
        :data-stand="l.stand"
        :data-ampel="l.ampel ?? undefined"
        :data-erf="erfStand(l)"
        :data-rot="istRot(l) ? '' : undefined"
        :data-neu="neuRot.has(l.titel) ? '' : undefined"
        :title="feldTitel(l)"
      >
        <span class="wkr-leiste-erf" :data-erf="erfStand(l)" aria-hidden="true">{{ ERF_ZEICHEN[erfStand(l)] }}</span>
        {{ l.titel
        }}<small v-if="l.stand !== 'papier'" class="wkr-leiste-verbindung" data-teil="leiste-verbindung" :data-ampel="l.ampel ?? undefined" aria-hidden="true">{{ ' ' }}<span class="wkr-ampel" :data-ampel="l.ampel ?? undefined">{{ l.ampel ? AMPEL[l.ampel] : '–' }}</span></small
        ><template v-if="feldText(l)">{{ ' ' }}{{ feldText(l) }}</template
        ><small v-if="l.wartend" class="wkr-leiste-imgeraet">{{ ' ' }}({{ t('betrieb.freigabe.imGeraet', { n: l.wartend }) }})</small
        ><b v-if="l.rueckfragen" class="wkr-leiste-frage">{{ ' ' }}!</b>
      </span>
      <button v-if="erfassungOeffnen" type="button" class="btn sm wkr-leiste-knopf" data-action="zur-erfassung">{{ t('betrieb.reiter.wkr') }} →</button>
    </div>
    <p v-if="warnende.length" class="note betrieb-warn wkr-rueckstand" role="status" data-teil="wkr-rueckstand">
      {{ t('betrieb.freigabe.rueckstand') }} {{ rueckstandText }}
    </p>

    <div :class="['betrieb-naechster', warnende.length ? 'betrieb-naechster--rueckstand' : '']" data-teil="naechster" :data-warnt="warnende.length ? '' : undefined">
      <span class="note">{{ t('betrieb.naechster') }}</span>
      <template v-if="naechster?.seiten">
        <span v-for="x in naechster.seiten" :key="x.rc" class="betrieb-seite" :data-racecourse="x.rc">
          <span class="note">{{ x.titel }}:</span>{{ ' ' }}<template v-if="x.faehrt"><b>{{ x.startNr }}</b> {{ x.name }}</template
          ><span v-else class="note">{{ t('betrieb.paar.leer') }}</span>
        </span>
        <span class="note">{{ naechster.was }}</span>
      </template>
      <template v-else-if="naechster">
        <b>{{ naechster.startNr }}</b> {{ naechster.name }}
        <span class="note">{{ [naechster.was, naechster.herkunft].filter(Boolean).join(' · ') }}</span>
      </template>
      <span v-else-if="ohneNaechsten" :class="['note', wartend > 0 ? 'betrieb-warn' : '']" :data-teil="wartend > 0 ? 'stockt' : 'ende'">{{ ohneNaechsten }}</span>
      <span v-else class="note">–</span>
    </div>

    <div class="betrieb-knoepfe">
      <button ref="zeigenKnopf" type="button" class="btn primary betrieb-gross" data-action="zeigen" :disabled="gesperrt || !naechster" @click="naechsterStart">
        {{ t('betrieb.zeigen') }}
      </button>
      <button type="button" class="btn" data-action="zurueckstellen" :disabled="gesperrt || !bereich.offen[0]" :title="tBereich(bereich, 'betrieb.zurueckstellen.title')" @click="zurueckstellen">
        {{ t('betrieb.zurueckstellen') }}
      </button>
      <button
        type="button"
        class="btn"
        data-action="zurueck"
        :disabled="!bereich.aktuell || bereich.aktuell.abgebrochen"
        :title="bereich.aktuell?.abgebrochen ? t('betrieb.abgebrochen.zurueck') : t('betrieb.zurueck.title')"
        @click="zurueck"
      >
        {{ t('betrieb.zurueck') }}
      </button>
      <button
        ref="wahlKnopf"
        type="button"
        :class="['btn', wahlOffen && !gesperrt ? 'active' : '']"
        data-action="wahl"
        :aria-expanded="wahlOffen && !gesperrt"
        :disabled="gesperrt"
        :title="t('betrieb.wahl.title')"
        @click="wahlOffen = !wahlOffen"
      >
        {{ t('betrieb.wahl') }}
      </button>
      <button
        v-if="ausfallMoeglich"
        ref="ausfallKnopf"
        type="button"
        :class="['btn', ausfallOffen && !gesperrt ? 'active' : '']"
        data-action="ausfall"
        :aria-expanded="ausfallOffen && !gesperrt"
        :disabled="gesperrt"
        :title="t('betrieb.ausfall.title')"
        @click="ausfallOffen = !ausfallOffen"
      >
        {{ t('betrieb.ausfall') }}
      </button>
      <button
        v-if="bereich.naechsterPunkt"
        type="button"
        :class="['btn', bereich.offen.length === 0 && wartend === 0 ? 'primary' : '']"
        data-action="beginnen"
        :disabled="gesperrt"
        @click="beginnen"
      >
        {{ beginnenText(bereich.naechsterPunkt) }}
      </button>
    </div>

    <BetriebsFolge v-if="wahlOffen && !gesperrt" :sicht="sicht" :bereich="bereich" :sende="sendeGeprueft" :gesperrt="gesperrt" @fertig="wahlZu" />

    <AusfallWahl
      v-if="ausfallMoeglich && ausfallOffen && !gesperrt"
      :sicht="sicht"
      :bereich="bereich"
      :gesperrt="gesperrt"
      :nicht="ausfallGesperrt"
      @wiederholen="(key) => wiederholen?.(key)"
      @fertig="ausfallZu"
    />

    <EinreihenListe
      :sicht="sicht"
      :bereich="bereich"
      :eintraege="bereich.wiederholung"
      art="wiederholung"
      :gesperrt="gesperrt"
      :aufhebbar="!!aufheben"
      @zeigen="zeige"
      @einreihen="einreihen"
      @aufheben="wiederholungAufheben"
    />
    <EinreihenListe :sicht="sicht" :bereich="bereich" :eintraege="bereich.zurueckgestellt" art="zurueckgestellt" :gesperrt="gesperrt" @zeigen="zeige" @einreihen="einreihen" />
    <EinreihenListe :sicht="sicht" :bereich="bereich" :eintraege="bereich.nachzuholen" art="nachzuholen" :gesperrt="gesperrt" @zeigen="zeige" @einreihen="einreihen" />

    <!-- Umgestellt: Die WKR-Bögen bleiben trotzdem, wie sie sind – das soll am Steg niemand fürchten müssen. -->
    <p v-if="bereich.abweichend" class="note" data-teil="abweichend">{{ tBereich(bereich, 'betrieb.abweichend') }}</p>

    <!-- Im Parallelslalom gibt der Plan die Folge vor: kein Aussetzen, Vorziehen, Verschieben (BETRIEB_ANNAHMEN.parallelOhneUmstellen). -->
    <p v-if="parallel" class="note" data-hinweis="parallel">{{ t('betrieb.parallel.hint') }}</p>
    <KlassenAussetzen v-else :sicht="sicht" :bereich="bereich" :sende="sende" :gesperrt="gesperrt" />

    <details class="betrieb-abschnitt betrieb-meldung" :open="!!bereich.meldung">
      <summary>
        {{ t('betrieb.meldung') }}
        <span v-if="bereich.meldung" :class="['betrieb-meldung-aktiv', bereich.meldung.art]" data-teil="meldung-aktiv">
          {{ t('betrieb.meldung.aktiv', { art: t(`meldung.${bereich.meldung.art}`), text: bereich.meldung.text }) }}
        </span>
      </summary>
      <p class="note">{{ t('betrieb.meldung.hint') }}</p>
      <div class="row betrieb-meldung-wahl">
        <div class="segmented" role="group" :aria-label="t('betrieb.meldung')">
          <button v-for="a in ARTEN" :key="a" type="button" :data-meldung-art="a" :class="art === a ? 'active' : ''" :aria-pressed="art === a" @click="art = a">
            {{ t(`meldung.${a}`) }}
          </button>
        </div>
        <MeldungWahl :sicht="sicht" @wahl="vorlage" />
      </div>
      <textarea v-model="text" class="input" rows="3" maxlength="200" data-meldung-text :placeholder="t('betrieb.meldung.platzhalter')" :aria-label="t('betrieb.meldung')" />
      <p class="note">{{ t('meldung.vorlagen.hint') }}</p>
      <div class="betrieb-knoepfe">
        <button type="button" class="btn" data-action="meldung-setzen" :disabled="!text.trim()" @click="meldungSetzen(false)">{{ t('betrieb.meldung.setzen') }}</button>
        <button v-if="mehrere" type="button" class="btn" data-action="meldung-alle" :disabled="!text.trim()" @click="meldungSetzen(true)">{{ t('betrieb.meldung.alle') }}</button>
        <button type="button" class="btn" data-action="meldung-loeschen" :disabled="!bereich.meldung" @click="meldungLoeschen">{{ t('betrieb.meldung.loeschen') }}</button>
      </div>
    </details>

    <EinsteigenAb :sicht="sicht" :bereich="bereich" :sende="sende" :gesperrt="gesperrt" />

    <AppDialog v-if="frageZeigen" :titel="t('betrieb.freigabe.frage')" data-dialog="trotzdem-freigeben" @abbrechen="frageZeigen = null">
      <p v-for="(satz, i) in frageSaetze" :key="i" data-teil="frage-liste">
        <b>{{ satz }}</b>
      </p>
      <p class="note">{{ t('betrieb.freigabe.frage.text') }}</p>
      <template #knoepfe>
        <button type="button" class="btn primary" data-action="trotzdem-freigeben" @click="zeigenJa">{{ t('betrieb.freigabe.frage.ja') }}</button>
        <button type="button" class="btn" data-action="trotzdem-nein" autofocus @click="frageZeigen = null">{{ t('common.cancel') }}</button>
      </template>
    </AppDialog>

    <AppDialog v-if="frageBeginnen && bereich.naechsterPunkt" :titel="tBereich(bereich, 'betrieb.beginnen.frage')" data-dialog="beginnen" @abbrechen="frageBeginnen = false">
      <p>{{ tnBereich(bereich, 'betrieb.beginnen.text', bereich.offenZahl) }}</p>
      <template #knoepfe>
        <button type="button" class="btn primary" data-action="beginnen-ja" @click="beginnenJa">{{ beginnenText(bereich.naechsterPunkt) }}</button>
        <button type="button" class="btn" data-action="beginnen-nein" autofocus @click="frageBeginnen = false">{{ t('common.cancel') }}</button>
      </template>
    </AppDialog>
  </section>
</template>
