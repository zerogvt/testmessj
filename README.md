<!-- feature: exam-variants -->
# testmessj

Turn one multiple-choice test in Word into any number of shuffled variants,
each written twice: a student copy (questions + options) and a professor copy
(same paper, plus a "Variant N" banner and the answer key on its own last
page).

This is [testmess](https://github.com/zerogvt/testmess) rewritten in
TypeScript, so it runs **in the browser**. There is nothing to install and
nothing to learn: open the page, pick your test, click one button.

## Disclaimer

**This tool is provided free of charge, “as is”, without warranty of any
kind**, express or implied, including any implied warranty of merchantability,
fitness for a particular purpose, accuracy or non-infringement.

It is software, and software gets things wrong. It may misread a question or
an answer key, shuffle an option wrongly, point a key at the wrong answer, drop
or alter part of a document, or produce a file that Word cannot open —
including in ways that are not obvious at a glance.

**Check every document it produces** — every student copy and every answer key
— before you print, distribute, sit or grade an examination with it.

To the fullest extent permitted by applicable law, the authors and contributors
accept **no liability** for any loss or damage arising out of or in connection
with this tool or anything it produces, including misprinted or misgraded
examinations, incorrect marks, wasted time, lost or corrupted documents, or any
direct, indirect, incidental, special, consequential or exemplary damages,
whether in contract, tort (including negligence) or otherwise. Nothing here
excludes any liability that cannot lawfully be excluded. See [LICENSE](LICENSE).

The page says the same thing, in a banner that does not go away and a notice
that has to be acknowledged on every visit.

## TL;DR — for the teacher

**1. Open the page:** <https://zerogvt.github.io/testmessj/>

**2. Choose your test** — drag the `.docx` onto the page, or click *Choose a
.docx file*. (No test to hand? Click one of the two samples.) The page reads
it straight away and tells you how many questions it found; if it cannot make
sense of the document it says so there and then, rather than handing you a
half-correct paper.

**3. Say how many variants you want** (3 by default) and press *Generate
variants*.

**4. Click the download button.** You get one `.zip`. Inside it:
`student_1.docx` and `professor_1.docx`, `student_2.docx` and
`professor_2.docx`, and so on. Hand out the `student_` ones — they carry no
answers; the matching `professor_` copy has the key.

**Your test never leaves your computer.** There is no upload and no server:
the page is a static file, and the documents are read, shuffled and written
inside your browser tab. There are no cookies, no analytics and no stored
state of any kind — the page forgets everything when you close it. (GitHub,
which hosts the page, logs the request that loaded it, the way every web host
does. Nothing about your test is in that request.)

**The papers name nobody.** Word records the author and the last person who
saved a document *inside the file*, so a paper handed to a class would
otherwise carry its teacher's name — one right-click away under File →
Properties. Those fields, the company and the template path are emptied by
default; untick *Remove author details* if you would rather keep them. Word
comments and tracked changes cannot be removed this way, so the page warns you
when your document has them and leaves them to you.

**Reprinting one later?** Each run shows the *seed* it used. Type that seed
into the seed box, with the same test and the same number of variants, and you
get exactly the same papers back.

### TL;DR end
---

## What it does

Questions are reordered and the options inside each question are reshuffled, so
neighbours cannot copy each other. The key is recomputed to follow the shuffle
— it always points at the same *answer content*, never at the old marker.

**The student copy adds nothing.** Apart from the reordering and the
renumbering it is paragraph-for-paragraph the source test — no banner, no
heading, no blank line — so nothing on the page tells a student which copy they
are holding. Which variant a paper is can be read off its file name, or off the
professor copy that matches it.

Option markers are read from the document rather than assumed: `(A)`, `a.`,
`α)` and `(iii)` all work, and a variant re-emits that question's own markers in
their original order, so a Greek-lettered test stays Greek-lettered and keeps
agreeing with its own instructions line.

Equations written with the Word equation editor survive untouched. See
[Why raw XML](#why-raw-xml) for how, and why that drove the design.

## What the source document must look like

The parser follows the layout of `samples/calculus_practice_test_2.docx`:

- Any front matter (title, instructions) above the first question — copied to
  every variant as-is.
- A question starts a paragraph with `1.` or `1)`.
- Each option is its own paragraph starting with a marker: `(A)`, `A)`, `A.`,
  `a)`, `[A]`, `α)`, `(iii)` — any single letter in any script (Latin, Greek,
  Cyrillic, either case) or a short roman numeral.
- A last page headed **Answer Key**, one entry per paragraph: `1.  A`, `1)  α`,
  `1.  (c)`. The entries may be in any order; they are matched by question
  number. Key and options need not agree on case (`Α` finds `α`).

Markers are stored exactly as written and compared case-insensitively — see
`sameMarker()`. Uppercasing them would turn an `α)` paper into an `Α)` one on
the way out. Digits are deliberately *not* accepted as option markers, since
`1)` cannot be told apart from a question number.

Stems and options may run over several paragraphs; the extra paragraphs stay
attached to whatever they continue. Anything that does not fit the test is
rejected loudly rather than guessed at: a question with fewer than two options,
duplicate option markers, a missing key entry, or a key pointing at a marker
that does not exist all throw `ExamError` (see `validateExam`), and the page
prints the message where you chose the file.

## Browser requirements

A browser from 2023 or later: the ZIP work goes through
`CompressionStream`/`DecompressionStream` (`deflate-raw`), which means Chrome
103+, Edge 103+, Firefox 113+ or Safari 16.4+. Nothing else is needed — no
extension, no permissions, no network after the page has loaded.

## Architecture

Three stages, one plain object between each — the objects are the contract,
which is what makes the whole thing testable without ever opening Word.

```
your_test.docx (read in the tab, never uploaded)
        |
        |  parseExam()             read the .docx, recognise questions,
        v                          options and the key
   Exam  ──────────────────────────────────────────────────┐
        |                                                  |
        |  makeVariants(exam, n, seed)                     |  (paragraph nodes
        v      makeVariant() once per variant              |   are shared, and
   Variant x n                                             |   never mutated)
        |                                                  |
        |  writeVariant(exam, variant)                     |
        |      renderDocumentXml(includeKey: false) ───────┤
        |      renderDocumentXml(includeKey: true)  ───────┘
        v
   student_N.docx + professor_N.docx   ->  bundlePapers()  ->  one .zip
```

| File | |
|---|---|
| `src/markers.ts` | the label patterns, and `sameMarker()` |
| `src/xml.ts` | paragraph markup: text, labels, relabelling |
| `src/zip.ts` | the archive layer — read a `.docx`, write one back |
| `src/parse.ts` | `parseExam()` and `validateExam()` |
| `src/metadata.ts` | taking the names out of a package, and warning about what stays |
| `src/variants.ts` | the shuffle, and the seeded generator behind it |
| `src/render.ts` | rebuilding `word/document.xml`, writing the packages |
| `src/testmess.ts` | the whole pipeline in one call, plus the public exports |
| `src/main.ts` | the page: file in, ZIP out |
| `tests/` | 161 tests, `vitest` |
| `samples/*.docx` | the two sample tests, Latin-lettered and Greek-lettered |

### 1. `parseExam(bytes, name) -> Exam`

Reads `word/document.xml` out of the archive and walks the body paragraphs,
classifying each one by its opening label. Every stem and every option keeps
**its own paragraph elements**, plus a plain-text rendering used only for tests,
the on-screen key and label matching.

```ts
{
  source: 'calculus_practice_test_2.docx',
  title: 'Calculus Practice Test',
  preamble: [Element, ...],              // everything above question 1
  keyTemplates: { pageBreak, heading, entry },  // reused so the professor copy
                                                // keeps the original formatting
  questions: [
    { number: 1,
      stemText: 'Evaluate the limit: ...',
      stemNodes: [Element, ...],
      options: [{ letter: 'A', text: '4', nodes: [Element, ...] }, ...],
      answer: 'A' },
    ...
  ],
  documentXml: '<?xml ...',              // the source part, verbatim
  parts: [ZipEntry, ...],                // the whole source package
}
```

### 2. `makeVariants(exam, count, seed) -> Variant[]`

Pure data, no documents: shuffles the question order and each question's
options with a seeded generator, renumbers the questions from 1, and recomputes
the answer marker. Markers are not generated but reused: slot 1 of a variant
carries whatever marker slot 1 of that question carried in the source, which is
what keeps a Greek paper Greek. The paragraph nodes are shared with the exam
and cloned only at render time, so building a variant cannot corrupt the source.

```ts
{
  index: 1,
  source: 'calculus_practice_test_2.docx',
  questions: [
    { number: 1,           // position in this variant
      sourceNumber: 7,     // which original question it is
      stemText: ..., stemNodes: [...],
      options: [{ letter: 'A',        // marker in this variant
                  sourceLetter: 'C',  // marker in the original
                  text: ..., nodes: [...] }, ...],
      answer: 'B' },       // marker of the correct option, in this variant
    ...
  ],
}
```

`sourceNumber` and `sourceLetter` are the provenance of every shuffle. They are
what lets the tests assert that the new key still points at the same answer
*content* as the original, rather than merely at some letter.

### 2b. `scrubMetadata(parts) -> ZipEntry[]`

Empties the fields that name a person, an organisation or a machine:
`dc:creator` and `cp:lastModifiedBy` in `docProps/core.xml`, and `Company`,
`Manager`, `Template` and `TotalTime` in `docProps/app.xml`. The parts stay
where they are — the package's relationships point at them — they simply stop
naming anyone. Dates, the title and the revision count are left alone: when a
test was written says nothing about who wrote it.

`carriedOverWarnings()` covers what a scrub cannot reach. Comments and tracked
changes carry both their authors' names and their content, and removing them
would mean rewriting the document, its relationships and its content types —
exactly the guesswork this program refuses to do. So the page says so and
leaves the decision with the teacher.

### 3. `writeVariant(exam, variant) -> Paper[]`

Called once per variant, and writes both copies.

`renderDocumentXml()` re-parses the source document, empties the body, and
refills it: the source's own front matter, then each question's paragraphs in
their new order, then — professor copy only — a "Variant N" banner, the page
break, the **Answer Key** heading and one line per question. `sectPr` (page
setup) is put back last, where Word expects it.

`writeDocx()` then copies the source archive part for part, swapping in only the
rebuilt `word/document.xml`. Styles, fonts, numbering and the Cambria Math font
table are therefore literally the originals, so a variant renders exactly like
the source test.

Finally `bundlePapers()` puts the whole run into one ZIP. A browser cannot be
asked "overwrite these six files?" the way a command line can, so the run is
handed over as a single download instead — never a folder half from this run
and half from the last one.

### Why raw XML

The equations are OMML (`<m:oMath>` markup from the Word equation editor), and
OMML has no faithful text form. Flattening question 1 gives `x2 – 4x – 2`: the
fraction bar and the exponent are simply gone, and that string is wrong maths.
Rebuilding equations from text would mean re-deriving structure that was never
in the text.

So nothing is ever re-rendered. Each stem and option travels as the paragraph
element lifted from the source, and the **only** thing rewritten is the leading
label — `3.` becomes `7.`, `(B)` becomes `(A)`. `relabel()` locates that label
across the concatenated `<w:t>` runs (Word routinely splits `(A)  4` into `(A` +
`)  4`) and edits only the runs it actually covers, leaving bold labels and
adjacent formatting intact. Because the replacement is a string, a marker may
change width (`iii` → `i`) without disturbing anything around it. Equation runs
are `<m:t>`, never `<w:t>`, so a label rewrite cannot reach inside an equation.

### No runtime dependencies

The page ships no third-party code: the browser supplies the compressor
(`CompressionStream`), the XML parser (`DOMParser`) and the serialiser
(`XMLSerializer`), which is the same bargain the Python version struck with
`zipfile` and `xml.etree`. `vite`, `vitest`, `typescript` and `jsdom` are build
and test tooling only, and none of them reaches the published page — about
16 kB of JavaScript, 6.5 kB gzipped.

## Working on it

```bash
npm install
npm run dev        # the page, on a local server, reloading as you edit
npm test           # 161 tests
npm run typecheck  # tsc --noEmit
npm run build      # the static site, into dist/
```

Most tests run against the intermediate objects — parsing, the key page not
being read as an eleventh question, permutation and renumbering invariants, the
correct answer following the shuffle by content, seed determinism, the exam not
being mutated, and label rewriting split across runs. Others are end-to-end over
the written `.docx` bytes: the student copy has no key, the professor key
matches its variant, every equation is preserved markup for markup, every part
of the package is still there and paragraph ids stay unique.

The functional tests run the whole pipeline over **both** sample tests, the
Latin-lettered `calculus_practice_test_2.docx` and the Greek-lettered
`calculus_practice_test_3.docx`, asserting the same things of each — which is
what stops anything quietly depending on the markers being `A`–`D`. Nothing
about the sample documents is hard-coded that the documents themselves can
answer: the expected equation count is read from the source, so re-exporting a
sample does not break the suite.

`tests/serializer.test.ts` is worth knowing about: browsers disagree on whether
`XMLSerializer` writes an XML declaration of its own (Chromium does, jsdom and
Firefox do not), and a document part carrying two will not open. That was found
by running the built page in a real headless Chromium, and is pinned by a test
that makes the serialiser misbehave on purpose.

## Privacy and hardening

The page is meant to be safe to hand to a colleague without a caveat, so:

- **Nothing is sent anywhere.** The only absolute URLs in the built bundle are
  XML namespace identifiers (strings, never fetched), the data-URI favicon and
  the two GitHub links in the footer. No CDN, no web font, no analytics, no
  beacon; no cookies, no `localStorage`, no service worker.
- **A Content-Security-Policy makes that a rule the browser enforces**, rather
  than a property of today's code: `default-src 'none'` with `connect-src
  'self'` leaves nowhere for a document to be sent, even if some future
  dependency tried. It is a `<meta>` element because GitHub Pages cannot set
  headers, which is also why `frame-ancestors` is absent — it is header-only.
- **Papers are scrubbed of identity metadata** by default (above).
- **The page never builds HTML from document content.** Everything that comes
  out of a `.docx` reaches the page through `textContent`, so a hostile
  document cannot inject markup; the XML is parsed with `DOMParser`, which does
  not resolve external entities; and the output document is assembled with DOM
  calls rather than string concatenation.
- **A malformed archive is refused, not unpacked.** `readZip` caps the input at
  64 MB, any single part at 64 MB and the total unpacked at 256 MB, checked
  from the central directory *before* inflating, so a zip bomb cannot wedge the
  tab. Sizes and CRCs are then verified against what actually came out.
- **The download blob is released** when the next run starts and when the page
  is hidden, so a set of papers does not sit in memory after the teacher has
  finished.
- **The notice cannot be skipped.** The banner is static markup, so it is on
  the page even if the bundle never loads; the modal is shown on every visit,
  survives Escape (Chromium's close watcher closes a modal on Escape regardless
  of a prevented `cancel` before the page has been interacted with, so a close
  that was not the button puts it straight back), and nothing about the
  acknowledgement is stored. `tests/disclaimer.test.ts` holds the wording and
  the mechanism in place.
- **The build is pinned.** `package-lock.json` is committed and CI uses
  `npm ci`; the GitHub Actions are pinned to commit SHAs rather than movable
  tags, because whatever they run is what builds the page people trust with
  their exams.

The honest limits: GitHub (and its CDN) logs the HTTP request that serves the
page, like any host — that is visible to GitHub, not to this code, and no
document is part of it. And anything already inside a teacher's source
document that is not metadata — comments, tracked changes, hidden text —
travels with the papers by design, which is what the warning is for.

## Deployment

`.github/workflows/deploy.yml` builds the page and publishes it to GitHub Pages
on every push to `main`; the test suite is the gate. Enable it once, by hand:
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

The build uses a relative base (`base: './'`), so the same `dist/` works at
`https://<user>.github.io/testmessj/`, at a custom domain, or opened from a
local web server.

## Licence

[MIT](LICENSE). The copyright line reads "the testmessj authors" rather than a
name, to match the samples, which carry none either.

## Verification

Everything the tests check is structural, since there is no Word on the
development machine: valid archive, every source part present, well-formed XML,
the original namespace declarations preserved, and every equation identical to
the source's markup for markup.

Beyond the suite, these independent checks were run on 2026-09-19:

- the papers this code writes were read back with **Python's** `zipfile` and
  parsed by the original `testmess` — a second implementation, and a stricter
  ZIP reader than the one that wrote them;
- the **built page was driven in headless Chromium**, sample in and ZIP out,
  and the documents that came out of the browser passed the same checks. (That
  is how the double XML declaration above was found.)
- the papers produced by that browser run were inspected for identity: no
  author, no last-saved-by, no company, no template path, and all 31 equations
  still present. The browser's log was checked for CSP refusals — clean.

What has *not* happened yet: **nobody has opened one of these papers in Word.**
The package writer here is new code, and structural checks are necessary but
not sufficient. Open one professor copy in Word before handing out a set.
