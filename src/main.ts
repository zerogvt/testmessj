// feature: exam-variants
//
// The page: pick a .docx, say how many variants, get one ZIP back.
//
// The source test is parsed as soon as it is chosen, not when the button is
// pressed, so a document this program refuses to guess about (a missing key
// entry, duplicate markers) is reported while the teacher is still looking at
// the file they picked.
//
// Two languages, one page.  Everything written in the markup carries a
// data-i18n key; everything written from here goes through t().  Switching
// language re-renders whatever is on screen from the state below, so a run
// already built does not have to be built again to be read in Greek.

import {
  bundlePapers, carriedOverWarnings, generatePapers, parseExam, seedFrom,
} from './testmess';
import type { Exam, Paper, Variant } from './testmess';
import { AppError } from './errors';
import { DEFAULT_LANG, LANGS, detectLanguage, t, type Lang, type Params } from './i18n';

// Served from the root of the build (see publicDir in vite.config.ts), under
// the same names the download links in the page use.
const SAMPLES: Record<string, string> = {
  latin: 'calculus_practice_test_2.docx',
  greek: 'calculus_practice_test_3.docx',
  nokey: 'calculus_practice_test_3_no_key.docx',
};

const fileInput = document.querySelector<HTMLInputElement>('#file')!;
const dropZone = document.querySelector<HTMLElement>('#drop')!;
const countInput = document.querySelector<HTMLInputElement>('#count')!;
const seedInput = document.querySelector<HTMLInputElement>('#seed')!;
const scrubInput = document.querySelector<HTMLInputElement>('#scrub')!;
const generateButton = document.querySelector<HTMLButtonElement>('#generate')!;
const downloadButton = document.querySelector<HTMLButtonElement>('#download')!;
const sourceStatus = document.querySelector<HTMLElement>('#source')!;
const warning = document.querySelector<HTMLElement>('#warning')!;
const status = document.querySelector<HTMLElement>('#status')!;
const results = document.querySelector<HTMLElement>('#results')!;
const notice = document.querySelector<HTMLDialogElement>('#notice')!;

type Kind = 'info' | 'error' | 'ok' | 'warn';

interface Source {
  name: string;
  bytes: Uint8Array;
  exam: Exam;
}

interface Run {
  papers: Paper[];
  variants: Variant[];
  seed: number;
  hasKey: boolean;
}

interface Message {
  key: string;
  params: Params;
  kind: Kind;
}

let lang: Lang = DEFAULT_LANG;
let source: Source | null = null;
let run: Run | null = null;
// The status lines are kept as keys, not as sentences, so they can change
// language along with the rest of the page.
let sourceMessage: Message | null = null;
let statusMessage: Message | null = null;
let warningMessage: Message | null = null;
let download: { url: string; name: string } | null = null;

// --------------------------------------------------------------------------
// Language
// --------------------------------------------------------------------------

function applyStrings(): void {
  document.documentElement.lang = lang;
  document.title = t(lang, 'page.title');
  document.querySelector<HTMLMetaElement>('meta[name="description"]')
    ?.setAttribute('content', t(lang, 'page.description'));

  for (const node of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    node.textContent = t(lang, node.dataset.i18n!);
  }
  for (const node of document.querySelectorAll<HTMLElement>('[data-i18n-placeholder]')) {
    node.setAttribute('placeholder', t(lang, node.dataset.i18nPlaceholder!));
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
    button.setAttribute('aria-pressed', String(button.dataset.lang === lang));
  }
}

function setLanguage(next: Lang): void {
  lang = next;
  applyStrings();
  // Anything already on screen has to follow.
  renderMessage(sourceStatus, sourceMessage);
  renderMessage(status, statusMessage);
  renderMessage(warning, warningMessage);
  renderRun();

  // So a Greek page can be sent to somebody as a link.  replaceState keeps it
  // out of the back button's way, and stores nothing.
  const url = new URL(window.location.href);
  if (next === DEFAULT_LANG) {
    url.searchParams.delete('lang');
  } else {
    url.searchParams.set('lang', next);
  }
  window.history.replaceState(null, '', url);
}

// --------------------------------------------------------------------------
// Saying things
// --------------------------------------------------------------------------

function renderMessage(target: HTMLElement, message: Message | null): void {
  target.textContent = message ? t(lang, message.key, message.params) : '';
  target.className = `status ${message?.kind ?? 'info'}`;
}

