// Holt die Parcours-Zeichnungen aus dem Parcours-Repository nach src/assets/parcours.
//
//   npm run parcours:sync                    Quelle: ../Parcours (Nachbarordner)
//   npm run parcours:sync -- /pfad/Parcours  andere Quelle
//
// Ein Handschritt nach `make` UND Commit im Parcours-Repository, NICHT Teil von Build oder CI: Die
// Zeichnungen entstehen dort mit Inkscape, hier wird nur das fertige Ergebnis kopiert,
// zurechtgemacht (normalisiere) und eingecheckt. Der Test src/lib/parcoursQuelle.test.ts
// prüft die eingecheckten Dateien dann in der CI.
//
// Läuft mit Node ab 22.18 ohne Bundler (Node streicht die Typen selbst).
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BEARBEITUNGSVERMERK,
  ERWARTETE_LIZENZ,
  gleicheLizenz,
  metadaten,
  normalisiere,
  PARCOURS_DATEIEN,
  vertragsBefunde,
} from '../src/lib/parcoursVertrag.ts'

/** Nur die WKR-Ausschnitte ohne Abdeckung: keine Logos, keine Texte im Ausschnitt. */
const ORDNER = 'dist/alcatraz_Parcours'
const REPO = 'https://github.com/Motorbootslalom/Parcours'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const quelle = resolve(process.argv[2] ?? join(wurzel, '..', 'Parcours'))
const ziel = join(wurzel, 'src', 'assets', 'parcours')

const git = (...args: string[]) => execFileSync('git', ['-C', quelle, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

/**
 * Der Commit der Quelle, vollständig. Er trägt die Herkunftsangabe (QUELLE.json, LICENSE.md,
 * Namensnennung in der Oberfläche) – also muss er die kopierten Dateien auch enthalten: Nach
 * `make` ist `dist/` oft neu erzeugt und noch nicht eingecheckt, dann nennte er einen Stand,
 * in dem diese Dateien anders aussehen.
 */
function commit(): string {
  let hash: string
  let offen: string
  try {
    hash = git('rev-parse', 'HEAD')
    // Auch Unversioniertes (`??`) zählt: Eine neue Datei stünde ebenfalls in keinem Commit.
    offen = git('status', '--porcelain', '--', ORDNER)
  } catch {
    console.error(`Abgebrochen, nichts geschrieben: ${quelle} ist kein Git-Repository – der Stand der Quelle ließe sich nicht festhalten.`)
    process.exit(1)
  }
  if (offen) {
    console.error(`Abgebrochen, nichts geschrieben: ${ORDNER} hat Änderungen, die in keinem Commit stehen.\nErst im Parcours-Repository committen:\n${offen}`)
    process.exit(1)
  }
  return hash
}
// Vor dem Lesen: Was danach gelesen wird, ist der Stand dieses Commits.
const stand = commit()

const fertig: Array<{ datei: string; text: string }> = []
const fehler: string[] = []
for (const datei of PARCOURS_DATEIEN) {
  let roh: string
  try {
    roh = readFileSync(join(quelle, ORDNER, `${datei}.svg`), 'utf8')
  } catch {
    fehler.push(`${datei}.svg: nicht gefunden in ${join(quelle, ORDNER)}`)
    continue
  }
  const text = normalisiere(roh)
  if (!/<svg\b[^>]*\bviewBox=/.test(text)) fehler.push(`${datei}.svg: kein viewBox (Breite oder Höhe fehlt an der Wurzel)`)
  for (const b of vertragsBefunde(text)) fehler.push(`${datei}.svg: ${b}`)
  if (!text.includes(BEARBEITUNGSVERMERK)) fehler.push(`${datei}.svg: kein Platz für den Bearbeitungsvermerk (cc:Work fehlt in den Metadaten)`)
  fertig.push({ datei, text })
}

// Erst prüfen, dann schreiben: Bei einem Fehler bleibt der eingecheckte Stand unberührt.
if (fehler.length > 0) {
  console.error(`Abgebrochen, nichts geschrieben:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}

let bytes = 0
for (const { datei, text } of fertig) {
  writeFileSync(join(ziel, `${datei}.svg`), text)
  bytes += Buffer.byteLength(text)
}
// Titel und Urheber stehen in den Zeichnungen selbst; die Oberfläche nennt sie von hier aus.
const angaben = fertig.map((f) => metadaten(f.text))
const { titel, urheber } = angaben[0]
const quelleJson = {
  repo: REPO,
  commit: stand,
  ordner: ORDNER,
  titel,
  urheber,
  lizenz: ERWARTETE_LIZENZ.name,
  lizenzUrl: ERWARTETE_LIZENZ.url,
  dateien: fertig.map((f) => `${f.datei}.svg`),
}
writeFileSync(join(ziel, 'QUELLE.json'), `${JSON.stringify(quelleJson, null, 2)}\n`)

// LICENSE.md nennt denselben Stand; ein Test (parcoursQuelle.test.ts) vergleicht beide.
const lizenzDatei = join(ziel, 'LICENSE.md')
const lizenzText = readFileSync(lizenzDatei, 'utf8')
const mitStand = lizenzText.replace(/(Stand: Commit `)[^`]*(`)/, `$1${stand}$2`)
if (mitStand === lizenzText && !lizenzText.includes(stand)) console.warn('ACHTUNG: In LICENSE.md fehlt die Zeile „Stand: Commit `…`“ – bitte den Commit von Hand nachziehen.')
else writeFileSync(lizenzDatei, mitStand)

console.log(`${fertig.length} Zeichnungen (${Math.round(bytes / 1024)} kB) nach ${ziel}, Stand ${stand}.`)

const abweichend = fertig.filter((_, i) => !gleicheLizenz(angaben[i].lizenzUrl, ERWARTETE_LIZENZ.url))
if (abweichend.length > 0) {
  // Kein Abbruch: Bereinigen kann das nur der Urheber im Parcours-Repository, und bis dahin
  // muss sich die Zeichnung trotzdem holen lassen. Aber es soll niemand übersehen.
  console.warn(
    `\nACHTUNG: Die Metadaten von ${abweichend.length} Zeichnung(en) nennen eine andere Lizenz als das Repository (${ERWARTETE_LIZENZ.name}):\n` +
      [...new Set(angaben.map((a) => a.lizenzUrl || '(keine)'))].map((u) => `  ${u}`).join('\n') +
      '\nBitte im Parcours-Repository (parcours.svg) bereinigen; siehe „Offen“ in src/assets/parcours/LICENSE.md.',
  )
}
if (new Set(angaben.map((a) => `${a.titel}|${a.urheber}`)).size > 1) console.warn('ACHTUNG: Titel oder Urheber sind nicht in allen Zeichnungen gleich.')
console.log('Bitte "npm run check" laufen lassen.')
