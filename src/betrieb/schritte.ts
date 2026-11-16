import type { ClassId, PunktId, TrackItem, VerschiebeZiel } from '../types'
import type { BereichLage, FolgeEintrag } from './folge'
import { buildSequenceSteps, trackOfClass } from '../planung/verzahnung'
import { BETRIEB_ANNAHMEN } from './annahmen'

// Die Schritte des Betriebs auf der Folge eines Bereichs – rein, ohne Stand und ohne Store. Vorbild ist
// die Startliste des Tafel-Prototyps (lib/startlist.ts: showSlot, deferSlot/reactivateSlot,
// moveSlotToAnchor, reinterleaveOpen, moveClassBefore, startAt), hier NEU geschrieben auf die
// abgeleitete Folge von alcatraz (Plan vom 16.11.2026, §3, Etappe E2):
//
// - Die Folge wird nie gespeichert, sondern aus der Verzahnung abgeleitet (betrieb/folge.ts). Weicht die
//   Bedienung davon ab (vorziehen, verschieben, Klasse aussetzen …), steht im Betrieb ein SCHNAPPSCHUSS
//   der umgestellten Punkte als Kennungen (`reihenfolge`). Der ABGLEICH legt ihn über die abgeleitete Folge:
//   Was es noch gibt, behält seine Stelle; Nachmeldungen, neue Läufe und Punkte, die der Betrieb nicht
//   umgestellt hat, kommen aus der abgeleiteten Folge hinzu, Entfernte fallen weg.
// - Der ZEIGER ist die späteste Stelle eines erledigten Starts (gezeigt oder „ohne Anzeige“) eines
//   begonnenen Punkts. Vor ihn rückt kein Schritt einen Start.
// - Die Folge zerfällt in BLÖCKE, je Punkt einen, in der Folge des Programms (`bloecke`). Abgeleitet ist jeder
//   Block genau sein Punkt; umgestellt kann ein Start im Block eines anderen Punkts stehen (eingereiht,
//   verschoben, gezielt gezeigt). Neu verzahnt und mit der Spur verschoben wird nur innerhalb eines Blocks –
//   die Läufe vermischen sich nie, und was die Bedienung bewusst woanders hingesetzt hat, bleibt dort.
// - Die Funktionen hier liefern die neue Folge als Kennungen; der Reducer (state/reducer/betrieb.ts) macht
//   daraus mit `schnappschuss` den neuen Stand. Gleich der abgeleiteten Folge ⇒ kein Schnappschuss (`null`).
//
// Die Verzahnung selbst und die WKR-Bögen ändern sich dadurch nie: Der Betrieb ändert nur seine eigene Folge.

// --- Blöcke -------------------------------------------------------------------------------------

/** Was Abgleich, Blöcke und Zeiger von einem Eintrag der Folge brauchen. */
interface MitKennung {
  key: string
  punkt: PunktId
}

/**
 * Die Blöcke einer Folge: je Stelle der Rang (im Programm) des Punkts, zu dessen Block sie gehört; `raenge`
 * sind die Ränge der Punkte der Starts an diesen Stellen, `anzahl` die Zahl der Punkte. Die Blöcke folgen dem
 * Programm (ihr Rang fällt nie) und decken sich mit möglichst vielen Starts ihres eigenen Punkts – wer dann
 * nicht im Block seines Punkts steht, ist dort zu Gast. Bei Gleichstand der frühere Block: Ein Gast an der
 * Grenze zweier Blöcke (ein Lauf-1-Start „ans Ende von Lauf 2“) gehört zu dem, hinter den er gesetzt wurde.
 *
 * Gerechnet von hinten (höchste Zahl der Treffer ab Stelle i mit Rang mindestens j), dann von vorn mit dem
 * kleinsten Rang, der das Beste noch erreicht – O(Stellen × Punkte), bei drei Läufen also linear.
 */
export function bloecke(raenge: readonly number[], anzahl: number): number[] {
  const n = raenge.length
  if (anzahl <= 1) return raenge.map(() => 0)
  const g: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(anzahl + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = anzahl - 1; j >= 0; j--) g[i][j] = Math.max(g[i][j + 1], (raenge[i] === j ? 1 : 0) + g[i + 1][j])
  }
  const out: number[] = []
  let rang = 0
  for (let i = 0; i < n; i++) {
    const ziel = g[i][rang]
    let j = rang
    while (j < anzahl - 1 && (raenge[i] === j ? 1 : 0) + g[i + 1][j] !== ziel) j++
    out.push(j)
    rang = j
  }
  return out
}

