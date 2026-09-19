// feature: exam-variants
//
// The page: pick a .docx, say how many variants, get one ZIP back.
//
// The source test is parsed as soon as it is chosen, not when the button is
// pressed, so a document this program refuses to guess about (a missing key
// entry, duplicate markers) is reported while the teacher is still looking at
// the file they picked.

import latinSample from '../samples/calculus_practice_test_2.docx?url';
import greekSample from '../samples/calculus_practice_test_3.docx?url';
import {
  bundlePapers, carriedOverWarnings, generatePapers, parseExam, seedFrom,
} from './testmess';
import type { Exam, Paper } from './testmess';

const SAMPLES: Record<string, { url: string; name: string }> = {
  latin: { url: latinSample, name: 'calculus_practice_test_2.docx' },
  greek: { url: greekSample, name: 'calculus_practice_test_3.docx' },
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

interface Source {
  name: string;
  bytes: Uint8Array;
  exam: Exam;
}

let source: Source | null = null;
let download: { url: string; name: string } | null = null;

function message(target: HTMLElement, text: string, kind: 'info' | 'error' | 'ok' | 'warn' = 'info') {
  target.textContent = text;
  target.className = `status ${kind}`;
}

function clearResults(): void {
  results.replaceChildren();
  downloadButton.hidden = true;
  if (download) {
    URL.revokeObjectURL(download.url);
    download = null;
  }
}

/** Read a chosen file, and parse it straight away so errors surface early. */
async function useDocument(name: string, bytes: Uint8Array): Promise<void> {
  clearResults();
  message(warning, '');
  source = null;
  generateButton.disabled = true;
  message(sourceStatus, `Reading ${name}…`);
  try {
    const exam = await parseExam(bytes, name);
    source = { name, bytes, exam };
    const markers = exam.questions[0].options.map((option) => option.letter).join(' ');
    const title = exam.title ? `${exam.title} — ` : '';
    message(sourceStatus,
      `${title}${exam.questions.length} questions, options marked ${markers} — ${name}`,
      'ok');
    // Comments and tracked changes cannot be scrubbed without rewriting the
    // document, so the teacher is told rather than surprised.
    const carried = carriedOverWarnings(exam.parts);
    if (carried.length) {
      message(warning,
        `Careful: this document contains ${carried.join(' and ')}, which are `
        + 'part of the file and will be carried into the papers. Remove them in '
        + 'Word (Review tab) first if the class should not see them.', 'warn');
    }
    generateButton.disabled = false;
  } catch (error) {
    message(sourceStatus, (error as Error).message, 'error');
  }
}

async function readFile(file: File): Promise<void> {
  await useDocument(file.name, new Uint8Array(await file.arrayBuffer()));
}

async function loadSample(which: string): Promise<void> {
  const sample = SAMPLES[which];
  const response = await fetch(sample.url);
  await useDocument(sample.name, new Uint8Array(await response.arrayBuffer()));
}

/** How the seed box is read: a number is itself, any other text is hashed. */
function chosenSeed(): number | undefined {
  const text = seedInput.value.trim();
  if (!text) {
    return undefined;
  }
  return /^\d+$/.test(text) ? Number(text) >>> 0 : seedFrom(text);
}

function showResults(papers: Paper[], keys: string[], seed: number): void {
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (const label of ['Variant', 'Files', 'Answer key']) {
    const cell = document.createElement('th');
    cell.textContent = label;
    head.append(cell);
  }
  const body = table.createTBody();
  keys.forEach((key, index) => {
    const row = body.insertRow();
    row.insertCell().textContent = String(index + 1);
    const names = papers
      .filter((paper) => paper.variant === index + 1)
      .map((paper) => paper.name)
      .join(', ');
    row.insertCell().textContent = names;
    const cell = row.insertCell();
    cell.className = 'key';
    cell.textContent = key;
  });

  const note = document.createElement('p');
  note.className = 'hint';
  note.textContent = `Seed ${seed} — type it into the seed box to rebuild exactly these papers.`;

  results.replaceChildren(table, note);
}

async function build(): Promise<void> {
  if (!source) {
    return;
  }
  clearResults();
  generateButton.disabled = true;
  message(status, 'Building the papers…');
  try {
    const { papers, variants, seed } = await generatePapers(source.bytes, source.name, {
      count: Number(countInput.value),
      seed: chosenSeed(),
      keepMetadata: !scrubInput.checked,
    });
    const archive = await bundlePapers(papers);
    const base = source.name.replace(/\.docx$/i, '');
    const blob = new Blob([archive as BlobPart], { type: 'application/zip' });
    download = { url: URL.createObjectURL(blob), name: `${base}-variants.zip` };
    downloadButton.textContent = `Download ${download.name} (${papers.length} papers)`;
    downloadButton.hidden = false;
    showResults(papers, variants.map(
      (variant) => variant.questions.map((q) => `${q.number}${q.answer}`).join(', ')), seed);
    message(status,
      `${variants.length} variants ready: ${papers.length} documents. `
      + 'Hand out the student copies; the professor copies carry the key.', 'ok');
  } catch (error) {
    message(status, (error as Error).message, 'error');
  } finally {
    generateButton.disabled = false;
  }
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
