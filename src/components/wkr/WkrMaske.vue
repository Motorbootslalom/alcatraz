<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { ClassId, PunktId } from '../../types'
import type { EntwurfEintrag, ErfassungsQuelle, PruefZeile, SchlangenEintrag, ZuletztZeile } from '../../geraete/erfassen'
import { BOJEN_ANSICHT_VORGABE, type AnsichtWahl, type BojenAnsicht, type GeraetAnsicht } from '../../geraete/ablage'
import type { ListenAufgabe } from '../../geraete/aufgaben'
import { liesRef } from '../../betrieb/folge'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import { liesListe, type ListenTeil } from '../../wkr/liste'
import {
  bojenVon,
  disqAnBojen,
  disqFuer,
  eintraege,
  entwurfAus,
  leererEntwurf,
  maskeFuer,
  maskenArt,
  mitBemerkung,
  punkteVon,
  teileFuer,
  tippe,
  tippeBoje,
  tippeBojenDisq,
  tippeDisq,
  wechselNach,
  wechselTakt,
  zellenAus,
  zurueck,
  type Entwurf,
  type MaskenAufbau,
  type MaskenBoje,
} from '../../wkr/maske'
import type { Weg } from '../../wkr/bojen'
import { NICHT_VORBEI_DISQ, nichtVorbeiArt } from '../../wkr/nichtVorbei'
import AppDialog from '../AppDialog.vue'
import WkrAbschluss from './WkrAbschluss.vue'
import WkrAusweichen from './WkrAusweichen.vue'
import WkrBojen from './WkrBojen.vue'
import WkrDisq from './WkrDisq.vue'
import WkrDisqOrt from './WkrDisqOrt.vue'
import WkrFuss from './WkrFuss.vue'
import WkrKnoepfe from './WkrKnoepfe.vue'
import WkrKopf from './WkrKopf.vue'
import WkrMehr from './WkrMehr.vue'
import WkrRuhe from './WkrRuhe.vue'
import WkrStarterKarte from './WkrStarterKarte.vue'
import WkrStegReiter from './WkrStegReiter.vue'
import WkrParcoursBild from './WkrParcoursBild.vue'
import WkrUebertragen from './WkrUebertragen.vue'
import WkrVorsteg from './WkrVorsteg.vue'
import WkrZuletzt from './WkrZuletzt.vue'
import { gedaechtnis } from './gedaechtnis'
import { useWkrText, zellenText } from './texte'

/**
 * Die Maske „Knöpfe“ EINER Liste (W3.3, Plan docs/plan-wkr-w3.md §5, 21.11.2026) – die Arbeitsfläche, die WkrGeraet
 * je Liste zeigt. Liest nur die {@link ErfassungsQuelle} (echte Erfassung oder Übung), nie einen Store; die Werte
 * entstehen in wkr/maske.ts (zellenAus = genau das, was der Bedienrechner unverändert annimmt).
 *
 * - **Start**: Kopf der Schlange (am Steg die des gewählten Teils), oder über Ausweichen/Suche gewählt („außer der
 *   Reihe“, nach dem Abschicken zurück zum Kopf). Kein Starter-Name, nie (F6).
 * - **Entwurf**: jede Änderung geht sofort in den Ausgang (merkeEntwurf) – ein Wechsel verliert nichts, und beim
 *   nächsten Erscheinen des Starts ist er wieder da. Verschwindet ein Start mit Entwurf aus der Folge (zurückgestellt),
 *   fragt ein Band einmal „behalten / verwerfen“.
 * - **Takt** (G5, wkr/maske.ts wechselTakt): Nach dem Abschicken sofort das Overlay „wird übertragen …“ über der
 *   ganzen Maske (WkrUebertragen, N1 vom Feldtest 21.11.2026), mit der Quittung kurz „✓ übernommen“, dann Wechsel mit
 *   Blitz (und Vibration, wo es sie gibt), 1 s lang nimmt die Mitte und der Fuß nichts an (`inert` UND Prüfung in
 *   jedem Tipp – ein Tropfen auf „Code 1“ ist so schlimm wie auf „Fehlerfrei“). Nie gesperrt bis zur Quittung (§5.2):
 *   ohne Antwort geht das Overlay nach uebertragenMaxMs, darüber „Bestätigung folgt“ (N2); „Rückgängig“ 6 s (G8).
 * - **Korrektur** (F7): eine Zeile aus „Zuletzt“ öffnet dieselbe Maske mit ihren Werten; „Korrektur abschicken“ bzw.
 *   nach dem Abschluss „Als Vorschlag senden“ fragt groß „alt → neu“.
 * - **Liste abschließen** (W3.4, F7/F8, G16): nur als Band, sobald der letzte eigene Punkt nicht mehr läuft (der
 *   nächste begann, oder nichts steht mehr an) und weder abgeschlossen noch mit eigenem Abschluss unterwegs ist
 *   (Auslegung L2); das Band nennt den Zweck (Unterschrift für den Lauf, alle Klassen). „Mehr → Liste abschließen“
 *   entfiel (Nutzer 21.11.2026, W3-40, AM10). Läuft der Lauf noch (Sicht `laeuft`), fragt die Prüfansicht vor dem
 *   Abschicken nach (R6-10). Die Prüfansicht (WkrAbschluss) ersetzt die Mitte; Tipp auf eine Zeile → Korrektur.
 * - **Ansicht, Sprache, Probe, Übung verlassen** gehen als Ereignis an WkrGeraet (dort gemerkt bzw. ausgeführt).
 * - **Bojen** (W4.2, Plan docs/plan-wkr-w4.md §5, 21.11.2026): Mitte = WkrBojen; Seite des Umschalters je Start und
 *   Teil im Gedächtnis (gedaechtnis.ts `wege`, neuer Start = Hinweg, wechselt nie von selbst, P8); Klassenwechsel-Band
 *   (P10) `klassenWechselMs` lang ÜBER der Karte (absolut, verschiebt nichts, fängt seine Fläche ab); Startnummer
 *   80 px (`.wkr-maske--bojen`, P17).
 * - **Bojen-Ansicht und Disq. an der Boje** (Nutzer 21.11.2026, WKR_ANNAHMEN V1/V2, U1/U2): Reihenfolge „Fahrtfolge“ ↔
 *   „Wie der Parcours liegt“, Start oben/unten, Spalten tauschen – je Liste aus `bojenAnsichten` (WkrGeraet merkt sie,
 *   ablage.ts `bojen`), geändert unter „Mehr → Ansicht“. Der Fuß nennt die Buchstaben an Bojen mit („Disq. G“).
 * - **Disq. auf Bojen-Listen** (Antwort W4-12, 21.11.2026, BZ4): DISQ im Fuß und „Disq. an Boje …“ öffnen dieselbe
 *   Wahl (WkrDisqOrt): erst die Boje bzw. „keine Boje / ganzer Parcours“ (→ Disq.-Feld), dann der Buchstabe. Der
 *   Buchstabe steht NEBEN den Punkten der Boje (BZ1, „5G“); nach der Wahl an einer Boje zeigt die Mitte wieder die Bojen.
 */
