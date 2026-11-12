import { dump as yamlDump, load as yamlLoad } from 'js-yaml'
import { aufloesen, istInlineKurzform } from './kurzform'
import type { RawAufbau, RawKurzform, RawQuelle, RawRegelwerk } from './schema'
import { kurzformBefunde, validateRawConfig, type ConfigIssue } from './validate'

// Eigene Aufbauten (KONZEPT-POSITIONEN.md §8 im Fehlerpunkte-Prototyp): Sie stehen nicht in
// der mitgelieferten Konfiguration, sondern im Stand der Veranstaltung (AppState), und werden
// per Sicherung, Vorlage oder YAML-Datei weitergegeben. Ihre Positionen stehen in Kurzform
// direkt im Aufbau. Was von außen kommt, läuft durch dieselbe Prüfung wie die mitgelieferten
// Dateien: eine YAML-Datei vor der Übernahme (pruefeEigene), der Inhalt einer Sicherung oder
// Vorlage bei jeder Benutzung (brauchbareEigene) – abgelehnte bleiben gespeichert, gelten aber nicht.

/** IDs von Aufbauten und Positionen: Sie stehen auch in Link und QR-Code (§9). */
export const ID_MUSTER = /^[a-z0-9]+$/

/**
 * Die Positionsdateien mit den eigenen Aufbauten dahinter. Ihre Positionen bekommen
 * `bildImBrowser`. Ein eigener Aufbau mit der ID eines Aufbaus aus dem Repo entfällt:
 * Der aus dem Repo gilt (§8, Übernahme ins Repo).
 */
export function mitEigenen(quelle: RawQuelle, eigene: RawAufbau[]): RawQuelle {
  const imRepo = new Set((quelle.aufbauten ?? []).map((a) => a.id))
  const dazu = eigene
    .filter((a) => !imRepo.has(a.id))
    .map(
      (a): RawAufbau => ({
        ...a,
        eigen: true,
        positionen: a.positionen.map((e) => (istInlineKurzform(e) ? { ...e, bildImBrowser: true } : e)),
      }),
    )
  return { ...quelle, aufbauten: [...(quelle.aufbauten ?? []), ...dazu] }
}

/** Eigene Aufbauten, die ein Aufbau aus dem Repo mit derselben ID verdeckt. */
export function verdeckteEigene(quelle: RawQuelle, eigene: RawAufbau[]): RawAufbau[] {
  const imRepo = new Set((quelle.aufbauten ?? []).map((a) => a.id))
  return eigene.filter((a) => imRepo.has(a.id))
}

/**
 * Eine Meldung der Prüfung. Die Oberfläche übersetzt sie über `code` und `params`
 * (Schlüssel `own.issue.<code>`); `message` ist der deutsche Wortlaut und gilt, wo es
 * keine Übersetzung gibt – das sind die Befunde aus validate.ts.
 */
export interface Meldung {
  code: string
  params: Record<string, string>
  message: string
}

export interface Pruefung {
  /** Die geprüften Aufbauten; leer, wenn es Fehler gibt. */
  aufbauten: RawAufbau[]
  fehler: Meldung[]
  /** Nicht blockierend, z. B. eine Boje, die keine Liste beobachtet. */
  hinweise: Meldung[]
}

