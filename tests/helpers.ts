// feature: exam-variants
//
// Shared test scaffolding: the sample documents, and the handful of readers
// used to interrogate a written .docx from the outside.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  KEY_ENTRY, KEY_HEADING, OPTION_LABEL, QUESTION_LABEL, readZip,
} from '../src/testmess';
import { DOCUMENT_PART } from '../src/parse';
import { NS, isTag, paragraphText, parseXml } from '../src/xml';

// Read from the repository root rather than from import.meta.url: under the
// jsdom environment that URL is a page URL, not a file one.
export function sampleBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(process.cwd(), 'samples', name)));
}

/**
 * The same test in two marker alphabets.  Test 3 marks its options with Greek
 * letters and no opening bracket ("α)  4"), and its key reads "1.  α".
 */
export const FIXTURES = [
  {
    name: 'latin',
    file: 'calculus_practice_test_2.docx',
    markers: ['A', 'B', 'C', 'D'],
    key: { 1: 'A', 2: 'D', 3: 'C', 4: 'A', 5: 'C', 6: 'B', 7: 'D', 8: 'A', 9: 'B', 10: 'C' },
  },
  {
    name: 'greek',
    file: 'calculus_practice_test_3.docx',
    markers: ['α', 'β', 'γ', 'δ'],
    key: { 1: 'α', 2: 'δ', 3: 'γ', 4: 'α', 5: 'γ', 6: 'β', 7: 'δ', 8: 'α', 9: 'β', 10: 'γ' },
  },
] as const;

export const SOURCE = FIXTURES[0].file;

/**
 * The same Greek test with its key page removed entirely -- a document a
 * teacher who knows their own answers would hand over.
 */
export const NOKEY = 'calculus_practice_test_3_no_key.docx';

/** word/document.xml out of a .docx, parsed. */
export async function documentRoot(bytes: Uint8Array): Promise<Document> {
  const parts = await readZip(bytes);
  const part = parts.find((entry) => entry.name === DOCUMENT_PART)!;
  return parseXml(new TextDecoder().decode(part.data));
}

export async function documentText(bytes: Uint8Array): Promise<string> {
  const parts = await readZip(bytes);
  const part = parts.find((entry) => entry.name === DOCUMENT_PART)!;
  return new TextDecoder().decode(part.data);
}

function mathNodes(doc: Document): Element[] {
  return Array.from(doc.getElementsByTagNameNS(NS.m, 'oMath'));
}

export function countMath(doc: Document): number {
  return mathNodes(doc).length;
}

/**
 * Every equation's full structure, as a multiset.
 *
 * Tags and attribute names are written in Clark notation ({uri}local), so
 * this compares the markup itself and not how a serialiser happened to spell
 * the namespace prefixes -- two documents can be identical and still write
 * m: vs ns0: for the same namespace.
 */
export function mathSignature(doc: Document): Map<string, number> {
  const shape = (node: Element): string => {
    const attributes = Array.from(node.attributes)
      .filter((attribute) => attribute.name !== 'xmlns'
        && !attribute.name.startsWith('xmlns:'))
      .map((attribute) => `{${attribute.namespaceURI ?? ''}}${attribute.localName}=${attribute.value}`)
      .sort()
      .join(',');
    const text = Array.from(node.childNodes)
      .filter((child) => child.nodeType === 3)
      .map((child) => child.nodeValue ?? '')
      .join('')
      .trim();
    const children = Array.from(node.children).map(shape).join('');
    return `<{${node.namespaceURI}}${node.localName}[${attributes}]"${text}"${children}>`;
  };

  const counts = new Map<string, number>();
  for (const node of mathNodes(doc)) {
    const key = shape(node);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function bodyParagraphs(doc: Document): Element[] {
  const body = doc.getElementsByTagNameNS(NS.w, 'body')[0];
  return Array.from(body.children).filter((child) => isTag(child, 'w', 'p'));
}

export function paragraphTexts(doc: Document): string[] {
  return bodyParagraphs(doc).map((paragraph) => paragraphText(paragraph).trim());
}

/** Drop a leading "7." or "(B)" so a paragraph can be compared by content. */
export function stripLabel(text: string): string {
  for (const pattern of [QUESTION_LABEL, OPTION_LABEL]) {
    const match = pattern.exec(text);
    if (match) {
      return text.slice(match[0].length).trim();
    }
  }
  return text.trim();
}

/** The key entries a document prints, as [question, marker] pairs. */
export function keyEntries(texts: string[]): Array<[number, string]> {
  const entries: Array<[number, string]> = [];
  for (const text of texts) {
    const match = KEY_ENTRY.exec(text);
    if (match) {
      entries.push([Number(match[1]), match[2]]);
    }
  }
  return entries;
}

export function hasKeyHeading(texts: string[]): boolean {
  return texts.some((text) => KEY_HEADING.test(text));
}

/** Count each distinct string, the way a teacher would tally the page. */
export function tally(items: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return counts;
}