const props = defineProps<{
  quelle: ErfassungsQuelle
  aufgabe: ListenAufgabe
  /** Texte der Liste oder ihrer anderen Sprache (F13, G9). */
  spracheWahl: 'liste' | 'andere'
  hand: 'rechts' | 'links'
  /** Meldung der Start-Freigabe für den Bereich der Liste (öffentliche Sicht, wie auf der Anzeigetafel). */
  meldung?: string | null
  /** Ansicht des Geräts (W3.4) – nur zum Anzeigen unter „Mehr“; gemerkt wird in WkrGeraet. */
  modus?: AnsichtWahl
  /** Vorbelegter WKR-Name für den Abschluss (G12). */
  name?: string
  /** Bojen-Ansicht je Liste (ablage.ts GeraetAnsicht.bojen) – nur zum Lesen; Änderungen gehen als `ansicht` hinauf. */
  bojenAnsichten?: Record<string, BojenAnsicht>
}>()
const emit = defineEmits<{ ansicht: [aenderung: Partial<GeraetAnsicht>]; probe: []; name: [name: string]; uebungEnde: [] }>()
const text = useWkrText()
const { w } = text

const liste = computed(() => props.aufgabe.liste)
/**
 * WKR-Name dieser Liste (Nutzer 21.11.2026, W3-13, WN1): aus der Einteilung (Sicht) oder auf dem Gerät geändert – für
 * „Mehr → Name“ und als Vorbelegung des Abschlusses (vor dem gemerkten Namen G12, der nur noch Rückfall ist, WN3).
 * Übung: kein Namensfeld (G13).
 */
const wkrNameLage = computed(() => (props.quelle.uebung ? null : props.quelle.wkrName(liste.value)))
const sicht = computed(() => props.quelle.sichten.value[liste.value] ?? null)

// --- Uhr: ein Sekundentakt für die Bänder, dazu genaue Zeitgeber für den Takt nach dem Abschicken ---
const jetzt = ref(Date.now())
const zeitgeber = new Set<ReturnType<typeof setTimeout>>()
const sekunde = setInterval(() => (jetzt.value = Date.now()), 1000)
function nach(ms: number, f: () => void): void {
  const id = setTimeout(() => {
    zeitgeber.delete(id)
    f()
  }, ms)
  zeitgeber.add(id)
}
onBeforeUnmount(() => {
  clearInterval(sekunde)
  for (const id of zeitgeber) clearTimeout(id)
})

// --- Steg-Teil, Schlange, gewählter Start ---
const geteilt = computed(() => !!sicht.value?.teile)
const stegWahl = ref<ListenTeil>(props.aufgabe.teil ?? 'ab')
const teil = computed<ListenTeil | undefined>(() => (geteilt.value ? (props.aufgabe.teil ?? stegWahl.value) : undefined))

function schlangeVon(t: ListenTeil | undefined): SchlangenEintrag[] {
  const ganz = props.quelle.schlange.value[liste.value] ?? []
  return t ? props.quelle.schlangeTeil(liste.value, t) : ganz
}
const schlange = computed(() => schlangeVon(teil.value))
const kopf = computed(() => schlange.value[0] ?? null)
const danach = computed(() => (sicht.value?.danach ?? []).filter((d) => !schlange.value.some((s) => s.key === d.key)))
const gewaehlt = ref<string | null>(null)
const aktuell = computed<SchlangenEintrag | null>(() => {
  const g = gewaehlt.value ? [...schlange.value, ...danach.value].find((x) => x.key === gewaehlt.value) : undefined
  return g ?? kopf.value
})
const stegStand = computed(() => {
  const je = (t: ListenTeil) => {
    const s = schlangeVon(t)
    return { kopf: s[0]?.startNr ?? null, wartend: s.length }
  }
  return { ab: je('ab'), an: je('an') }
})

const status = computed(() => {
  const s = sicht.value
  if (!s) return 'aktiv' as const
  return teil.value && s.teile ? s.teile[teil.value].status : s.status
})
const abgeschlossenIn = (t: ListenTeil | undefined): PunktId[] => {
  const s = sicht.value
  if (!s) return []
  return t && s.teile ? s.teile[t].abgeschlossen : s.abgeschlossen
}

// --- Aufbau der Maske ---
const ersteKlasse = computed(() => (Object.entries(sicht.value?.klassen ?? {}).find(([, k]) => k?.felder)?.[0] ?? null) as ClassId | null)
function klasseVon(s: string, punkt: PunktId | null): ClassId | null {
  const bekannt = [...schlange.value, ...danach.value, ...(sicht.value?.schlange ?? [])].find((x) => x.key === s)
  if (bekannt) return bekannt.klasse
  if (punkt) {
    const p = props.quelle.pruefung(liste.value, punkt).zeilen.find((z) => z.s === s)
    if (p?.klasse) return p.klasse as ClassId
  }
  return ersteKlasse.value
}
const aufbauVon = (k: ClassId | null): MaskenAufbau | null => (sicht.value && k ? maskeFuer(sicht.value, k, props.spracheWahl) : null)
const klassenTitel = (k: ClassId | null) => (k ? (props.spracheWahl === 'andere' ? sicht.value?.andere?.klassen[k]?.titel : undefined) ?? sicht.value?.klassen[k]?.titel ?? k : '')
const listeSpaeter = computed(() => {
  const mit = Object.values(sicht.value?.klassen ?? {}).filter((k) => k?.felder)
  return mit.length > 0 && mit.every((k) => maskenArt(k!.felder!) === 'spaeter')
})

// --- Korrektur (F7) ---
const korrektur = shallowRef<ZuletztZeile | null>(null)
/**
 * Der eigene Stand des Starts (und Teils) beim Öffnen der Korrektur – „alt“ im Dialog und Grundlage des Entwurfs.
 * Nie die Zellen der Zeile allein: Eine Korrekturzeile trägt nur die geänderten Felder (Prüfbefund W3, 21.11.2026).
 */
const korrekturAlt = shallowRef<Record<string, string>>({})
const korrekturArt = computed(() => {
  const k = korrektur.value
  if (!k) return null
  return k.punkt && abgeschlossenIn(k.teil).includes(k.punkt) ? ('vorschlag' as const) : ('korrektur' as const)
})

const klasse = computed(() => (korrektur.value ? klasseVon(korrektur.value.s, korrektur.value.punkt) : (aktuell.value?.klasse ?? null)))
const aufbau = computed(() => aufbauVon(klasse.value))

// --- Entwurf: jede Änderung sofort in den Ausgang ---
const entwurf = shallowRef<Entwurf>(leererEntwurf())
const entwurfSchluessel = computed(() => (aktuell.value ? `${aktuell.value.key}|${teil.value ?? ''}` : null))
function ladeEntwurf(): void {
  if (korrektur.value) return
  const a = aktuell.value
  const b = aufbau.value
  const zellen = a && b ? props.quelle.entwurf(liste.value, a.key, teil.value) : null
  entwurf.value = zellen && b ? entwurfAus(zellen, b) : leererEntwurf()
}
watch(entwurfSchluessel, ladeEntwurf, { immediate: true })
// Die Klasse kommt erst mit der Sicht – dann den Entwurf noch einmal mit dem Aufbau lesen.
watch(() => aufbau.value?.art, ladeEntwurf)

function aendere(neu: Entwurf): void {
  entwurf.value = neu
  const a = aktuell.value
  const b = aufbau.value
  if (korrektur.value || !a || !b) return
  props.quelle.merkeEntwurf(liste.value, a.key, teil.value, zellenAus(neu, b, teil.value))
}