/** Deutscher Wortlaut der eigenen Meldungen; `{name}` wird aus den Parametern ersetzt. */
const TEXTE = {
  YAML: 'Die Datei ist kein gültiges YAML: {detail}',
  KEIN_AUFBAU: 'Die Datei enthält keinen Aufbau (Abschnitt „aufbauten:“ fehlt oder ist leer).',
  POSITIONEN_ABSCHNITT:
    'Positionen stehen bei eigenen Aufbauten direkt im Aufbau, nicht in einem eigenen Abschnitt „positionen:“.',
  AUFBAU_ID: 'Aufbau „{name}“: Die id darf nur Kleinbuchstaben und Ziffern enthalten.',
  AUFBAU_NAME: 'Aufbau „{id}“ hat keinen Namen.',
  AUFBAU_VORHANDEN: 'Den Aufbau „{id}“ gibt es schon unter den mitgelieferten. Bitte eine andere id wählen.',
  AUFBAU_LEER: 'Aufbau „{id}“ hat keine Positionen.',
  POSITION_ID: 'Aufbau „{id}“: Die id der Position „{titel}“ darf nur Kleinbuchstaben und Ziffern enthalten.',
  POSITION_VORHANDEN: 'Aufbau „{id}“: Die Position „{position}“ gibt es schon unter den mitgelieferten.',
  AUFBAU_DISZIPLIN: 'Aufbau „{id}“: Eigene Aufbauten gibt es nur für das Manövrieren, nicht für „{disziplin}“.',
  DEFEKT: 'Aufbau „{id}“ lässt sich nicht lesen ({detail}).',
} as const

function meldung(code: keyof typeof TEXTE, params: Record<string, string> = {}): Meldung {
  return { code, params, message: TEXTE[code].replace(/\{(\w+)\}/g, (_, name: string) => params[name] ?? '') }
}

/** Nur die Felder, die ein eigener Aufbau haben darf: ohne interne Kennzeichen. */
function bereinigt(a: RawAufbau): RawAufbau {
  const { eigen: _eigen, ...rest } = a
  return {
    ...rest,
    positionen: rest.positionen.map((e) => {
      if (!istInlineKurzform(e)) return e
      const { bildImBrowser: _bild, ...position } = e
      return position as RawKurzform
    }),
  }
}

/**
 * Prüft eigene Aufbauten aus einer Datei (YAML-Text) oder einem Link (Objekt), bevor sie
 * übernommen werden. `vorhanden` sind die schon gespeicherten eigenen Aufbauten: Einer mit
 * derselben ID wird ersetzt, die übrigen müssen weiter passen.
 */
export function pruefeEigene(eingabe: unknown, quelle: RawQuelle, regelwerk: RawRegelwerk, vorhanden: RawAufbau[] = []): Pruefung {
  const fehler: Meldung[] = []
  let daten = eingabe
  if (typeof eingabe === 'string') {
    try {
      daten = yamlLoad(eingabe)
    } catch (e) {
      return { aufbauten: [], fehler: [meldung('YAML', { detail: (e as Error).message.split('\n')[0] })], hinweise: [] }
    }
  }
  const liste = (daten as { aufbauten?: unknown })?.aufbauten
  if (!Array.isArray(liste) || liste.length === 0) return { aufbauten: [], fehler: [meldung('KEIN_AUFBAU')], hinweise: [] }
  if ((daten as { positionen?: unknown }).positionen !== undefined) fehler.push(meldung('POSITIONEN_ABSCHNITT'))

  const imRepo = new Set((quelle.aufbauten ?? []).map((a) => a.id))
  const positionenImRepo = new Set(quelle.positionen.map((p) => p.id))
  const standardDisziplin = quelle.disziplinen?.[0]?.id
  const aufbauten: RawAufbau[] = []
  for (const roh of liste) {
    const a = roh as Partial<RawAufbau>
    if (!a || typeof a !== 'object' || typeof a.id !== 'string' || !ID_MUSTER.test(a.id)) {
      fehler.push(meldung('AUFBAU_ID', { name: String(a?.name ?? a?.id ?? '?') }))
      continue
    }
    if (typeof a.name !== 'string' || !a.name.trim()) fehler.push(meldung('AUFBAU_NAME', { id: a.id }))
    if (imRepo.has(a.id)) fehler.push(meldung('AUFBAU_VORHANDEN', { id: a.id }))
    // Gewählt wird ein eigener Aufbau nur für das Manövrieren (die erste Disziplin); einer für
    // eine andere stünde in der Konfiguration, ließe sich aber nirgends wählen.
    if (a.disziplin !== undefined && standardDisziplin !== undefined && a.disziplin !== standardDisziplin)
      fehler.push(meldung('AUFBAU_DISZIPLIN', { id: a.id, disziplin: String(a.disziplin) }))
    if (!Array.isArray(a.positionen) || a.positionen.length === 0) {
      fehler.push(meldung('AUFBAU_LEER', { id: a.id }))
      continue
    }
    for (const e of a.positionen) {
      if (!istInlineKurzform(e)) continue
      if (typeof e.id !== 'string' || !ID_MUSTER.test(e.id)) fehler.push(meldung('POSITION_ID', { id: a.id, titel: String(e.titel ?? '?') }))
      else if (positionenImRepo.has(e.id)) fehler.push(meldung('POSITION_VORHANDEN', { id: a.id, position: e.id }))
    }
    aufbauten.push(bereinigt(a as RawAufbau))
  }
  if (fehler.length > 0) return { aufbauten: [], fehler, hinweise: [] }

  // Dieselbe Prüfung wie für die mitgelieferten Dateien, mit den übrigen eigenen Aufbauten.
  const neu = new Set(aufbauten.map((a) => a.id))
  const zusammen = mitEigenen(quelle, [...vorhanden.filter((a) => !neu.has(a.id)), ...aufbauten])
  const befunde = [...kurzformBefunde(zusammen), ...validateRawConfig({ ...regelwerk, ...aufloesen(zusammen) })]
  // Die Befunde aus validate.ts bleiben vorerst deutsch (rund 150 Meldungen zur Pflege der YAML-Dateien).
  const alsMeldung = (b: ConfigIssue): Meldung => ({ code: b.code, params: { where: b.where }, message: b.message })
  return {
    aufbauten: befunde.some((b) => b.severity === 'error') ? [] : aufbauten,
    fehler: befunde.filter((b) => b.severity === 'error').map(alsMeldung),
    hinweise: befunde.filter((b) => b.severity === 'warning').map(alsMeldung),
  }
}

