// feature: exam-variants
//
// A test that ends with its last question is an ordinary test: plenty of
// teachers know their own answers and never type a key page.  Such a document
// is read, shuffled and written -- as student copies only, because the
// professor copy exists to carry the key and a second identical paper with a
// banner on it is just something else to hand out by mistake.
//
// The distinction that matters, and that these tests pin: *no key at all* is
// fine; a key that is announced and then incomplete is still refused, because
// there the teacher believes there is one.

import { describe, expect, it } from 'vitest';

import {
  generatePapers, keyLine, makeVariants, parseExam, readZip, variantNames,
  writeVariant, writeZip,
} from '../src/testmess';
import { KEY_HEADING } from '../src/markers';
import { NOKEY, SOURCE, documentRoot, countMath, mathSignature, paragraphTexts, sampleBytes } from './helpers';

describe('a test with no answer key', () => {
  const bytes = () => sampleBytes(NOKEY);

  it('is read rather than refused', async () => {
    const exam = await parseExam(bytes(), NOKEY);
    expect(exam.hasKey).toBe(false);
    expect(exam.questions).toHaveLength(10);
    expect(exam.questions.map((question) => question.answer))
      .toEqual(Array(10).fill(null));
    expect(exam.questions[0].options.map((option) => option.letter))
      .toEqual(['α', 'β', 'γ', 'δ']);
  });

  it('has no key page to reuse', async () => {
    const exam = await parseExam(bytes(), NOKEY);
    expect(exam.keyTemplates.heading).toBeNull();
    expect(exam.keyTemplates.entry).toBeNull();
  });

  it('shuffles like any other test, with no answer to follow', async () => {
    const exam = await parseExam(bytes(), NOKEY);
    for (const variant of makeVariants(exam, 3, 5)) {
      expect(variant.questions.map((question) => question.number))
        .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      for (const question of variant.questions) {
        expect(question.answer).toBeNull();
        expect(question.options.map((option) => option.letter))
          .toEqual(['α', 'β', 'γ', 'δ']);
      }
    }
  });

  it('prints no key line rather than an invented one', async () => {
    const exam = await parseExam(bytes(), NOKEY);
    expect(keyLine(makeVariants(exam, 1, 5)[0])).toBe('');
  });

  it('is written as student copies only', async () => {
    const exam = await parseExam(bytes(), NOKEY);
    const papers = await writeVariant(exam, makeVariants(exam, 1, 5)[0]);
    expect(papers.map((paper) => paper.name)).toEqual(['student_1.docx']);
    expect(papers.map((paper) => paper.kind)).toEqual(['student']);
  });

  it('produces one paper per variant through the whole pipeline', async () => {
    const { papers, variants } = await generatePapers(bytes(), NOKEY,
      { count: 3, seed: 13 });
    expect(variants).toHaveLength(3);
    expect(papers.map((paper) => paper.name))
      .toEqual(['student_1.docx', 'student_2.docx', 'student_3.docx']);
  });

  it('writes papers with no key page in them', async () => {
    const { papers } = await generatePapers(bytes(), NOKEY, { count: 2, seed: 13 });
    for (const paper of papers) {
      const texts = paragraphTexts(await documentRoot(paper.bytes));
      expect(texts.some((text) => KEY_HEADING.test(text)), paper.name).toBe(false);
      // No banner either: a student copy adds nothing, and there is no
      // professor copy for a banner to belong to.
      expect(texts.some((text) => /Variant|Παραλλαγή/.test(text)), paper.name).toBe(false);
    }
  });

  it('keeps every equation, like any other paper', async () => {
    const source = await documentRoot(bytes());
    const expectedMath = countMath(source);
    const expectedShapes = mathSignature(source);
    expect(expectedMath).toBeGreaterThan(0);

    const { papers } = await generatePapers(bytes(), NOKEY, { count: 2, seed: 13 });
    for (const paper of papers) {
      const doc = await documentRoot(paper.bytes);
      expect(countMath(doc), paper.name).toBe(expectedMath);
      expect(mathSignature(doc), paper.name).toEqual(expectedShapes);
    }
  });

  it('names its files without a professor copy', () => {
    expect(variantNames(2, false)).toEqual(['student_2.docx']);
    expect(variantNames(2, true)).toEqual(['student_2.docx', 'professor_2.docx']);
    expect(variantNames(2)).toEqual(['student_2.docx', 'professor_2.docx']);
  });
});

describe('a key that is announced but incomplete', () => {
  /** The full sample, with one line of its key page removed. */
  const withoutOneKeyEntry = async (): Promise<Uint8Array> => {
    const parts = await readZip(sampleBytes(SOURCE));
    return writeZip(parts.map((part) => {
      if (part.name !== 'word/document.xml') {
        return part;
      }
      const xml = new TextDecoder().decode(part.data);
      // Cut the first key line, which is the paragraph after the heading's.
      // Located from the heading rather than by its text: "3." also opens
      // question 3, much earlier in the document.
      const heading = xml.indexOf('Answer Key');
      expect(heading).toBeGreaterThan(-1);
      const afterHeading = xml.indexOf('</w:p>', heading) + '</w:p>'.length;
      const entry = /<w:p\b[\s\S]*?<\/w:p>/.exec(xml.slice(afterHeading))!;
      const stripped = xml.slice(0, afterHeading)
        + xml.slice(afterHeading).replace(entry[0], '');
      expect(stripped.length).toBeLessThan(xml.length);
      return { ...part, data: new TextEncoder().encode(stripped) };
    }));
  };

  it('is still refused, because the teacher believes there is a key', async () => {
    // This is the difference that matters: a document that says "Answer Key"
    // and then misses an entry is a mistake, not a choice.
    await expect(parseExam(await withoutOneKeyEntry(), 'missing_entry.docx'))
      .rejects.toMatchObject({ code: 'no-key-entry' });
  });
});