/** Die Blöcke einer Folge nach dem Programm des Bereichs (unbekannter Punkt: Rang 0). */
export function bloeckeIn(folge: readonly MitKennung[], programm: readonly PunktId[]): number[] {
  const rang = new Map(programm.map((p, i) => [p, i]))
  return bloecke(
    folge.map((e) => rang.get(e.punkt) ?? 0),
    programm.length,
  )
}

/** Die Stelle hinter dem Block mit Rang `rang` (bzw. dort, wo er stünde, wenn er leer ist): vor den ersten späteren Block. */
function hinterBlock(block: readonly number[], rang: number): number {
  const i = block.findIndex((b) => b > rang)
  return i < 0 ? block.length : i
}

/** Die Stelle, an der der Block mit Rang `rang` beginnt (bzw. stünde). */
function vorBlock(block: readonly number[], rang: number): number {
  const i = block.findIndex((b) => b >= rang)
  return i < 0 ? block.length : i
}

// --- Abgleich, Schnappschuss, Zeiger ------------------------------------------------------------

/**
 * Der Schnappschuss über der abgeleiteten Folge (Abgleich): Kennungen des Schnappschusses, die es noch
 * gibt, behalten ihre Folge. Entfernte (Starter gelöscht, Lauf entfallen) fallen heraus; `gezeigt` bleibt
 * davon unberührt.
 *
 * Neue – Nachmeldung, neuer Lauf und alle Starts der Punkte, die der Schnappschuss nicht trägt (unumgestellt)
 * – kommen in den Block ihres Punkts, hinter ihren Vorgänger desselben Punkts aus der abgeleiteten Folge,
 * genauer: hinter den ihrer Vorgänger IN DIESEM BLOCK, der jetzt am weitesten hinten steht. Ohne Umstellung
 * ist das der nächste; ist er aber vorgezogen worden (gezielt gezeigt, B-5), stünde eine Nachmeldung hinter
 * ihm sofort als Nächste da, obwohl ihre Stelle in der Verzahnung noch gar nicht dran ist. Ein Vorgänger,
 * der als Gast in einem anderen Block steht, zieht keinen nach. Ohne Vorgänger an den Anfang des Blocks;
 * gibt es den noch nicht (ein Lauf mehr, ein unumgestellter Punkt), dorthin, wo er nach dem Programm stünde.
 */
export function abgleich<E extends MitKennung>(abgeleitet: readonly E[], reihenfolge: readonly string[] | null): E[] {
  if (reihenfolge === null) return [...abgeleitet]
  const nachKey = new Map(abgeleitet.map((e) => [e.key, e]))
  const ergebnis: E[] = []
  const drin = new Set<string>()
  for (const k of reihenfolge) {
    const e = nachKey.get(k)
    if (e && !drin.has(k)) {
      ergebnis.push(e)
      drin.add(k)
    }
  }
  if (ergebnis.length === abgeleitet.length) return ergebnis
  // Die abgeleitete Folge steht in der Folge des Programms: Daraus der Rang jedes Punkts.
  const rang = new Map<PunktId, number>()
  for (const e of abgeleitet) if (!rang.has(e.punkt)) rang.set(e.punkt, rang.size)
  const rangVon = (e: MitKennung) => rang.get(e.punkt) ?? 0
  const block = bloecke(ergebnis.map(rangVon), rang.size)
  let stelle = new Map(ergebnis.map((e, i) => [e.key, i]))
  // Je Punkt der Vorgänger im eigenen Block, der am weitesten hinten steht – in der abgeleiteten Folge
  // gehen alle früheren voran, ob aus dem Schnappschuss oder eben eingefügt.
  const letzter = new Map<PunktId, string>()
  for (const e of abgeleitet) {
    const r = rangVon(e)
    if (drin.has(e.key)) {
      const i = stelle.get(e.key)!
      const bisher = letzter.get(e.punkt)
      if (block[i] === r && (bisher === undefined || stelle.get(bisher)! < i)) letzter.set(e.punkt, e.key)
      continue
    }
    const vor = letzter.get(e.punkt)
    const at = vor !== undefined ? stelle.get(vor)! + 1 : vorBlock(block, r)
    ergebnis.splice(at, 0, e)
    block.splice(at, 0, r)
    drin.add(e.key)
    letzter.set(e.punkt, e.key)
    stelle = new Map(ergebnis.map((x, i) => [x.key, i]))
  }
  return ergebnis
}

