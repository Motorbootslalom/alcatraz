<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { ClassId, KeineZeitGrund, WkrPunkt } from '../../types'
import type { EntwurfEintrag, ErfassungsQuelle, PruefZeile, SchlangenEintrag, ZuletztZeile } from '../../geraete/erfassen'
import type { AnsichtWahl, GeraetAnsicht } from '../../geraete/ablage'
import type { ListenAufgabe } from '../../geraete/aufgaben'
import { liesRef } from '../../betrieb/folge'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import type { ListenTeil } from '../../wkr/liste'
import { NICHT_GESTARTET } from '../../lib/abmeldung'
import {
  attemptWechsel,
  BOJEN_FOLGE_VORGABE,
  bojenVon,
  disqAnBojen,
  disqFuer,
  eintraege,
  entwurfAus,
  entwurfZellen,
  fertig,
  keineZeitAus,
  leererEntwurf,
  setzeKeineZeit,
  setzeZeit,
  zeitenOffen,
  maskeFuer,
  maskenArt,
  mitBemerkung,
  punkteVon,
  teileFuer,
  tippe,
  codeTippPrellt,
  tippeBoje,
  tippeBojenDisq,
  tippeDisq,
  nichtGestartetZellen,
  ohneFremdesX,
  wechselNach,
  wechselTakt,
  zellenAus,
  zurueck,
  type BojenFolge,
  type Entwurf,
  type MaskenAufbau,
  type MaskenBoje,
} from '../../wkr/maske'
import type { Weg } from '../../wkr/bojen'
import type { MaskenWahl } from '../../wkr/maskenWahl'
import AppDialog from '../AppDialog.vue'
import WkrAbschluss from './WkrAbschluss.vue'
import WkrAusweichen from './WkrAusweichen.vue'
import WkrFuss from './WkrFuss.vue'
import WkrKopf from './WkrKopf.vue'
import WkrMehr from './WkrMehr.vue'
import WkrMitte from './WkrMitte.vue'
import { bildTreffer, type BildLage } from '../../wkr/bild'
import { tabellenSpalten } from '../../wkr/tabelle'
import { parcoursSvg } from '../../lib/parcoursQuelle'
import WkrSeite from './WkrSeite.vue'
import WkrRuhe from './WkrRuhe.vue'
import WkrStarterKarte from './WkrStarterKarte.vue'
import WkrStegReiter from './WkrStegReiter.vue'
import WkrParcoursBild from './WkrParcoursBild.vue'
import WkrUebertragen from './WkrUebertragen.vue'
import WkrZuletzt from './WkrZuletzt.vue'
import { gedaechtnis } from './gedaechtnis'
import { rolleAnDenRand, zielNachErklaerung } from './systemModus'
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
 * - **Bojen-Folge und Disq. an der Boje** (Nutzer 22.11.2026, WKR_ANNAHMEN.bojenFolge; U1/U2 vom 21.11.2026): Reihenfolge
 *   „Rückweg gedreht“ (Vorgabe) / „Fahrtfolge“ / „Alles untereinander“ – je Liste aus `bojenFolgen` (WkrGeraet merkt
 *   sie, ablage.ts `bojenFolge`), geändert unter „Mehr → Ansicht“. Der Fuß nennt die Buchstaben an Bojen mit („Disq. G“).
 * - **Disq. auf Bojen-Listen** (Antwort W4-12, 21.11.2026, BZ4): DISQ im Fuß und „Disq. an Boje …“ öffnen dieselbe
 *   Wahl (WkrDisqOrt): erst die Boje bzw. „keine Boje / ganzer Parcours“ (→ Disq.-Feld), dann der Buchstabe. Der
 *   Buchstabe steht NEBEN den Punkten der Boje (BZ1, „5, G“; mehrere seit R7-14 22.11.2026); nach der Wahl an einer Boje zeigt die Mitte wieder die Bojen.
 * - **Pad** (W5.1, Plan docs/plan-wkr-w5.md §4, 22.11.2026): Die Mitte (was getippt wird) steht in WkrMitte.vue. WkrGeraet
 *   gibt die Anordnung (wkr/anordnung.ts): `seite` rechts/unten = eigene Seitenspalte WkrSeite (Schlange, Zuletzt als
 *   Liste, Einträge im Klartext, Zeichnung – PD3/PD6), `kompakt` = Schlange und Einträge unter der Arbeitsfläche; Fuß
 *   über die volle Breite der Maske. `stegTeil`: Spalte eines Geräts für den ganzen Steg (Ablegen bzw. Anlegen fest, ohne
 *   Steg-Reiter; der Abschluss bleibt der ganzen Liste und steht nur in der Ablegen-Spalte). `ohneLauf`: der Lauf steht im
 *   gemeinsamen Rundenband über Racecourse A und B (PD4). Attempt-Wechsel bei derselben Nummer (PD5): Band „23 ·
 *   ATTEMPT 2“ invers über der Karte, attemptSperreMs lang nimmt die Maske nichts an. `masken` reicht die Maskenwahl
 *   (F14) an „Mehr“, Ereignis `maske` geht an WkrGeraet.
 * - **Zeit** (W5.4, Plan docs/plan-wkr-w5.md §7, 22.11.2026, ZT1–ZT4): Art `zeit` bzw. Bojen mit Zeit-Abschnitt (WkrMitte
 *   → WkrZeiten). Der Hauptknopf bleibt gesperrt, bis jedes Zeitfeld eine lesbare Zeit oder „keine Zeit“ hat
 *   (wkr/maske.ts fertig); die Zeile trägt dann `kz` (immer, auch leer – sie ersetzt ein älteres Kennzeichen). Die
 *   Korrektur holt „keine Zeit“ aus dem eigenen Stand (quelle.keineZeit), „Zuletzt“ zeigt die Zeiten als Uhr.
 * - **Tabelle** (W5.5, Plan docs/plan-wkr-w5.md §8, 22.11.2026, TB1–TB5): Mit wirksamer Maske `text` zeigt WkrMitte
 *   WkrTabelle (Spalten aus wkr/tabelle.ts tabellenSpalten, letzte gesendete Zeilen, nächste Starts). Die Tabelle gibt
 *   ihren Entwurf hinauf (gemerkt wie jeder Tipp), Enter in der letzten Zelle ruft `haupt` – derselbe Takt, dasselbe
 *   Overlay; „Korrigieren“ an einer Zeile = oeffneKorrektur wie aus „Zuletzt“. Zellen mit Fehler sperren den
 *   Hauptknopf (WkrFuss `zellenFehler`); DISQ entfällt dort (Buchstaben stehen in der Zelle).
 * - **Übung, Nutzer 26.11.2026** (WKR_ANNAHMEN UK7, UK2, UK5; ersetzt UK1/UK3 vom 24.11.2026, R11-14): Nach dem
 *   Abschicken rollt nur die Übungs-Erklärung oben hinaus, der Kopf bleibt und steht am Rand (erklaerungAusDemBild:
 *   Spalte der Maske an den Rand), noch einmal, sobald die nächste Karte steht (UK5) – nur in der Übung, nicht auf
 *   dem Pad mit mehreren Spalten.
 * - **Lage des Bilds, Nutzer 24.11.2026** (BL1–BL6): „Mehr → Ansicht“ zeigt beim Bild statt der Bojen-Folge die Lage
 *   (Automatisch / Start/Ziel links/oben/rechts/unten seit 26.11.2026, R11-13, BL7 – vorher „Steg …“; Parallelslalom
 *   „Start …“), je Liste gemerkt wie die Bojen-Folge
 *   (`bildLagen`); die Ortswahl der Disq. folgt beim Bild der Vorgabe-Folge (BL6).
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
  /** Bojen-Folge je Liste (ablage.ts GeraetAnsicht.bojenFolge) – nur zum Lesen; Änderungen gehen als `ansicht` hinauf. */
  bojenFolgen?: Record<string, BojenFolge>
  /** Lage des Bilds je Liste (ablage.ts GeraetAnsicht.bildLage, Nutzer 24.11.2026, BL3) – wie `bojenFolgen` nur zum Lesen. */
  bildLagen?: Record<string, BildLage>
  /** Pad (W5.1): eigene Seitenspalte rechts/unten bzw. kompakt unter der Arbeitsfläche; fehlt = Handy. */
  seite?: 'rechts' | 'unten' | 'kompakt' | null
  /** Pad, ganzer Steg (W5.1): dieser Teil als eigene Spalte. */
  stegTeil?: ListenTeil
  /** Der Lauf steht im gemeinsamen Rundenband (PD4) – nicht noch einmal im Kopf. */
  ohneLauf?: boolean
  /** Maskenwahl (F14, W5.1) für „Mehr → Ansicht → Maske“; die gezeigte Maske ist `masken.wirksam`. */
  masken?: { erlaubt: MaskenWahl[]; wirksam: MaskenWahl; fest: boolean } | null
}>()
const emit = defineEmits<{ ansicht: [aenderung: Partial<GeraetAnsicht>]; probe: []; name: [name: string]; uebungEnde: []; maske: [maske: MaskenWahl] }>()
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
const teil = computed<ListenTeil | undefined>(() => (geteilt.value ? (props.aufgabe.teil ?? props.stegTeil ?? stegWahl.value) : undefined))
/** Darf der WKR hier den Steg-Teil wechseln? Nicht am Teil-Gerät und nicht in einer Steg-Spalte des Pads (W5.1). */
const teilWaehlbar = computed(() => geteilt.value && !props.aufgabe.teil && !props.stegTeil)

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
const abgeschlossenIn = (t: ListenTeil | undefined): WkrPunkt[] => {
  const s = sicht.value
  if (!s) return []
  return t && s.teile ? s.teile[t].abgeschlossen : s.abgeschlossen
}