// --- Takt nach dem Abschicken (G5; Overlay mit Quittung seit dem Feldtest 21.11.2026, N1/N2) ---
interface Gesendet {
  um: number
  z: number
  start: SchlangenEintrag
  entwurf: Entwurf
  aufbau: MaskenAufbau
  klasse: string
}
const gesendet = shallowRef<Gesendet | null>(null)
/** Wann die eben gesendete Zeile ihre Antwort bekam (Quittung, Rückfrage, Ablehnung) – beendet das Overlay früher. */
const quittungUm = ref<number | null>(null)
/** Stufe der eben gesendeten Zeile, wie der Kern sie in „Zuletzt“ führt. */
const gesendeteStufe = computed(() => {
  const g = gesendet.value
  return g ? (props.quelle.zuletzt.value.find((x) => x.z === g.z)?.stufe ?? null) : null
})
const takt = computed(() => wechselTakt(gesendet.value?.um ?? null, jetzt.value, quittungUm.value))
const gesperrt = computed(() => takt.value !== 'frei')
/** Overlay „wird übertragen …“ / „✓ übernommen“: die Nummer steht noch, die Maske darunter nimmt nichts an. */
const imOverlay = computed(() => takt.value === 'gesendet' || takt.value === 'uebernommen')
/** N2: Overlay ohne Antwort weg – über dem Kopf „Start n gesendet – Bestätigung folgt“, bis die Antwort kommt. */
const bestaetigungFolgt = computed(() => {
  const g = gesendet.value
  return g && !imOverlay.value && quittungUm.value === null && gesendeteStufe.value?.stufe === 'unterwegs' ? g.start.startNr : null
})
const blitz = ref(false)
function blitze(): void {
  blitz.value = true
  // Vibration nur, wo es sie gibt (iPhone nicht) – der Blitz ist Pflicht, die Vibration Zugabe (Plan §8).
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(60)
  } catch {
    // manche Browser werfen ohne Bedienung – der Blitz genügt
  }
  nach(150, () => (blitz.value = false))
}
const tick = () => (jetzt.value = Date.now())
/** Die Uhr genau an den Grenzen des Takts nachziehen (der Sekundentakt allein wäre bis zu 1 s zu spät). */
function planeWechsel(g: Gesendet, ab: number): void {
  const wechsel = g.um + wechselNach(g.um, quittungUm.value)
  nach(Math.max(0, wechsel - ab), tick)
  nach(Math.max(0, wechsel + WKR_ANNAHMEN.sperreMs - ab), tick)
}
function starteTakt(g: Gesendet): void {
  jetzt.value = g.um
  quittungUm.value = null
  nach(WKR_ANNAHMEN.uebertragenMinMs, tick)
  planeWechsel(g, g.um)
  nach(WKR_ANNAHMEN.rueckgaengigMs, tick)
}
function beendeTakt(): void {
  gesendet.value = null
  quittungUm.value = null
}
// Die Antwort auf die eben gesendete Zeile: Zeitpunkt merken und den früheren Wechsel planen (nach dem Höchstwert
// ändert sie nichts mehr – wechselTakt übergeht sie dann).
watch(gesendeteStufe, (st) => {
  const g = gesendet.value
  if (!g || quittungUm.value !== null || !st || st.stufe === 'unterwegs') return
  const um = Date.now()
  quittungUm.value = um
  jetzt.value = um
  planeWechsel(g, um)
})
// Der Wechsel der Nummer blitzt – gleich ob nach der Quittung oder nach dem Höchstwert.
watch(takt, (neu, alt) => {
  if (neu === 'sperre' && (alt === 'gesendet' || alt === 'uebernommen')) blitze()
})
const rueckgaengig = computed(() => {
  const g = gesendet.value
  return g && jetzt.value - g.um < WKR_ANNAHMEN.rueckgaengigMs ? { z: g.z, sn: g.start.startNr } : null
})

// --- Was die Mitte zeigt: gesendet (Takt), Korrektur oder der aktuelle Start ---
const zeige = computed(() => {
  const g = gesendet.value
  if (g && imOverlay.value) return { start: g.start as Pick<SchlangenEintrag, 'key' | 'startNr' | 'titel' | 'boot' | 'geschaetzt' | 'vorab'>, aufbau: g.aufbau, entwurf: g.entwurf, klasse: g.klasse }
  const k = korrektur.value
  if (k) {
    const bekannt = [...schlange.value, ...danach.value].find((x) => x.key === k.s)
    const start = bekannt ?? { key: k.s, startNr: k.sn ?? '?', titel: sicht.value?.punkt?.titel ?? '' }
    return aufbau.value ? { start, aufbau: aufbau.value, entwurf: entwurf.value, klasse: klassenTitel(klasse.value) } : null
  }
  const a = aktuell.value
  return a && aufbau.value ? { start: a, aufbau: aufbau.value, entwurf: entwurf.value, klasse: klassenTitel(a.klasse) } : null
})
const ausserDerReihe = computed(() => !korrektur.value && !!aktuell.value && aktuell.value.key !== kopf.value?.key)
/**
 * Parcours-Ampel am gezeigten Start (Nutzer 21.11.2026, P-03; WKR_ANNAHMEN.ampelInDerKarte, AM9): nur auf
 * Parcours-Listen (die Sicht trägt `ampel` nur dort), nur für den Start der Karte, nie in der Korrektur.
 */
const kartenAmpel = computed(() => {
  const a = sicht.value?.ampel
  const z = zeige.value
  return a && z && !korrektur.value && a.key === z.start.key ? a.ampel : null
})
const invers = computed(() => {
  const r = zeige.value ? liesRef(zeige.value.start.key) : null
  return !!r && r.art === 'p' && (r.attempt > 1 || /rerun/i.test(String(r.runde)))
})

// --- Ruhe: Zustände ohne Arbeit (§5.6) ---
type Ruhe = 'warte' | 'leer' | 'pausiert' | 'abgemeldet' | 'papier' | 'abgeschlossen' | 'entfaellt' | 'spaeter'
const ruhe = computed<Ruhe | null>(() => {
  const s = sicht.value
  if (!s) return 'warte'
  if (s.modus === 'papier') return 'papier'
  if (status.value !== 'aktiv') return status.value
  if (korrektur.value || imOverlay.value) return null
  if (listeSpaeter.value) return 'spaeter'
  const a = aktuell.value
  if (!a) return s.punkt && abgeschlossenIn(teil.value).includes(s.punkt.id) ? 'abgeschlossen' : 'leer'
  if (a.entfaellt || !aufbau.value) return 'entfaellt'
  if (aufbau.value.art === 'spaeter') return 'spaeter'
  return null
})
/**
 * Wie lange schon „verbinde …“ ohne Sicht (Nutzer 21.11.2026, W3-24, GF6): nach verbindeKarenzSek der Knopf „Neu
 * verbinden“. Gezählt ab dem Moment, in dem die Maske ohne Sicht dasteht – auch bei einer neu zugewiesenen Liste.
 */
const warteSeit = ref<number | null>(null)
watch(
  () => ruhe.value === 'warte',
  (w) => (warteSeit.value = w ? Date.now() : null),
  { immediate: true },
)
const warteLange = computed(() => warteSeit.value !== null && jetzt.value - warteSeit.value >= WKR_ANNAHMEN.verbindeKarenzSek * 1000)
function neuVerbinden(): void {
  if (typeof location !== 'undefined') location.reload()
}
const naechsterStart = computed(() => {
  const d = sicht.value?.danach[0]
  return d ? { startNr: d.startNr, klasse: klassenTitel(d.klasse) } : null
})

// --- Verbindung, Quittung ---
const verbunden = computed(() => props.quelle.verbunden.value)
/** N11 (Feldtest 21.11.2026): neutral beim Aufbau, rot erst nach Karenz oder Abriss – der Kern entscheidet. */
const verbindung = computed(() => props.quelle.verbindung.value)
// Seit wann getrennt bzw. ohne Quittung: aus der Quelle, nicht hier gemerkt – ein Reiterwechsel baut die Maske neu auf.
const getrenntSeit = computed(() => props.quelle.getrenntSeit.value)
const getrenntSek = computed(() => (getrenntSeit.value === null ? 0 : Math.max(0, Math.floor((jetzt.value - getrenntSeit.value) / 1000))))
const papierAb = computed(() => (getrenntSek.value >= WKR_ANNAHMEN.papierHinweisSek ? (kopf.value?.startNr ?? null) : null))
const seitWartend = computed(() => props.quelle.wartendSeit.value)
const ohneQuittung = computed(() => seitWartend.value !== null && jetzt.value - seitWartend.value >= WKR_ANNAHMEN.ohneQuittungMs)
const hinweis = computed(() => props.quelle.hinweise.value[liste.value]?.[0] ?? null)

