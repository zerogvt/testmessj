<!-- feature: exam-variants -->
# testmessj

Turn one multiple-choice test in Word into any number of shuffled variants,
each written twice: a student copy (questions + options) and a professor copy
(same paper, plus a "Variant N" banner and the answer key on its own last
page).

This is [testmess](https://github.com/zerogvt/testmess) rewritten in
TypeScript, so it runs **in the browser**. There is nothing to install and
nothing to learn: open the page, pick your test, click one button.

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
inside your browser tab. You can put the page in a bookmark, or use it with
the network switched off.

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
| `src/variants.ts` | the shuffle, and the seeded generator behind it |
| `src/render.ts` | rebuilding `word/document.xml`, writing the packages |
| `src/testmess.ts` | the whole pipeline in one call, plus the public exports |
| `src/main.ts` | the page: file in, ZIP out |
| `tests/` | 123 tests, `vitest` |
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
npm test           # 123 tests
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

## Deployment

`.github/workflows/deploy.yml` builds the page and publishes it to GitHub Pages
on every push to `main`; the test suite is the gate. Enable it once, by hand:
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

The build uses a relative base (`base: './'`), so the same `dist/` works at
`https://<user>.github.io/testmessj/`, at a custom domain, or opened from a
local web server.

## Verification

Everything the tests check is structural, since there is no Word on the
development machine: valid archive, every source part present, well-formed XML,
the original namespace declarations preserved, and every equation identical to
the source's markup for markup.

Beyond the suite, two independent checks were run on 2026-09-19:

- the papers this code writes were read back with **Python's** `zipfile` and
  parsed by the original `testmess` — a second implementation, and a stricter
  ZIP reader than the one that wrote them;
- the **built page was driven in headless Chromium**, sample in and ZIP out,
  and the documents that came out of the browser passed the same checks. (That
  is how the double XML declaration above was found.)

What has *not* happened yet: **nobody has opened one of these papers in Word.**
The package writer here is new code, and structural checks are necessary but
not sufficient. Open one professor copy in Word before handing out a set.
