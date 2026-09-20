// feature: exam-variants
//
// The WordprocessingML layer: everything that touches paragraph markup.
//
// Nothing here ever re-renders a paragraph.  A stem or an option travels as
// the element lifted from the source document, cloned into the output
// document, and the only thing rewritten is the leading label.  That is what
// keeps the equations (OMML, <m:oMath>) intact: they are markup, and markup is
// all that is ever copied.
//
// The DOM does the parsing and the serialising -- DOMParser and XMLSerializer
// are in every browser -- so the namespace prefixes the source document uses
// (w:, m:, w14:, mc: ...) come back out spelled the way they went in.

import { AppError } from './errors';

export const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  m: 'http://schemas.openxmlformats.org/officeDocument/2006/math',
  w14: 'http://schemas.microsoft.com/office/word/2010/wordml',
} as const;

export const XML_NS = 'http://www.w3.org/XML/1998/namespace';

export function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const failure = doc.getElementsByTagName('parsererror')[0];
  if (failure) {
    throw new AppError('not-well-formed', { detail: failure.textContent?.trim() ?? '' });
  }
  return doc;
}

export function serialize(node: Node): string {
  return new XMLSerializer().serializeToString(node);
}

export function isTag(node: Element, prefix: keyof typeof NS, local: string): boolean {
  return node.namespaceURI === NS[prefix] && node.localName === local;
}

/** Direct element children, as an array that survives mutation of the parent. */
export function childElements(parent: Element): Element[] {
  return Array.from(parent.children);
}

/** The <w:body> of a word/document.xml. */
export function documentBody(doc: Document): Element {
  const body = doc.documentElement.getElementsByTagNameNS(NS.w, 'body')[0];
  if (!body) {
    throw new AppError('no-body');
  }
  return body;
}

/**
 * Flatten a paragraph to plain text, equation runs (<m:t>) included.
 *
 * Lossy by nature -- used for recognising labels and for test assertions,
 * never for writing documents.
 */
export function paragraphText(paragraph: Element): string {
  const parts: string[] = [];
  const walk = (node: Element): void => {
    for (const child of Array.from(node.children)) {
      if (isTag(child, 'w', 't') || isTag(child, 'm', 't')) {
        parts.push(child.textContent ?? '');
      } else if (isTag(child, 'w', 'tab')) {
        parts.push('\t');
      } else {
        walk(child);
      }
    }
  };
  walk(paragraph);
  return parts.join('');
}

export function hasPageBreak(paragraph: Element): boolean {
  const breaks = paragraph.getElementsByTagNameNS(NS.w, 'br');
  return Array.from(breaks).some((node) => node.getAttributeNS(NS.w, 'type') === 'page');
}

/** The <w:t> runs of a paragraph, in document order. */
export function textRuns(paragraph: Element): Element[] {
  return Array.from(paragraph.getElementsByTagNameNS(NS.w, 't'));
}

/** Set a <w:t> value, keeping significant leading/trailing whitespace. */
export function setRunText(node: Element, value: string): void {
  node.textContent = value;
  if (value !== value.trim()) {
    node.setAttributeNS(XML_NS, 'xml:space', 'preserve');
  }
}

/**
 * Replace characters [start, end) of the concatenated <w:t> texts.
 *
 * A label can be split over several runs ("(A" + ")  4"), so the span is
 * mapped back onto whichever runs it covers.  Only those runs are touched,
 * which keeps the surrounding character formatting intact.
 */
export function replaceSpan(
  nodes: Element[], start: number, end: number, replacement: string,
): void {
  let position = 0;
  let inserted = false;
  for (const node of nodes) {
    const text = node.textContent ?? '';
    const low = position;
    const high = position + text.length;
    position = high;
    if (high <= start || low >= end) {
      continue;
    }
    const cutFrom = Math.max(start, low) - low;
    const cutTo = Math.min(end, high) - low;
    const head = text.slice(0, cutFrom);
    const tail = text.slice(cutTo);
    setRunText(node, head + (inserted ? '' : replacement) + tail);
    inserted = true;
  }
}

/** Rewrite the label opening a paragraph ("3." -> "7.", "(B)" -> "(A)"). */
export function relabel(paragraph: Element, pattern: RegExp, newLabel: string): boolean {
  const nodes = textRuns(paragraph);
  const joined = nodes.map((node) => node.textContent ?? '').join('');
  const match = pattern.exec(joined);
  if (match === null || !match.indices?.[1]) {
    return false;
  }
  const [start, end] = match.indices[1];
  replaceSpan(nodes, start, end, newLabel);
  return true;
}

/**
 * Drop w14:paraId / w14:textId from a cloned paragraph.
 *
 * Those ids are meant to be unique per paragraph, and the answer key lines are
 * all stamped out of the same template paragraph.
 */
export function stripParagraphIds(paragraph: Element): Element {
  for (const name of ['paraId', 'textId']) {
    paragraph.removeAttributeNS(NS.w14, name);
  }
  return paragraph;
}

/** A <w:...> element in the given document, with w:-qualified attributes. */
export function element(
  doc: Document, tag: string, attributes: Record<string, string> = {},
): Element {
  const node = doc.createElementNS(NS.w, `w:${tag}`);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttributeNS(NS.w, `w:${name}`, value);
  }
  return node;
}