const kopfTitel = computed(() => {
  const s = sicht.value
  const a = props.spracheWahl === 'andere' ? s?.andere : undefined
  return { titel: a?.titel ?? s?.titel ?? '', bereich: a?.bereich ?? s?.bereich ?? '' }
})

// --- Zuletzt, Entwürfe ---
const zeilen = computed(() => props.quelle.zuletzt.value.filter((z) => z.liste === liste.value))
// „So lassen“ und „behalten“ überleben den Neuaufbau der Maske (Reiterwechsel) – Gedächtnis je Quelle und Liste.
const gedacht = gedaechtnis(props.quelle, props.aufgabe.liste)
const erledigt = ref<ReadonlySet<number>>(gedacht.erledigt)
const legeWeg = (z: number) => (erledigt.value = gedacht.erledigt = new Set([...erledigt.value, z]))
/**
 * „So lassen“ am Band (Nutzer 21.11.2026, W3-35, GF5): Band weg UND bei einer Rückfrage dem Bedienrechner melden –
 * sonst bekam er kein Feedback. Bei einer Ablehnung gibt es dort nichts zu vermerken (sie steht nicht im Eingang).
 */
function soLassen(z: number): void {
  if (zeilen.value.find((x) => x.z === z)?.stufe.stufe === 'rueckfrage') props.quelle.soLassen(liste.value, z)
  legeWeg(z)
}
const andereEntwuerfe = computed(() =>
  props.quelle.entwuerfe.value.filter((e) => e.liste === liste.value && !(e.s === aktuell.value?.key && (e.teil ?? '') === (teil.value ?? ''))),
)
// „Nicht vorbeigekommen“ (W4.3): statt der (leeren) Zellen das Kennzeichen – „fehlerfrei“ wäre falsch.
const zeilenText = (z: ZuletztZeile) => (z.nv ? `⊘ ${w('wkr.geraet.nichtVorbei.text')}` : zellenText(z.zellen, aufbauVon(klasseVon(z.s, z.punkt)), text, w('wkr.geraet.fehlerfreiText')))

/** Entwürfe zu Starts, die nicht mehr in der Folge stehen (zurückgestellt) – einmal fragen. */
const gefragt = ref<ReadonlySet<string>>(gedacht.gefragt)
const verwaist = computed<EntwurfEintrag | null>(() => {
  const s = sicht.value
  if (!s || !verbunden.value) return null
  const da = new Set([...s.schlange, ...s.danach, ...schlange.value].map((x) => x.key))
  return props.quelle.entwuerfe.value.find((e) => e.liste === liste.value && !da.has(e.s) && !gefragt.value.has(`${e.s}|${e.teil ?? ''}`)) ?? null
})
function behalte(e: EntwurfEintrag): void {
  gefragt.value = gedacht.gefragt = new Set([...gefragt.value, `${e.s}|${e.teil ?? ''}`])
}
function verwirf(e: EntwurfEintrag): void {
  props.quelle.verwirfEntwurf(liste.value, e.s, e.teil)
}

// --- Liste abschließen (W3.4, §5.7, G16) ---
/** Titel der Punkte, wie die Sicht sie einmal nannte – der vorige Punkt steht nach dem Wechsel nicht mehr in der Sicht. */
const punktTitel = ref<Record<string, string>>({})
watch(
  () => sicht.value?.punkt,
  (p) => {
    if (p && punktTitel.value[p.id] !== p.titel) punktTitel.value = { ...punktTitel.value, [p.id]: p.titel }
  },
  { immediate: true },
)
function titelVonPunkt(p: PunktId): string {
  const bekannt = punktTitel.value[p]
  if (bekannt) return bekannt
  const [art, rest = ''] = p.split(':')
  return art === 'lauf' ? w('wkr.geraet.punkt.lauf', { n: rest }) : rest
}
/** Der eigene Teil für den Abschluss: der der Aufgabe – ein Gerät für den ganzen Steg schließt die ganze Liste. */
const abschlussTeil = computed(() => (geteilt.value ? props.aufgabe.teil : undefined))
const letzterEigenerPunkt = computed(() => zeilen.value.find((z) => z.punkt !== null)?.punkt ?? null)
const bandPunkt = computed<PunktId | null>(() => {
  const p = letzterEigenerPunkt.value
  const s = sicht.value
  if (!p || !s || s.modus === 'papier') return null
  if (abgeschlossenIn(abschlussTeil.value).includes(p)) return null
  if (props.quelle.abschluesse.value.some((a) => a.liste === liste.value && a.punkt === p && a.stufe !== 'abgelehnt')) return null
  const ruht = s.punkt?.id === p && schlange.value.length === 0 && danach.value.length === 0
  return s.punkt?.id !== p || ruht ? p : null
})
const abschluss = ref<PunktId | null>(null)
/** Nur noch über das Band (W3-40, AM10): „Mehr → Liste abschließen“ gibt es nicht mehr. */
function oeffneAbschluss(p: PunktId | null): void {
  if (!p) return
  korrektur.value = null
  disqOffen.value = false
  abschluss.value = p
}
/** Starts, die sich aus der Prüfansicht korrigieren lassen: die neueste eigene Zeile steht in „Zuletzt“. */
const korrigierbar = computed(() => new Set(zeilen.value.filter((z) => z.punkt === abschluss.value).map((z) => z.s)))
function korrigiereAusPruefung(s: string): void {
  const z = zeilen.value.find((x) => x.s === s && x.punkt === abschluss.value)
  if (!z) return
  abschluss.value = null
  oeffneKorrektur(z.z)
}
function pruefText(z: PruefZeile): { klasse: string; codes: string; punkte: number | null } {
  const k = (z.klasse as ClassId | null) ?? null
  const b = aufbauVon(k)
  if (z.nv) return { klasse: klassenTitel(k), codes: `⊘ ${w('wkr.geraet.nichtVorbei.text')}`, punkte: null }
  return {
    klasse: klassenTitel(k),
    codes: zellenText(z.zellen, b, text, w('wkr.geraet.fehlerfreiText')),
    // Punkte auch bei Bojen (P14): dort steht die Summe der Berührungen und Codes.
    punkte: b && (b.art === 'katalog' || b.art === 'bojen') ? punkteVon(entwurfAus(z.zellen, b), b, abschlussTeil.value) : null,
  }
}
const listenSprache = computed(() => (sicht.value?.sprache === 'en' ? ('en' as const) : ('de' as const)))

// --- Bedienung ---
const disqOffen = ref(false)
const ausweichen = ref<InstanceType<typeof WkrAusweichen> | null>(null)
const nichtGefunden = ref<string | null>(null)
/** N13: Nummer eines „Bitte prüfen“, die das Gerät nicht kennt, solange keine Suche offen sein kann (Ruhe). */
const hinweisUnbekannt = ref<string | null>(null)
const frageKorrektur = ref(false)
// Das Band „nicht in der Folge“ (N13) gilt nur bis zur nächsten Arbeit: Sobald ein Start gezeigt wird (die Suche ist
// dann erreichbar), ist es überholt – sonst stünde es die ganze Erfassung über und schöbe die Knöpfe (Prüfbefund 21.11.2026).
watch(
  () => !!zeige.value,
  (da) => {
    if (da) hinweisUnbekannt.value = null
  },
)

