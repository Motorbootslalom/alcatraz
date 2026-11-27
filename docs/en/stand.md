[Deutsch](../stand.md) · English

# Status and origins

Where Alcatraz comes from, what has been taken over from the prototypes, what is built today and what is still missing.
What the app can do: [funktionen.md](funktionen.md); competition day and device operation: [betrieb.md](betrieb.md).
Why something is the way it is is recorded with a date in [entscheidungen.md](../entscheidungen.md) (German), open
questions under [Offen](../entscheidungen.md#offen) (German).

## How it came about

Since 1995 I have done the scoring of the competitions for the Landesverband Motorbootsport Brandenburg (the state
association of Brandenburg).
Back then still based on Excel and VBA.
Between competitions I extended the “program” bit by bit.
When I could no longer take part in 2003/2004 for lack of time, its development came to a halt as well.

Since 2008 I have been active again.
In the meantime Volker had developed a program of his own (also based on Excel).
The two programs have a lot in common and different strengths.
Together, however, they share the drawback that they only run with Excel on Windows.
They do not run with the current version for Mac OS X either.

Since I personally like working neither with Windows nor with Mac, the wish for a solution that does not depend on
the operating system keeps growing in me.
For this reason Alcatraz is to run in the browser.
Even without an active internet connection …

## Merging the prototypes

Alcatraz merges the previous prototypes:

| Source | Content | Status in Alcatraz |
|---|---|---|
| `verzahnung-prototyp-vue` | Drivers, race numbers, interleaving, boats needed, parallel slalom | taken over |
| `fehlerpunkte-prototyp-vue` | Rulebooks, setups, race officials' sheets, data entry, results | taken over, see below |
| `tafel` | Scoreboard, starting order in operation, devices via ntfy | taken over (E1–E8), field test open |
| `Parcours` | Course drawings | included, see below |
| Excel scoring | Team competition, weighing, certificate data and more | largely taken over, see below |

**From `fehlerpunkte-prototyp-vue`** the following have been taken over (details in [funktionen.md](funktionen.md)):

- rulebooks and setups (`src/config/`),
- the race official assignment and the preview of the lists
  ([Event and assignments](funktionen.md#event-and-assignments)),
- the [race officials' sheets](funktionen.md#race-officials-sheets),
  [checklists and QR codes](funktionen.md#checklists-and-qr-codes),
- [data entry](funktionen.md#data-entry),
- [scoring and results](funktionen.md#scoring-and-results),
  the [code notice](funktionen.md#code-notice).

Lists and scoring of the parallel slalom were added ([Parallel slalom](parallelslalom.md)).

**From `tafel`** everything the plan of 16.11.2026 provided for (stages E1 to E8) has been taken over, except the field
test: scoreboard in a second window, start release at the operating computer, starting order with waiting times and
spectator list, without a network (E1–E3), under UIM also for the parallel slalom (E4); the transmission core via an
ntfy server, encrypted and signed, with the gaps of the prototype closed
(E5, [technik.md](technik.md#device-operation-security-model)); read-only links with a QR code for
scoreboard and spectator list on other devices (E6) and pairing a phone for the start release (E7).
E8 is prepared: keeping the screen awake, “Reload all devices”, the quota counter and the
[procedure on competition day](betrieb.md#procedure-on-competition-day); the field test is still open
([feldtest.md](feldtest.md)).
How to use it: [Operation: start release and scoreboard](funktionen.md#operation-start-release-and-scoreboard),
[Device operation](betrieb.md#device-operation).

**From `Parcours`:** The drawings of classes E (Dolphin) and 1–7, for classes 5–7 also as “Möwe”, and the lane of the
parallel slalom are included (`src/assets/parcours`, `npm run parcours:sync`;
licence: [README](../../README.en.md#licences)).
They are used in the assistant for own setups (“In the picture”), on the race officials' sheets (in the parallel
slalom only on the course sheet) and on the race official's device (form “Picture”; with “Buttons” below the form).

**From the Excel scoring** the following are there:

- the [lists of drivers](funktionen.md#lists-of-drivers-and-pontoon-entry-list) and the pontoon entry list,
- [weighing](funktionen.md#weighing) with weight lists and the list “Extra weights”,
- the [team competition](funktionen.md#team-competition),
- the [results booklet](funktionen.md#results-booklet).

Still missing are the certificate data (intended as CSV/XLSX for mail merge, decision of 12.11.2026).

## Current status

As of 27.11.2026. Built and checked by tests is what stages E1–E8 and W1–W5 provided for; what is open is mainly the
field tests.

- **Before the competition, lists and scoring:** drivers, race numbers, weighing, interleaving, race officials'
  sheets, checklists, data entry, results and team competition according to the DM rules (German championship) and
  UIM rule 960, under UIM also parallel slalom and individual competition ([funktionen.md](funktionen.md),
  [parallelslalom.md](parallelslalom.md)).
- **Operation on competition day (E1–E8, 16.–20.11.2026):** scoreboard, start release, starting order with waiting
  times and spectator list ([funktionen.md](funktionen.md#operation-start-release-and-scoreboard)); with device
  operation switched on, scoreboard and spectator list also on other devices and the start release from the paired
  phone ([betrieb.md](betrieb.md#device-operation)).
- **Digital entry by the race officials (W1–W5, 21.–22.11.2026)** following the
  [proposal of 21.11.2026](../vorschlag-wkr-erfassung.md) (German)
  ([funktionen.md](funktionen.md#digital-entry-by-the-race-officials)):
  The race official enters their list on a phone or pad instead of on the sheet.
  Forms: “Buttons” for pontoon, gate 5, man-over-board and pontoon entry, on lists with buoys one row per stop;
  “Picture” (tap the buoys in the course drawing); “Table” for experienced users (pad and computer only).
  Timing lists have a numeric keypad, the knots a checklist at the table.
  A pad shows several lists side by side (in landscape up to four depending on the width, in portrait up to two).
  The trial run sends nothing, the practice needs no network (`#/uebung`).
  At the operating computer: a matrix of lists × starts, “Incoming” for queries and proposals, ◆ and “Check paper”
  in data entry, the racecourse light with auto mode in the start release.
  Values from the device take the same path as typing in; a cell that already holds a value is never silently
  overwritten.
- **The user's answers:** Rounds up to 11 of the question page (21.–26.11.2026) and the wishes of 24.11.2026 are built
  in. From round 11 (26.11.2026): the birthday warning in two levels (yellow note up to 14 days, red warning up to 2
  days around the first day of racing), shared race officials' sheets on request at DM and UIM championships too,
  co-drivers per class with a substitute and weight and an extra weight of their own, the repeat of an attempt after a
  confirmed breakdown, the position of the drawing named after start/finish, “↩ Undo” with an arrow pointing left, in
  practice only the explanation scrolls out of view. Before that, among others: several disqualifications at one buoy
  (“5, J, D”), a long press on a buoy, the lane of the parallel slalom on the device and on the course sheet, a maximum
  number per code (the third tap on “2nd and 3rd attempt” sets Disq. D), “Did not start · Disq. X” instead of “Did not
  pass”, the position of the drawing in “Picture”, the extra weight on the pontoon device and in adjustable steps,
  shared race officials' sheets of the club championship by the interleaving, a birthday warning according to section C8
  of the DM rules, the letter D for class E selectable under DM too, the tie-break of the individual competition
  according to rule 960, pt. 5.2.6 (in the parallel slalom the last, then the second-to-last heat driven). Details with
  dates: [entscheidungen.md](../entscheidungen.md) (German), on the digital entry by the race officials from [Digitale
  WKR-Erfassung](../entscheidungen.md#digitale-wkr-erfassung-antworten-21112026) (German) on, plus the plans `plan-*.md`
  (German).

## What is still open

- **Field tests** ([feldtest.md](feldtest.md)): device operation with real phones and the real ntfy server
  (read-only links, pairing, start release from the phone, background, Wake Lock, iPhone, quota) and the race
  officials' forms on phone and pad (gloves, sun, hit circles in the picture, knots at the table, timing, table).
  The tests check device operation against a simulated server; the findings of a first trial with a real phone
  (21.11.2026) have been incorporated, the checklist has not been worked through yet.
- **W6 depending on the findings** ([plan-wkr-w5.md](../plan-wkr-w5.md), German): the form “Picture” specially for
  the phone in portrait, timing lists specially for the phone, in the parallel slalom one pontoon device for both
  sides (“A | B” in one form).
- **Open questions** to the user for the next round of the question page, collected under
  [Offen](../entscheidungen.md#offen) (German): above all what was newly interpreted while rebuilding after round 11
  (repeat after a breakdown, co-drivers with substitute and weight, details of the birthday warning and of the shared
  race officials' sheets), plus single interpretations on the maximum number per code, on “Did not start · Disq. X”
  and on practice, older ones on pairing (E7) and on the separate finals.
- **Flaky tests:** Two end-to-end tests in `src/GeraetWkr.test.ts` occasionally fail under load (a fixed time limit
  while waiting). On GitHub they have only run on request since 24.11.2026, locally and in the pre-commit hook always
  ([technik.md](technik.md#tests)). The cause has not been fixed.
- **Check-in on the device:** planned as a later task in device operation (`src/geraete/aufgaben.ts`), not built.
- **From the Excel scoring:** the certificate data.
- Ideas without a decision: empty boxes in the [list of ideas](#original-list-of-ideas).

## Original list of ideas

The list dates from the time before the prototypes; the wording of the ideas is unchanged in the German original
(translated here), only typos have been corrected.
The boxes were brought up to date against the code on 25.11.2026.
After each idea, “→” says where it is implemented, or what is missing.
“Solved differently” means: the purpose is fulfilled, only in a different way than in the idea.
“Partly” and “open” mean: still to be decided whether it comes or is dropped.

Here just a roughly sorted listing of most of the ideas:

- [x] Interleaving (driver 1 class 1, driver 2 class 4, driver 3 class 1, ...)
  → [Interleaving](funktionen.md#interleaving)
- [x] View for race officials
  → [digital entry by the race officials](funktionen.md#digital-entry-by-the-race-officials) on their own phone or
  pad (W1–W5, see [Current status](#current-status)); the field test is still pending
  - [x] Login and permission model ... → solved differently: no login. A device is paired at the operating computer
    by QR code or device code and gets its tasks there: start release for certain racecourses, one or more race
    official lists. They can be changed and revoked in the device list; checking happens only at the operating
    computer. Settings and “Reset operation” stay there.
  - [x] Next start is only released once all race officials have approved the attempt
    → solved differently, deliberately without a lock (decision F4 of 21.11.2026: a device can fail): The
    racecourse light of the start release is green until the driver has passed the start gate (“Through the start
    gate” or the first row of a racecourse race official), then red until every digitally entered racecourse list has
    sent the start. The auto mode (off by default) then shows the next one by itself. Otherwise the start release asks
    “Continue anyway?” when a racecourse list is behind, or only warns (Settings → Order of starts in operation).
    Pontoon and pontoon entry never hold things up.
  - [x] Race number and class must update before every start → The race official's device shows by itself the start
    that the start release has shown: race number large, class, never the name; pontoon entry and leaving the pontoon
    already see the next starts in advance. In the buoy form, “Attention, class change!” appears briefly at the first
    start of a new class.
  - [x] Driver page → the [scoreboard](funktionen.md#operation-start-release-and-scoreboard) in the second
    window at the operating computer (“In the boat”, before it), the starting order in operation and the spectator
    list (built for the phone); since E6 scoreboard and spectator list also via a read-only link on other devices,
    since E7 the start release on the paired phone
    - [x] Display of information such as race number, name, class and attempt → scoreboard
    - [x] Split into 'In the boat', 'At the pontoon', 'At pontoon entry' → spectator list (scoreboard: “In the boat”
      and before it)
    - [x] Number of drivers in the areas configurable (1 in the boat, 2 at the pontoon, 2 at pontoon entry) →
      Settings → Order of starts in operation (0–10 each)
    - [x] Order changeable, depending on permission → at the start release hold back, move, let a class sit out or
      bring it forward, in the starting order also by dragging. At the operating computer everything works, on the
      paired phone only in the released racecourses and without “Reset operation”.
    - [x] Different colours for class and attempt → scoreboard (class in the class colour, attempt in a colour of
      its own)
    - [x] Drivers move up automatically after a completed attempt → “Next start” shows the next one in the order,
      in auto mode without a tap as soon as all racecourse race officials have sent; the next attempt is begun
      explicitly
    - [ ] Schedule (breaks, end of the day etc.) in the sorting → open; breaks exist as a message on the
      scoreboard (also as a template: Lunch break, Prize-giving …)
    - [x] Approximate calculation of the time until the start/pontoon entry → starting order and spectator list:
      “in about” and “To pontoon entry” from the intervals between starts per class (measured from three measurements
      on, otherwise the default from the DM 2025); not in the parallel slalom
- [x] Printed race official lists → [race officials' sheets](funktionen.md#race-officials-sheets); lists that are
  only entered on a device are not printed by Alcatraz (“Print anyway” as a fallback)
  - [x] Interleaving on one list (no changing of sheets again and again, but filled in from top to bottom) (optional)
    → One sheet applies per class and attempt, the drivers on it are in the starting order of the interleaving. If
    several classes are on one sheet (club championship), since 24.11.2026 there has been the choice “Classes on
    shared sheets” (Settings → Race officials' sheets): separate, one block per class with a heading, or by the
    interleaving, mixed in starting order. Since 26.11.2026 shared sheets are also available on request at DM and UIM
    championships (tick “Shared sheets …” in the same place), with the same choice.
  - [x] light shades of grey or colour for other classes
    → solved differently (user 24.11.2026: “we don't need colours”): when separate, each block carries the class as
    a heading; by the interleaving it stands in the column “Cl.” behind the race number.
    - [x] Grey out the chicane (and other observation points not driven) for smaller classes on interleaved lists
          → columns a class does not have are strongly hatched in its rows, like the row of a dummy in the
          parallel slalom (since 24.11.2026)
  - [x] Also several classes on one page (configurable)
    → with the type “Club championship” (Event tab), since 26.11.2026 on request at championships too (“Settings →
    Race officials' sheets → Shared sheets”); lists whose drawing differs between classes stay one per class, except
    with “Save paper” (then without the course drawing)
    - At club championships or small competitions with only 1–2 drivers per class, a list of its own makes no
      sense
  - [x] Transfer of lists into the program with the same view
        (browser form and observation list are identical) → [Data entry](funktionen.md#data-entry); values from the
        race official's device arrive via the same data entry (◆)
    - Less error-prone and easy to check
  - [ ] Attempt can only be 'completed' once all observation lists have been entered & checked
    → partly: on paper the [checklist](funktionen.md#checklists-and-qr-codes) has a box per sheet and the steps of
    the scoring; data entry shows the progress per sheet. Digitally the race official closes their list on the device
    with their name (“Close the list” replaces the signature on the sheet); after that, corrections only go as a
    proposal. What is missing is shown by the matrix under Operation → Race officials. Nothing is locked.
    - [ ] Four-eyes principle. Checking must be done with another race official/user
      → partly, on paper: “Checked” and “Signed” on the checklist; in the app open, without users
- [ ] Support for 'fun drivers' → open
    - Older drivers drive in a younger class (in addition to their actual attempt)
    - Included on the lists and in data entry
    - Included on the notice board
    - Not in the final scoring, but with information for the prize-giving (difference to the actual driver etc.)
- [x] Do not show the club at a club championship → origin “none” in the Event tab
- [x] Store rules as a set (German championship rules)
  → DM rules (`dm-2026`), plus UIM rule 960 (`uim-2026`); [Rulebooks](funktionen.md#rulebooks-and-terms)
- [ ] Rules for the event based on the DM rules
  → partly: attempts, dropped attempts, additional sheets, own setups and the steps of the extra weight can be set
  per event; switching off or overriding individual rules is not possible.
  - Rules can be deactivated or overridden
- [x] Violations are given and shown with an abbreviation (A, B, C etc.)
  → disqualification letters and penalty codes from the rulebook; [code notice](funktionen.md#code-notice)
- [x] Times can be entered in the format 1,2345 and 83,45 instead of 1:23:45
  → [Data entry](funktionen.md#data-entry); on the race official's device likewise via a numeric keypad
  - Conversion for the display happens automatically
- [x] Every touch, every penalty point is recorded individually and is also shown accordingly on the notice board
  → Recorded per gate and buoy (start and finish separately by L and R).
  The results of an attempt show the points per sheet of the course and the column “Penalty codes”.
- [x] Pontoon entry lists → [Lists of drivers and pontoon entry list](funktionen.md#lists-of-drivers-and-pontoon-entry-list);
  plus a pontoon entry sheet that is entered and scored like the other sheets
  - For ticking off attempts and possibly points, taken off because of life jackets on the pontoon
- [x] 3 extra rows under observation lists → blank rows for late entries, number adjustable
  (Settings → Race officials' sheets)
- [x] Notice board lists → [Scoring and results](funktionen.md#scoring-and-results)
  - [x] Late starters (who do not drive in the regular interleaving) are shown at the top (1st place)
    → Whoever has not driven yet stands in 1st place without a time.
  - [x] Penalty points != buoy touches are shown as letters
    → “Penalty codes” on the results of an attempt: the penalty codes, followed by the disqualification letters
    - Letters the same throughout the program
    - [ ] Only the letters that appear in the notice board list are shown as an (optional) table below it
      → open: today all codes of the rulebook are on a notice of their own, not only the ones used below the list.
