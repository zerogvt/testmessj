// feature: exam-variants
//
// Browsers do not agree on what XMLSerializer writes in front of a document:
// Chromium adds an XML declaration of its own, jsdom and Firefox add none.
// Word will not open a document.xml carrying two, so the rendered part is
// checked here against a serialiser that behaves like Chromium's -- caught
// once for real, in a headless browser, and pinned here so it stays caught.

import { afterEach, describe, expect, it } from 'vitest';

import { makeVariants, parseExam, renderDocumentXml } from '../src/testmess';
import { SOURCE, sampleBytes } from './helpers';

const native = globalThis.XMLSerializer;

afterEach(() => {
  globalThis.XMLSerializer = native;
});

/** Serialise the way Chromium does: declaration first. */
function serializeLikeChromium(): void {
  class DeclaringSerializer extends native {
    override serializeToString(node: Node): string {
      const text = super.serializeToString(node);
      return node.nodeType === 9 ? `<?xml version="1.0" encoding="UTF-8"?>${text}` : text;
    }
  }
  globalThis.XMLSerializer = DeclaringSerializer;
}

describe('the rendered document part', () => {
  const render = async (includeKey: boolean): Promise<string> => {
    const exam = await parseExam(sampleBytes(SOURCE), SOURCE);
    return renderDocumentXml(exam, makeVariants(exam, 1, 5)[0], includeKey);
  };

  it.each([false, true])('carries exactly one XML declaration (key: %s)',
    async (includeKey) => {
      const xml = await render(includeKey);
      expect(xml.match(/<\?xml/g)).toHaveLength(1);
      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'))
        .toBe(true);
    });

  it.each([false, true])(
    'carries exactly one even when the serialiser writes its own (key: %s)',
    async (includeKey) => {
      serializeLikeChromium();
      const xml = await render(includeKey);
      expect(xml.match(/<\?xml/g)).toHaveLength(1);
      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document'))
        .toBe(true);
    });

  it('keeps the document root exactly as the source wrote it', async () => {
    serializeLikeChromium();
    const exam = await parseExam(sampleBytes(SOURCE), SOURCE);
    const expected = /<w:document\b[^>]*>/.exec(exam.documentXml)![0];
    const xml = renderDocumentXml(exam, makeVariants(exam, 1, 5)[0], true);
    expect(xml).toContain(expected);
  });
});
