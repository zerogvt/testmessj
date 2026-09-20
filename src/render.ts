// feature: exam-variants
//
// Writing the variant documents.
//
// Nothing is re-rendered: word/document.xml is re-parsed from the source, its
// body emptied and refilled with the source's own paragraphs in their new
// order, and the package is then copied part for part with only that one part
// swapped.  Styles, fonts, numbering and the Cambria Math font table are
// therefore literally the originals, so a variant renders exactly like the
// source test.

import { DEFAULT_LANG, t, type Lang } from './i18n';
import { KEY_ENTRY, OPTION_LABEL, QUESTION_LABEL } from './markers';
import { DOCUMENT_PART, type Exam } from './parse';
import type { Variant } from './variants';
import {
  childElements, documentBody, element, isTag, parseXml, relabel, replaceSpan,
  serialize, setRunText, stripParagraphIds, textRuns,
} from './xml';
import { writeZip, type ZipEntry } from './zip';

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
const ROOT_OPEN_TAG = /<w:document\b[^>]*>/;
// Chromium's XMLSerializer writes an XML declaration of its own where jsdom
// and Firefox write none.  Word rejects a document with two, so whatever the
// serialiser produced is dropped and the source's declaration written back.
const OWN_DECLARATION = /^\uFEFF?\s*<\?xml[^>]*\?>\s*/;

export interface Paper {
  name: string;
  kind: 'student' | 'professor';
  variant: number;
  bytes: Uint8Array;
}

/**
 * The file names a variant is written under.
 *
 * A test that came with no answer key has no professor copy to write: the
 * professor copy exists to carry the key, and a second identical paper with a
 * banner on it would only be something else to hand out by mistake.
 */
export function variantNames(index: number, hasKey = true): string[] {
  const names = [`student_${index}.docx`];
  if (hasKey) {
    names.push(`professor_${index}.docx`);
  }
  return names;
}

// --------------------------------------------------------------------------
// Paragraphs this program invents (professor copy only)
// --------------------------------------------------------------------------

interface TextParagraphOptions {
  bold?: boolean;
  centered?: boolean;
  size?: string;
  after?: string;
}

function textParagraph(
  doc: Document, text: string, options: TextParagraphOptions = {},
): Element {
  const { bold = false, centered = false, size, after = '60' } = options;
  const paragraph = element(doc, 'p');
  const properties = element(doc, 'pPr');
  if (centered) {
    properties.append(element(doc, 'jc', { val: 'center' }));
  }
  properties.append(element(doc, 'spacing', { after }));
  paragraph.append(properties);

  const run = element(doc, 'r');
  const runProperties = element(doc, 'rPr');
  if (bold) {
    runProperties.append(element(doc, 'b'));
    runProperties.append(element(doc, 'bCs'));
  }
  if (size) {
    runProperties.append(element(doc, 'sz', { val: size }));
    runProperties.append(element(doc, 'szCs', { val: size }));
  }
  if (runProperties.children.length) {
    run.append(runProperties);
  }
  const node = element(doc, 't');
  setRunText(node, text);
  run.append(node);
  paragraph.append(run);
  return paragraph;
}

function pageBreakParagraph(doc: Document): Element {
  const paragraph = element(doc, 'p');
  const run = element(doc, 'r');
  run.append(element(doc, 'br', { type: 'page' }));
  paragraph.append(run);
  return paragraph;
}

/**
 * A "Variant N" line for the professor copy only.
 *
 * The student copy gets no banner, and nothing else the source did not have:
 * a variant has to read as the same test its class was given, not as one
 * visibly stamped copy out of several.  Which variant a student paper is can
 * be read off its file name, or off the professor copy it matches.
 */
function bannerParagraph(doc: Document, variant: Variant, lang: Lang): Element {
  // The only sentence this program ever adds to a document, so it is the only
  // one that has to follow the language the teacher is working in.
  const label = t(lang, 'paper.banner', { index: variant.index });
  return textParagraph(doc, label,
    { bold: true, centered: true, size: '22', after: '160' });
}