/**
 * Der Schnappschuss einer Folge (Kennungen): `null`, wenn sie der abgeleiteten gleicht – dann ist nichts
 * abgewichen. Sonst trägt er nur, was umgestellt ist: Die Starts eines Punkts, die in ihrem Block genau wie
 * abgeleitet stehen, bleiben weg, wenn der Abgleich sie an dieselbe Stelle zurücklegt
 * (BETRIEB_ANNAHMEN.unberuehrtePunkteFolgenVerzahnung). So folgen Läufe, die der Betrieb nicht angefasst hat,
 * einer später geänderten und wieder festgeschriebenen Verzahnung – wie die WKR-Bögen.
 */
export function schnappschuss(keys: readonly string[], abgeleitet: readonly MitKennung[]): string[] | null {
  const gleich = keys.length === abgeleitet.length && keys.every((k, i) => k === abgeleitet[i].key)
  if (gleich) return null
  const punktVon = new Map(abgeleitet.map((e) => [e.key, e.punkt]))
  const programm = [...new Set(abgeleitet.map((e) => e.punkt))]
  const gleicheFolge = (a: readonly string[]) => a.length === keys.length && a.every((k, i) => k === keys[i])
  let snap = [...keys]
  for (const [r, punkt] of programm.entries()) {
    const block = bloeckeIn(
      snap.map((k) => ({ key: k, punkt: punktVon.get(k)! })),
      programm,
    )
    const weg = new Set(snap.filter((k, i) => punktVon.get(k) === punkt && block[i] === r))
    if (weg.size === 0) continue
    const probe = snap.filter((k) => !weg.has(k))
    // Nur weglassen, was der Abgleich genau so zurücklegt – sonst ginge eine Umstellung verloren.
    if (gleicheFolge(abgleich(abgeleitet, probe).map((e) => e.key))) snap = probe
  }
  return snap
}

/**
 * Der Zeiger: die höchste Stelle eines erledigten Starts in der Folge, −1 = keiner. Mit `nurBegonnene`
 * zählt nur Erledigtes begonnener Punkte (BETRIEB_ANNAHMEN.zeigerNurBegonnene): Ein gezielt gezeigter
 * Start eines späteren Laufs schiebt den Zeiger nicht über den laufenden hinaus.
 */
export function zeigerIn(folge: readonly MitKennung[], erledigt: ReadonlySet<string>, begonnen: ReadonlySet<PunktId>, nurBegonnene: boolean): number {
  let zeiger = -1
  folge.forEach((e, i) => {
    if (erledigt.has(e.key) && (!nurBegonnene || begonnen.has(e.punkt))) zeiger = i
  })
  return zeiger
}

// --- Umsetzen -----------------------------------------------------------------------------------

const keysVon = (folge: readonly { key: string }[]) => folge.map((e) => e.key)

/** Setzt `key` an Stelle `ziel` der Folge OHNE ihn (die Stelle, an der er eingefügt wird). */
export function setzeAn(keys: readonly string[], key: string, ziel: number): string[] {
  const rest = keys.filter((k) => k !== key)
  const at = Math.max(0, Math.min(rest.length, ziel))
  return [...rest.slice(0, at), key, ...rest.slice(at)]
}

/** Die Stelle des Zeigers in der Folge ohne `key` (ein nicht erledigter Start ist nie selbst der Zeiger). */
function zeigerOhne(l: Pick<BereichLage, 'folge' | 'zeiger'>, key: string): number {
  const i = l.folge.findIndex((e) => e.key === key)
  return i >= 0 && i < l.zeiger ? l.zeiger - 1 : l.zeiger
}

/** Ist das ein Start, den die Bedienung bewegen darf: in der Folge, nicht erledigt, nicht entfallen? */
export function beweglich(l: Pick<BereichLage, 'folge' | 'erledigt'>, key: string): FolgeEintrag | null {
  const e = l.folge.find((x) => x.key === key)
  return e && !e.entfaellt && !l.erledigt.has(key) ? e : null
}

/**
 * Direkt hinter den Zeiger – bzw. hinter den Start im Boot, wenn der weiter hinten steht (ein gezielt
 * gezeigter Start eines späteren Laufs schiebt den Zeiger nicht): Ein gezielt gezeigter Start (B-5, wie
 * showSlot im Prototyp) steht danach dort, wo er gefahren ist – die Folge spiegelt die Wirklichkeit (B-7);
 * „als Nächster einreihen“ (B-4) ebenso. Mehrere (Einsteigen) kommen in der gegebenen Folge dorthin.
 */