function tippeCode(feld: string, code: string): void {
  if (gesperrt.value) return
  aendere(tippe(entwurf.value, feld, code))
}
/** Letzter Tipp je Schalter-Feld (Zeitmarke) – nur für den Prellschutz, nie im reinen wkr/maske.ts. */
const bojenTipp = new Map<string, number>()
function tippeBojeKnopf(b: MaskenBoje): void {
  if (gesperrt.value) return
  // Prellschutz (WKR_ANNAHMEN.bojenSchalterPrellMs, Prüfbefund 21.11.2026): Ein zweiter Tipp auf denselben Schalter
  // kurz nach dem ersten nähme die Berührung still wieder weg (Handschuh, Warten auf die Rückmeldung) – verworfen.
  // Zähler zählen jeden Tipp (sichtbar in der Zahl), dort kein Schutz.
  if (!b.zaehler) {
    const um = Date.now()
    const vorher = bojenTipp.get(b.feld)
    bojenTipp.set(b.feld, um)
    if (vorher !== undefined && um - vorher < WKR_ANNAHMEN.bojenSchalterPrellMs) return
  }
  aendere(tippeBoje(entwurf.value, b))
}
/** Disq. an einer Boje setzen bzw. (`null`) herausnehmen (U1). */
function setzeBojenDisq(b: MaskenBoje, code: string | null): void {
  if (gesperrt.value) return
  aendere(tippeBojenDisq(entwurf.value, b, code))
}
function setzeDisq(code: string): void {
  if (gesperrt.value) return
  aendere(tippeDisq(entwurf.value, code))
}
function zurueckTipp(): void {
  if (gesperrt.value) return
  aendere(zurueck(entwurf.value))
}
function bemerkung(t: string): void {
  aendere(mitBemerkung(entwurf.value, t))
}
function waehleTeil(t: ListenTeil): void {
  if (gesperrt.value || props.aufgabe.teil) return
  stegWahl.value = t
  gewaehlt.value = null
  disqOffen.value = false
}
function waehle(key: string): void {
  if (gesperrt.value) return
  korrektur.value = null
  hinweisUnbekannt.value = null
  gewaehlt.value = key === kopf.value?.key ? null : key
  disqOffen.value = false
  ladeEntwurf()
}
/** Buchstaben vor den bekannten Startnummern (E01, D03) – die Tasten des Ziffernfelds (K8). */
const buchstaben = computed(() => {
  const nummern = [...schlange.value, ...danach.value].map((x) => x.startNr).concat(zeilen.value.map((z) => z.sn ?? ''))
  const out = new Set<string>()
  for (const n of nummern) for (const ch of /^\s*([A-Za-z]+)/.exec(n)?.[1].toUpperCase() ?? '') out.add(ch)
  return [...out].sort()
})
/** Startnummern vergleichbar machen: „E01“ = „e1“, „007“ = „7“. */
const nummer = (s: string) => s.trim().toUpperCase().replace(/^(\D*)0+(?=\d)/, '$1')
function suche(nr: string): void {
  const gesucht = nummer(nr)
  const treffer = [...schlange.value, ...danach.value].find((x) => nummer(x.startNr) === gesucht)
  if (treffer) {
    nichtGefunden.value = null
    ausweichen.value?.zu()
    waehle(treffer.key)
    return
  }
  const z = zeilen.value.find((x) => x.sn !== undefined && nummer(x.sn) === gesucht)
  if (z) {
    nichtGefunden.value = null
    ausweichen.value?.zu()
    oeffneKorrektur(z.z)
    return
  }
  nichtGefunden.value = nr
}

/**
 * N13 (Feldtest 21.11.2026): „Bitte Nr. prüfen“ → „601 öffnen“. Schon gesendet → Korrektur mit dem eigenen Stand
 * (oeffneKorrektur liest quelle.stand); noch offen (Schlange, danach, am ganzen Steg auch der andere Teil) → Eingabe
 * dieses Starts; unbekannt → Suche mit der Nummer vorbelegt. Das Öffnen meldet den Hinweis als gesehen.
 */
async function oeffneHinweis(id: number, nr: string): Promise<void> {
  props.quelle.gesehen(id)
  abschluss.value = null
  hinweisUnbekannt.value = null
  const gesucht = nummer(nr)
  // Nur Zeilen des laufenden Punkts (Prüfbefund 21.11.2026): „Zuletzt“ reicht über Läufe hinweg, und dieselbe Nummer
  // steht in Lauf 1 und 2 (Parallelslalom: Attempt 1 und 2) – sonst öffnete die Bitte zu Lauf 2 die Korrektur von Lauf 1.
  const punkt = sicht.value?.punkt?.id ?? null
  const z = punkt ? zeilen.value.find((x) => x.punkt === punkt && x.sn !== undefined && nummer(x.sn) === gesucht) : undefined
  // Abgelehnt steht der Start wieder offen – dann die Eingabe statt einer Korrektur der verworfenen Zeile.
  if (z && z.stufe.stufe !== 'abgelehnt') {
    oeffneKorrektur(z.z)
    return
  }
  beendeTakt()
  jetzt.value = Date.now()
  korrektur.value = null
  frageKorrektur.value = false
  const teile: (ListenTeil | undefined)[] = geteilt.value && !props.aufgabe.teil ? [teil.value, teil.value === 'an' ? 'ab' : 'an'] : [teil.value]
  for (const t of teile) {
    const treffer = [...schlangeVon(t), ...danach.value].find((x) => nummer(x.startNr) === gesucht)
    if (!treffer) continue
    if (t && t !== teil.value) stegWahl.value = t
    gewaehlt.value = null
    waehle(treffer.key)
    return
  }
  // Unbekannt: Suche vorbelegt – der WKR sieht die Nummer und den Satz „nicht in der Folge“ und kann sie ändern.
  nichtGefunden.value = nr
  await nextTick()
  if (ausweichen.value) ausweichen.value.oeffne(nr)
  else hinweisUnbekannt.value = nr
}

function haupt(): void {
  if (gesperrt.value) return
  hinweisUnbekannt.value = null
  if (korrektur.value) {
    if (aufbau.value) frageKorrektur.value = true
    return
  }
  const a = aktuell.value
  const b = aufbau.value
  if (!a || !b) return
  const z = props.quelle.schicke(liste.value, { s: a.key, zellen: zellenAus(entwurf.value, b, teil.value), ...(teil.value ? { teil: teil.value } : {}) })
  if (z === null) return
  const g: Gesendet = { um: Date.now(), z, start: a, entwurf: entwurf.value, aufbau: b, klasse: klassenTitel(a.klasse) }
  quittungUm.value = null
  gesendet.value = g
  gewaehlt.value = null
  disqOffen.value = false
  starteTakt(g)
  ladeEntwurf()
}

/**
 * „Nicht vorbeigekommen“ (W4.3, P16/R6) für den gezeigten Start: wo X nicht gilt (nicht Vorsteg, am Steg nur
 * Anlegen – WKR_ANNAHMEN.nichtVorbeiNichtBeiX), nicht in der Korrektur. Die Startnummer für die Rückfrage; sonst `null`.
 */
