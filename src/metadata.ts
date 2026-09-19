// feature: exam-variants
//
// Word writes more into a .docx than the words: docProps/core.xml names the
// author and whoever saved it last, docProps/app.xml names the template, the
// company and how many minutes were spent editing.  Because a variant is the
// source package copied part for part, all of that would otherwise travel to
// every student -- their teacher's name is one right-click away in File ->
// Properties, and one `unzip` away for anyone curious.
//
// So the papers are scrubbed by default.  Only these metadata parts are
// touched; the document, styles, fonts, numbering and the math font table are
// still literally the originals.

import type { ZipEntry } from './zip';

const CORE_PART = 'docProps/core.xml';
const APP_PART = 'docProps/app.xml';

/**
 * What is emptied, and what it is replaced with.
 *
 * Dates are deliberately left alone: when a test was written says nothing
 * about who wrote it, and dcterms elements are typed, so an empty one risks
 * upsetting Word for no gain.
 */
const CORE_FIELDS: Record<string, string> = {
  'dc:creator': '',
  'cp:lastModifiedBy': '',
};

const APP_FIELDS: Record<string, string> = {
  Company: '',
  Manager: '',
  // A custom template can be a path on a school's network drive.
  Template: 'Normal.dotm',
  // How long the teacher spent writing the test is nobody else's business.
  TotalTime: '0',
};

const decoder = new TextDecoder('utf-8');
const encoder = new TextEncoder();

/**
 * Replace one element's text content in a small, well-formed part.
 *
 * Deliberately string surgery rather than a DOM round trip: these parts go to
 * Word untouched apart from the fields named above, and re-serialising them
 * would risk changes nobody asked for.  Absent elements are left absent --
 * adding a `<Company/>` that was never there would be a change of its own.
 */
function setField(xml: string, tag: string, value: string): string {
  const paired = new RegExp(`(<${tag}(?:\\s[^>]*)?>)[\\s\\S]*?(</${tag}>)`, 'g');
  const empty = new RegExp(`<${tag}((?:\\s[^>]*)?)/>`, 'g');
  return xml
    .replace(paired, (_match, open: string, close: string) => `${open}${value}${close}`)
    .replace(empty, (_match, attributes: string) => (
      value ? `<${tag}${attributes}>${value}</${tag}>` : `<${tag}${attributes}/>`
    ));
}

function scrubPart(xml: string, fields: Record<string, string>): string {
  let out = xml;
  for (const [tag, value] of Object.entries(fields)) {
    out = setField(out, tag, value);
  }
  return out;
}

/**
 * Take the names out of a package's metadata parts.
 *
 * The parts stay where they are -- the package's relationships point at them,
 * so removing them would be a broken document -- they simply stop naming
 * anyone.
 */
export function scrubMetadata(parts: ZipEntry[]): ZipEntry[] {
  return parts.map((entry) => {
    const fields = entry.name === CORE_PART
      ? CORE_FIELDS
      : entry.name === APP_PART ? APP_FIELDS : null;
    if (fields === null) {
      return entry;
    }
    const scrubbed = scrubPart(decoder.decode(entry.data), fields);
    return { ...entry, data: encoder.encode(scrubbed) };
  });
}

/** The names a package still carries, for tests and for the page's warning. */
export function metadataNames(parts: ZipEntry[]): string[] {
  const names: string[] = [];
  for (const entry of parts) {
    if (entry.name !== CORE_PART && entry.name !== APP_PART) {
      continue;
    }
    const xml = decoder.decode(entry.data);
    for (const tag of ['dc:creator', 'cp:lastModifiedBy', 'Company', 'Manager']) {
      const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(xml);
      const value = match?.[1]?.trim();
      if (value) {
        names.push(value);
      }
    }
  }
  return names;
}

/**
 * Things in the source document that a scrub cannot reach, and that a teacher
 * would not want to hand out.
 *
 * Comments and tracked changes carry their authors' names *and* their content
 * -- a note reading "make this one easier, they struggled last year" is in the
 * file, whether or not Word shows it.  Removing them would mean rewriting the
 * document, its relationships and its content types, which is exactly the kind
 * of guesswork this program refuses to do; so it says so instead, and lets the
 * teacher decide.
 */
export function carriedOverWarnings(parts: ZipEntry[]): string[] {
  const warnings: string[] = [];
  const has = (name: string) => parts.some((entry) => entry.name === name);

  if (has('word/comments.xml') || has('word/commentsExtended.xml')) {
    warnings.push('comments');
  }
  const document = parts.find((entry) => entry.name === 'word/document.xml');
  if (document) {
    const xml = decoder.decode(document.data);
    if (/<w:(ins|del)\b/.test(xml)) {
      warnings.push('tracked changes');
    }
  }
  return warnings;
}
