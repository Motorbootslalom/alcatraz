<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { ClassId, PunktId } from '../../types'
import type { EntwurfEintrag, ErfassungsQuelle, PruefZeile, SchlangenEintrag, ZuletztZeile } from '../../geraete/erfassen'
import type { AnsichtModus, GeraetAnsicht } from '../../geraete/ablage'
import type { ListenAufgabe } from '../../geraete/aufgaben'
import { liesRef } from '../../betrieb/folge'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import type { ListenTeil } from '../../wkr/liste'
import {
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
  tippeDisq,
  wechselNach,
  wechselTakt,
  zellenAus,
  zurueck,
  type Entwurf,
  type MaskenAufbau,
} from '../../wkr/maske'
import AppDialog from '../AppDialog.vue'
import WkrAbschluss from './WkrAbschluss.vue'
import WkrAusweichen from './WkrAusweichen.vue'
import WkrDisq from './WkrDisq.vue'
import WkrFuss from './WkrFuss.vue'
import WkrKnoepfe from './WkrKnoepfe.vue'
import WkrKopf from './WkrKopf.vue'
import WkrMehr from './WkrMehr.vue'
import WkrRuhe from './WkrRuhe.vue'
import WkrStarterKarte from './WkrStarterKarte.vue'
import WkrStegReiter from './WkrStegReiter.vue'
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
 *   Reihe“, nach dem Abschicken zurück zum Kopf). Kein Name, nie (F6).
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
 * - **Liste abschließen** (W3.4, F7/F8, G16): unter „Mehr“ immer (der laufende Punkt, sonst der letzte eigene), als
 *   Band, sobald der letzte eigene Punkt nicht mehr läuft (der nächste begann, oder nichts steht mehr an) und weder
 *   abgeschlossen noch mit eigenem Abschluss unterwegs ist (Auslegung L2). Die Prüfansicht (WkrAbschluss) ersetzt die
 *   Mitte; Tipp auf eine Zeile → Korrektur.
 * - **Ansicht, Sprache, Probe, Übung verlassen** gehen als Ereignis an WkrGeraet (dort gemerkt bzw. ausgeführt).
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
  modus?: AnsichtModus
  /** Vorbelegter WKR-Name für den Abschluss (G12). */
  name?: string
}>()
const emit = defineEmits<{ ansicht: [aenderung: Partial<GeraetAnsicht>]; probe: []; name: [name: string]; uebungEnde: [] }>()
const text = useWkrText()
const { w } = text

const liste = computed(() => props.aufgabe.liste)
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
const naechsterStart = computed(() => {
  const d = sicht.value?.danach[0]
  return d ? { startNr: d.startNr, klasse: klassenTitel(d.klasse) } : null
})

// --- Verbindung, Quittung ---
const verbunden = computed(() => props.quelle.verbunden.value)
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
const andereEntwuerfe = computed(() =>
  props.quelle.entwuerfe.value.filter((e) => e.liste === liste.value && !(e.s === aktuell.value?.key && (e.teil ?? '') === (teil.value ?? ''))),
)
const zeilenText = (z: ZuletztZeile) => zellenText(z.zellen, aufbauVon(klasseVon(z.s, z.punkt)), text, w('wkr.geraet.fehlerfreiText'))

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
const abschlussMoeglich = computed(() => sicht.value?.punkt?.id ?? letzterEigenerPunkt.value)
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
function oeffneAbschluss(p: PunktId | null = bandPunkt.value ?? abschlussMoeglich.value): void {
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
  return {
    klasse: klassenTitel(k),
    codes: zellenText(z.zellen, b, text, w('wkr.geraet.fehlerfreiText')),
    punkte: b && b.art === 'katalog' ? punkteVon(entwurfAus(z.zellen, b), b, abschlussTeil.value) : null,
  }
}
const listenSprache = computed(() => (sicht.value?.sprache === 'en' ? ('en' as const) : ('de' as const)))

// --- Bedienung ---
const disqOffen = ref(false)
const ausweichen = ref<InstanceType<typeof WkrAusweichen> | null>(null)
const nichtGefunden = ref<string | null>(null)
const frageKorrektur = ref(false)