export function hinterDenZeiger(l: Pick<BereichLage, 'folge' | 'zeiger' | 'aktuell'>, bewegt: string | readonly string[]): string[] {
  const liste = typeof bewegt === 'string' ? [bewegt] : [...bewegt]
  const weg = new Set(liste)
  const rest = keysVon(l.folge).filter((k) => !weg.has(k))
  // Zeiger und Start im Boot sind erledigt, also nie unter den bewegten.
  const zeiger = l.zeiger >= 0 ? rest.indexOf(l.folge[l.zeiger].key) : -1
  const imBoot = l.aktuell ? rest.indexOf(l.aktuell.key) : -1
  const at = Math.max(zeiger, imBoot) + 1
  return [...rest.slice(0, at), ...liste, ...rest.slice(at)]
}

/**
 * „Ans Ende des Laufs einreihen“ (B-4): ans Ende des Blocks seines Punkts – ein anderer Nachzügler, der als
 * Gast im Block eines späteren Laufs steht, zählt dabei nicht. Ist der eigene Block schon vorbei (alles davon
 * liegt vor dem Zeiger – ein verpasster Lauf 1, während Lauf 2 läuft), ans Ende des Blocks des laufenden
 * Punkts: dort, wo der Start wirklich drankommt (S-4). Nie vor den Zeiger.
 */
export function ansPunktende(l: Pick<BereichLage, 'folge' | 'zeiger' | 'laufend' | 'programm'>, key: string): string[] {
  const e = l.folge.find((x) => x.key === key)
  if (!e) return keysVon(l.folge)
  const rest = l.folge.filter((x) => x.key !== key)
  const block = bloeckeIn(rest, l.programm)
  const frueheste = zeigerOhne(l, key) + 1
  let at = hinterBlock(block, Math.max(0, l.programm.indexOf(e.punkt)))
  if (at < frueheste && l.laufend !== null && BETRIEB_ANNAHMEN.einreihenEndeLaufend) at = hinterBlock(block, Math.max(0, l.programm.indexOf(l.laufend)))
  return setzeAn(keysVon(l.folge), key, Math.max(at, frueheste))
}

/** Wohin ein Verschieben zielt: die Stelle in der Folge ohne den bewegten Start und der Block dort. */
export interface Zielort {
  stelle: number
  /** Rang des Blocks, in den der Start kommt – nur darin rutscht seine Spur mit. */
  block: number
}

/**
 * Das Ziel eines Verschiebens in der Folge ohne den bewegten Start (`rest`, mit seinen Blöcken); `null`, wenn
 * es das Ziel nicht gibt. „vor/nach Lauf n“ (S-6) zielen auf Blockgrenzen: „vor Lauf 3“ ist das Ende des
 * Blocks davor (S-4: „den zweiten vor Beginn von Lauf 3“), „nach Lauf 2“ das Ende des Blocks von Lauf 2. Hat
 * der Punkt keinen Start mehr, gilt die Stelle, an der sein Block stünde (wie moveSlotToAnchor im Prototyp).
 */
export function zielStelle(rest: readonly MitKennung[], block: readonly number[], ziel: VerschiebeZiel, programm: readonly PunktId[]): Zielort | null {
  if ('vor' in ziel || 'nach' in ziel) {
    const ref = 'vor' in ziel ? ziel.vor : ziel.nach
    const i = rest.findIndex((e) => e.key === ref)
    if (i < 0) return null
    return { stelle: 'vor' in ziel ? i : i + 1, block: block[i] }
  }
  const punkt = 'vorPunkt' in ziel ? ziel.vorPunkt : ziel.nachPunkt
  const rang = programm.indexOf(punkt)
  if (rang < 0) return null
  if ('vorPunkt' in ziel) return { stelle: vorBlock(block, rang), block: Math.max(0, rang - 1) }
  return { stelle: hinterBlock(block, rang), block: rang }
}

/**
 * Verschiebt einen Start (S-4, S-6). Nie vor den Zeiger: Gefahrenes bleibt, wo es war (B-7).
 *
 * Mit `spuren` (Einstellung „Verzahnung beim Verschieben halten“, V-7) rutscht seine SPUR mit: Der Start
 * bekommt den Platz seiner Spur, der dem Ziel am nächsten liegt, die übrigen Starts dieser Spur rücken
 * nach; alle anderen Spuren bleiben, wo sie sind. So stehen nie zwei Starts derselben Spur durch das
 * Verschieben hintereinander, und am Steg bleibt die Zeit für den Bootswechsel. Das gilt nur innerhalb
 * EINES Blocks (BETRIEB_ANNAHMEN.haltenImBlock): Über eine Laufgrenze hinweg schöbe die rutschende Spur
 * fremde Starts in andere Läufe, und das Ziel („vor Lauf 3“) würde verfehlt – dann wird genau ans Ziel
 * gesetzt. Ohne Spur (Klasse nicht in der Anordnung) oder für einen Start vor dem Zeiger (nachzuholen)
 * ebenso. `null`: Ziel unbekannt.
 */