// --- Aufbau der Maske ---
const ersteKlasse = computed(() => (Object.entries(sicht.value?.klassen ?? {}).find(([, k]) => k?.felder)?.[0] ?? null) as ClassId | null)
function klasseVon(s: string, punkt: WkrPunkt | null): ClassId | null {
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
/**
 * Übung (Nutzer 22.11.2026, R7-45, Y4): die Klassen der Liste zum Vorziehen, Namen wie in der Maske (Klasse E unter
 * UIM „Dolphin“); nur, wenn die Quelle es kann (die echte Erfassung nie).
 */
const vorziehKlassen = computed(() =>
  props.quelle.uebung && props.quelle.zieheKlasseVor && sicht.value ? (Object.keys(sicht.value.klassen) as ClassId[]).map((id) => ({ id, titel: klassenTitel(id) })) : null,
)
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
  const e = zellen && b ? entwurfAus(zellen, b) : leererEntwurf()
  // „Rückgängig“ einer noch wartenden „Nicht gestartet“-Zeile (Prüfbefund 24.11.2026, NG5): holeZurueck legt ihre
  // Zellen ({Disq.: X}) als Entwurf zurück. Wo die Knöpfe kein X anbieten, gilt dieselbe Regel wie in der Korrektur –
  // der Start steht wieder ohne X da; der Entwurf im Ausgang zieht mit (leer = weg), sonst stünde X weiter in der
  // Entwurfsleiste und käme beim nächsten Laden wieder.
  const ohne = b ? ohneFremdesX(e, b, teil.value) : e
  if (ohne !== e && a && b) props.quelle.merkeEntwurf(liste.value, a.key, teil.value, entwurfZellen(ohne, b, teil.value))
  entwurf.value = ohne
}
watch(entwurfSchluessel, ladeEntwurf, { immediate: true })
// Die Klasse kommt erst mit der Sicht – dann den Entwurf noch einmal mit dem Aufbau lesen.
watch(() => aufbau.value?.art, ladeEntwurf)