const nichtVorbeiNr = computed(() => {
  const a = aktuell.value
  const typeId = liesListe(liste.value)?.typeId
  if (!a || korrektur.value || !typeId) return null
  const xHier = WKR_ANNAHMEN.xListen.includes(typeId) && (!geteilt.value || teil.value === undefined || teil.value === WKR_ANNAHMEN.xTeil)
  return xHier ? null : a.startNr
})
function nichtVorbei(): void {
  if (gesperrt.value || !nichtVorbeiNr.value) return
  hinweisUnbekannt.value = null
  const a = aktuell.value
  const b = aufbau.value
  if (!a || !b) return
  // Ein Entwurf dieses Starts ist damit hinfällig – „Es wird nichts eingetragen“ (R6).
  props.quelle.verwirfEntwurf(liste.value, a.key, teil.value)
  // W3-17 (Nutzer 21.11.2026, GF10): Wo die Liste J kennt, ist es Disq. J im Disq.-Feld (eine gewöhnliche Zeile – Haken,
  // Matrix ✓ mit Disq.); sonst (Steg-Anlegen) das Kennzeichen ⊘ wie seit W4.3.
  const alsDisq = nichtVorbeiArt(disqFuer(b, teil.value)) === 'disq'
  const e = alsDisq ? tippeDisq(leererEntwurf(), NICHT_VORBEI_DISQ) : leererEntwurf()
  const z = alsDisq
    ? props.quelle.schicke(liste.value, { s: a.key, zellen: zellenAus(e, b, teil.value), ...(teil.value ? { teil: teil.value } : {}) })
    : props.quelle.schicke(liste.value, { s: a.key, zellen: {}, nv: true, ...(teil.value ? { teil: teil.value } : {}) })
  if (z === null) return
  const g: Gesendet = { um: Date.now(), z, start: a, entwurf: e, aufbau: b, klasse: klassenTitel(a.klasse) }
  quittungUm.value = null
  gesendet.value = g
  gewaehlt.value = null
  disqOffen.value = false
  starteTakt(g)
  ladeEntwurf()
}

function oeffneKorrektur(z: number): void {
  const k = props.quelle.zuletzt.value.find((x) => x.z === z)
  if (!k) return
  if (k.teil && geteilt.value && !props.aufgabe.teil) stegWahl.value = k.teil
  // Die Korrektur ist eine bewusste Wahl (oben, außerhalb der gesperrten Fläche): Sie beendet den Takt des letzten
  // Abschickens, sonst zeigte die Mitte noch den gesendeten Start.
  beendeTakt()
  hinweisUnbekannt.value = null
  korrektur.value = k
  disqOffen.value = false
  const b = aufbauVon(klasseVon(k.s, k.punkt))
  korrekturAlt.value = props.quelle.stand(k.z) ?? k.zellen
  entwurf.value = b ? entwurfAus(korrekturAlt.value, b) : leererEntwurf()
}
function brichKorrekturAb(): void {
  korrektur.value = null
  frageKorrektur.value = false
  ladeEntwurf()
}
const korrekturNeu = computed(() => (korrektur.value && aufbau.value ? zellenAus(entwurf.value, aufbau.value, korrektur.value.teil) : {}))
function korrekturJa(): void {
  const k = korrektur.value
  frageKorrektur.value = false
  if (!k || !aufbau.value) return
  props.quelle.korrigiere(k.z, korrekturNeu.value)
  legeWeg(k.z)
  brichKorrekturAb()
}

function zurueckHolen(): void {
  const g = gesendet.value
  if (!g) return
  beendeTakt()
  jetzt.value = Date.now()
  const r = props.quelle.holeZurueck(g.z)
  if (!r) {
    // Schon unterwegs: kein automatisches Hinterherschicken, sondern die Korrektur (G8).
    oeffneKorrektur(g.z)
    return
  }
  if (r.teil && geteilt.value && !props.aufgabe.teil) stegWahl.value = r.teil
  korrektur.value = null
  gewaehlt.value = r.s
  ladeEntwurf()
}
function oeffneEntwurf(e: EntwurfEintrag): void {
  if (e.teil && geteilt.value && !props.aufgabe.teil) stegWahl.value = e.teil
  if ([...schlangeVon(e.teil), ...danach.value].some((x) => x.key === e.s)) waehle(e.s)
}

const art = computed(() => (zeige.value?.aufbau.art === 'vorsteg' ? 'vorsteg' : zeige.value?.aufbau.art === 'bojen' ? 'bojen' : 'katalog'))

// --- Bojen: Seite des Umschalters je Start (P8) und Klassenwechsel-Band (P10) ---
const wege = ref<ReadonlyMap<string, Weg>>(gedacht.wege)
/** Je Start und Teil; die Korrektur hat ihren eigenen Schlüssel (sie beginnt auf „Hinweg“ wie ein neuer Start). */
const wegSchluessel = computed(() => (korrektur.value ? `k|${korrektur.value.z}` : zeige.value ? `${zeige.value.start.key}|${teil.value ?? ''}` : ''))
const weg = computed<Weg>(() => wege.value.get(wegSchluessel.value) ?? 'hin')
function waehleWeg(x: Weg): void {
  if (gesperrt.value) return
  const neu = new Map(wege.value)
  neu.set(wegSchluessel.value, x)
  wege.value = gedacht.wege = neu
}
/** Halte einer Maske als Kennzeichen – „andere Halte“ heißt: anderes Kennzeichen als beim zuvor gezeigten Start. */
const halteVon = (a: MaskenAufbau | null) => (a && a.art === 'bojen' ? a.abschnitte.map((x) => (x.art === 'halt' ? `${x.halt.halt}|${x.halt.weg}` : x.teil.feld)).join(',') : null)
const wechselBis = ref<number | null>(null)
const wechselKlasse = ref('')
let letzteHalte: string | null = null
/**
 * Nutzer 21.11.2026 (W4-13, WKR_ANNAHMEN GF9): Das Band kommt nur beim ERSTEN Start einer Klasse im laufenden Punkt –
 * bei verzahnten Klassen (1, 2, 1, 2 …) sonst vor fast jedem Start. Gemerkt im Gedächtnis der Liste (Reiterwechsel).
 */
function ersterDerKlasse(klasse: string): boolean {
  const k = `${sicht.value?.punkt?.id ?? ''}|${klasse}`
  if (gedacht.klassenGesehen.has(k)) return false
  gedacht.klassenGesehen = new Set([...gedacht.klassenGesehen, k])
  return true
}
watch(
  () => (zeige.value && !imOverlay.value && !korrektur.value ? { key: zeige.value.start.key, halte: halteVon(zeige.value.aufbau), klasse: zeige.value.klasse } : null),
  (z) => {
    if (!z || z.halte === null) return
    const erster = ersterDerKlasse(z.klasse)
    if (letzteHalte !== null && z.halte !== letzteHalte && erster) {
      const um = Date.now()
      jetzt.value = um
      wechselBis.value = um + WKR_ANNAHMEN.klassenWechselMs
      wechselKlasse.value = z.klasse
      nach(WKR_ANNAHMEN.klassenWechselMs, tick)
    }
    letzteHalte = z.halte
  },
  { immediate: true },
)
/** Zeichnung der Klasse des gezeigten Starts (Sicht `bild`, W4-13) – auf Bojen-, Tor-5- und MüB-Listen, wo sie es gibt. */
const parcoursBild = computed(() => (klasse.value ? (sicht.value?.klassen[klasse.value]?.bild ?? null) : null))
const klassenWechsel = computed(() => (wechselBis.value !== null && jetzt.value < wechselBis.value ? wechselKlasse.value : null))
const disqCodes = computed(() => (zeige.value ? disqFuer(zeige.value.aufbau, teil.value) : []))
/** Alle Disq.-Buchstaben des Entwurfs für den Fuß: die der Liste und die an Bojen (U1). */
/** Bojen-Listen: DISQ gibt es auch ohne Disq.-Feld, sobald eine Boje Buchstaben annimmt (BZ4). */
const mitBojenDisq = computed(() => !!zeige.value && zeige.value.aufbau.art === 'bojen' && bojenVon(zeige.value.aufbau).some((b) => b.disq.length > 0))
const fussDisq = computed(() => (zeige.value ? [...zeige.value.entwurf.disq, ...disqAnBojen(zeige.value.entwurf, zeige.value.aufbau).map((d) => d.code)] : []))