export function verschiebe(
  l: Pick<BereichLage, 'folge' | 'zeiger' | 'erledigt' | 'programm'>,
  key: string,
  ziel: VerschiebeZiel,
  spuren: TrackItem[][] | null,
): string[] | null {
  const von = l.folge.findIndex((e) => e.key === key)
  if (von < 0) return null
  if (('vor' in ziel && ziel.vor === key) || ('nach' in ziel && ziel.nach === key)) return null
  const rest = l.folge.filter((e) => e.key !== key)
  const ort = zielStelle(rest, bloeckeIn(rest, l.programm), ziel, l.programm)
  if (ort === null) return null
  const ziel0 = Math.max(ort.stelle, zeigerOhne(l, key) + 1)
  const keys = keysVon(l.folge)
  if (!spuren || von <= l.zeiger) return setzeAn(keys, key, ziel0)

  const spurVon = trackOfClass(spuren)
  const spur = spurVon.get(l.folge[von].klasse)
  const block = bloeckeIn(l.folge, l.programm)
  // Ein Start als Ziel: sein Block in der ganzen Folge (wie der des bewegten – beide gleich gerechnet).
  const zielKey = 'vor' in ziel ? ziel.vor : 'nach' in ziel ? ziel.nach : null
  const zielBlock = zielKey === null ? ort.block : block[l.folge.findIndex((e) => e.key === zielKey)]
  if (spur === undefined || block[von] !== zielBlock) return setzeAn(keys, key, ziel0)
  // Die offenen Plätze dieser Spur in diesem Block hinter dem Zeiger (ohne Erledigtes und Entfallenes).
  const plaetze: number[] = []
  l.folge.forEach((e, i) => {
    if (i > l.zeiger && block[i] === block[von] && !e.entfaellt && !l.erledigt.has(e.key) && spurVon.get(e.klasse) === spur) plaetze.push(i)
  })
  const aus = plaetze.indexOf(von)
  if (aus < 0) return setzeAn(keys, key, ziel0)
  // Wie viele Plätze der Spur liegen vor dem Ziel? Das ist die Stelle des Starts in seiner Spur. Lag er
  // selbst davor, zählt er nach dem Herausnehmen nicht mehr mit.
  const ohne = (p: number) => p - (p > von ? 1 : 0)
  const nach = Math.max(0, Math.min(plaetze.length - 1, plaetze.filter((p) => p !== von && ohne(p) < ziel0).length))
  if (nach === aus) return keys
  const strom = plaetze.map((p) => keys[p])
  strom.splice(aus, 1)
  strom.splice(nach, 0, key)
  const neu = [...keys]
  plaetze.forEach((p, i) => (neu[p] = strom[i]))
  return neu
}

// --- Neu verzahnen (Klasse setzt aus, Klasse vorziehen) ------------------------------------------

export interface WebOptionen {
  /** Diese Punkte neu weben, jeden für sich (die Läufe vermischen sich nie). */
  punkte: readonly PunktId[]
  /** Gewünschte Klassenfolge (B-10): Die Klassen werden NUR innerhalb ihrer Spur danach sortiert. */
  reihenfolge?: readonly ClassId[]
  /**
   * Klassen, die gerade zurückkommen (V-5): Ihre Starts vor dem Zeiger (vorbeigezogen, solange das Boot
   * fehlte) werden in den Rest des Punkts eingewoben, statt „nachzuholen“ zu werden.
   */
  zurueck?: ReadonlySet<ClassId>
}