/** One key line, reusing the source key line's formatting where there is one. */
function keyEntryParagraph(
  doc: Document, exam: Exam, number: number, letter: string,
): Element {
  const template = exam.keyTemplates.entry;
  if (template !== null) {
    const paragraph = stripParagraphIds(doc.importNode(template, true));
    const nodes = textRuns(paragraph);
    const joined = nodes.map((node) => node.textContent ?? '').join('');
    const match = KEY_ENTRY.exec(joined);
    if (match?.indices?.[1] && match.indices[2]) {
      // Right to left: rewriting the letter first keeps the number's offsets.
      replaceSpan(nodes, match.indices[2][0], match.indices[2][1], letter);
      replaceSpan(nodes, match.indices[1][0], match.indices[1][1], String(number));
      return paragraph;
    }
  }
  return textParagraph(doc, `${number}.  ${letter}`, { after: '40' });
}

function keyParagraphs(
  doc: Document, exam: Exam, variant: Variant, lang: Lang,
): Element[] {
  const { pageBreak, heading } = exam.keyTemplates;
  const paragraphs: Element[] = [
    pageBreak !== null ? doc.importNode(pageBreak, true) : pageBreakParagraph(doc),
    heading !== null
      ? doc.importNode(heading, true)
      : textParagraph(doc, t(lang, 'paper.key'),
        { bold: true, size: '28', after: '160' }),
  ];
  for (const question of variant.questions) {
    // Only reached with a key: writeVariant() writes no professor copy
    // without one.
    paragraphs.push(keyEntryParagraph(doc, exam, question.number, question.answer ?? ''));
  }
  return paragraphs;
}

// --------------------------------------------------------------------------
// The document part
// --------------------------------------------------------------------------

/** Rebuild word/document.xml for one variant, reusing the source markup. */
export function renderDocumentXml(
  exam: Exam, variant: Variant, includeKey: boolean, lang: Lang = DEFAULT_LANG,
): string {
  const doc = parseXml(exam.documentXml);
  const body = documentBody(doc);
  const sectionProperties = childElements(body)
    .find((child) => isTag(child, 'w', 'sectPr')) ?? null;
  for (const child of Array.from(body.childNodes)) {
    body.removeChild(child);
  }

  for (const paragraph of exam.preamble) {
    body.append(doc.importNode(paragraph, true));
  }
  if (includeKey) {
    body.append(bannerParagraph(doc, variant, lang));
  }

  for (const question of variant.questions) {
    const stem = question.stemNodes.map((node) => doc.importNode(node, true));
    relabel(stem[0], QUESTION_LABEL, String(question.number));
    body.append(...stem);
    for (const option of question.options) {
      const paragraphs = option.nodes.map((node) => doc.importNode(node, true));
      relabel(paragraphs[0], OPTION_LABEL, option.letter);
      body.append(...paragraphs);
    }
  }

  if (includeKey) {
    body.append(...keyParagraphs(doc, exam, variant, lang));
  }
  if (sectionProperties !== null) {
    body.append(sectionProperties);
  }

  let serialised = serialize(doc).replace(OWN_DECLARATION, '');
  const openTag = ROOT_OPEN_TAG.exec(exam.documentXml)?.[0];
  if (openTag !== undefined) {
    // Restore the original root tag so every prefix listed in mc:Ignorable
    // stays declared, even where this variant happens not to use it.
    serialised = serialised.replace(ROOT_OPEN_TAG, () => openTag);
  }
  return XML_DECLARATION + serialised;
}

// --------------------------------------------------------------------------
// The package
// --------------------------------------------------------------------------

/** Copy the source package, swapping in the rebuilt document part. */
export async function writeDocx(exam: Exam, documentXml: string): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(documentXml);
  const parts: ZipEntry[] = exam.parts.map((entry) => (
    entry.name === DOCUMENT_PART ? { ...entry, data: encoded } : entry
  ));
  return writeZip(parts);
}

/**
 * Write one variant: the student paper, and -- where the source has an answer
 * key -- the professor's copy as well.
 */
export async function writeVariant(
  exam: Exam, variant: Variant, lang: Lang = DEFAULT_LANG,
): Promise<Paper[]> {
  const wanted = exam.hasKey
    ? [['student', false], ['professor', true]] as const
    : [['student', false]] as const;
  const names = variantNames(variant.index, exam.hasKey);

  const papers: Paper[] = [];
  for (const [index, [kind, includeKey]] of wanted.entries()) {
    papers.push({
      name: names[index],
      kind,
      variant: variant.index,
      bytes: await writeDocx(exam, renderDocumentXml(exam, variant, includeKey, lang)),
    });
  }
  return papers;
}