/** Ein gespeicherter eigener Aufbau, den die Prüfung ablehnt, mit den Gründen. */
export interface Abgelehnt {
  id: string
  name: string
  fehler: Meldung[]
}

export interface EigeneAuswahl {
  /** Die eigenen Aufbauten, die in die Konfiguration kommen, in gespeicherter Reihenfolge. */
  gut: RawAufbau[]
  /** Die übrigen, je mit den Meldungen der Prüfung. Sie bleiben gespeichert (Herunterladen, Löschen). */
  abgelehnt: Abgelehnt[]
}

/**
 * Trennt die gespeicherten eigenen Aufbauten in brauchbare und abgelehnte. Sicherung und
 * Vorlage bringen eigene Aufbauten mit, ohne dass sie durch die Prüfung einer YAML-Datei
 * gelaufen wären; deshalb läuft hier **jeder einzeln** durch dieselbe Prüfung. Ein
 * beschädigter Aufbau nimmt so nur sich selbst aus der Konfiguration, nicht alle.
 *
 * - Eine Kennung gilt einmal: Der erste Eintrag gewinnt, weitere entfallen.
 * - Was ein mitgelieferter Aufbau verdeckt, ist weder gut noch abgelehnt (siehe
 *   {@link verdeckteEigene}).
 * - Jeder wird mit den schon angenommenen zusammen geprüft: Zwei eigene mit derselben
 *   Positions-ID vertragen sich nicht, der spätere wird abgelehnt.
 * - Es genügt, die Prüfung unter **einem** der Regelwerke zu bestehen – so ist der Aufbau
 *   auch einmal hereingekommen (Assistent, YAML-Datei). Damit hängt das Ergebnis nicht am
 *   gewählten Regelwerk: Ein Wechsel nimmt niemandem seine Aufbauten. Das ist nötig, weil
 *   die Prüfung auch Pflegehinweise je Regelwerk kennt (unter UIM etwa fehlende englische
 *   Titel), die einen Aufbau nicht unbrauchbar machen. Genannt werden die Meldungen des
 *   ersten Regelwerks.
 *
 * `probe` baut probeweise mit den angenommenen und dem Kandidaten und wirft, wenn das
 * nicht geht (konfig.ts reicht den Bau herein, für alle Regelwerke; dieses Modul kennt ihn nicht).
 */