/**
 * Webt den REST von Punkten neu mit der Verzahnung (Vorbild reinterleaveOpen): Das Boot einer Klasse
 * fällt aus, die nächste Klasse DERSELBEN Spur rückt auf ihre Plätze – nur so bleibt der Wechsel zwischen
 * den Spuren erhalten (V-5: `E2E21212121216163` → `E6E61111113`, die Starts der Klasse 2 ans Ende des
 * Laufs, „Boot fehlt“). Kommt das Boot zurück, wird der Rest mit ihr neu gewoben.
 *
 * - Angefasst werden je Punkt nur offene Starts (nicht erledigt, nicht entfallen, nicht zurückgestellt) IM
 *   BLOCK SEINES PUNKTS, in einem begonnenen Punkt nur die hinter dem Zeiger. Sie bekommen die Plätze, die
 *   sie schon hatten – Erledigtes, Zurückgestelltes, Entfallenes, Gäste anderer Punkte und Starts des Punkts,
 *   die die Bedienung in einen anderen Block gesetzt hat (eingereiht, verschoben), bleiben stehen.
 * - Je Starter eine Einheit: Mit „Versuche nacheinander“ (ein Punkt, mehrere Versuche je Starter) bleiben
 *   seine Versuche beisammen (BETRIEB_ANNAHMEN.versucheNacheinanderEinPunkt). Hat ein Starter im Punkt schon
 *   einen Versuch gefahren, fährt er die übrigen zu Ende – sie bleiben, wo sie sind (außer sein Boot fehlt;
 *   BETRIEB_ANNAHMEN.angebrochenFaehrtZuEnde).
 * - Starts ausgesetzter Klassen kommen ans Ende (bis das Boot zurück ist, fahren sie nicht; zwischen den
 *   anderen sähe es aus, als sei die falsche Klasse herausgenommen).
 * - Vorbeigezogene einer zurückkehrenden Klasse (`zurueck`) kommen in den Rest des Punkts; hat der keinen
 *   offenen Start mehr (der Lauf stockt), direkt hinter den Zeiger bzw. den Start im Boot – solange der
 *   Zeiger noch im Block des Punkts steht. Ist er schon in einem späteren, bleiben sie stehen und sind
 *   nachzuholen (BETRIEB_ANNAHMEN.bootFehltVorNachzuholen).
 * - Der Reigen setzt hinter der Spur des zuletzt erledigten Starts des Blocks ein (Nahtstelle), mit
 *   `reihenfolge` bei der Spur der Klasse, die vorn stehen soll; ist im Block noch nichts erledigt, bei der
 *   ersten Spur und MIT den Pausen der Anordnung – dann ergibt sich ohne Ausfall wieder die Verzahnung.
 *   Mitten im Punkt bleiben die Pausen außen vor: Sie versetzen nur den Beginn.
 * - Ein Punkt, dessen Starts nicht alle zu weben sind (Klasse fehlt in der Anordnung), bleibt, wie er ist:
 *   lieber nicht anfassen als jemanden verlieren.
 */
export function webeNeu(
  l: Pick<BereichLage, 'folge' | 'zeiger' | 'erledigt' | 'begonnen' | 'zurueckgestellt' | 'programm' | 'aktuell'>,
  spuren: TrackItem[][],
  ausgesetzt: ReadonlySet<ClassId>,
  optionen: WebOptionen,
): string[] {
  const eintrag = new Map(l.folge.map((e) => [e.key, e]))
  const zurueckgestellt = new Set(l.zurueckgestellt.map((e) => e.key))
  const zeigerKey = l.zeiger >= 0 ? l.folge[l.zeiger].key : null
  const spurVon = trackOfClass(spuren)
  let keys = keysVon(l.folge)

  for (const punkt of new Set(optionen.punkte)) {
    const r = l.programm.indexOf(punkt)
    if (r < 0) continue
    const begonnen = l.begonnen.includes(punkt)
    const block = bloeckeIn(
      keys.map((k) => eintrag.get(k)!),
      l.programm,
    )
    const zeiger = zeigerKey === null ? -1 : keys.indexOf(zeigerKey)
    // Starter, die im Punkt schon einen Versuch gefahren haben (nur mit „Versuche nacheinander“ möglich).
    const angebrochen = new Set(keys.filter((k) => eintrag.get(k)!.punkt === punkt && l.erledigt.has(k)).map((k) => eintrag.get(k)!.starter))
    const plaetze: number[] = []
    const vorbei: string[] = []
    keys.forEach((k, i) => {
      const e = eintrag.get(k)!
      if (e.punkt !== punkt || e.entfaellt || l.erledigt.has(k) || zurueckgestellt.has(k)) return
      if (!begonnen || i > zeiger) {
        if (block[i] === r && (!angebrochen.has(e.starter) || ausgesetzt.has(e.klasse))) plaetze.push(i)
      } else if (optionen.zurueck?.has(e.klasse)) vorbei.push(k)
    })
    // Vorbeigezogene ohne offenen Rest: nur, solange der Zeiger noch im Block des Punkts steht (der Lauf stockt).
    const stockt = plaetze.length === 0 && vorbei.length > 0 && (zeiger < 0 || block[zeiger] <= r)
    if (plaetze.length === 0 && !stockt) continue

    let arbeit = keys
    let ziele = plaetze
    if (vorbei.length > 0) {
      // Die Vorbeigezogenen kommen hinter den letzten offenen Platz des Punkts bzw. hinter den Zeiger oder den
      // Start im Boot; gewoben wird über alle.
      const weg = new Set(vorbei)
      const offenKeys = plaetze.map((p) => keys[p])
      arbeit = keys.filter((k) => !weg.has(k))
      ziele = offenKeys.map((k) => arbeit.indexOf(k))
      const imBoot = l.aktuell ? arbeit.indexOf(l.aktuell.key) : -1
      const letzter = ziele.length > 0 ? ziele.at(-1)! : Math.max(zeigerKey === null ? -1 : arbeit.indexOf(zeigerKey), imBoot)
      arbeit = [...arbeit.slice(0, letzter + 1), ...vorbei, ...arbeit.slice(letzter + 1)]
      ziele = [...ziele, ...vorbei.map((_, j) => letzter + 1 + j)]
    }
    // In der Folge, wie sie bisher stand – so behält jede Klasse ihre Reihenfolge.
    const stelle = new Map(keys.map((k, i) => [k, i]))
    const elemente = [...vorbei, ...plaetze.map((p) => keys[p])].sort((a, b) => stelle.get(a)! - stelle.get(b)!).map((k) => eintrag.get(k)!)

    // Die Nahtstelle: der zuletzt erledigte Start im Block des Punkts (auch ein Gast – gefahren ist gefahren).
    let letzteErledigt: FolgeEintrag | null = null
    for (let i = 0; i < keys.length; i++) if (block[i] === r && l.erledigt.has(keys[i])) letzteErledigt = eintrag.get(keys[i])!
    const reihenfolge = optionen.reihenfolge
    const startSpur = reihenfolge?.length
      ? (spurVon.get(reihenfolge[0]) ?? 0)
      : letzteErledigt !== null
        ? (spurVon.get(letzteErledigt.klasse) ?? -1) + 1
        : 0
    const mitPausen = !reihenfolge && letzteErledigt === null
    const gewoben = webe(elemente, spuren, ausgesetzt, { reihenfolge, startSpur, mitPausen })
    if (gewoben.length !== ziele.length) continue
    const neu = [...arbeit]
    ziele.forEach((p, i) => (neu[p] = gewoben[i].key))
    keys = neu
  }
  return keys
}