function aendere(neu: Entwurf): void {
  entwurf.value = neu
  const a = aktuell.value
  const b = aufbau.value
  if (korrektur.value || !a || !b) return
  // Zeiten wie getippt, auch halb (W5.4) – der Entwurf ist nur gerätelokal (entwurfZellen, nie die Leitung).
  props.quelle.merkeEntwurf(liste.value, a.key, teil.value, entwurfZellen(neu, b, teil.value))
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
// PD5 (W5.1, 22.11.2026): Attempt-Wechsel bei derselben Startnummer – Band invers, eine Sperrsekunde (Watch unten).
const attemptBis = ref<number | null>(null)
const attemptText = ref('')
const attemptAktiv = computed(() => attemptBis.value !== null && jetzt.value < attemptBis.value)
// PD5 (W5.1): auch in der Sperrsekunde des Attempt-Wechsels (attemptBis, unten) nimmt die Maske nichts an.
const gesperrt = computed(() => takt.value !== 'frei' || attemptAktiv.value)
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
  if (neu !== 'sperre' || (alt !== 'gesendet' && alt !== 'uebernommen')) return
  blitze()
})
const rueckgaengig = computed(() => {
  const g = gesendet.value
  return g && jetzt.value - g.um < WKR_ANNAHMEN.rueckgaengigMs ? { z: g.z, sn: g.start.startNr } : null
})

