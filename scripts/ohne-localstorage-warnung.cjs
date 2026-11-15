// Wird jedem Test-Worker per --require vorgeschaltet (vite.config.ts, test.execArgv).
// Node ab 25 meldet beim ersten Blick auf globalThis.localStorage einmal je Prozess
// „localStorage is not available because --localstorage-file was not provided.“ – bei über
// hundert Testdateien also über hundert Mal. Die Tests brauchen diesen Speicher von Node nicht
// (src/test-setup.ts setzt einen eigenen ein). Die Meldung hat keinen Code, `--disable-warning`
// träfe deshalb alle ExperimentalWarnings. Hier fällt genau diese eine weg, alle anderen bleiben.
// Muster: node_modules/vitest/suppress-warnings.cjs.

const MELDUNG = 'localStorage is not available because --localstorage-file was not provided'

const { emit } = process

process.emit = function (event, warning) {
  if (event === 'warning' && typeof warning?.message === 'string' && warning.message.startsWith(MELDUNG)) {
    return false
  }
  return Reflect.apply(emit, this, arguments)
}