function say(
  target: HTMLElement, key: string | null, params: Params = {}, kind: Kind = 'info',
): void {
  const message = key === null ? null : { key, params, kind };
  if (target === sourceStatus) {
    sourceMessage = message;
  } else if (target === status) {
    statusMessage = message;
  } else if (target === warning) {
    warningMessage = message;
  }
  renderMessage(target, message);
}

/** Report a failure in the reader's language, where the error has a code. */
function complain(target: HTMLElement, error: unknown): void {
  if (error instanceof AppError) {
    say(target, error.key, error.params, 'error');
    return;
  }
  // Something unforeseen: better the English than nothing.
  say(target, null);
  target.textContent = (error as Error).message;
  target.className = 'status error';
}

// --------------------------------------------------------------------------
// The work
// --------------------------------------------------------------------------

function clearResults(): void {
  results.replaceChildren();
  downloadButton.hidden = true;
  run = null;
  say(status, null);
  if (download) {
    URL.revokeObjectURL(download.url);
    download = null;
  }
}

/** Read a chosen file, and parse it straight away so errors surface early. */
async function useDocument(name: string, bytes: Uint8Array): Promise<void> {
  clearResults();
  say(warning, null);
  source = null;
  generateButton.disabled = true;
  say(sourceStatus, 'status.reading', { name });
  try {
    const exam = await parseExam(bytes, name);
    source = { name, bytes, exam };
    say(sourceStatus, 'status.source', {
      count: exam.questions.length,
      markers: exam.questions[0].options.map((option) => option.letter).join(' '),
      name,
    }, 'ok');
    // A test with no answer key page is an ordinary test -- said plainly,
    // where the file was chosen, so nobody waits for professor copies that
    // are never coming.
    if (!exam.hasKey) {
      say(warning, 'status.nokey', {}, 'info');
    }
    // Comments and tracked changes cannot be scrubbed without rewriting the
    // document, so the teacher is told rather than surprised.
    const carried = carriedOverWarnings(exam.parts);
    if (carried.length) {
      say(warning, 'status.warning', { what: listWarnings(carried) }, 'warn');
    }
    generateButton.disabled = false;
  } catch (error) {
    complain(sourceStatus, error);
  }
}

/** "comments and tracked changes", in the page's language. */
function listWarnings(carried: string[]): string {
  return carried
    .map((item) => t(lang, item === 'comments' ? 'warning.comments' : 'warning.tracked'))
    .join(` ${t(lang, 'warning.and')} `);
}

async function readFile(file: File): Promise<void> {
  await useDocument(file.name, new Uint8Array(await file.arrayBuffer()));
}

async function loadSample(which: string): Promise<void> {
  const name = SAMPLES[which];
  try {
    const response = await fetch(`./${name}`);
    if (!response.ok) {
      throw new Error(`${response.status}`);
    }
    await useDocument(name, new Uint8Array(await response.arrayBuffer()));
  } catch {
    say(sourceStatus, 'error.sample', { name }, 'error');
  }
}

/** How the seed box is read: a number is itself, any other text is hashed. */
function chosenSeed(): number | undefined {
  const text = seedInput.value.trim();
  if (!text) {
    return undefined;
  }
  return /^\d+$/.test(text) ? Number(text) >>> 0 : seedFrom(text);
}

/** Draw the table of variants, in whatever language the page is in. */
function renderRun(): void {
  if (!run) {
    return;
  }
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (const key of ['results.variant', 'results.files', 'results.key']) {
    const cell = document.createElement('th');
    cell.textContent = t(lang, key);
    head.append(cell);
  }
  const body = table.createTBody();
  for (const variant of run.variants) {
    const row = body.insertRow();
    row.insertCell().textContent = String(variant.index);
    row.insertCell().textContent = run.papers
      .filter((paper) => paper.variant === variant.index)
      .map((paper) => paper.name)
      .join(', ');
    const cell = row.insertCell();
    cell.className = run.hasKey ? 'key' : 'key muted';
    cell.textContent = run.hasKey
      ? variant.questions.map((question) => `${question.number}${question.answer}`).join(', ')
      : t(lang, 'results.nokey');
  }

  const note = document.createElement('p');
  note.className = 'hint';
  note.textContent = t(lang, 'results.seed', { seed: run.seed });
  results.replaceChildren(table, note);

  if (download) {
    downloadButton.textContent = t(lang, 'download.button',
      { name: download.name, papers: run.papers.length });
  }
}