/**
 * Webt Starts nach der Anordnung: fahrende Klassen verzahnt, Klassen außerhalb der Anordnung danach, ausgesetzte
 * zuletzt. Gewoben wird je STARTER (eine Einheit = seine Starts hier, in ihrer Folge): Ohne „Versuche
 * nacheinander“ ist das ein Start, mit allen seinen Versuchen im Punkt – die bleiben so beisammen, wie auf den
 * WKR-Bögen (ein Stapel je Starter), statt sich mit denen anderer Starter abzuwechseln.
 */
function webe(
  elemente: readonly FolgeEintrag[],
  spuren: TrackItem[][],
  ausgesetzt: ReadonlySet<ClassId>,
  o: { reihenfolge?: readonly ClassId[]; startSpur: number; mitPausen: boolean },
): FolgeEintrag[] {
  const spurVon = trackOfClass(spuren)
  const rang = (k: ClassId) => {
    const i = o.reihenfolge?.indexOf(k) ?? -1
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  const fahrende = spuren.map((spur) => {
    const items = spur.filter((i) => (i.kind === 'class' ? !ausgesetzt.has(i.klasse) : o.mitPausen))
    if (!o.reihenfolge) return items
    // Array.prototype.sort ist stabil: Klassen ohne Rang behalten ihre Folge in der Spur.
    return [...items].sort((a, b) => (a.kind === 'class' ? rang(a.klasse) : 0) - (b.kind === 'class' ? rang(b.klasse) : 0))
  })
  // Map behält die Folge des ersten Eintrags: die Einheiten in der Folge ihres ersten Starts.
  const einheiten = new Map<string, FolgeEintrag[]>()
  for (const e of elemente) einheiten.set(e.starter, [...(einheiten.get(e.starter) ?? []), e])
  const jeKlasse = new Map<ClassId, FolgeEintrag[][]>()
  const ohneSpur: FolgeEintrag[][] = []
  const aus: FolgeEintrag[][] = []
  for (const einheit of einheiten.values()) {
    const klasse = einheit[0].klasse
    if (ausgesetzt.has(klasse)) aus.push(einheit)
    else if (!spurVon.has(klasse)) ohneSpur.push(einheit)
    else jeKlasse.set(klasse, [...(jeKlasse.get(klasse) ?? []), einheit])
  }
  return [...buildSequenceSteps(fahrende, jeKlasse, o.startSpur).flatMap((s) => s.p), ...ohneSpur.flat(), ...aus.flat()]
}

// --- Klassen im laufenden Punkt (B-9, B-10) -------------------------------------------------------

/**
 * Die fahrenden Klassen in der Folge, in der sie im Arbeitspunkt drankommen – maßgeblich ist der jeweils
 * NÄCHSTE offene Start einer Klasse (nicht E, 1, 2 …: am Steg zählt, was als Nächstes kommt).
 */
export function klassenNachNaechstemStart(l: Pick<BereichLage, 'offen' | 'arbeitsPunkt'>): ClassId[] {
  const klassen: ClassId[] = []
  for (const e of l.offen) if (e.punkt === l.arbeitsPunkt && !klassen.includes(e.klasse)) klassen.push(e.klasse)
  return klassen
}

/**
 * Hat die Klasse ihre Spur unter den fahrenden Klassen für sich? Dann lässt sie sich nicht vorziehen
 * (B-10): Ihre Plätze gehören ihr ohnehin alle, umsortiert wird nur innerhalb der Spuren.
 */
export function klasseAllein(klasse: ClassId, klassen: readonly ClassId[], spuren: TrackItem[][]): boolean {
  const spurVon = trackOfClass(spuren)
  const spur = spurVon.get(klasse)
  return spur === undefined || !klassen.some((k) => k !== klasse && spurVon.get(k) === spur)
}

/**
 * Zieht eine Klasse vor bzw. schiebt sie zurück (B-10, Vorbild moveClassBefore): Sie kommt künftig dort
 * dran, wo bisher `vor` drankam; `vor = null` heißt „als Letzte“. Umsortiert wird nur innerhalb der Spuren,
 * nur im Arbeitspunkt; ausgesetzte Klassen bleiben außen vor. `null`: nichts zu tun (Klasse nicht im Punkt,
 * steht schon dort, hat ihre Spur für sich).
 */
export function klasseVor(
  l: Pick<BereichLage, 'folge' | 'zeiger' | 'erledigt' | 'begonnen' | 'zurueckgestellt' | 'offen' | 'arbeitsPunkt' | 'programm' | 'aktuell'>,
  spuren: TrackItem[][],
  ausgesetzt: ReadonlySet<ClassId>,
  klasse: ClassId,
  vor: ClassId | null,
): string[] | null {
  if (l.arbeitsPunkt === null || klasse === vor) return null
  const folge = klassenNachNaechstemStart(l)
  if (!folge.includes(klasse) || (vor !== null && !folge.includes(vor))) return null
  if (BETRIEB_ANNAHMEN.alleinAufDerSpurFest && klasseAllein(klasse, folge, spuren)) return null
  const rest = folge.filter((k) => k !== klasse)
  const at = vor === null ? rest.length : rest.indexOf(vor)
  const neu = [...rest.slice(0, at), klasse, ...rest.slice(at)]
  if (neu.every((k, i) => k === folge[i])) return null
  return webeNeu(l, spuren, ausgesetzt, { punkte: [l.arbeitsPunkt], reihenfolge: neu })
}

// --- Einsteigen ---------------------------------------------------------------------------------

/**
 * Der erste Start eines Punkts – wahlweise der ersten, der eine Klasse fährt (Vorbild firstSlotOf):
 * Grundlage für „Einsteigen bei Lauf 3“ bzw. „Lauf 2 ab Klasse 5“. Schon gezeigte zählen nicht, entfallene
 * (X) auch nicht – „Weiter mit“ nennte sonst einen, der nicht fährt; was nur „ohne Anzeige“ erledigt ist, schon:
 * So lässt sich ein zu später Einstieg zurücknehmen.
 */
export function ersterStart(l: Pick<BereichLage, 'folge' | 'gezeigtKeys'>, punkt: PunktId, klasse: ClassId | null = null): FolgeEintrag | null {
  return l.folge.find((e) => e.punkt === punkt && !e.entfaellt && !l.gezeigtKeys.has(e.key) && (klasse === null || e.klasse === klasse)) ?? null
}

/**
 * Einsteigen ab einem Start (Vorbild startAt): Alles davor, was nicht gezeigt wurde, ist „ohne Anzeige“
 * erledigt – nie in `gezeigt`, denn erfundene Zeiten verdürben die Prognose (E3). Was ab dem Start „ohne
 * Anzeige“ war, ist wieder offen: Ein zu später Einstieg wird mit einem früheren behoben.
 */
export function einsteigen(l: Pick<BereichLage, 'folge' | 'gezeigtKeys'>, ohneAnzeige: readonly string[], key: string): string[] | null {
  const i = l.folge.findIndex((e) => e.key === key)
  if (i < 0) return null
  const ab = new Set(l.folge.slice(i).map((e) => e.key))
  const davor = l.folge.slice(0, i).filter((e) => !l.gezeigtKeys.has(e.key)).map((e) => e.key)
  return [...new Set([...ohneAnzeige.filter((k) => !ab.has(k)), ...davor])]
}