function tippeCode(feld: string, code: string): void {
  if (gesperrt.value) return
  aendere(tippe(entwurf.value, feld, code))
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

function haupt(): void {
  if (gesperrt.value) return
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

function oeffneKorrektur(z: number): void {
  const k = props.quelle.zuletzt.value.find((x) => x.z === z)
  if (!k) return
  if (k.teil && geteilt.value && !props.aufgabe.teil) stegWahl.value = k.teil
  // Die Korrektur ist eine bewusste Wahl (oben, außerhalb der gesperrten Fläche): Sie beendet den Takt des letzten
  // Abschickens, sonst zeigte die Mitte noch den gesendeten Start.
  beendeTakt()
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

const art = computed(() => (zeige.value?.aufbau.art === 'vorsteg' ? 'vorsteg' : 'katalog'))
const disqCodes = computed(() => (zeige.value ? disqFuer(zeige.value.aufbau, teil.value) : []))
const sichtbareTeile = computed(() => (zeige.value ? teileFuer(zeige.value.aufbau, teil.value) : []))
</script>

<template>
  <div class="wkr-maske" data-teil="maske" :data-liste="liste" :data-takt="takt" :data-gesperrt="gesperrt || undefined" :data-steg="teil">
    <WkrKopf
      v-if="sicht"
      :titel="kopfTitel.titel"
      :bereich="kopfTitel.bereich"
      :lauf="zeige?.start.titel ?? sicht.punkt?.titel ?? null"
      :invers="invers"
      :uebung="quelle.uebung"
      :verbunden="verbunden"
      :getrennt-sek="getrenntSek"
      :wartend="quelle.wartend.value"
      :ohne-quittung="ohneQuittung"
      :bestaetigung-folgt="bestaetigungFolgt"
      :papier-ab="papierAb"
      :hinweis="hinweis"
      @gesehen="(id) => quelle.gesehen(id)"
    />

    <WkrAbschluss
      v-if="abschluss"
      :quelle="quelle"
      :liste="liste"
      :listen-titel="kopfTitel.titel"
      :punkt="abschluss"
      :punkt-titel="titelVonPunkt(abschluss)"
      :teil="abschlussTeil"
      :name="name ?? ''"
      :zeile-text="pruefText"
      :korrigierbar="korrigierbar"
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
        @so-lassen="legeWeg"
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

      <div v-if="bandPunkt" class="wkr-band wkr-band--hinweis" role="status" data-teil="abschluss-band" :data-punkt="bandPunkt">
        <b>{{ w('wkr.geraet.abschluss.band', { punkt: titelVonPunkt(bandPunkt) }) }}</b>
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
        @weiter="quelle.weiter(liste)"
        @pausiere="quelle.pausiere(liste)"
      />
      <template v-else-if="zeige">
        <WkrStarterKarte :start="zeige.start" :klasse="zeige.klasse" :ausser-der-reihe="ausserDerReihe" :gesendet="imOverlay" :korrektur="korrekturArt" />
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
          <WkrKnoepfe v-else :teile="sichtbareTeile" :entwurf="zeige.entwurf" @tippe="tippeCode" />
          <WkrMehr
            :mit-bemerkung="!!zeige.aufbau.bemerkung"
            :bemerkung="zeige.entwurf.bemerkung"
            :status="status"
            :modus="modus ?? 'sonne'"
            :hand="hand"
            :sprache="text.sprache.value"
            :listen-sprache="listenSprache"
            :mit-andere="!!sicht?.andere"
            :kann-abschliessen="!!abschlussMoeglich"
            :uebung="quelle.uebung"
            @bemerkung="bemerkung"
            @pausiere="quelle.pausiere(liste)"
            @melde-ab="quelle.meldeAb(liste)"
            @weiter="quelle.weiter(liste)"
            @abschluss="oeffneAbschluss()"
            @probe="emit('probe')"
            @ansicht="(a) => emit('ansicht', a)"
            @uebung-ende="emit('uebungEnde')"
          />
        </div>
        <div class="wkr-unten" :inert="gesperrt">
          <WkrFuss
            :art="art"
            :teil="teil"
            :eintraege="eintraege(zeige.entwurf)"
            :punkte="punkteVon(zeige.entwurf, zeige.aufbau, teil)"
            :disq="zeige.entwurf.disq"
            :korrektur="korrekturArt"
            :hand="hand"
            :mit-disq="disqCodes.length > 0"
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
        :modus="modus ?? 'sonne'"
        :hand="hand"
        :sprache="text.sprache.value"
        :listen-sprache="listenSprache"
        :mit-andere="!!sicht?.andere"
        :kann-abschliessen="!!abschlussMoeglich"
        :uebung="quelle.uebung"
        @pausiere="quelle.pausiere(liste)"
        @melde-ab="quelle.meldeAb(liste)"
        @weiter="quelle.weiter(liste)"
        @abschluss="oeffneAbschluss()"
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
      <p class="wkr-korrektur-alt" data-teil="alt">{{ zellenText(korrekturAlt, aufbau, text, w('wkr.geraet.fehlerfreiText')) }}</p>
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