async function build(): Promise<void> {
  if (!source) {
    return;
  }
  clearResults();
  generateButton.disabled = true;
  say(status, 'status.building');
  try {
    const hasKey = source.exam.hasKey;
    const { papers, variants, seed } = await generatePapers(source.bytes, source.name, {
      count: Number(countInput.value),
      seed: chosenSeed(),
      keepMetadata: !scrubInput.checked,
      lang,
    });
    const archive = await bundlePapers(papers);
    const base = source.name.replace(/\.docx$/i, '');
    const blob = new Blob([archive as BlobPart], { type: 'application/zip' });
    download = { url: URL.createObjectURL(blob), name: `${base}-variants.zip` };
    run = { papers, variants, seed, hasKey };
    downloadButton.hidden = false;
    renderRun();
    say(status, hasKey ? 'status.ready' : 'status.ready.nokey',
      { variants: variants.length, papers: papers.length }, 'ok');
  } catch (error) {
    complain(status, error);
  } finally {
    generateButton.disabled = false;
  }
}

// --------------------------------------------------------------------------
// The notice
// --------------------------------------------------------------------------
//
// Shown on every visit and closed only by the button: nothing is remembered
// between visits, because remembering would mean storing a flag in somebody's
// browser, and this page stores nothing.  A teacher meets it each time they
// come to build papers, which is exactly when it matters.

function openNotice(): void {
  if (typeof notice.showModal === 'function') {
    if (!notice.open) {
      notice.showModal();
    }
  } else {
    // No <dialog> support: show it in the page rather than not at all.
    notice.setAttribute('open', '');
  }
}

// Escape must not dismiss it; the button is the acknowledgement.
//
// Preventing `cancel` is not enough on its own: Chromium's close watcher
// closes a modal on Escape regardless when the page has not been interacted
// with yet, which is exactly the moment this notice is on screen.  So a close
// that was not the button putting it back is undone -- verified in a real
// browser, because this is precisely the kind of thing jsdom would let pass.
let acknowledged = false;

notice.addEventListener('cancel', (event) => event.preventDefault());
notice.addEventListener('close', () => {
  if (!acknowledged) {
    openNotice();
  }
});
document.querySelector<HTMLButtonElement>('#accept-notice')!
  .addEventListener('click', () => {
    acknowledged = true;
  });

for (const id of ['show-notice', 'show-notice-footer']) {
  document.querySelector<HTMLButtonElement>(`#${id}`)?.addEventListener(
    'click', () => openNotice());
}

// --------------------------------------------------------------------------
// Wiring
// --------------------------------------------------------------------------

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
  button.addEventListener('click', () => {
    const next = button.dataset.lang as Lang;
    if ((LANGS as readonly string[]).includes(next) && next !== lang) {
      setLanguage(next);
    }
  });
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) {
    void readFile(file);
  }
});

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-sample]')) {
  button.addEventListener('click', () => {
    fileInput.value = '';
    void loadSample(button.dataset.sample!);
  });
}

for (const event of ['dragenter', 'dragover'] as const) {
  dropZone.addEventListener(event, (drag) => {
    drag.preventDefault();
    dropZone.classList.add('over');
  });
}
for (const event of ['dragleave', 'drop'] as const) {
  dropZone.addEventListener(event, () => dropZone.classList.remove('over'));
}
dropZone.addEventListener('drop', (drag) => {
  drag.preventDefault();
  const file = drag.dataTransfer?.files?.[0];
  if (file) {
    void readFile(file);
  }
});

generateButton.addEventListener('click', () => void build());

downloadButton.addEventListener('click', () => {
  if (!download) {
    return;
  }
  const anchor = document.createElement('a');
  anchor.href = download.url;
  anchor.download = download.name;
  anchor.click();
});

// A blob URL keeps the whole set of papers alive in memory for as long as the
// tab is open.  Nothing can read it from outside, but there is no reason for
// somebody's exam to sit there after they have closed the page or walked away
// from it, so it goes as soon as it is no longer needed.
window.addEventListener('pagehide', () => {
  if (download) {
    URL.revokeObjectURL(download.url);
    download = null;
  }
});

// The page opens in the language it was asked for, or the browser's own.
setLanguage(detectLanguage());

openNotice();
