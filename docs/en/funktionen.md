[Deutsch](../funktionen.md) · English

# What Alcatraz can do

Everything Alcatraz can do today – by area, roughly in the order of a competition.
Why something is the way it is is recorded with a date in [entscheidungen.md](../entscheidungen.md) (German);
“decision of …” there and here means a decision of the user.

- Procedure on competition day, without internet, backup, history and how to use device operation:
  [betrieb.md](betrieb.md).
- Parallel slalom and individual competition under rule 960: [parallelslalom.md](parallelslalom.md).
- Structure and development: [technik.md](technik.md). What is still missing: [stand.md](stand.md).

## Contents

- [Rulebooks and terms](#rulebooks-and-terms)
- [Event and assignments](#event-and-assignments)
- [Drivers and race numbers](#drivers-and-race-numbers)
- [Origin and flags](#origin-and-flags)
- [Weighing](#weighing)
- [Interleaving](#interleaving)
- [Race officials' sheets](#race-officials-sheets)
- [Checklists and QR codes](#checklists-and-qr-codes)
- [Operation: start release and scoreboard](#operation-start-release-and-scoreboard)
- [Device operation](#device-operation)
- [Digital entry by the race officials](#digital-entry-by-the-race-officials)
- [Data entry](#data-entry)
- [Scoring and results](#scoring-and-results)
- [Team competition](#team-competition)
- [Further lists and printing](#further-lists-and-printing)
- [Locks and checks](#locks-and-checks)
- [Parallel slalom and individual competition (rule 960)](#parallel-slalom-and-individual-competition-rule-960)
- [Sample data](#sample-data)

## Rulebooks and terms

Alcatraz knows two rulebooks: the DM-Reglement 2026 (`dm-2026`, the rules of the German championship) and UIM rule 960
“Formula Future” (`uim-2026`).
Under the DM only manoeuvring is run, under UIM also the [parallel slalom](parallelslalom.md).
Each rulebook is a YAML file under `src/config/regelwerke/`: classes, average weights, co-driver, penalty and
disqualification codes, attempts and dropped attempts, dead-heat rule, team competition, checklists and the language
of the lists. The setups of the racecourses are under `src/config/aufbauten/`.

**Further rulebooks:** Associations and organisers from other countries are invited to send their rulebook so that it
can be included – most easily via the
[template for a new rulebook](https://github.com/Motorbootslalom/alcatraz/issues/new?template=regelwerk.yml) on
GitHub. Helpful are:

- the rulebook itself (PDF or link),
- the classes with their age limits (years of birth, birthdays),
- the penalty and disqualification codes with their points or seconds,
- the language the lists should be in.

**Terms according to the rulebooks:**

- In German the lists are called “Wertungslisten” (DM-Reglement C7).
- English follows the UIM Circuit Rulebook, rule 960: “driver”, “attempt”, “race number”, “race official”,
  “team manager”, “co-driver”, “extra weight”, “pontoon”, “results”, “ranking”, “dead heat”.
- Class E is called “Dolphin” everywhere under UIM (`klassenNamen` in the rulebook), “Klasse E” (class E) under the DM.
- Weights: “(statistisches) Durchschnittsgewicht” and “Ausgleichsgewicht” (DM-Reglement C3),
  in English “average weight” and “extra weight” (UIM 960 pt. 3.7).
- The co-driver is called “Co-Pilot” in the DM-Reglement, “co-driver” in the UIM rulebook.
- The terms of the parallel slalom are listed under [Dummies and terms](parallelslalom.md#dummies-and-terms).

**Language:** The user interface can be switched between German and English at any time.
The lists follow the rulebook, not the user interface (`listenSprache`: DM German, UIM English).
Only the race officials' sheets can be chosen per list and racecourse – German, English or bilingual –, and only where
the rulebook offers English. The choice is made in the race official assignment next to each name, because a group of
its own sits at each racecourse (`src/lib/listensprache.ts`, `AppState.wkrSprachen`).

## Event and assignments

The “Event” view takes name, year, date, number of attempts, type (championship or club championship),
origin (club, state, country or none), rulebook and setup.

- **Date** (24.11.2026): the first day of competition, optional. It is only needed for the warning about permission to
  start by birthday – with a date exact to the day, in two levels (see [Locks and checks](#locks-and-checks)); the
  years of birth are calculated with the year. If it lies in another year, a note at the field says so. It is kept in
  the backup, not in the template.
- **Assignments:** race official assignment, boats and co-drivers per class are in the block “Assignments”.
  The names of the race officials and the names and weights of the co-drivers are kept only in the backup, never in
  the template; the boat of the class also in the template (`src/lib/besetzung.ts`). On the co-drivers see
  [Co-drivers and their extra weight](#co-drivers-and-their-extra-weight).
- The **preview of the lists** (“What the lists look like”) is here and in the wizard, under UIM also with the lists
  of the parallel slalom per racecourse. It only displays the names of the assignment.
- Own setups are created under “Settings” (wizard and YAML exchange).
- At the end of the view is the [sample data](#sample-data).

## Drivers and race numbers

The “Drivers” tab keeps the drivers per class – by hand or via the exchange with Excel.
Race numbers are by class (E01, 101 …) or classic (consecutive).

<a href="../bilder/en/starter.png"><img src="../bilder/en/starter.png" width="300"
alt="Drivers tab: classes with race numbers, names and origin with flag"></a>

**Exchange with Excel** (`src/components/ExcelPanel.vue`, `src/import/tsv.ts`, `src/import/starterMerge.ts`):

- **Replace list** recognises existing drivers by class and race number, then by class and name;
  they keep their ID and with it their weight and place in the interleaving.
  If the list comes without race numbers, a recognised driver keeps their previous number (16.11.2026).
- **Add to list** only adds new drivers and names those passed over separately (16.11.2026).
- **Copy list of drivers** writes the gender in the language of the user interface
  (M, W, D, k. A. or M, F, D, n/a); the import reads both spellings.
- “Assign automatically” numbers each class in its order when numbering by class,
  and in the starting order of the interleaving when numbering classic.

**Race numbers by vest size** (19.11.2026; Settings → “Race numbers by vest size”,
`src/domain/startnrBereiche.ts`): Race numbers by class are printed on vests in clothing sizes.
In each class a range of numbers belongs to one size group (S–M, L–XL, XXL; XS counts as S–M, XXXL as XXL).
Under the DM the race number list of the DMYV (the German motor yacht association) is the default (`startNrBereiche`
in `dm-2026.yaml`), under UIM there is none.
The event can set its own ranges per class and enter the numbers of missing vests (“512, 517, 623”);
both travel with backup and template.

- “Assign automatically” gives each driver, in the order of the tab, the next free number from the range of their
  size. If a class only has ranges of one group (DMYV: E to 3 only S–M), that range applies to everyone, even without
  a size. Missing vests are always skipped.
- If the range is full or the size is missing in a split class, the number stays empty; the tab names the driver
  under “Check by hand” (no automatic fallback, 20.11.2026).
- New drivers (by hand, “Move to class X”, Excel import, sample drivers) likewise get the first free number of their
  range.
- Moving (▲▼) works freely; the numbers move along. “Change order” and “Random” only reorder within a size group
  (20.11.2026).
- A number is only taken if it is written exactly the way the assignment writes it (“5012” in class 5 does not take
  512). Under “Race numbers” the tab names whose number does not match their size.

**Letter of class E** (since 24.11.2026 in both rulebooks): E (default) or D – under DM “Letter of class E”, under UIM
“Letter of the Dolphin numbers” (“Drivers → Race numbers”, in backup and template; applies to newly assigned numbers).
The ranges of numbers follow it: with D, E01–E30 becomes D01–D30. E and D are read the same;
after switching, E02 is therefore followed by D03, not D01 (`parseClassNumber`).

What is locked from when and what is checked – including year of birth and birthday – is described under
[Locks and checks](#locks-and-checks). Who counts for the team competition can be chosen
(see [Team competition](#team-competition)).

## Origin and flags

For the origin “State” and “Country” the following show the flag on request: Drivers tab, lists of drivers, pontoon
entry and weight lists, results and team competition – not the race officials' sheets.
Forms: written out or abbreviation, flag + abbreviation, flag + written out or flag only
(“Settings → Lists”; the team competition has the choice at the list).
It is decided in one place (`herkunftAnzeige` in `src/lib/origin.ts`).

- **Matching** (`src/domain/flaggen.ts`, `src/domain/staaten.ts`): The origin is free text on the driver.
  German states are recognised by abbreviations (BY, DE-BY), names and common spellings (NRW, BaWü, Thueringen),
  countries by ISO codes (DE, DEU), IOC codes (GER, NED, SUI) and German and English names.
  Conjunctions and “Saint”/“St.” do not count. Whatever is not recognised is shown as text; the “Drivers” tab names it.
- **Nations are international:** On an English list a recognised country appears in English, even if it was entered
  in German (“Litauen” → “Lithuania”); on a German list it appears as it was entered.
- **Country codes** (`laenderKuerzel` in the rulebook, `src/domain/kuerzel.ts`): In both rulebooks countries carry the
  IOC code (GER, SUI, NED, LAT) – according to rule 209 “POSTING OF THE RESULTS”, under the DM since 15.11.2026,
  because the association belongs to the German Olympic Sports Confederation. Every recognised country becomes this
  code (“Germany”, “Deutschland”, “DEU” → GER); former IOC codes (ROM, SIN, TRI) are recognised, today's are output.
  German states keep their abbreviations (BY, NW). The event's own abbreviations take precedence.
- **Spellings:** If drivers name the same state differently (“NRW” and “Nordrhein-Westfalen”), they carry the same
  flag and the same abbreviation. In the [team competition](#team-competition) and on the lists of drivers per origin
  they are **one** team; the list shows the most frequent spelling. “Baden” and “Württemberg” alone
  do not count as Baden-Württemberg.
- **Printing:** In print the flag never stands alone – with “flag only” the abbreviation is added (black-and-white
  printing). The flag does not change the page split.
- **Images:** vector images (SVG), embedded at build time, nothing is loaded at runtime; no emoji.
  Countries from [country-flag-icons](https://www.npmjs.com/package/country-flag-icons) (MIT licence,
  © 2020 @catamphetamine); German states each with the state flag that anyone may fly (Wikimedia Commons,
  public domain; [`src/flaggen/bundeslaender/LIESMICH.md`](../../src/flaggen/bundeslaender/LIESMICH.md)).
  The notices are also in the app under “Settings → Third-party components and licences”.

## Weighing

- **Weight lists** per origin for filling in at check-in. “Print weight lists” in Weighing opens them
  for the chosen origin; the address (`#/lists/weights/<origin>`, German `#/listen/gewicht/<Herkunft>`) can be passed
  on (16.11.2026).
- The weights are entered in the “Weighing” tab. The average weights per class are in the rulebook and
  can be changed under “Settings → Average weights”.
- **Steps** (24.11.2026): There is also “Extra weight in steps of” – 0.1 / 0.5 / 1 / 2 kg or a value of your
  own (0.1–10 kg; default 1 kg). The step is the smallest weight piece that is put into the boat at the pontoon.
  The extra weight is a multiple of it, rounded half up (with 2 kg: 2.9 → 2 kg, 3.0 → 4 kg; with 0.5 kg:
  1.2 → 1 kg, 1.25 → 1.5 kg). Anyone lighter by less than half a step needs none. Weighing, lists and
  pontoon device calculate the same way (`rundeAufStufe` in `src/domain/gewicht.ts`, `ausgleichVon` in
  `src/lib/ausgleich.ts`).
- **List “Extra weights”** for the pontoon: one sheet per class by race number with the extra weight and a box per
  attempt; in the head boat, co-driver and – if entered – below it in small print “Substitute co-driver” with the name,
  from the assignments (`src/components/AusgleichListen.vue`). If a co-driver needs an extra weight, it is in brackets
  after the name (under UIM “Vor2 Nach2 (+3.5 kg)”, under DM in German “(+3,5 kg)”), if their weight is missing,
  “(not weighed)”; never the body weight. Empty means “none needed”, also when rounded to 0 kg (Weighing then shows
  “0 kg”).
  Anyone not weighed yet gets a field for adding it by hand (“not weighed”, “kg”).
- **On the pontoon device** (24.11.2026): With digital entry by the race officials, the device shows the same extra
  weight next to the race number in the part “Leaving” – “Extra weight 4 kg”, “no extra weight” or “Extra weight: not
  weighed”. Nothing is maintained at the pontoon; a weight added later in Weighing reaches the device by itself. Only
  the extra weight goes over the line, encrypted for the pontoon list, never the body weight
  ([decision](../entscheidungen.md#ausgleichsgewicht-am-steg-entscheidung-24112026) (German)).

### Co-drivers and their extra weight

If co-drivers change within a class, the total weight should stay the same in every attempt (26.11.2026;
`src/lib/besetzung.ts`, `src/lib/ausgleich.ts`). The drivers are calculated as before: average weight minus body
weight.

- **Entering:** “Event → Assignments”, table “Boats and co-drivers” with the columns Class, Boat, Co-driver, Weight,
  Substitute co-driver, Weight. The weight is optional and is read as in Weighing (comma or point, “kg” may be added,
  stored to 0.1 kg); anything unreadable removes the weight, the name stays. Enter first goes through all boats, then
  through all co-drivers, their weights, the substitute co-drivers and their weights.
- **Below the weight** a small note says what follows from it: “+4 kg extra weight” for the lighter co-driver,
  “weight missing” if others of their group are weighed but they are not, “counts only with a name” for a weight
  without a name; nothing for the heaviest. Below the table a sentence names the choice in force, with the link
  “Change: Settings → Average weights”.
- **Choice** under “Settings → Average weights” (jump target `#/settings?average-weights`), below “Extra weight in
  steps of”: “Extra weight of the co-drivers” **per class** – against the heaviest co-driver of the class (default) –
  or **across all co-drivers** – against the heaviest co-driver of the classes with drivers; as long as no driver has
  been entered, against all classes of the assignments. A lighter co-driver gets the difference, rounded with the same
  step as the drivers (to the nearest step, halves up) and separate from the extra weight of the driver. The choice
  travels with backup and template.
- **Who counts:** only a co-driver with a name and a weight. If the name of a substitute co-driver is deleted (they
  drop out), their weight stays in the field but no longer causes ballast for the other one, and the lists show no
  empty field “Substitute co-driver”. Typing the name in again makes the weight count again. For the assigned
  co-driver their line on the lists stays empty for filling in by hand.
- **On the lists:** the “Extra weights” for the pontoon (above) and the
  [list according to rule 960, pt. 3.7](#list-of-drivers-per-team-rule-960) show both co-drivers one below the other,
  the extra weight in brackets after the name, never the body weight. Race officials' sheets, scoreboard, spectator
  list, start release and devices show no co-drivers.
- **Data protection:** names and weights of the co-drivers are kept only in the backup, never in the template. The
  history has the entry “Co-driver weight recorded”. Older states and backups are taken over: the previous co-driver
  becomes the assigned one, without substitute and without weight.

### List of drivers per team (rule 960)

Rule 960, pt. 3.7 requires: Race number, Name and surname, Sex, Date of birth, Verified weight and ballast
required, Class, in the classes Dolphin and 1–3 the co-driver
(“Lists → Weight lists → per team”, `src/lib/teamListe.ts`).

- An **internal** list, in no results booklet. The date of birth follows the list option “Show the date of birth on
  lists of drivers”.
- “Ballast required” is the extra weight in the steps of the event; “–” means none needed.
- The column “Co-driver” shows the assigned co-driver and below it, introduced in small print with “Substitute
  co-driver:”, the substitute, each with the extra weight in brackets (“Vor2 Nach2 (+3.5 kg)”). A long line gets
  smaller, the assigned co-driver keeps the normal size (26.11.2026).
- For this there is the optional driver field **Gender** with four values (15.11.2026, `src/domain/geschlecht.ts`):
  M, F, D, not specified; empty means “not recorded”. Under rule 960 the Drivers tab has a column for it.
  Import column “Sex”/“Gender”/“Geschlecht” (m, male, männlich; f, w, female, weiblich; d, divers; na, n/a,
  keine Angabe). On the list it appears in English: M, F, D, n/a.
- The gender is kept in backup and driver data, never in the template; scoring does not know it.

## Interleaving

The interleaving sets the starting order and with it race numbers and all lists.

<a href="../bilder/en/verzahnung.png"><img src="../bilder/en/verzahnung.png" width="300"
alt="Interleaving: classes on the lanes of a racecourse, locked"></a>

- The classes are distributed by number of drivers as evenly as possible onto the lanes of a racecourse,
  so that the boat changes after every start.
- Quick selection for one or two racecourses. Class blocks can be dragged between the lanes;
  a pause lets a lane sit out a few starts.
- The boats needed are checked against the small and large boats available.
- “Lock interleaving” locks racecourses, lanes and boats so that race numbers and lists remain valid.
- Under UIM the starting order of the parallel slalom with the heats after it is also here – per class or with
  “All classes on” for all at once ([Starting order](parallelslalom.md#starting-order-of-the-preliminary-heat),
  [Heats after the preliminary heat](parallelslalom.md#heats-after-the-preliminary-heat)). Once the lists of a heat
  have been printed, its order stays until “Release print lock” (20.11.2026).

## Race officials' sheets

The race officials' sheets (German “WKR-Bögen”) are under “Lists” (`src/lib/wkrListen.ts`,
`src/components/WkrListen.vue`).

<a href="../bilder/en/wkr-bogen.png"><img src="../bilder/en/wkr-bogen.png" width="240"
alt="Race officials' sheet for gate 1/3/5 with QR code, legend of the disqualifications and course drawing"></a>

- One sheet per racecourse, class, attempt and list; the race numbers in the starting order of the interleaving.
- Blank rows for late entries; optionally the description on the back.
- The course drawing is on the sheets, dimmed according to the position. In the parallel slalom only the course sheet
  (Fahrweg) of each racecourse carries the single lane, to the right of the legend (23.11.2026,
  [parallelslalom.md](parallelslalom.md#race-officials-sheets-of-the-preliminary-heat)).
- The sheets are only printed after the interleaving has been locked (see [Locks](#locks-and-checks)).
- **Print order** (21.11.2026): per racecourse position by position, within that the starting order (1st attempt in
  the order of the classes, then the 2nd …) – the stack only needs to be split at the positions (`WKR_DRUCKFOLGE`).
  Parallel slalom: per racecourse position by position, within that the heats. Checklists stay per class and attempt
  (with shared sheets mostly per racecourse and attempt, see [checklists](#checklists-and-qr-codes)).
- Lists that are only entered on a device (Operation → Race officials, mode “Device”) are not printed, not even on
  the checklist; a note above the stack offers “Print anyway”. Paused and signed-off lists and a pontoon of which
  only one part is on devices are printed (`src/wkr/druck.ts`).

**Shared sheets:** Classes whose sheets are built alike (same columns, same course drawing) share a page; lists whose
drawing differs between classes stay one per class. With “Save paper” all classes of a list are on one sheet, without
course drawing, the blank rows once per page under “Late entries” instead of per class. Scoring is per class in any
case.

- **Club championship:** always shared sheets; “Save paper” is preselected there.
- **Championship (DM and UIM)** since 26.11.2026 on request: “Settings → Race officials' sheets”, tick “Shared sheets:
  classes whose sheets are built alike on one page” (off by default; otherwise every class has its own sheets). Only
  with the tick do “Save paper: all classes of a list on one sheet, without the course drawing” (off by default here;
  without the course drawing the race official only has the description, and if the classes drive different courses,
  the drawing of their class is missing) and “Classes on shared sheets” appear below it. The sheets then look as at
  the club championship: in the head for example “Classes 4, 7”, the QR code names all classes of the sheet. A note
  above the sheets under “Lists” says that they are shared. The preview of the lists (Event, “Race officials”) also
  shows the shared sheet. The setting travels with backup and template and is still there after switching to the club
  championship and back. Unchanged: race officials' devices (lists per racecourse and list), parallel slalom,
  results, team competition and results booklet.
- “Classes on shared sheets” (24.11.2026, `wkrGemeinsamFolge`): **separate** (default) – one block per class with
  the class as heading – or **by the interleaving** – all drivers mixed in starting order, the class in a narrow
  column next to the race number, the blank rows at the end of every page with an empty class cell.
  The head names the classes of the page; checklists, QR codes and data entry follow the same order of rows.
- Columns that a class does not have are heavily hatched in its rows, like the row of a dummy in the
  parallel slalom. Scoring is per class in both cases.

**Lists of the event** (`src/lib/listen.ts`): the lists of the setup.

- Optionally “Gate 5 also monitors the racecourse”: one list instead of two. Disq., remark, tick and
  race official name then move over (`src/state/tor5.ts`).
- In addition, extra lists outside the setup: knots, pontoon entry, variants without start/finish. They are printed,
  assigned, entered, scored and counted on the checklist like those of the setup.
- Both rulebooks provide the knots list in every manoeuvring setup (`vorgabeListen`); it can be deselected.

**List options** under “Settings”:

- Drivers per page fixed instead of automatic, and “Split from”. Shared sheets of several classes are always split
  automatically; the note below says so at a club championship and with shared sheets switched on.
- Club championship: “Save paper” and “Classes on shared sheets”; championship: before them the tick “Shared sheets
  …”. “Blank rows per page” appears as soon as “Save paper” is on or the classes stand by the interleaving; otherwise
  they stay blank rows per class (3 at a championship).
- Names of the buoy sides: R/L, Land/Sea, Quay/Harbour, arrows, Inner/Outer. The results stay with R/L.
- The language of the sheets: see [Rulebooks and terms](#rulebooks-and-terms).

## Checklists and QR codes

**Checklists** (German “Laufzettel”) are a list type of their own (`src/lib/laufzettel.ts`,
`src/components/LaufzettelListen.vue`).

<a href="../bilder/en/laufzettel.png"><img src="../bilder/en/laufzettel.png" width="180"
alt="Checklist with a box per list, the steps of the scoring and QR code"></a>

- One checklist per stack of sheets: racecourse, class and attempt. Where classes share sheets (club championship, or
  a championship if switched on), one checklist covers all of them, usually one per racecourse and attempt; sheets of
  single classes on it (lists with a drawing of their own) name their class in the row (“Cl. 4”).
- An A4 landscape sheet to be folded to A5, with a box per printed page – measured on the same sheets
  that are printed. The layout can be chosen: one row per page or one row per list.
- The knots (a list without attempt) are in the stack of the last attempt. Its checklist has steps of its own:
  no posting, but review by the team managers and the overall result (`schritteLetzterLauf`).
- The steps depend on the rulebook (`laufzettel`; default in `src/config/einstellungen.yaml`).
  UIM: posting within one hour, signed by the O.O.D. (pt. 5.2).

**QR codes** are on every printed page of every sheet and on every checklist (`src/lib/qr.ts`).

- Format `ALC1.<Veranstaltung>.<Regelwerk>.<Aufbau>.<Parcours>.<Klassen>.<Lauf>[.<Liste>.S<Seite>]`
  (event, rulebook, setup, racecourse, classes, attempt, list, page), embedded as a vector (`qrcode-generator`).
- A handheld scanner or the field “Scan sheet” jumps in data entry to the sheet and into its first cell.
  If the sheets have been grouped differently since printing (shared sheets switched on or off), scanning an old
  sheet shows the sheet the class is on now (with several classes the first one) and says so; the entries belong to
  the driver and end up in the right place.
- The code of a checklist shows all lists of its stack one below the other, with a jump bar.
  By hand: “all, one below the other” in the choice of list.
- Sheets of another event, another rulebook or setup are rejected with a reason.
- A scan leaves no trace in the field in which the cursor happened to be (`src/lib/scanner.ts`).

## Operation: start release and scoreboard

On competition day the operating computer releases who starts next; a **scoreboard** shows it in a
second window, for example on a monitor at the pontoon. In addition there is a **starting order** with estimated
waiting times and a **spectator list**. Tab “Operation” with the sub-tabs Start release, Starting order, Devices and
Race officials (`src/views/BetriebView.vue`, logic in `src/betrieb/`). None of this needs a network; it only reaches
other devices with [device operation](#device-operation).
Step by step: [Procedure on competition day](betrieb.md#procedure-on-competition-day).
Neither the DM-Reglement nor rule 960 governs the procedure at the pontoon; what has been interpreted is in
`BETRIEB_ANNAHMEN` (`src/betrieb/annahmen.ts`).

<table>
<tr>
<td valign="top" width="300"><a href="../bilder/en/start-freigabe.png"><img src="../bilder/en/start-freigabe.png"
width="300" alt="Start release at the operating computer with a start in progress"></a>
<br>Start release at the operating computer</td>
<td valign="top" width="300"><a href="../bilder/en/anzeigetafel.png"><img src="../bilder/en/anzeigetafel.png"
width="300" alt="Scoreboard in the second window, landscape"></a>
<br>Scoreboard in the second window</td>
<td valign="top" width="120"><a href="../bilder/en/zuschauer.png"><img src="../bilder/en/zuschauer.png"
width="120" alt="Spectator list at phone width"></a>
<br>Spectator list</td>
</tr>
</table>

**Principles:**

- **The prerequisite** is the locked interleaving; before that the tab only shows the way there. If it is unlocked in
  the middle of the day, showing, “Begin attempt” and everything that rearranges the order are on hold; Back,
  messages and reset keep working.
- **The order of starts** is never stored, but derived attempt by attempt from the interleaving – the same as
  on the race officials' sheets (`src/betrieb/folge.ts`). What is stored is what was shown and begun, and after the
  first rearrangement a snapshot of the order (`src/betrieb/schritte.ts`). Operation never changes interleaving or
  sheets. With “Attempts run consecutively” (UIM) each driver runs their attempts one after the other.
- **Release goes by attempt, not by position:** A start of an attempt that has not begun yet waits – even
  if it already stands in the middle of the current one; showing a start specifically always works.
- **X:** A start with X (“did not start”) in a Disq. cell of the attempt is dropped; without X it is back.
  Operation itself never sets an X and never writes values; only the repeat after a breakdown (below) discards
  values, explicitly and after a confirmation question.
- **A confirmation question** only comes before “Begin attempt” while starts are open, before “Reset operation”,
  before a repeat after a breakdown and, with digital entry by the race officials, on a backlog before showing;
  everything else can be taken back.

### Start release

One card per racecourse (`src/components/betrieb/StartFreigabe.vue`):

- **“Begin attempt N”** releases the starts of the attempt. Open starts of the current attempt stay released and
  come first.
- **“Next start”** brings the next open start onto the scoreboard, **“Back”** takes it back.
  A double click only switches once. At the end of an attempt the scoreboard keeps showing the last driver.
- **Hold back:** The next driver is briefly prevented and is listed under “Held back”; from there “As next”,
  “To the end of the attempt” or “Show now”.
- **To be made up:** Starts that were overtaken without having had their turn (late entry, removed X, missed
  attempt). They never come by themselves; they are shown or put back in line.
- **Choose another driver** (`BetriebsFolge.vue`): the next twelve open starts or the whole order, plus a
  search by race number or name across everything still to be shown – later attempts too. “Show” brings the start
  onto the scoreboard at once; the previous next driver stays the next one.
- **Repeat (breakdown) …** (26.11.2026; since 27.11.2026 also on the paired start release phone and in the parallel
  slalom; `AusfallWahl.vue`, `BETRIEB_ANNAHMEN` WH1–WH14, WHP1–WHP6): after a confirmed breakdown the driver's
  attempt is repeated. The choice shows the starts already shown in the attempts under way, the one shown last first;
  the first eight are shown at once, the search by race number finds the others. Starts of withdrawn drivers are
  greyed out (“withdrawn – no repeat”). If the driver is to blame, the race official enters “J” at the buoy (wrong
  racecourse) – then there is no repeat. “Repeat …” asks “Repeat after breakdown: 102, Attempt 1?”; “Discard values
  and repeat” empties all values of this driver in this attempt on every sheet, including those from the race
  officials' devices and their open queries. With “Attempts run consecutively” (UIM) the pontoon entry line stays;
  the question says so. The open confirmation closes by itself if its start has meanwhile been repeated elsewhere,
  taken back or given an X. In the parallel slalom the confirmation asks instead which boats repeat
  ([Parallel slalom in operation](#parallel-slalom-in-operation)). From the phone, the operating computer checks
  every repeat once more; a refusal is shown there as a sentence ([Device operation](#device-operation)). In English
  this is always called “Repeat”, never “Re-run” – that is the heat after a tie in the parallel slalom.
- **Repeat pending:** this is where the start waits afterwards; it never goes by itself. The O.O.D. puts it in line
  with “As next” or “To the end of the attempt” or shows it with “Show now” – also from the paired start release phone
  and in the starting order. Until then the aborted attempt stands under “In the boat” with “breakdown – to be
  repeated”; “Back” is locked, and there is no racecourse light and no auto mode for it. If nobody runs in the start
  any more afterwards (X, for example through a withdrawal), it is dropped: it disappears from “Repeat pending” and
  from the choice, and there is no “No repeat after all” for it any more.
- **No repeat after all** (in the list “Repeat pending”, at the operating computer and since 27.11.2026 also on the
  start release phone, as long as the start has not been shown again): the aborted attempt counts again, and its
  discarded values come back – on all sheets, including the ticks “entered” and “no time”, but only into fields that
  are empty by now; what has been entered since the breakdown stays. Queries, proposals and paper notes from back then
  do not come back. After two breakdowns of the same start the attempt aborted last counts. The race officials'
  devices then treat the start as before (done; corrections from “Recent” are accepted again).
- The history (“Settings → Files → History”) has entries of its own, such as “Repeat after breakdown – values
  discarded: 101, Class 1, Attempt 1” and “No repeat after all – values brought back: …” – the same when triggered
  from the phone, without a device name. In the parallel slalom the entry names only the boats that really repeat
  (“… values discarded: E01, Class Dolphin, Parallel slalom Preliminary heat, 1st attempt”, after “Repeat both”
  with “E01 / E02”); “No repeat after all” names the boats from before. The discarded values are in the backup as
  long as the abort is part of the operation; “Reset operation”, deleting the attempt and removing the driver clear
  them away.
- **Move** (menu per start): ahead of the next one, to the end of the attempt, before or after another attempt – never
  ahead of what has already run. With “Keep the interleaving when moving” (on by default) the start gets the next
  place of its lane within the attempt. What the operator has rearranged this way stays; attempts not rearranged keep
  following the interleaving.
- **Classes · boat missing** (`KlassenAussetzen.vue`): the classes in the order in which they come up, with the
  number of their open starts. “Boat missing” puts the starts of a class greyed out at the end of the attempt; with
  “Bring other classes forward” (on by default) the next class of the same lane moves up (`E2E21212121216163` →
  `E6E61111113`), otherwise only the gaps close. “Boat is back” interleaves the rest of the attempt with it again.
  “Bring forward” makes a class the next one, only within its lane.
- If only held-back, to-be-repeated, to-be-made-up or “boat missing” starts are left, the attempt **stalls**; the
  card says so.
- **Join from …** attempt and optionally class, if start release only joins in the middle of the competition:
  whatever lies before counts as run (without display), “Continue with” names the next start.
- If the driver in the boat is deleted (before the first value), the scoreboard shows “ready”.
- **Message** per racecourse or on all: disruption and break appear on the scoreboard instead of the driver, a note
  below them. **Templates** (welcome, thanks, break, disruption; `src/betrieb/meldungen.ts`) are taken into the text
  field and adapted; their text is in the language of the scoreboard.
- “Reset operation” (with confirmation) clears what was begun and shown and the messages; drivers, interleaving and
  values remain.
- With [digital entry by the race officials](#digital-entry-by-the-race-officials) the card also shows the state of
  each list and the [racecourse traffic light](#racecourse-traffic-light-and-auto-mode).

### Scoreboard

“Open display board” opens a window of its own (`#/anzeige`, English `#/display`; per racecourse
`#/anzeige/<parcours>`; `src/AnzeigeApp.vue`). The F key or a double click switches to full screen; the mouse pointer
disappears after a short rest.

- Per racecourse: name of the racecourse, class (with class colour) and attempt, the race number large, name, origin
  and on request the start before. White on black, whatever colour scheme the operator uses.
- Two racecourses are shown one above the other, on very wide screens side by side. Names that are too long get
  smaller instead of being cut off (`src/lib/fit.ts`).
- A start repeated after a breakdown is shown as “Attempt 1 · Repeat” (German “1. Lauf · Wiederholung”), without a
  reason; likewise in the spectator list. In the parallel slalom it reads “Preliminary heat · Attempt 1 · Repeat”
  (German “Vorlauf · 1. Versuch · Wiederholung”); if only one boat repeats, the other side is shown as “–”.
- The window only reads and never writes; it follows the operating window at once and keeps the screen awake.
- Language as the lists (DM German, UIM English: “Course”, “Attempt”, “Class Dolphin”), can be changed.
- What it shows comes from a narrow view (`src/betrieb/sicht.ts`): race number, name, class and origin of the
  drivers currently appearing – never date of birth, weight, gender or entered values.

### Starting order and intervals between starts

**Starting order** (sub-tab “Starting order”, `src/components/betrieb/StartListe.vue`): per racecourse the start in
the boat with “for m:ss” and the whole order of open starts by attempt, with two times:

- **“in about”** – roughly when the start is due: the rest of the start in the boat, then per start the interval
  between starts of its class;
- **“To pontoon entry”** – when the driver must be at pontoon entry: as soon as they belong to the next “at the
  pontoon” + “at pontoon entry” starts (default 2 + 2).
- Attempts that have not begun yet and “boat missing” stay without a figure. During a break or disruption on the
  scoreboard there is no figure, only a sentence saying why.
- Rearranging by dragging a start onto another or via “Move …” – the same rules as at the
  start release. Calculated with the clock of the screen; nothing is stored.

**Intervals between starts** (`src/betrieb/prognose.ts`): What is measured is the interval between two displays of a
racecourse, attributed to the class of the previous start. Not counted are intervals under 30 s and over 300 s,
across an attempt boundary, across a start done without display and for a start that has since received an X. From
three measurements on the mean of the class applies, before that the event's own value, otherwise the default
(`startabstaende` in `src/config/einstellungen.yaml`, rounded means of the DM 2025). “Adopt measured values as
defaults” turns the means into own values that travel with the template to the next event.

### Spectator list

“Open spectator list”: a window of its own (`#/zuschauer`, English `#/spectators`; per racecourse
`#/zuschauer/<parcours>`; `src/ZuschauerApp.vue`), narrow enough for a phone.

- Per racecourse “In the boat”, “At the pontoon”, “At pontoon entry”, “After that” (with “in about” and “to pontoon
  entry in”), finally “Boat missing”. Attempts that have not begun yet are not on it. During a break or disruption the
  message is at the top.
- Filters by class and – since the field test on 21.11.2026 – by team (club, state association or nation, as the
  event has it, several selectable). The filters only hide and stay in the viewer's browser; none of it goes over the
  network.
- It reads an even narrower view than the scoreboard (`sichtZuschauer`): without held-back starts, starts to be
  made up and starts of later attempts. It reaches the spectators' phones via the spectator link of
  [device operation](#device-operation).

### Parallel slalom in operation

Only under UIM ([details](parallelslalom.md#operation-start-release-and-scoreboard)): an area of its own after
the racecourses. Its steps are the locked heats (preliminary heat, re-run, semi-finals, small final, final);
each is released individually with “Begin …” (24.11.2026), its starts are the pairs of the plan. The scoreboard
shows racecourse A and B as they lie seen from the spectators (setting). Classes sitting out and moving do not exist
there, holding back takes the whole pair, there are no waiting times. A board of its own is opened with
“Separate display board” (`#/anzeige/parallel`). “Repeat (breakdown) …” has existed here too since 27.11.2026: the
choice shows the pairs shown in the heats under way, the confirmation asks every time without a preselection which
boats repeat (“Only E01 (Racecourse A)”, “Only E02 (Racecourse B)”, “Repeat both”); a boat that does not repeat keeps
its values ([details](parallelslalom.md#repeat-after-a-breakdown)). This is not the re-run after a tie.

### Settings and storage

- **“Settings → Display board”:** header, logos left and right (those of the lists), which racecourses the
  shared board shows, previous start, name of the racecourse, names (as on the posted results, full, shortened, none),
  origin, language, font size (70–130 %); under UIM the position of racecourse A and B.
- **“Settings → Order of starts in operation”:** “Keep the interleaving when moving”, starts “at the pontoon” and
  “at pontoon entry” (0–10 each), intervals between starts per class (default, own value 30–600 s, measured, what
  applies) and the settings of [digital entry by the race officials](#digital-entry-by-the-race-officials) (backlog,
  auto mode).
- The settings travel with the template, except the header. Operation itself is kept in the backup, not in
  the template; restoring a state from the history and “Delete all entered values” leave it as it is.
- Under `file://` (single-file version) the operating window itself nudges the windows it opened, where the
  browser does not carry the message between windows (`src/lib/anzeigeFenster.ts`).

## Device operation

Scoreboard, spectator list, start release and race official lists on other devices – screens at the pontoon,
tablets, phones –, via a third-party ntfy server on the internet (sub-tab “Operation → Devices”, `src/geraete/`).
How to use it, limits, quota and disruptions: [betrieb.md](betrieb.md#device-operation);
security model: [technik.md](technik.md#device-operation-security-model). It has not yet been tested in the field
with real phones and the real server ([feldtest.md](feldtest.md)).

- **Only “Switch on device operation” connects** – until then nothing leaves the browser (test
  `src/main.geraete.test.ts`). Then, encrypted and signed, the following go via the server: race number, name
  (according to the setting “Names” of the scoreboard), origin and class, the order of starts with times, messages,
  the name of the event; for the race official lists their starts with race number and class (without names), at
  the pontoon the extra weight. A paired start release learns, for its courses, which drivers who have already
  started have withdrawn – only so that it offers them no repeat after a breakdown (27.11.2026; the notice before
  switching on names it). Never leaving the operating computer: date of birth, body weight, gender, entered
  values (except, for a query, the value of that one cell to the devices of the list), logos or the data of the
  event. The race official devices send their rows encrypted to the operating computer.
- **Server:** default `ntfy.adminforge.de`, can be changed under “Settings → Devices”. Its operator sees no
  contents, but times, sizes and IP addresses.
- **Two read links** with QR code: “Display board” and “Spectators” (`#/sehen/<paket>`). No login, no
  pairing; the device shows the same scoreboard (without logos) or spectator list as at the operating computer.
  Fingerprint for comparing, “Renew spectator link”, “End room”. Since 27.11.2026 the display board link also
  carries the list of starts run in the attempts under way, from which the start release builds the choice “Repeat
  (breakdown) …” (without values, reasons or withdrawals); the spectator link does not – interpreted during
  implementation, still to be confirmed (`BETRIEB_ANNAHMEN` WH11). Devices with an older version reload once for it.
- **Pairing** (E7): scan the QR code from the screen (main way) or pairing link plus device code over the radio. A
  device is paired for the **start release** of certain racecourses or for a **race official list** (see
  [Digital entry by the race officials](#digital-entry-by-the-race-officials)). In the device list: name, kind of
  device (phone, tablet, computer), racecourses, lists, “Revoke”.
- **Start release on the phone** (`#/geraet`): the same buttons as at the operating computer, only for its own
  racecourses, without “Reset operation” and “Show on all courses” (the message). After every press the buttons are
  locked until the operating computer confirms; the decision is always made there (allowlist
  `src/geraete/aufgaben.ts`).
- **Repeat from the phone** (27.11.2026, user R13-01/R13-06; `BETRIEB_ANNAHMEN` WH3, WH11–WH14): “Repeat
  (breakdown) …” and “No repeat after all” also work on the start release phone, with the same choice and
  confirmation as at the operating computer (in the parallel slalom with the choice of boats). The operating computer
  checks against the full data and refuses with a reason: “No repeat for this start: it is not (or no longer) among
  the starts run in the attempts or heats under way – please check the display.”, “The driver has withdrawn – no
  repeat. If the driver is to start after all, first take back the withdrawal at the operating computer.” or “This
  device may not do that (another racecourse, or no longer released).” The repeat is bound to the attempt the phone
  saw: if the message arrives late (dead spot) and the start has changed in the meantime, nothing changes, and the
  phone reports “Something has changed there in the meantime – please check the display.” If someone was quicker:
  “Nothing changed – already done, or someone else was quicker. Please check the display.”
- In addition: keeping the screen awake on every connected device, “Reload all devices” after an update and a
  display of how many messages went to the server today.

## Digital entry by the race officials

The race officials enter their list on their own phone or tablet instead of on the sheet (stages W1–W5, built
21–24.11.2026; [proposal](../vorschlag-wkr-erfassung.md) (German), plans [W1](../plan-wkr-w1.md) to
[W5](../plan-wkr-w5.md) (German)).
It requires [device operation](#device-operation), has so far only been tested against a simulated server and is still
**without a field test** ([feldtest.md](feldtest.md)). Paper remains the fallback at any time: each list can be paused
or switched to paper from a given start. How to use it step by step:
[Race officials' entry on phone and tablet](betrieb.md#race-officials-entry-on-phone-and-tablet). The interpretations
are recorded with a date in `WKR_ANNAHMEN` (`src/wkr/annahmen.ts`), open questions under
[Offen](../entscheidungen.md#offen) (German).

<table>
<tr>
<td valign="top" width="160"><a href="../bilder/en/wkr-handy.png"><img src="../bilder/en/wkr-handy.png"
width="160" alt="Race official form on the phone with race number, buoy buttons and main button"></a>
<br>Form “Buttons” on the phone</td>
<td valign="top" width="360"><a href="../bilder/en/wkr-pad-bild.png"><img src="../bilder/en/wkr-pad-bild.png"
width="360" alt="Race official form Picture on the tablet with course drawing and side column"></a>
<br>Form “Picture” on the tablet with course drawing</td>
</tr>
</table>

### How a row arrives

- When pairing, a device gets a list (phone: one recommended, tablet two, at most four); at the pontoon optionally
  whole, leaving only or mooring only. This makes the list “digital”.
- The device only sees the **view of its list** (`src/wkr/sicht.ts`): shown starts with race number and class,
  never names, plus the form per class and notes from the operating computer. Pontoon entry and leaving the pontoon
  see the next starts in advance; mooring only comes once the boat is back.
- A row that has been sent goes via data entry into the values – exactly as when typing in from paper: empty cell →
  taken over; if something else is already there, it becomes a **query** at the operating computer, never silently
  overwritten.
- Without a connection the device keeps entering; waiting rows are sent later in a bundle. They are kept only on the
  device (36 hours). A device with a list reports during an attempt with a sign of life (battery, waiting rows).
- **Closing the list:** After the attempt a band appears: “… is over – close the list?”. The check view shows
  what was sent, what is open and X; with the name of the race official – prefilled from the race official
  assignment – closing replaces the signature on the sheet. Open starts go with “Rest on paper”. If the attempt is
  still running, the device asks. After that, corrections only go as a proposal.
- **Repeat after a breakdown** (26.11.2026, see [Start release](#start-release)): when the start is shown again, the
  devices get it like a new start. A row that a device still sends for the aborted attempt is rejected; the device
  shows “This attempt was aborted after a breakdown – the start is repeated. The line was not taken over.” If a list
  has already closed the attempt, its device still gets the repeat; the row arrives under Incoming as a proposal (“The
  list is finished for this attempt.”) and is accepted with one click, the closing stays. Exception “Attempts run
  consecutively”: the pontoon entry row stays, the device there can keep correcting it, and a late row is taken over.
  In the parallel slalom (27.11.2026) only the lists of the racecourse whose boat repeats get the attempt anew, and
  only there is a late row refused; on the other racecourse it is taken over, and the repeat never comes there as a
  new start – not even if the list was paused during the first attempt or only went digital later.

### At the operating computer

- **Operation → Race officials** (`src/components/betrieb/WkrMatrix.vue`): a matrix of lists × shown starts – ✓
  entered, ½ one pontoon part, ○ open, ○! overdue, ! query, V proposal, P paper, ✕ did not start,
  “✓ no time” – and per list the device with a traffic light (heard, quiet, gone). Per list: entry by device, paper or
  both; pause, sign off, “Continue on device”; **“Paper from start …”**; “Please check no.” to the devices;
  view and release closings. “Pair device” on a list without a device leads directly to pairing. A repeat after a
  breakdown is shown as open in the matrix and counts towards the backlog, also on a list with a closed attempt;
  “Paper from start …” from the repeat on puts only the repeat and later starts on paper, not the starts between the
  breakdown and the repeat.
- Below that the **Incoming** area: queries (take the device's value or keep the existing one) and proposals
  (accept or discard).
- **At the table (no attempt):** a block of its own for the knots list (“Knots: n / m open”).
- **Data entry:** ◆ on values from the device, “Check paper” on rows and cells for which the sheet is needed;
  whoever overwrites a device value is asked once (see [Data entry](#data-entry)).
- **Start release:** a row with the state of each list – ✓ done, ⧗ waiting n, ✕ device gone, ▭ paper, the
  connection in small print. From how many open starts of a racecourse list a warning appears, and whether to ask
  before showing (“Continue anyway?”) or only to warn, is set under “Settings → Order of starts in operation”
  (default: from one, ask). Nothing is ever blocked. A paired start release phone sees the same row, without values
  and device names.
- The **race official name** comes from the assignment; if a device changes it under “More → Name”, the operating
  computer shows the difference and can take it over.

### Racecourse traffic light and auto mode

The start release goes only by the **racecourse** (user 21.11.2026): pontoon and pontoon entry work autonomously and
never hold things up. As soon as a racecourse list is entered digitally – gates, buoys, gate 5, man overboard,
course supervision, start/finish, since 22.11.2026 also time –, there is a traffic light per racecourse
(`src/wkr/ampel.ts`; procedure in [betrieb.md](betrieb.md#procedure-on-competition-day)):

1. After “Next start” it is **green** (“Start clear”).
2. It turns **red** with “Through the start gate” or by itself as soon as a racecourse race official sends something
   for the start; next to it is shown which lists are still missing. “Not through after all” takes the button back.
3. Once all digital racecourse lists have sent: **clear**. “Next start” while red asks “Continue anyway?”.
4. **Auto mode** (setting, off by default): If every racecourse list has a device, the start release counts down
   3 seconds when “clear” (“Hold”) and shows the next one. Never by itself: a new attempt, starts to be made up,
   held-back starts, with an open query, during a break or disruption.

The racecourse race officials see a dot “start clear” or “on the racecourse” in the driver card; scoreboard and
spectator list show no traffic light. If, in the parallel slalom, only one boat repeats after a breakdown, only the
lists of this boat count: the light stays green until it has passed through the start gate – the values of the other
boat that remained do not count –, and the question when closing the list names only this boat as “on the course”
(27.11.2026).

### Forms

To choose from are “Buttons”, “Picture” and “Table”. The operating computer can set one per list (device list),
optionally “fixed”; otherwise the race official switches under “More → Display”. Without a setting “Buttons” applies,
on the tablet for lists with buoys “Picture” (`src/wkr/maskenWahl.ts`). “Buttons” looks different depending on the list
(codes, buoys, time, checklist). All forms produce the same cell values as typing in from paper (`src/wkr/maske.ts`).

- **Codes** (pontoon, pontoon entry, gate 5, man overboard): one button per penalty code of the list, the race number
  large, never a name. Main button “No penalty ✓”, with entries “Send · n pen.”; “↩ Undo” in the footer (the arrow
  pointing left as a small drawing, above the word on narrow phones) takes back the last tap. Disq. separately via DISQ:
  the first tap marks, the second sets. The Disq. buttons only offer X at leaving the pontoon and at pontoon entry, with
  a confirmation question. Codes that do not apply in the class according to the rulebook are greyed out but can be
  pressed (DM: 4 and 23 from class 3; 2, 5, 10 and 16 from class 4).
- **Maximum per code** (24.11.2026; `max`/`danach` per code in the rulebook): “2nd and 3rd attempt of the element”
  counts at most twice; the third tap sets Disq. **D** (“4th attempt of an element”) – the button says beforehand
  “next = Disq. D”. On these buttons a tap less than 0.4 s after the previous one does not count (debounce). Gate 5
  code 1 (“not entered with the full length”) only works once. Every other code counts at most three times per attempt, also
  contacts with the pontoon and “Durchreißen der Schaltung” (DM) (confirmed 26.11.2026); at the maximum the button says
  so (“at most 3×”).
- **Buoys** (gate lists such as gate 1/3/5 and gate 2/4/5, racecourse with start/finish, parallel slalom): one row per
  stop, the two buoys of a gate side by side as on the sheet. One tap = one touch (5 points), the second
  removes it; the gate buoys of gate 5 count up to 9. If a class has more than seven rows, a switch
  “OUTWARD | RETURN” divides them, which never changes by itself. Order under “More → Display”: “Return reversed”
  (default), “Order of the run” or “All in one list”. DISQ first asks for the buoy (“No buoy / whole racecourse” for
  the Disq. field); a long press (0.8 s) on a buoy opens its Disq. choice directly, several letters, then “Done”.
  A cell can thus carry points and letters (“5, J, D”). A gate left out is a J on one of its buoys.
- **Picture** (only lists with buoys): the course drawing of the class, tapping is done on the buoys themselves – hit
  circles at least 15 mm, pushed apart if too close. Switch OUTWARD, RETURN and RETURN 2 (speed lap), by hand only. A
  long press on a buoy opens the Disq. choice of that buoy. **Position of the drawing** (24.11.2026, “More → Display”):
  “Automatic” (as on the sheet, as far as space allows), “Start/finish on the left/at the top/on the right/at the
  bottom” (since 26.11.2026; before “Pontoon at the bottom/on the left/at the top/on the right” – a position already
  chosen stays and shows the same picture, only under the new name), below it a sentence such as “Start/finish at the
  top, gate 5 at the bottom.”; in the parallel slalom “Start on the left/at the top/on the right/at the bottom”; the
  lettering stays upright, remembered per device and list. The parallel slalom shows the single lane without pontoon,
  the same for racecourse A and B. If a buoy is missing in a drawing, the device shows the buttons.
- **Time** (timing lists): the time fields with a numeric keypad for the active field; below it is shown how the
  operating computer reads the input (“83.45” = 83.45 s). Only the first time field is mandatory; after a complete
  time the keypad jumps to the next one. “No time for …” with a reason: timing system failed, did not finish, other
  reason – at the operating computer “✓ no time”, in data entry “Check paper”. Lists with buoys and time show the
  buoy form with time fields.
- **Knot checklist at the table** (knots, list without attempt): the device knows all drivers of the classes with the
  list, without start release. Type the race number on the keypad or take the suggestion “Next: …” (the next
  open one after the one last worked on); per knot ✓ or ✗ (✗ = 5), “✓ All correct” or “✓ Rest correct”,
  send. A number already entered asks “correct it?”.
- **Table** (for experienced users, only tablet or computer with keyboard): one row per start with the columns of the
  sheet, Tab and Enter to the next cell, Enter in the last one sends. It is read as when typing in from paper; errors
  appear at the cell (“Not a penalty code of this sheet”, “Too often …”). Correction in the table with “old → new”,
  Esc cancels.

For the few lists without a form, assigning shows “Form to follow – paper”.

### On the device

- **After sending**, “sending …” appears briefly with the confirmation, then the next race number; for one
  second the form accepts nothing (protection against double taps). The bar “Recent” opens sent rows for
  correction; “Other start number …” jumps to another start.
- **Did not start** (24.11.2026, replaces “Did not come past”): “More → Did not start · Disq. X” with a large
  confirmation question “23 did not start?” enters X alone into the Disq. field – on every list with a Disq. field
  (gates, gate 5, man overboard, parallel slalom, pontoon, pontoon entry). At the operating computer it acts like any
  X: the start is dropped in this attempt, on all lists and in scoring. Whoever made a mistake corrects it via
  “Recent”; the correction starts without X.
- **More:** remarks, pause (paper), sign off, “Did not start · Disq. X”, name, display (“Like device” as
  default, Sun, Light, Dark; left-handed; plus buoy order, position of the drawing and form), language (that of the
  list, switchable; under UIM codes and titles change too), trial run.
- **Trial run:** After first receiving a list, the device shows a trial run once per room, list and form with the
  start “P” – nothing is sent; “Skip” always works, “More → Trial run” repeats it.
- **Tablet** (`src/wkr/anordnung.ts`): in landscape up to four lists side by side, in portrait up to two; the whole
  pontoon as leaving and mooring side by side. A side column shows queue and entries in plain text. In the parallel
  slalom a band with the heat and a clear change at the next attempt.
- **Two tabs** of the same pairing: only the one opened last sends, the older one offers “Continue here”.

### Practice

“Practise offline” in the pairing form or the address `#/uebung` (`src/components/wkr/WkrUebung.vue`):
choose rulebook (DM-Reglement or UIM rule 960), list and form, then the same form with made-up starts 1–20
without names. No network, no operating computer, no store; only the display settings are saved.

- The next start comes 2–6 seconds after sending, occasionally also earlier; now and then a query comes as in
  earnest. At the pontoon there are made-up extra weights.
- After sending – also after Enter in the table, “Did not start” and “All correct” at the table – only the
  explanation “How practice works” scrolls off the top (since 26.11.2026; before, the header scrolled away too). What
  stays: the yellow note “The screen may turn off.” (it is below the explanation until it is tapped away with
  “Hide”), below it the header with “PRACTICE”, list, attempt and connection, below that “Recent” and the card with
  the race number. On the tablet with several lists side by side nothing scrolls; with one list the list tabs and the
  top of the side column stay in view. In the real entry nothing ever scrolls by itself.
- “Bring a class forward” (at the very bottom under “More”, at the table above “End practice”) fetches the next start
  from another class – to practise a class change.
- Good for the briefing the day before; the practice needs neither an event nor pairing.

## Data entry

Data entry is a tab of its own (`src/views/ErfassungView.vue`, `src/lib/eingaben.ts`, `src/lib/erfassung.ts`).

<a href="../bilder/en/erfassung.png"><img src="../bilder/en/erfassung.png" width="240"
alt="Data entry: a sheet as an input table with values"></a>

- The completed sheets are typed in after the attempt; the same sheet as on paper appears as an
  input table, in the same order of rows.
- Keyboard: Tab to the next field, Enter and ↑ ↓ within the column.
- Times can be typed in short form: “83.45” is seconds, “1.2345” or “1:23.45” is 1:23.45 (point or comma).
  Before the separator, values from 20 on mean seconds, below that minutes: “15.30” is 15:30.00 (`src/lib/time.ts`).
- Progress per sheet and notes on implausible entries – since 24.11.2026 also when a code appears more often than
  it can occur in an attempt (“Code 6 is entered more than 2× … Disq. D?”). Nothing is set by this; what is on
  the paper stays.
- A QR code leads directly to the sheet or stack of sheets (see [QR codes](#checklists-and-qr-codes)).
- With [shared sheets](#race-officials-sheets), choosing a class shows the shared sheet it is on; “all, one below the
  other” and scanning a checklist bring the stack of the racecourse. The values belong to the driver, scoring is per
  class.
- **Repeat after a breakdown** (26.11.2026): the race number carries ↻ with the note “Repeat after breakdown – enter
  the values of the repeat …”. On paper the race official has struck out the line and entered the repeat in a blank
  line; the struck-out line does not count. At pontoon entry with “Attempts run consecutively” there is no ↻ (nothing
  is struck out there). On the sheets of the parallel slalom ↻ is only in the row of the boat that repeats
  (27.11.2026).
- With [digital entry by the race officials](#digital-entry-by-the-race-officials): ◆ on values from the device (with
  list, device and time), “Check paper” on rows and cells for which the sheet is needed, and a question before a value
  from the device is overwritten. Open queries are decided under Operation → Race officials.

## Scoring and results

<a href="../bilder/en/wertungsliste.png"><img src="../bilder/en/wertungsliste.png" width="600"
alt="Overall results of a class with three attempts and a dropped attempt"></a>

- Scoring is calculated by pure functions (`src/lib/ergebnis.ts`, `scoring.ts`, `time.ts`, `codes.ts`, `disq.ts`).
- Results exist per class, attempt and overall under “Lists”, printed in the order of the sheets:
  racecourse, then class by starting order.
- A field below the table shows on every page when the list last changed
  (`src/lib/listenStand.ts`); there is no print time in the page margin.
- For each list both orders (race number, then ranking) can be output in one print.

**Equal points:** The dead-heat rule of the rulebook decides (`stichentscheid`).
DM: the fastest scored attempt. UIM according to rule 960 pt. 5.2.6: the sum of both attempts.
Only then is a ranking shared. A ranking decided this way carries an asterisk; the rule is stated below the table.

**Anyone who has not run yet** stands without a time in 1st place.
An X (did not start) in a Disq. field of the attempt – at the pontoon, at pontoon entry or from the device – appears
as “Did not start” on the list and counts like a disqualification. In the interim standings of the overall list it is
at the end until the dropped attempt absorbs that attempt.

**Attempts and dropped attempts:**

- If the rulebook provides a number of attempts (`wertungslaeufe`), choosing the rulebook sets it at once:
  UIM 2 attempts and 1 dropped attempt (two attempts, the better one counts), DM 3 attempts and “by rule”.
  Under DM “by rule” also drops one with only two attempts (Reglement C6).
- Deviating by hand remains possible; the user interface then points this out (under DM only a preset, no note).
- Values already entered for an attempt that no longer exists afterwards stay in the data. A note names them where the
  setting is changed, under “Details” per driver with attempt, list and field (`src/components/EingabenHinweis.vue`).

### Posting according to UIM (rule 960, pt. 5.2)

What a rulebook requires for posting is in its YAML file (`aushang`, so far only `uim-2026.yaml`).

- Below every results list (per attempt, overall list, individual competition, team competition) there is a
  signature line “O.O.D.” and an empty field “Time of posting” – “All results must be signed by the O.O.D. and
  must show the time of posting.” The printed time stamp next to it remains the last change.
- The overall list of manoeuvring has the column “UIM points” (pt. 5.2.1, table pt. 5.1) as soon as the class is
  complete; a shared ranking gives both the full points, disqualified drivers have 0.
- According to pt. 5.2.1 it has no column “Result”: Attempts, “Knots pen.”, “Best time incl. knots pen.”, “UIM points”
  (15.11.2026). The overall list of the DM keeps “Ergebnis” (result).
- Nowhere does the number of a stage appear (“stage 2”), only the name of the discipline.
- As long as only one discipline has been run, the sheet of the UIM team competition says what it is based on
  (“Manoeuvring only – nothing has been recorded for Parallel slalom yet.”).

### Attempts run consecutively (UIM)

“Settings → Scoring”, according to pt. 4.3.2 “2 attempts, run consecutively”. Under UIM an option, not preselected
(15.11.2026): Some countries only moor at the pontoon and run again at once, others run the attempts as separate runs.
The switch only appears under rulebooks that know it (`versucheNacheinander`).

**On:** Each driver appears on the manoeuvring lists twice, directly one after the other.

- 1st and 2nd attempt are on **one** class sheet, with the column “Attempt” after the race number and a
  dividing line below each driver; pages are only split between drivers.
- **Pontoon entry** (15.11.2026): the driver only passes there once – one row per driver, without “Attempt”
  (`einmalJeStarter`). What is entered there applies to every attempt; so an X from pontoon entry counts in both.
  If a later attempt already holds something else, the row points this out.
- One sheet per list instead of one per attempt, all in the same stack, plus **one** checklist per class.
  The QR code names the stack; data entry shows the same sheet and writes each row under its attempt.
- Nothing is posted between the attempts.

**Off:** separate sheets and checklists per attempt; those before the last attempt with the steps for posting.

## Team competition

The team competition is calculated per origin – club, state or country – from the rankings in the overall list of
each class; a list type of its own under “Lists” (`src/lib/pokal.ts`, `src/components/PokalListen.vue`).

**Three variants** that can be switched on at the same time:

- Places 1–3: 10, 7, 5 points.
- Places 1–6: 6 to 1 points; this is how the DM 2026 workbook calculates.
- UIM points: places 1–20 according to rule 960 pt. 5.1; per origin the five best count, scored from five drivers on.

Points, number of best and minimum number can be changed under “Settings → Team competition”
(defaults `pokalPunkte` in `src/config/einstellungen.yaml` and `pokal` in the rulebook).

**Tie** (`pokal.stichentscheid`): DM (C6) the number of 1st places, then of 2nd and 3rd; UIM (pt. 5.2.6) the
points of the 1st places, then of the 2nd … Only then do they share the ranking; the ranking carries an asterisk.

**Who counts:**

- Disqualified drivers, open ones and drivers without origin get no points.
- Spellings that only differ in upper/lower case or spaces count as the same; for
  state and country also every recognised spelling (see [Origin and flags](#origin-and-flags)).
- Optionally only selected drivers count (column with boxes in the “Drivers” tab). Whoever is not selected keeps
  their ranking but gets no points. The selection is kept in backup and driver data.

**Interim standings:** As long as not every class has its final result, the list is marked as interim standings.
A class then counts with its overall list as it currently stands; open ones get nothing.

**Printing:** one document per variant – places landscape, UIM portrait – with the time stamp of the most recent
overall list of all classes (`wertungZeit` in `src/lib/listenStand.ts`); it never runs backwards.

Under rule 960 with parallel slalom: see [UIM team competition](parallelslalom.md#uim-team-competition).

<a href="../bilder/en/mannschaftswertung.png"><img src="../bilder/en/mannschaftswertung.png" width="600"
alt="Team competition by places 1 to 6 per origin"></a>

## Further lists and printing

### Lists of drivers and pontoon entry list

The lists of drivers are a tab with the selection “Type” (`src/lib/starterlisten.ts`):
interleaved (on request with the drivers of one origin highlighted for the team managers), per origin by
race number, by class and under rule 960 “Parallel slalom”
([Starting order per racecourse](parallelslalom.md#starting-order-per-racecourse)). The pontoon entry list is a list
type of its own.

### Code notice

A list type of its own: all penalty and disqualification codes of the rulebook with their source on one A4 sheet
(`src/components/CodesAushang.vue`).

### Results booklet

The results booklet (German “Druckdatei”) is the last tab under “Lists” (`src/lib/druckdatei.ts`): the file that goes
to the participating groups after the competition.

- Contents: the interleaved list of drivers per racecourse, the team competitions switched on (UIM points before
  places), the explanation of the penalty points and disqualifications, then per class the attempts and the overall
  list by ranking.
- Everything in one print: “Save as PDF” gives one file; portrait and landscape alternate, each document counts
  its own pages. Parts, scope and classes can be deselected.
- Two versions: “External” like the posted results (names shortened or left out, never a date of birth); “Internal”
  with full names and, if switched on, the date of birth on the list of drivers.
- As long as not every class has its final result, a note names the missing attempts.
- **According to rule 960** (15.11.2026): team competition, legend of the codes, individual competition, then per
  discipline with values its lists – before manoeuvring the interleaved list of drivers, before each heat of the
  parallel slalom its starting order. The results booklet of the DM keeps the order of the template.
  The list according to pt. 3.7 is in no results booklet.

### Logos

Settings → “Logos on the lists” (`src/components/LogosPanel.vue`, 16.11.2026): two places, “Left logo” and
“Right logo”, empty at first. Without a logo every list looks as before.

- They appear next to the header of every page of the lists, on the race officials' sheets in the title bar before
  the QR code, on the checklists as a strip above the title and on the scoreboard next to the header.
- Height 8–30 mm (default 15 mm), on the race officials' sheets at most 12 mm; taller logos cost rows, the lists are
  split anew.
- Upload: PNG, JPEG, WebP, GIF or SVG up to 20 MB; the image is reduced in the browser (at most about 100 kB per
  logo), metadata is dropped. Below 200 dpi the setting points this out.
- Backup and template carry the logos; they never go via device operation.

### Double-sided printing

For list types with several documents in one print, “print double-sided” starts each document on a new
sheet; after an odd number of pages an empty page follows that is not counted (`src/lib/doppelseitig.ts`).

### Colours

On screen, lists and sheets follow the colour scheme (also dark); printed they are black on white with a grey
row every five rows. Their colours come only from `--blatt-*` in `src/styles/blatt.css`; logos print in their own
colours.

## Locks and checks

Each applies both in the user interface and in the reducer. The items with a date are decisions of 15.11.2026 unless
stated otherwise.

- **Field of drivers:** As soon as the first value is entered, drivers can neither be imported nor added or
  removed (`starterfeldFest`). Changing details, loading a backup and resetting still work.
  Whoever no longer runs is instead **entered as did not start**: an X in the Disq. field at the pontoon in every
  attempt without values, under UIM also in the locked heats of the parallel slalom (`src/lib/abmeldung.ts`);
  ↺ takes back the withdrawal.
- **Rulebook:** As soon as results are entered it can no longer be changed until all values are deleted;
  a template does not change it then either.
- **Class of a driver:** fixed as soon as the interleaving or the starting order of the parallel slalom is locked.
  There is no free choice of class; only if a changed date of birth belongs to another class does the user interface
  suggest “Move to class X”.
- **Order of the drivers:** “Change order” turns the column headers Surname, First name, Origin, Size, Gender
  and Date of birth into buttons – per class and for all at once. Three steps per header (21.11.2026): ascending (↑),
  descending (↓), marker off (↕); equal values keep their order, entries without a value go last. “Random”
  shuffles anew every time. The existing race numbers are only redistributed (`src/lib/reihenfolge.ts`).
  Locked as soon as the interleaving is locked, as is ▲▼; race numbers by hand stay free.
- **Printing race officials' sheets:** only once the interleaving is locked; before that a note leads to the
  interleaving, and Ctrl+P only puts that note on paper. The lists of the parallel slalom depend on their locked heats.
- **Year of birth and class:** A year of birth that does not belong to the class is rejected – when pasting from
  Excel, when loading driver data, when adding and when changing the date of birth
  (`src/import/klassenPruefung.ts`).
  If it belongs to another class, a suggestion appears below: “Add in class X”, “Move to class X”,
  in the Excel import per row “Import into class X” and “Fix all” (16.11.2026). If the year of birth fits no
  class, the message names the years of birth that start at all. Without a date of birth the driver stands out as
  “missing”.
- **Permission to start by birthday** (24.11.2026, two levels since 26.11.2026; DM only, Reglement C8: class E from
  the 6th, class 7 up to the 27th birthday; `geburtstagsGrenzen` in the rulebook, days in `GEBURTSTAG_FENSTER`,
  `src/import/klassenPruefung.ts`): a warning and a note in the “Drivers” tab that can be ignored – nothing is locked,
  moved or asked, there is nothing to confirm. UIM has no birthday limits.
  It is measured against the date of the event (first day of racing); if the event runs over several days, the day
  the driver starts counts.
  - **Clear warning (red):** the 6th or 27th birthday lies at most 2 days before or after the first day of racing, or
    the driver is clearly too young or too old on that day. In the header of the class the red badge “2 birthdays:
    warning” (also when the class is collapsed), expanded a red box “Attention, permission to start by birthday –
    please check, nothing is locked:” with one sentence per driver, for example (first day of racing 2026-09-05):
    “Vor1 Nach1 turns 6 on 2026-09-04 (1 day before the first day of racing) – in Class E permitted to start only
    from that day.” or “… turns 27 on 2026-09-06 (1 day after the first day of racing) – in Class 7 permitted to start
    only until 2026-09-05.” (the last day is the one before the 27th birthday). If the driver may not start on the
    first day of racing already, the sentence adds it: “… (1 day after the first day of racing) – in Class E permitted
    to start only from that day, so not yet on the first day of racing.” or “… (on the first day of racing) – in
    Class 7 permitted to start only until 2026-09-04, so no longer on the first day of racing.” Clearly outside:
    “turns 6 only on … – in Class E permitted to start from age 6.”
  - **Note (yellow):** the driver may start on the first day of racing, but the birthday lies 3 to 14 days before it
    (class E) or after it (class 7). Yellow badge “1 birthday to check” and a yellow box “Permission to start by
    birthday – only a note, nothing is locked:”, for example “Birthday close to the day of racing: Vor1 Nach1 turns 6
    on 2026-08-27 (9 days before the first day of racing) – in Class E permitted to start from age 6, please check.”
  - Each driver counts in the header only once, at their stronger level. The “!” at the date of birth is red or
    yellow, and the cell has a red or yellow left edge. On the phone name, number of drivers and badges in the class
    header wrap onto a new line. A sentence below the boxes names the day and both spans.
  - **Without a date** only the year counts: the borderline years of birth are shown in yellow with the day of the
    birthday (“before the day of racing?”); drivers certainly outside by year are shown in red. The sentence below says
    that with a date the check counts to the day and then only names who is too young or too old on that day or has a
    birthday up to 14 days before or after it.
  - Confirmed 26.11.2026: no longer on the 27th birthday itself; without a date the whole borderline years.
    Confirmed 27.11.2026: “less than 2 days” includes the 2nd day; red as well if the 6th birthday is 1 or 2 days
    before the first day of racing; class E with the 6th birthday 3 to 14 days after the first day of racing is “too
    young” (red), not a note. Confirmed 27.11.2026: 29 February becomes 1 March in years without it.
- **Date fields:** never the browser's date picker (depending on the system it showed mm/dd/yyyy), but a text field:
  German DD.MM.YYYY, English YYYY-MM-DD (`src/components/DatumFeld.vue`). Also recognised are 2019-12-01, 1.12.2019
  and 01/12/2019 (slash: day first); a date that does not exist is reported. Stored as YYYY-MM-DD.
  The Excel import reads the same spellings, plus a year alone and Excel serial numbers.
- **Race numbers with letters:** E01 and D01 sort everywhere before 101, 201 … (`vergleicheStartNr` – the one
  place for lists, scoring, interleaving and the pairs of the parallel slalom).
- **DM, disqualification S “Bremsen mit der Hand beim Anlegen” (braking with the hand when mooring)** – only on the
  pontoon list (Reglement C5 d).
- **“X”** (did not start) is in every rulebook; “O” is never assigned.

## Parallel slalom and individual competition (rule 960)

Under rule 960 the parallel slalom, the individual competition across both stages and the UIM team competition are
added. Everything about it is on a page of its own: [parallelslalom.md](parallelslalom.md).

- Starting order of the preliminary heat with racecourse A and B, dummies for an odd number, heats after it
  (semi-finals, small final, final) and re-run; scoring only interprets where rule 960 is silent
  (`PARALLEL_ANNAHMEN`, confirmed 24.11.2026).
- **Individual competition:** per class and discipline time, ranking and UIM points, plus the sum. With an equal sum
  the time decides according to pt. 5.2.6 – since 24.11.2026 in the parallel slalom the two attempts of the last heat
  run, with an equal time additionally those of the heat before
  ([Individual competition](parallelslalom.md#individual-competition)).

<a href="../bilder/en/parallel-results.png"><img src="../bilder/en/parallel-results.png" width="600"
alt="Results of the preliminary heat in the parallel slalom with slanted Qualified"></a>

## Sample data

The sample data is at the end of “Event” (`src/components/BeispieldatenPanel.vue`), collapsed as long as it
is not being worked with. All names are made up.

**Sample field of drivers:**

- A **total number** as a suggestion according to the type of event (21.11.2026, `BEISPIEL_STARTERZAHL` in
  `src/domain/generate.ts`): club championship 10–20, championship with clubs or without origin 45–75, by
  states or countries 100–160. “New suggestion” draws again.
- The number per class is a field of its own (0–999); next to it the sum. Numbers set by hand stay with a
  new total; “Reset” forgets them, “New suggestion” replaces everything. Distribution follows fixed shares
  (`BEISPIEL_KLASSEN_ANTEILE`: E 4 %, 1 9 %, 2 13 %, 3 15 %, 4 15 %, 5 18 %, 6 11 %, 7 15 % – from three lists of
  drivers 2025/2026, without data from them); under UIM the same shares on E to 5.
- The origin follows the event, **independently of the rulebook** (15.11.2026): clubs, states, countries
  (English names, IOC codes) or none; the club championship gets none. “Origins” limits their number –
  for checking the team competition.
- Sample drivers only get a gender under a rulebook with parallel slalom (for the list according to pt. 3.7).

**Sample values:** a selection – manoeuvring up to attempt n or a heat of the parallel slalom (only selectable once
its starting order is locked).

- “Insert sample values” only fills what is selected, in the heats after the preliminary heat only empty attempts.
- “Delete values of the selection” only deletes its values; withdrawn drivers get their X back. “Delete all entered
  values” remains.
- Withdrawn drivers get no sample values. The values follow rounded key figures per class, without individual results.

**Sample assignments, weights, boats and co-drivers** each have a button of their own (`src/lib/beispieldaten.ts`,
deterministic via `saat`; since 21.11.2026 only here):

- The assignments fill every printed list of the race official assignment per racecourse with two to three made-up
  people, at most 40 characters, so that the entry fits on one line in the head of the sheet.
- The weights lie around the average weight of the class; 40 % are at least half a step lighter, so that
  extra weights arise.
- Each class gets a made-up boat name (`src/data/boote.ts`). “Sample co-drivers” enters, for each class in which the
  rulebook provides a co-driver, a made-up co-driver and a substitute, both with a made-up weight of 55–95 kg – so that
  an extra weight appears on the lists. The question before replacing reads “… Replace them with made-up names and
  weights?”.
- If something is already there, the app asks before replacing it. Each button gets an entry of its own in the
  history.
