# CLAUDE.md

Context for working on **testmessj**, beyond what the code and README already
show. Read `README.md` first for how the program is put together; this file is
only the things that are easy to break without knowing them.

testmessj is the TypeScript port of
[testmess](https://github.com/zerogvt/testmess) — same job, same invariants,
running in a browser tab instead of a terminal. When something here is
surprising, the Python original usually explains why.

Feature tag for new files here: `feature: exam-variants` (the tag predates both
renames — keep it, do not "fix" it).

## The invariants

These are the promises the tests exist to defend. Breaking one silently puts a
wrong exam paper in front of a student, so treat a failure here as a bug in the
change, not in the test.

- **Equations never go through plain text.** The tests are written with the Word
  equation editor (OMML, `<m:oMath>`), which has no faithful text rendering:
  `x²−4 / x−2` flattens to the wrong maths `x2 – 4x – 2`. Stems and options are
  carried as the *paragraph elements* cloned from the source and re-emitted
  unchanged. The only thing ever rewritten in a paragraph is its leading label.
- **The student copy adds nothing.** Apart from the reordering and the
  renumbering it is paragraph-for-paragraph the source test — no banner, no
  heading, no blank line. Nothing on the page may reveal which variant a student
  holds. (The professor copy is where additions go.)
- **Option markers come from the document.** `(A)`, `a.`, `α)`, `(iii)` — never
  assume A–D, never generate a fresh sequence, never uppercase them. A variant
  reuses that question's own markers in their original order, so a Greek paper
  stays Greek and keeps agreeing with its own instructions line. Compare markers
  with `sameMarker()`, which case-folds.
- **The key follows the shuffle by content**, not by marker: after shuffling it
  must point at the same answer text it pointed at in the source.
- **Refuse rather than guess.** A missing key entry, duplicate markers, a key
  naming an option that does not exist: throw `ExamError`, do not improvise.
  Half-correct exam papers are worse than no papers. The page shows that message
  where the teacher chose the file.
- **A run is handed over whole.** The browser has no folder to half-overwrite,
  and that is the point: all the papers of one run go into one ZIP, or none do.
  Never offer a partial set.
- **The source never leaves the tab.** No upload, no telemetry, no CDN, no
  analytics, no cookies, no stored state. A teacher's unreleased exam is on
  that page. Anything that would make a network request after load is a bug,
  and the missing runtime dependencies are what keep it honest. The `<meta>`
  CSP in `index.html` (`default-src 'none'`, `connect-src 'self'`) is the
  browser-enforced half of that promise -- when it has to change, change it
  deliberately and say why.
- **The papers name nobody by default.** `scrubMetadata()` empties the author,
  last-saved-by, company, manager, template and editing-time fields before the
  papers are written. It touches `docProps/` only; the document, styles, fonts
  and math table stay the originals. A teacher can opt back in from the page.
  What a scrub cannot reach -- comments, tracked changes -- is *warned about*,
  never silently rewritten: see `carriedOverWarnings()`.
- **Document content never becomes markup.** Anything read out of a `.docx`
  reaches the page through `textContent`, and the output document is built with
  DOM calls, not string concatenation. No `innerHTML`, ever.

## Conventions

- **No runtime dependencies.** The browser supplies the ZIP codec
  (`CompressionStream`/`DecompressionStream`, `deflate-raw`), the XML parser
  (`DOMParser`) and the serialiser (`XMLSerializer`). That is the same bargain
  the Python version struck with `zipfile` and `xml.etree`, and the raw-XML
  approach is strictly more faithful than any re-render, so it is not a
  sacrifice. `vite`/`vitest`/`typescript`/`jsdom` are tooling and must stay out
  of `src/` imports that reach the page.
- 2-space indentation, in the TypeScript too. Comments say *why*, not *what*.
- Tests are `vitest`, run with `npm test`. They live in `tests/` and import
  through `src/testmess.ts` where they can.
- Do not hard-code facts about `samples/*.docx` into tests — the sample
  documents get re-exported and the numbers move (the equation count already
  changed 30 → 31 once). Derive them from the source document at test time.
  Marker alphabets and keys are the exception, and they live in `FIXTURES`.
- Generated papers are downloads, not files in the tree; `dist/` and
  `node_modules/` are gitignored. The sample sources are not.

## Things that bit us

- **`frame-ancestors` in a `<meta>` CSP is ignored** and Chromium logs an error
  about it. GitHub Pages cannot set headers, so it is left out on purpose --
  do not "fix" it back in.
- **The samples are published with the page.** They were exported from Word and
  carried a real name in `docProps/core.xml` until it was emptied on
  2026-09-19. Any sample added later needs the same treatment before it is
  committed: `dc:creator` and `cp:lastModifiedBy`, checked with
  `metadataNames()`.
- **`XMLSerializer` is not the same everywhere.** Chromium writes an XML
  declaration in front of a serialised document; jsdom and Firefox do not. Two
  declarations and Word will not open the part. `renderDocumentXml()` strips
  whatever the serialiser produced and writes the source's own declaration
  back; `tests/serializer.test.ts` pins that with a deliberately misbehaving
  serialiser. **jsdom passing is not proof a browser is happy** — when
  something touches parsing or serialising, run the built page in a real
  browser.
- **The root element is restored verbatim** after serialising, so every prefix
  listed in `mc:Ignorable` stays declared even where a variant does not use it.
- **Paragraph ids must not be cloned.** The key lines are all stamped out of one
  template paragraph; `stripParagraphIds()` drops `w14:paraId`/`w14:textId` so
  they do not collide.
- **The exam's nodes are shared, never mutated.** Variants point at the same
  elements; `renderDocumentXml()` clones with `importNode` before relabelling.
  Mutating a node in place would corrupt every later variant.
- **Seeds are shown, not hidden.** A teacher who has to reprint one paper needs
  the run to be repeatable, so the seed used is always reported back.

## Verification

The automated checks are structural, since there is no Word on the development
machine: valid archive, every source part present, well-formed XML, original
namespace declarations preserved, equations identical to the source markup for
markup.

Three things were confirmed by hand on 2026-09-19: Python's `zipfile` and the
original `testmess` parser read the papers this code writes; the built page
produces papers that pass the same checks when driven in headless Chromium; and
the papers from that browser run carry no author, company or template path,
with the browser's own log clean of CSP refusals.

**Nobody has opened a testmessj paper in Word yet.** The package writer is new
code. If a change touches how the archive or the document part is written, the
structural checks are necessary but not sufficient — open one of the results in
Word before claiming it renders.