// --- Bojen-Ansicht dieser Liste (V1/V2): gemerkt in WkrGeraet, hier nur gelesen und geändert ---
const bojenAnsicht = computed<BojenAnsicht>(() => props.bojenAnsichten?.[liste.value] ?? { ...BOJEN_ANSICHT_VORGABE })
function aendereBojenAnsicht(neu: BojenAnsicht): void {
  // Die geänderte Liste kommt ans Ende (Prüfbefund 21.11.2026): Die Ablage behält die letzten BOJEN_ANSICHT_MAX in
  // Einfüge-Reihenfolge – so fällt die am längsten nicht geänderte heraus, nicht die zuerst angelegte.
  const rest = { ...(props.bojenAnsichten ?? {}) }
  delete rest[liste.value]
  emit('ansicht', { bojen: { ...rest, [liste.value]: neu } })
}
const sichtbareTeile = computed(() => (zeige.value ? teileFuer(zeige.value.aufbau, teil.value) : []))
</script>

<template>
  <div class="wkr-maske" :class="{ 'wkr-maske--bojen': art === 'bojen' }" data-teil="maske" :data-liste="liste" :data-takt="takt" :data-gesperrt="gesperrt || undefined" :data-steg="teil">
    <WkrKopf
      v-if="sicht"
      :titel="kopfTitel.titel"
      :bereich="kopfTitel.bereich"
      :lauf="zeige?.start.titel ?? sicht.punkt?.titel ?? null"
      :invers="invers"
      :uebung="quelle.uebung"
      :verbindung="verbindung"
      :getrennt-sek="getrenntSek"
      :wartend="quelle.wartend.value"
      :ohne-quittung="ohneQuittung"
      :bestaetigung-folgt="bestaetigungFolgt"
      :papier-ab="papierAb"
      :hinweis="hinweis"
      @gesehen="(id) => quelle.gesehen(id)"
      @oeffne="oeffneHinweis"
    />
    <div v-if="hinweisUnbekannt" class="wkr-band wkr-band--warn" role="alert" data-teil="hinweis-unbekannt">
      <b>{{ w('wkr.geraet.nichtGefunden', { nr: hinweisUnbekannt }) }}</b>
      <button type="button" class="wkr-knopf" data-ziel="klein" data-action="hinweis-unbekannt-weg" @click="hinweisUnbekannt = null">{{ w('wkr.geraet.gesehen') }}</button>
    </div>

    <WkrAbschluss
      v-if="abschluss"
      :quelle="quelle"
      :liste="liste"
      :listen-titel="kopfTitel.titel"
      :punkt="abschluss"
      :punkt-titel="titelVonPunkt(abschluss)"
      :teil="abschlussTeil"
      :name="wkrNameLage?.name || name || ''"
      :zeile-text="pruefText"
      :korrigierbar="korrigierbar"
      :laeuft="sicht?.laeuft && sicht.laeuft.punkt === abschluss ? sicht.laeuft : null"
      @korrigiere="korrigiereAusPruefung"
      @zurueck="abschluss = null"
      @name="(n) => emit('name', n)"
    />
    <template v-else>
      <WkrStegReiter v-if="geteilt && teil" :teil="teil" :fest="!!aufgabe.teil" :stand="stegStand" @waehle="waehleTeil" />

      <WkrZuletzt
        :zeilen="zeilen"
        :text="zeilenText"
        :entwuerfe="andereEntwuerfe"
        :rueckgaengig="rueckgaengig"
        :erledigt="erledigt"
        @korrigiere="oeffneKorrektur"
        @so-lassen="soLassen"
        @rueckgaengig="zurueckHolen"
        @entwurf="oeffneEntwurf"
      />

      <div v-if="verwaist" class="wkr-band wkr-band--warn" role="alert" data-teil="verwaist" :data-start="verwaist.s">
        <b>{{ w('wkr.geraet.verwaist', { nr: verwaist.sn ?? '?' }) }}</b>
        <span class="wkr-reihe">
          <button type="button" class="wkr-knopf" data-ziel="klein" data-action="entwurf-behalten" @click="behalte(verwaist)">{{ w('wkr.geraet.behalten') }}</button>
          <button type="button" class="wkr-knopf" data-ziel="klein" data-action="entwurf-verwerfen" @click="verwirf(verwaist)">{{ w('wkr.geraet.verwerfen') }}</button>
        </span>
      </div>

      <div v-if="bandPunkt" class="wkr-band wkr-band--hinweis" role="status" data-teil="abschluss-band" :data-punkt="bandPunkt" :data-laeuft="sicht?.laeuft?.punkt === bandPunkt ? '' : undefined">
        <b>{{ w('wkr.geraet.abschluss.band', { punkt: titelVonPunkt(bandPunkt) }) }}</b>
        <span class="wkr-hinweis" data-teil="abschluss-zweck">{{ w('wkr.geraet.abschluss.zweck', { punkt: titelVonPunkt(bandPunkt) }) }}</span>
        <button type="button" class="wkr-knopf" data-ziel="klein" data-action="abschluss-band" @click="oeffneAbschluss(bandPunkt)">{{ w('wkr.geraet.abschluss') }}</button>
      </div>

      <WkrRuhe
        v-if="ruhe"
        :art="ruhe"
        :naechster="naechsterStart"
        :meldung="meldung"
        :punkt="sicht?.punkt?.titel ?? null"
        :liste="kopfTitel.titel"
        :klasse="klassenTitel(aktuell?.klasse ?? null)"
        :aktiv="status === 'aktiv'"
        :neu-verbinden="ruhe === 'warte' && warteLange && !quelle.uebung"
        @weiter="quelle.weiter(liste)"
        @pausiere="quelle.pausiere(liste)"
        @neu-verbinden="neuVerbinden"
      />
      <template v-else-if="zeige">
        <div class="wkr-karten-platz">
          <WkrStarterKarte :start="zeige.start" :klasse="zeige.klasse" :ausser-der-reihe="ausserDerReihe" :gesendet="imOverlay" :korrektur="korrekturArt" :ampel="kartenAmpel" />
          <!-- P10: liegt über der Karte (absolut) – verschiebt keinen Knopf, fängt Tipps auf seiner Fläche ab. -->
          <p v-if="klassenWechsel && art === 'bojen'" class="wkr-band wkr-band--warn wkr-klassen-wechsel" role="status" data-teil="klassen-wechsel">
            <b>{{ w('wkr.geraet.bojen.klassenWechsel', { klasse: klassenWechsel }) }}</b>
          </p>
        </div>
        <button v-if="korrektur" type="button" class="wkr-knopf" data-ziel="klein" data-action="korrektur-abbrechen" @click="brichKorrekturAb">{{ w('wkr.geraet.korrektur.abbrechen') }}</button>

        <div class="wkr-mitte" :inert="gesperrt" data-teil="mitte">
          <WkrAusweichen
            v-if="!korrektur"
            ref="ausweichen"
            :naechste="schlange.filter((x) => x.key !== aktuell?.key && !x.entfaellt).slice(0, 2)"
            :nicht-gefunden="nichtGefunden"
            :buchstaben="buchstaben"
            @waehle="waehle"
            @suche="suche"
            @schliesse="nichtGefunden = null"
          />
          <!-- :key je Start und Teil: Ein vorgemerkter Disq.-Buchstabe gilt nie für den nächsten Start (Prüfbefund W3). -->
          <WkrVorsteg
            v-if="art === 'vorsteg'"
            :key="`${zeige.start.key}|${teil ?? ''}|${korrektur?.z ?? ''}`"
            :codes="disqCodes"
            :gesetzt="zeige.entwurf.disq"
            :start-nr="zeige.start.startNr"
            :gesperrt="gesperrt"
            @setze="setzeDisq"
          />
          <!-- Bojen-Listen (BZ4): erst der Ort, dann der Buchstabe; :key je Start wie WkrDisq. -->
          <WkrDisqOrt
            v-else-if="disqOffen && art === 'bojen'"
            :key="`${zeige.start.key}|${teil ?? ''}|${korrektur?.z ?? ''}`"
            :aufbau="zeige.aufbau"
            :entwurf="zeige.entwurf"
            :codes="disqCodes"
            :start-nr="zeige.start.startNr"
            :gesperrt="gesperrt"
            :ansicht="bojenAnsicht"
            @setze="setzeDisq"
            @boje-disq="setzeBojenDisq"
            @fertig="disqOffen = false"
          />
          <WkrDisq
            v-else-if="disqOffen"
            :key="`${zeige.start.key}|${teil ?? ''}|${korrektur?.z ?? ''}`"
            :titel="w('wkr.geraet.disq')"
            :codes="disqCodes"
            :gesetzt="zeige.entwurf.disq"
            :start-nr="zeige.start.startNr"
            :gesperrt="gesperrt"
            @setze="setzeDisq"
          />
          <!-- :key je Start: Ein offener Disq.-Modus gilt nie für den nächsten Start (wie WkrDisq). -->
          <WkrBojen
            v-else-if="art === 'bojen'"
            :key="`${zeige.start.key}|${teil ?? ''}|${korrektur?.z ?? ''}`"
            :aufbau="zeige.aufbau"
            :entwurf="zeige.entwurf"
            :weg="weg"
            :ansicht="bojenAnsicht"
            @boje="tippeBojeKnopf"
            @disq="disqOffen = true"
            @tippe="tippeCode"
            @weg="waehleWeg"
          />
          <WkrKnoepfe v-else :teile="sichtbareTeile" :entwurf="zeige.entwurf" @tippe="tippeCode" />
          <WkrMehr
            :mit-bemerkung="!!zeige.aufbau.bemerkung"
            :bemerkung="zeige.entwurf.bemerkung"
            :status="status"
            :modus="modus ?? 'geraet'"
            :hand="hand"
            :sprache="text.sprache.value"
            :listen-sprache="listenSprache"
            :mit-andere="!!sicht?.andere"
            :uebung="quelle.uebung"
            :nicht-vorbei="nichtVorbeiNr"
            :nicht-vorbei-disq="nichtVorbeiArt(disqCodes) === 'disq' ? NICHT_VORBEI_DISQ : null"
            :bojen-ansicht="art === 'bojen' ? bojenAnsicht : null"
            :wkr-name="wkrNameLage"
            @wkr-name="(n) => quelle.setzeWkrName(liste, n)"
            @bojen-ansicht="aendereBojenAnsicht"
            @nicht-vorbei="nichtVorbei"
            @bemerkung="bemerkung"
            @pausiere="quelle.pausiere(liste)"
            @melde-ab="quelle.meldeAb(liste)"
            @weiter="quelle.weiter(liste)"
            @probe="emit('probe')"
            @ansicht="(a) => emit('ansicht', a)"
            @uebung-ende="emit('uebungEnde')"
          />
          <!-- W4-13 (21.11.2026, GF9): Parcours-Zeichnung der Klasse unter den Knöpfen – beim Hochwischen erreichbar. -->
          <WkrParcoursBild v-if="parcoursBild" :bild="parcoursBild" :klasse="zeige.klasse" />
        </div>
        <div class="wkr-unten" :inert="gesperrt">
          <WkrFuss
            :art="art"
            :teil="teil"
            :eintraege="eintraege(zeige.entwurf)"
            :punkte="punkteVon(zeige.entwurf, zeige.aufbau, teil)"
            :disq="fussDisq"
            :korrektur="korrekturArt"
            :hand="hand"
            :mit-disq="disqCodes.length > 0 || mitBojenDisq"
            :disq-offen="disqOffen"
            @zurueck="zurueckTipp"
            @disq="disqOffen = !disqOffen"
            @haupt="haupt"
          />
        </div>
      </template>
      <!-- Auch ohne Arbeit: Ansicht, Sprache, Probe, Liste abschließen (Pausieren usw. hat die Ruhe selbst, außer „leer“). -->
      <WkrMehr
        v-if="ruhe && ruhe !== 'warte'"
        :mit-bemerkung="false"
        bemerkung=""
        :status="status"
        :mit-status="ruhe === 'leer'"
        :modus="modus ?? 'geraet'"
        :hand="hand"
        :sprache="text.sprache.value"
        :listen-sprache="listenSprache"
        :mit-andere="!!sicht?.andere"
        :uebung="quelle.uebung"
        :wkr-name="wkrNameLage"
        @wkr-name="(n) => quelle.setzeWkrName(liste, n)"
        @pausiere="quelle.pausiere(liste)"
        @melde-ab="quelle.meldeAb(liste)"
        @weiter="quelle.weiter(liste)"
        @probe="emit('probe')"
        @ansicht="(a) => emit('ansicht', a)"
        @uebung-ende="emit('uebungEnde')"
      />
    </template>

    <!-- N1 (Feldtest 21.11.2026): sofort nach „Fehlerfrei“/„Abschicken“ über der ganzen Maske, ohne Knöpfe. -->
    <WkrUebertragen v-if="gesendet && imOverlay" :start-nr="gesendet.start.startNr" :takt="takt" :stufe="gesendeteStufe" />
    <div v-if="blitz" class="wkr-blitz" data-teil="blitz" aria-hidden="true" />

    <AppDialog
      v-if="frageKorrektur && korrektur"
      class="wkr-dialog"
      :titel="w(korrekturArt === 'vorschlag' ? 'wkr.geraet.korrektur.frageVorschlag' : 'wkr.geraet.korrektur.frage', { nr: korrektur.sn ?? '?' })"
      data-dialog="wkr-korrektur"
      @abbrechen="frageKorrektur = false"
    >
      <p class="wkr-korrektur-alt" data-teil="alt">{{ korrektur.nv ? `⊘ ${w('wkr.geraet.nichtVorbei.text')}` : zellenText(korrekturAlt, aufbau, text, w('wkr.geraet.fehlerfreiText')) }}</p>
      <p class="wkr-korrektur-pfeil" aria-hidden="true">↓</p>
      <p class="wkr-korrektur-neu" data-teil="neu">{{ zellenText(korrekturNeu, aufbau, text, w('wkr.geraet.fehlerfreiText')) }}</p>
      <template #knoepfe>
        <button type="button" class="wkr-knopf wkr-knopf--haupt" data-ziel="gross" data-action="korrektur-ja" @click="korrekturJa">
          {{ w(korrekturArt === 'vorschlag' ? 'wkr.geraet.korrektur.vorschlag' : 'wkr.geraet.korrektur.abschicken') }}
        </button>
        <button type="button" class="wkr-knopf" data-ziel="gross" data-action="korrektur-nein" autofocus @click="frageKorrektur = false">{{ w('wkr.geraet.abbrechen') }}</button>
      </template>
    </AppDialog>
  </div>
</template>