export function brauchbareEigene(
  eigene: readonly RawAufbau[],
  quelle: RawQuelle,
  regelwerke: readonly RawRegelwerk[],
  probe: (aufbauten: RawAufbau[]) => void = () => {},
): EigeneAuswahl {
  const imRepo = new Set((quelle.aufbauten ?? []).map((a) => a.id))
  const gesehen = new Set<string>()
  const gut: RawAufbau[] = []
  const abgelehnt: Abgelehnt[] = []
  for (const a of eigene) {
    if (gesehen.has(a.id)) continue
    gesehen.add(a.id)
    if (imRepo.has(a.id)) continue
    let fehler: Meldung[]
    try {
      const jeRegelwerk = regelwerke.map((regelwerk) => pruefeEigene({ aufbauten: [a] }, quelle, regelwerk, gut).fehler)
      fehler = jeRegelwerk.some((f) => f.length === 0) ? [] : (jeRegelwerk[0] ?? [])
      if (fehler.length === 0) probe([...gut, a])
    } catch (e) {
      // Beschädigte Daten (z. B. eine Zahl, wo eine Liste stehen muss) bringen die Prüfung
      // selbst zum Stolpern. Auch das ist eine Ablehnung, kein Absturz.
      fehler = [defektMeldung(a.id, e)]
    }
    if (fehler.length === 0) gut.push(a)
    else abgelehnt.push({ id: a.id, name: typeof a.name === 'string' ? a.name : a.id, fehler })
  }
  return { gut, abgelehnt }
}

/** Die Meldung für einen Aufbau, an dem Prüfung oder Bau mit einem Fehler abbrechen. */
export function defektMeldung(id: string, grund: unknown): Meldung {
  return meldung('DEFEKT', { id, detail: (grund instanceof Error ? grund.message : String(grund)).split('\n')[0] })
}

/** Ein Aufbau als YAML-Datei in der Form, die auch im Repo gilt (§4.1, §8). */
export function aufbauYaml(aufbau: RawAufbau, kopf: { datum: string; version: string; regelwerk: string }): string {
  return (
    `# Aufbau „${aufbau.name}“ aus Alcatraz\n` +
    `# Datum: ${kopf.datum} · App-Version: ${kopf.version} · Regelwerk: ${kopf.regelwerk}\n` +
    '# Einspielen: „Einstellungen“ → „Eigene Aufbauten“ → „YAML einspielen“. Fest mitliefern: Datei nach\n' +
    '# src/config/aufbauten/ legen und in aufbauten.yaml eintragen.\n' +
    yamlDump({ aufbauten: [bereinigt(aufbau)] }, { lineWidth: -1, noRefs: true })
  )
}

/**
 * Übernimmt einen eigenen Aufbau aus einem Link: Der Link hat Vorrang. Gibt es lokal einen
 * mit derselben ID, aber anderem Inhalt, bleibt der lokale als Kopie unter neuer ID erhalten.
 */
export function ausLinkUebernehmen(lokal: RawAufbau[], ausLink: RawAufbau): RawAufbau[] {
  const bisher = lokal.find((a) => a.id === ausLink.id)
  const andere = lokal.filter((a) => a.id !== ausLink.id)
  if (!bisher || JSON.stringify(bereinigt(bisher)) === JSON.stringify(bereinigt(ausLink))) return [...andere, ausLink]
  const vergeben = new Set(lokal.map((a) => a.id))
  let n = 2
  while (vergeben.has(`${bisher.id}kopie${n}`)) n++
  // Positionen gelten überall unter ihrer ID: Die Kopie bekommt eigene.
  const kopie: RawAufbau = {
    ...bisher,
    id: `${bisher.id}kopie${n}`,
    name: `${bisher.name} (Kopie)`,
    positionen: bisher.positionen.map((e) => (istInlineKurzform(e) ? { ...e, id: `${e.id}k${n}` } : e)),
  }
  return [...andere, kopie, ausLink]
}