// --- Was die Mitte zeigt: gesendet (Takt), Korrektur oder der aktuelle Start ---
const zeige = computed(() => {
  const g = gesendet.value
  if (g && imOverlay.value) return { start: g.start as Pick<SchlangenEintrag, 'key' | 'startNr' | 'titel' | 'boot' | 'geschaetzt' | 'vorab' | 'ausgleich'>, aufbau: g.aufbau, entwurf: g.entwurf, klasse: g.klasse }
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
/**
 * Ausgleichsgewicht auf der Karte (Nutzer 24.11.2026, WKR_ANNAHMEN AG3): nur im Teil „Ablegen“ – auch am Gerät für
 * den ganzen Steg im Reiter bzw. der Pad-Spalte „Ablegen“, in der Korrektur nach ihrem Teil –, nie im „Anlegen“. Den
 * Wert trägt nur die Sicht der Steg-Liste (`ListenStart.ausgleich`); hier wird nur entschieden, ob er erscheint.
 */
const kartenAusgleich = computed(() => {
  const z = zeige.value
  const t = korrektur.value?.teil ?? teil.value
  if (!z || (t !== undefined && t !== WKR_ANNAHMEN.ausgleichTeil)) return null
  return 'ausgleich' in z.start ? (z.start.ausgleich ?? null) : null
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

// --- Übung: Erklärung nach dem Abschicken aus dem Bild, der Kopf bleibt (Nutzer 26.11.2026, WKR_ANNAHMEN UK7, UK2, UK5) ---
// Steht hinter `zeige` und `ruhe`: Der Watch unten liest sie sofort beim Aufbau.
const maskeRef = ref<HTMLElement | null>(null)
/**
 * Nur in der Übung (die echte Maske rollt nie von selbst) und nicht auf dem Pad mit mehreren Spalten (`seite`
 * kompakt): Die Seite rollt dort für alle Spalten zugleich (UK2, bestätigt 26.11.2026, R11-30 (8)).
 */
const rolltErklaerungHinaus = computed(() => props.quelle.uebung && WKR_ANNAHMEN.uebungErklaerungAusDemBild && props.seite !== 'kompakt')
/**
 * Nach dem Abschicken rollt die Seite, bis die Spalte dieser Maske oben am Rand steht (UK7, Nutzer 26.11.2026): Die
 * Erklärung „So läuft die Übung“ geht oben hinaus, der KOPF der Maske („ÜBUNG“, Liste, Verbindung) steht am Rand,
 * darunter „Zuletzt“ mit „↩ Rückgängig“ und die Karte. Steht der Hinweis „Bildschirm kann ausgehen“, liegt er seit
 * 27.11.2026 unter der Erklärung und bleibt über dem Kopf stehen (systemModus.ts zielNachErklaerung, Prüfbefund).
 * Auf dem Pad mit einer Spalte stehen die Reiter der Listen und der Anfang der Seitenspalte in derselben Höhe – sie
 * bleiben ebenso zu sehen (wie UK4). Die Fläche „wird übertragen …“ liegt fest über allem und rollt nicht mit. Ohne Bewegung bei „Bewegung
 * reduzieren“ (systemModus.ts rolleAnDenRand). Ohne Spalte (Einbau ohne WkrGeraet) die Maske selbst.
 *
 * Vorher (UK1/UK3, 24.11.2026) rollte auch der Kopf hinaus – Nutzer 26.11.2026 (R11-14) auf die Frage, ob das auch am
 * Wettkampftag so sein soll (dort stehen im Kopf „Keine Bestätigung“ und „Bitte Nr. prüfen“): „Oh, dann besser wieder
 * raus damit. Ich dachte, es ist eine extra Zeile.“
 */
function erklaerungAusDemBild(): void {
  if (!rolltErklaerungHinaus.value) return
  rolleAnDenRand(zielNachErklaerung(maskeRef.value))
}
/**
 * UK5 (Prüfbefund 24.11.2026): Im Übungstakt kommt der nächste Start erst 2–6 s nach dem Abschicken (geraete/uebung.ts
 * UEBUNG_FOLGE_MS). Bis dahin steht statt Karte und Knöpfen nur „Kein Boot unterwegs.“ (WkrRuhe `leer`) – die
 * Seite würde kurz, der Browser rollte von selbst zurück nach oben, und mit der neuen Karte stünde die Erklärung
 * wieder da (gilt seit 26.11.2026 für UK7). Darum nach dem Abschicken: (a) ausrichten, sobald wieder eine Karte steht (nicht schon beim Ende
 * des Overlays – da kann sie noch fehlen), (b) bis dahin hält die Maske ihre Höhe vom Abschicken (min-height), damit
 * nichts zurückspringt. Beides endet mit dem ersten Ausrichten mit Karte; eine Korrektur dazwischen zählt nicht als
 * neue Karte. Die gehaltene Höhe gilt nur, solange die Maske Arbeit oder „leer“ zeigt (Pause usw. ohne Leerraum).
 */
const ausrichtenOffen = ref(false)
const halteHoehe = ref<number | null>(null)
function nachDemAbschicken(): void {
  if (!rolltErklaerungHinaus.value) return
  void nextTick(erklaerungAusDemBild)
  if (!WKR_ANNAHMEN.uebungKopfMitNaechsterKarte) return
  // Gemessen, solange Karte und Knöpfe noch stehen (vor dem Overlay-Ende); im Test-DOM 0 = nichts halten.
  const h = maskeRef.value?.offsetHeight ?? 0
  halteHoehe.value = h > 0 ? h : null
  ausrichtenOffen.value = true
}
/** Die Karte des nächsten Starts (nicht die gesendete unter dem Overlay, nicht die Korrektur) – sonst `null`. */
const naechsteKarte = computed(() => (!imOverlay.value && !korrektur.value && zeige.value ? zeige.value.start.key : null))
watch(naechsteKarte, (key) => {
  if (!key || !ausrichtenOffen.value) return
  ausrichtenOffen.value = false
  void nextTick(() => {
    erklaerungAusDemBild()
    halteHoehe.value = null
  })
})
const halteStil = computed(() => (halteHoehe.value !== null && (ruhe.value === null || ruhe.value === 'leer') ? { minHeight: `${halteHoehe.value}px` } : undefined))
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
// In einer Steg-Spalte des Pads (W5.1) nur die Zeilen dieses Teils – der andere hat seine eigene Spalte.
const zeilen = computed(() => props.quelle.zuletzt.value.filter((z) => z.liste === liste.value && (!props.stegTeil || !z.teil || z.teil === props.stegTeil)))
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
// „Nicht gestartet“ (24.11.2026) nennt zellenText selbst – X allein heißt „nicht gestartet (Disq. X)“.
const zeilenText = (z: ZuletztZeile) => zellenText(z.zellen, aufbauVon(klasseVon(z.s, z.punkt)), text, w('wkr.geraet.fehlerfreiText'), z.kz)

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
function titelVonPunkt(p: WkrPunkt): string {
  const bekannt = punktTitel.value[p]
  if (bekannt) return bekannt
  const [art, rest = ''] = p.split(':')
  return art === 'lauf' ? w('wkr.geraet.punkt.lauf', { n: rest }) : rest
}
/** Der eigene Teil für den Abschluss: der der Aufgabe – ein Gerät für den ganzen Steg schließt die ganze Liste. */
const abschlussTeil = computed(() => (geteilt.value ? props.aufgabe.teil : undefined))
const letzterEigenerPunkt = computed(() => zeilen.value.find((z) => z.punkt !== null)?.punkt ?? null)
const bandPunkt = computed<WkrPunkt | null>(() => {
  const p = letzterEigenerPunkt.value
  const s = sicht.value
  if (!p || !s || s.modus === 'papier') return null
  if (abgeschlossenIn(abschlussTeil.value).includes(p)) return null
  if (props.quelle.abschluesse.value.some((a) => a.liste === liste.value && a.punkt === p && a.stufe !== 'abgelehnt')) return null
  // Ganzer Steg auf dem Pad (W5.1): ein Band für die ganze Liste, in der Ablegen-Spalte.
  if (props.stegTeil === 'an') return null
  const ruht = s.punkt?.id === p && schlange.value.length === 0 && danach.value.length === 0
  return s.punkt?.id !== p || ruht ? p : null
})
const abschluss = ref<WkrPunkt | null>(null)
/** Nur noch über das Band (W3-40, AM10): „Mehr → Liste abschließen“ gibt es nicht mehr. */
function oeffneAbschluss(p: WkrPunkt | null): void {
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
    // Punkte auch bei Bojen (P14): dort steht die Summe der Berührungen und Codes.
    punkte: b && (b.art === 'katalog' || b.art === 'bojen') ? punkteVon(entwurfAus(z.zellen, b), b, abschlussTeil.value) : null,
  }
}
const listenSprache = computed(() => (sicht.value?.sprache === 'en' ? ('en' as const) : ('de' as const)))

// --- Bedienung ---
const disqOffen = ref(false)
/**
 * Lang gedrückte Boje (R7-21, 22.11.2026, LD1): WkrDisqOrt beginnt bei ihren Buchstaben. Gilt nur, solange die Wahl
 * offen ist – DISQ im Fuß öffnet danach wieder bei „Wo?“. Kein Prellschutz-Eintrag (LD4): ein Langdruck ist kein Tipp.
 */
const disqBojeStart = ref<MaskenBoje | null>(null)
watch(disqOffen, (offen) => {
  if (!offen) disqBojeStart.value = null
})
function oeffneDisqAnBoje(b: MaskenBoje): void {
  if (gesperrt.value || b.disq.length === 0) return
  disqBojeStart.value = b
  disqOffen.value = true
}
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

/** Letzter Tipp je Feld und Code (Zeitmarke) – nur für den Prellschutz CM8, nie im reinen wkr/maske.ts. */
const codeTipp = new Map<string, number>()
function tippeCode(feld: string, code: string): void {
  if (gesperrt.value || !aufbau.value) return
  // Prellschutz an „2. und 3. Versuch“ (CM8, Prüfbefund 24.11.2026): Dort führt der dritte Tipp zu Disq. D – ein
  // prellender Handschuh-Tipp gleich nach dem vorigen wird verworfen (wkr/maske.ts codeTippPrellt entscheidet).
  const um = Date.now()
  const schluessel = JSON.stringify([feld, code])
  const vorher = codeTipp.get(schluessel)
  codeTipp.set(schluessel, um)
  if (codeTippPrellt(aufbau.value, feld, code, vorher, um)) return
  // Höchstzahl je Code und Disq. danach (Nutzer 24.11.2026, CM3/CM4) entscheidet wkr/maske.ts tippe am Aufbau.
  aendere(tippe(entwurf.value, aufbau.value, feld, code))
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
  if (gesperrt.value || !teilWaehlbar.value) return
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
  const teile: (ListenTeil | undefined)[] = teilWaehlbar.value ? [teil.value, teil.value === 'an' ? 'ab' : 'an'] : [teil.value]
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
  // Tabelle (W5.5, TB3): Solange eine Zelle einen Fehler hat, geht nichts hinaus – weder über Enter noch den Hauptknopf.
  if (tabelle.value && tabellenFehler.value > 0) return
  hinweisUnbekannt.value = null
  if (korrektur.value) {
    if (aufbau.value && fertig(entwurf.value, aufbau.value)) frageKorrektur.value = true
    return
  }
  const a = aktuell.value
  const b = aufbau.value
  if (!a || !b) return
  // Zeit (W5.4, ZT3): erst, wenn jedes Zeitfeld fertig ist – der Knopf ist dann ohnehin gesperrt (Doppelsicherung).
  if (!fertig(entwurf.value, b)) return
  const z = props.quelle.schicke(liste.value, { s: a.key, zellen: zellenAus(entwurf.value, b, teil.value), ...kzVon(entwurf.value, b), ...(teil.value ? { teil: teil.value } : {}) })
  if (z === null) return
  const g: Gesendet = { um: Date.now(), z, start: a, entwurf: entwurf.value, aufbau: b, klasse: klassenTitel(a.klasse) }
  quittungUm.value = null
  gesendet.value = g
  gewaehlt.value = null
  disqOffen.value = false
  starteTakt(g)
  ladeEntwurf()
  // Übung (UK7, 26.11.2026): Erklärung aus dem Bild, solange das Overlay noch darüber liegt – und mit der nächsten Karte (UK5).
  nachDemAbschicken()
}

/**
 * „Nicht gestartet · Disq. X“ (Nutzer 24.11.2026, WKR_ANNAHMEN NG1) für den gezeigten Start: auf jeder Liste mit
 * eigenem Disq.-Feld (wkr/maske.ts nichtGestartetZellen – auch Steg-Anlegen, Vorsteg, Parallelslalom), nicht in der
 * Korrektur. Die Startnummer für die Rückfrage; sonst `null`. Ersetzt „Nicht vorbeigekommen“ (W4.3) und dessen J (GF10).
 */
const nichtGestartetNr = computed(() => {
  const a = aktuell.value
  const b = aufbau.value
  if (!a || korrektur.value || !b || !nichtGestartetZellen(b)) return null
  return a.startNr
})
function nichtGestartet(): void {
  if (gesperrt.value || !nichtGestartetNr.value) return
  hinweisUnbekannt.value = null
  const a = aktuell.value
  const b = aufbau.value
  const zellen = b ? nichtGestartetZellen(b) : null
  if (!a || !b || !zellen) return
  // Ein Entwurf dieses Starts ist damit hinfällig – eingetragen wird nur X (BZ2: X nie neben Punkten oder Buchstaben).
  props.quelle.verwirfEntwurf(liste.value, a.key, teil.value)
  // Die Zeile geht an zellenAus vorbei: Die Disq.-Knöpfe bieten X außerhalb von Steg-Ablegen und Vorsteg nicht an (NG3),
  // zellenAus ließe es also weg. Der Entwurf fürs Overlay trägt X wie ein Tipp.
  const e = tippeDisq(leererEntwurf(), NICHT_GESTARTET)
  const z = props.quelle.schicke(liste.value, { s: a.key, zellen, ...(teil.value ? { teil: teil.value } : {}) })
  if (z === null) return
  const g: Gesendet = { um: Date.now(), z, start: a, entwurf: e, aufbau: b, klasse: klassenTitel(a.klasse) }
  quittungUm.value = null
  gesendet.value = g
  gewaehlt.value = null
  disqOffen.value = false
  starteTakt(g)
  ladeEntwurf()
  nachDemAbschicken()
}

/** „Keine Zeit“ für die Zeile (W5.4): auf Listen mit Zeitfeldern immer (auch leer), sonst nichts. */
function kzVon(e: Entwurf, b: MaskenAufbau): { kz?: Record<string, KeineZeitGrund> } {
  return b.zeiten.length > 0 ? { kz: Object.fromEntries(keineZeitAus(e, b)) } : {}
}
function setzeZeitFeld(feld: string, t: string): void {
  if (gesperrt.value || !aufbau.value) return
  aendere(setzeZeit(entwurf.value, aufbau.value, feld, t))
}
function setzeKeineZeitFeld(feld: string, grund: KeineZeitGrund | null): void {
  if (gesperrt.value || !aufbau.value) return
  aendere(setzeKeineZeit(entwurf.value, aufbau.value, feld, grund))
}

function oeffneKorrektur(z: number): void {
  const k = props.quelle.zuletzt.value.find((x) => x.z === z)
  if (!k) return
  if (k.teil && teilWaehlbar.value) stegWahl.value = k.teil
  // Die Korrektur ist eine bewusste Wahl (oben, außerhalb der gesperrten Fläche): Sie beendet den Takt des letzten
  // Abschickens, sonst zeigte die Mitte noch den gesendeten Start.
  beendeTakt()
  hinweisUnbekannt.value = null
  korrektur.value = k
  disqOffen.value = false
  const b = aufbauVon(klasseVon(k.s, k.punkt))
  korrekturAlt.value = props.quelle.stand(k.z) ?? k.zellen
  korrekturKz.value = props.quelle.keineZeit(k.z)
  const e = b ? entwurfAus(korrekturAlt.value, b, korrekturKz.value) : leererEntwurf()
  // „Doch gestartet“ (24.11.2026, WKR_ANNAHMEN NG5): Wo die Knöpfe kein X anbieten (alles außer Steg-Ablegen und
  // Vorsteg), beginnt die Korrektur ohne X – sonst stünde es im Fuß, ließe sich nicht abwählen, und zellenAus ließe es
  // beim Abschicken doch weg. Abschicken (auch „fehlerfrei“) nimmt das X am Bedienrechner heraus; „alt → neu“ zeigt es.
  entwurf.value = b ? ohneFremdesX(e, b, k.teil ?? teil.value) : e
}
function brichKorrekturAb(): void {
  korrektur.value = null
  frageKorrektur.value = false
  ladeEntwurf()
}
const korrekturNeu = computed(() => (korrektur.value && aufbau.value ? zellenAus(entwurf.value, aufbau.value, korrektur.value.teil) : {}))
/** „Keine Zeit“ vor (aus dem eigenen Stand) und nach der Korrektur (W5.4) – für „alt → neu“ und die Zeile. */
const korrekturKz = shallowRef<Record<string, KeineZeitGrund>>({})
const korrekturKzNeu = computed(() => (aufbau.value ? Object.fromEntries(keineZeitAus(entwurf.value, aufbau.value)) : {}))
function korrekturJa(): void {
  const k = korrektur.value
  frageKorrektur.value = false
  if (!k || !aufbau.value) return
  props.quelle.korrigiere(k.z, korrekturNeu.value, aufbau.value.zeiten.length > 0 ? korrekturKzNeu.value : undefined)
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
  if (r.teil && teilWaehlbar.value) stegWahl.value = r.teil
  korrektur.value = null
  gewaehlt.value = r.s
  ladeEntwurf()
}
function oeffneEntwurf(e: EntwurfEintrag): void {
  if (e.teil && teilWaehlbar.value) stegWahl.value = e.teil
  if ([...schlangeVon(e.teil), ...danach.value].some((x) => x.key === e.s)) waehle(e.s)
}

const art = computed(() => {
  const a = zeige.value?.aufbau.art
  return a === 'vorsteg' || a === 'bojen' || a === 'zeit' ? a : 'katalog'
})

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
// --- PD5 (W5.1, 22.11.2026): Attempt-Wechsel bei derselben Startnummer – Band invers, eine Sperrsekunde ---
let zuletztGezeigt: { key: string; startNr: string } | null = null
watch(
  () => (zeige.value && !imOverlay.value && !korrektur.value ? { key: zeige.value.start.key, startNr: zeige.value.start.startNr } : null),
  (z) => {
    if (!z) return
    const n = attemptWechsel(zuletztGezeigt, z)
    if (n !== null) {
      const um = Date.now()
      jetzt.value = um
      attemptBis.value = um + WKR_ANNAHMEN.attemptSperreMs
      attemptText.value = w('wkr.geraet.attempt', { nr: z.startNr, n })
      nach(WKR_ANNAHMEN.attemptSperreMs, tick)
    }
    zuletztGezeigt = z
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

// --- Bojen-Folge dieser Liste (22.11.2026): gemerkt in WkrGeraet, hier nur gelesen und geändert ---
const bojenFolge = computed<BojenFolge>(() => props.bojenFolgen?.[liste.value] ?? BOJEN_FOLGE_VORGABE)
function aendereBojenFolge(neu: BojenFolge): void {
  // Die geänderte Liste kommt ans Ende (Prüfbefund 21.11.2026): Die Ablage behält die letzten BOJEN_FOLGE_MAX in
  // Einfüge-Reihenfolge – so fällt die am längsten nicht geänderte heraus, nicht die zuerst angelegte.
  const rest = { ...(props.bojenFolgen ?? {}) }
  delete rest[liste.value]
  emit('ansicht', { bojenFolge: { ...rest, [liste.value]: neu } })
}

// --- Lage des Bilds dieser Liste (Nutzer 24.11.2026, WKR_ANNAHMEN BL1–BL3): gemerkt in WkrGeraet wie die Bojen-Folge ---
const bildLage = computed<BildLage | null>(() => props.bildLagen?.[liste.value] ?? null)
/** Wie die Zeichnung gerade liegt (WkrBild meldet die wirksame Drehung) – „Mehr“ zeigt das ohne eigene Wahl. */
const bildDrehungJetzt = ref(0)
function aendereBildLage(neu: BildLage | null): void {
  // Wie bei der Bojen-Folge rückt die geänderte Liste ans Ende (ablage.ts behält die letzten BOJEN_FOLGE_MAX).
  const rest = { ...(props.bildLagen ?? {}) }
  delete rest[liste.value]
  // „Automatisch“ (`null`, Prüfbefund 24.11.2026, BL1): Eintrag der Liste weg = keine Wahl; ohne Eintrag fällt die Map.
  const lagen = neu === null ? rest : { ...rest, [liste.value]: neu }
  emit('ansicht', { bildLage: Object.keys(lagen).length > 0 ? lagen : undefined })
}
const sichtbareTeile = computed(() => (zeige.value ? teileFuer(zeige.value.aufbau, teil.value) : []))

// --- Seitenspalte auf dem Pad (W5.1, PD3/PD6) ---
/** Eigene Seitenspalte (rechts/unten) – dort steht die Zeichnung statt unter den Knöpfen (PD6). */
const eigeneSeite = computed(() => props.seite === 'rechts' || props.seite === 'unten')
const seiteNaechste = computed(() => schlange.value.filter((x) => x.key !== aktuell.value?.key && !x.entfaellt).slice(0, WKR_ANNAHMEN.seiteSchlange))
const seiteEintraege = computed(() => {
  const z = zeige.value
  if (!z) return null
  return zellenText(zellenAus(z.entwurf, z.aufbau, korrektur.value?.teil ?? teil.value), z.aufbau, text, w('wkr.geraet.fehlerfreiText'), Object.fromEntries(keineZeitAus(z.entwurf, z.aufbau)))
})
const seitePunkte = computed(() => (zeige.value && art.value !== 'vorsteg' && art.value !== 'zeit' ? punkteVon(zeige.value.entwurf, zeige.value.aufbau, teil.value) : null))
// --- Maske „Bild“ (W5.2, 22.11.2026, Plan docs/plan-wkr-w5.md §5) ---
/**
 * Zuordnung des Bilds der Klasse des gezeigten Starts, nur bei wirksamer Maske „Bild“ auf einer Bojen-Liste; `null`
 * (BD2: Boje ohne ID, Zeichnung fehlt) → WkrMitte zeigt die Bojen-Knöpfe. Die Zeichnung steht dann nicht noch einmal
 * unter den Knöpfen bzw. in der Seite (PD6).
 */
const bildZuordnungJetzt = computed(() =>
  props.masken?.wirksam === 'bild' && sicht.value && klasse.value && art.value === 'bojen'
    ? bildTreffer(sicht.value, klasse.value as ClassId, parcoursSvg, props.spracheWahl)
    : null,
)
/**
 * Prüfbefund 24.11.2026 (WKR_ANNAHMEN BL6, bestätigt 26.11.2026, R11-30 (5)): Die Bojen-Folge wirkt nur, wo sie unter „Mehr“ auch
 * wählbar ist (BL1). Beim Bild öffnet DISQ im Fuß weiter die Liste „Disq. – an welcher Boje?“ (WkrDisqOrt, BD7) – die
 * steht dort immer in der Vorgabe „Rückweg gedreht“, nie in einer Folge, die der WKR früher bei den Knöpfen gewählt
 * hat und beim Bild weder sieht noch ändern kann. Bei den Knöpfen gilt die Wahl wie bisher für Knöpfe und Ortswahl.
 */
const bojenFolgeWirksam = computed<BojenFolge>(() => (bildZuordnungJetzt.value ? BOJEN_FOLGE_VORGABE : bojenFolge.value))
/** Beim Bild stehen die Einträge im Klartext immer daneben (Pflicht, Plan §5.2) – auf dem Handy kompakt darunter. */
// --- Tabelle für Geübte (W5.5, Plan docs/plan-wkr-w5.md §8, 22.11.2026, TB1–TB5) ---
/** Zellen der aktiven Tabellen-Zeile mit Fehler (WkrTabelle meldet sie) – sperrt den Hauptknopf. */
const tabellenFehler = ref(0)
const tabelle = computed(() => {
  if (props.masken?.wirksam !== 'text' || !sicht.value || !klasse.value || !aufbau.value || art.value === 'zeit') return null
  const t = korrektur.value?.teil ?? teil.value
  const n = WKR_ANNAHMEN.tabelleZeilen
  // Gesendet: die letzten eigenen Zeilen dieses Teils, älteste oben (wie ein Bogen); Werte aus dem eigenen Stand (M2).
  const gesendet = zeilen.value
    .filter((z) => !t || !z.teil || z.teil === t)
    .slice(0, n.gesendet)
    .reverse()
    .map((z) => ({ z: z.z, sn: z.sn ?? '?', zellen: props.quelle.stand(z.z) ?? z.zellen, stufe: z.stufe, ...(z.kz ? { kz: z.kz } : {}) }))
  // In der Korrektur steht der aktuelle Start unter den nächsten – er wartet, bis die Korrektur durch ist.
  const naechste = [...(korrektur.value && aktuell.value ? [aktuell.value] : []), ...schlange.value.filter((x) => x.key !== aktuell.value?.key && !x.entfaellt)]
    .slice(0, n.naechste)
    .map((x) => ({ key: x.key, startNr: x.startNr, klasse: klassenTitel(x.klasse) }))
  return { spalten: tabellenSpalten(sicht.value, klasse.value, aufbau.value, t, props.spracheWahl), ...(t ? { teil: t } : {}), gesendet, korrektur: korrektur.value?.z ?? null, naechste }
})
function tabellenEntwurf(e: Entwurf): void {
  if (gesperrt.value) return
  aendere(e)
}
const seiteWirksam = computed(() => props.seite ?? (bildZuordnungJetzt.value ? ('kompakt' as const) : null))
/**
 * „Mehr → Ansicht“ (Nutzer 24.11.2026: „Die Einstellungen mit Bojen … machen keinen Sinn, wenn man Bild ausgewählt hat.
 * Dafür braucht Bild die Auswahl von den 4 Parcours-Himmelsrichtungen.“, WKR_ANNAHMEN BL1): die Bojen-Folge nur, wenn
 * die Bojen-Knöpfe zu sehen sind – nicht beim Bild und nicht bei der Tabelle; beim Bild statt ihrer die Lage. Ein Bild
 * ohne vollständige Zuordnung zeigt die Knöpfe (BD2) und damit wieder die Bojen-Folge; das Schema (Rückfall ohne
 * Parallel.svg) dreht nicht und hat keine Lage. Benannt nach Start/Ziel (Nutzer 26.11.2026, R11-13, BL7: „Steg ist hier
 * irreführend“) – `art` wählt nur die Texte: Klassen „Start/Ziel …“ mit Tor 5, Parallelslalom „Start …“ mit Boje 5.
 */
const mehrBojenFolge = computed(() => (art.value === 'bojen' && !bildZuordnungJetzt.value && !tabelle.value ? bojenFolge.value : null))
const mehrBildLage = computed(() => {
  const z = bildZuordnungJetzt.value
  if (!z || z.art !== 'svg') return null
  return { art: z.racecourse ? ('parallel' as const) : ('klasse' as const), wahl: bildLage.value, wirksam: bildDrehungJetzt.value }
})
/** „Andere Startnummer …“ aus der Seitenspalte: dieselbe Suche wie unter der Karte. */
function sucheAusSeite(): void {
  ausweichen.value?.oeffne('')
}
/** Fuß nur mit einem Start zum Tippen – außerhalb der Arbeitsfläche, damit er auf dem Pad über die volle Breite geht. */
const zeigeUnten = computed(() => !abschluss.value && !ruhe.value && !!zeige.value)
</script>

<template>
  <div
    ref="maskeRef"
    class="wkr-maske"
    :class="{ 'wkr-maske--bojen': art === 'bojen' }"
    :style="halteStil"
    data-teil="maske"
    :data-liste="liste"
    :data-takt="takt"
    :data-gesperrt="gesperrt || undefined"
    :data-steg="teil"
    :data-seite="seite || undefined"
    :data-maske="masken?.wirksam"
  >
    <!-- W5.1: Arbeitsfläche; auf dem Pad daneben bzw. darunter WkrSeite, darunter der Fuß über die volle Breite. -->
    <div class="wkr-maske-haupt">
      <WkrKopf
        v-if="sicht"
        :titel="kopfTitel.titel"
        :bereich="kopfTitel.bereich"
        :lauf="ohneLauf ? null : (zeige?.start.titel ?? sicht.punkt?.titel ?? null)"
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
        <WkrStegReiter v-if="geteilt && teil" :teil="teil" :fest="!teilWaehlbar" :stand="stegStand" @waehle="waehleTeil" />

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
            <!-- PD5 (W5.1): Attempt-Wechsel bei derselben Nummer – invers über der Karte, solange die Sperrsekunde läuft. -->
            <p v-if="attemptAktiv" class="wkr-band wkr-attempt" role="status" data-teil="attempt-wechsel">
              <b>{{ attemptText }}</b>
            </p>
            <WkrStarterKarte :start="zeige.start" :klasse="zeige.klasse" :ausser-der-reihe="ausserDerReihe" :gesendet="imOverlay" :korrektur="korrekturArt" :ampel="kartenAmpel" :ausgleich="kartenAusgleich" />
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
            <!-- W5.1: was getippt wird, wählt WkrMitte (Vorsteg, Disq., Bojen, Knöpfe, Bild W5.2, Zeit W5.4, Tabelle W5.5). -->
            <WkrMitte
              :art="art"
              :schluessel="`${zeige.start.key}|${teil ?? ''}|${korrektur?.z ?? ''}`"
              :aufbau="zeige.aufbau"
              :entwurf="zeige.entwurf"
              :start-nr="zeige.start.startNr"
              :disq-offen="disqOffen"
              :disq-boje="disqBojeStart"
              :disq-codes="disqCodes"
              :gesperrt="gesperrt"
              :weg="weg"
              :bojen-folge="bojenFolgeWirksam"
              :sichtbare-teile="sichtbareTeile"
              :maske="masken?.wirksam"
              :bild="bildZuordnungJetzt"
              :bild-lage="bildLage"
              :klasse="zeige.aufbau.titel"
              :pad="!!seite"
              :tabelle="tabelle"
              @entwurf="tabellenEntwurf"
              @tabellen-fehler="(n) => (tabellenFehler = n)"
              @abschicken="haupt"
              @korrigiere="oeffneKorrektur"
              @korrektur-abbrechen="brichKorrekturAb"
              @setze-disq="setzeDisq"
              @boje-disq="setzeBojenDisq"
              @disq-fertig="disqOffen = false"
              @boje="tippeBojeKnopf"
              @disq="disqOffen = true"
              @disq-an-boje="oeffneDisqAnBoje"
              @tippe="tippeCode"
              @weg="waehleWeg"
              @zeit="setzeZeitFeld"
              @keine-zeit="setzeKeineZeitFeld"
              @bild-drehung="(d) => (bildDrehungJetzt = d)"
            />
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
              :nicht-gestartet="nichtGestartetNr"
              :bojen-folge="mehrBojenFolge"
              :bild-lage="mehrBildLage"
              :wkr-name="wkrNameLage"
              :masken="masken ?? null"
              :vorziehen="vorziehKlassen"
              :nachweis="!!parcoursBild || !!bildZuordnungJetzt"
              @vorziehen="(k) => quelle.zieheKlasseVor?.(liste, k)"
              @wkr-name="(n) => quelle.setzeWkrName(liste, n)"
              @maske="(m) => emit('maske', m)"
              @bojen-folge="aendereBojenFolge"
              @bild-lage="aendereBildLage"
              @nicht-gestartet="nichtGestartet"
              @bemerkung="bemerkung"
              @pausiere="quelle.pausiere(liste)"
              @melde-ab="quelle.meldeAb(liste)"
              @weiter="quelle.weiter(liste)"
              @probe="emit('probe')"
              @ansicht="(a) => emit('ansicht', a)"
              @uebung-ende="emit('uebungEnde')"
            />
            <!-- W4-13 (21.11.2026, GF9): Parcours-Zeichnung der Klasse unter den Knöpfen – beim Hochwischen erreichbar;
                 mit eigener Seitenspalte auf dem Pad steht sie dort (PD6, W5.1). -->
            <WkrParcoursBild v-if="parcoursBild && !eigeneSeite && !bildZuordnungJetzt" :bild="parcoursBild" :klasse="zeige.klasse" />
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
          :vorziehen="vorziehKlassen"
          :nachweis="!!parcoursBild || !!bildZuordnungJetzt"
          @vorziehen="(k) => quelle.zieheKlasseVor?.(liste, k)"
          @wkr-name="(n) => quelle.setzeWkrName(liste, n)"
          @pausiere="quelle.pausiere(liste)"
          @melde-ab="quelle.meldeAb(liste)"
          @weiter="quelle.weiter(liste)"
          @probe="emit('probe')"
          @ansicht="(a) => emit('ansicht', a)"
          @uebung-ende="emit('uebungEnde')"
        />
      </template>
    </div>

    <WkrSeite
      v-if="seiteWirksam && zeigeUnten && zeige"
      :aktuell="korrektur ? null : aktuell"
      :aktuell-klasse="zeige.klasse"
      :naechste="seiteNaechste"
      :klasse-von="(e) => klassenTitel(e.klasse)"
      :zeilen="zeilen"
      :text="zeilenText"
      :eintraege="seiteEintraege"
      :punkte="seitePunkte"
      :kompakt="seiteWirksam === 'kompakt'"
      :bild="eigeneSeite && !bildZuordnungJetzt ? parcoursBild : null"
      :gesperrt="gesperrt"
      @waehle="waehle"
      @suche="sucheAusSeite"
      @korrigiere="oeffneKorrektur"
    />
    <div v-if="zeigeUnten && zeige" class="wkr-unten" :inert="gesperrt">
      <WkrFuss
        :art="art"
        :teil="teil"
        :eintraege="eintraege(zeige.entwurf)"
        :punkte="punkteVon(zeige.entwurf, zeige.aufbau, teil)"
        :disq="fussDisq"
        :korrektur="korrekturArt"
        :hand="hand"
        :mit-disq="!tabelle && (disqCodes.length > 0 || mitBojenDisq)"
        :disq-offen="disqOffen"
        :zeiten-offen="zeitenOffen(zeige.entwurf, zeige.aufbau)"
        :mit-zeit="zeige.aufbau.zeiten.length > 0"
        :zellen-fehler="tabelle ? tabellenFehler : 0"
        @zurueck="zurueckTipp"
        @disq="disqOffen = !disqOffen"
        @haupt="haupt"
      />
    </div>

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
      <p class="wkr-korrektur-alt" data-teil="alt">
        {{ zellenText(korrekturAlt, aufbau, text, w('wkr.geraet.fehlerfreiText'), korrekturKz) }}
      </p>
      <p class="wkr-korrektur-pfeil" aria-hidden="true">↓</p>
      <p class="wkr-korrektur-neu" data-teil="neu">{{ zellenText(korrekturNeu, aufbau, text, w('wkr.geraet.fehlerfreiText'), korrekturKzNeu) }}</p>
      <template #knoepfe>
        <button type="button" class="wkr-knopf wkr-knopf--haupt" data-ziel="gross" data-action="korrektur-ja" @click="korrekturJa">
          {{ w(korrekturArt === 'vorschlag' ? 'wkr.geraet.korrektur.vorschlag' : 'wkr.geraet.korrektur.abschicken') }}
        </button>
        <button type="button" class="wkr-knopf" data-ziel="gross" data-action="korrektur-nein" autofocus @click="frageKorrektur = false">{{ w('wkr.geraet.abbrechen') }}</button>
      </template>
    </AppDialog>
  </div>
</template>
