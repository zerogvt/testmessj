// feature: exam-variants
//
// End-to-end over the written packages: bytes in, bytes out, everything
// asserted from the outside the way Word would see it.

import { beforeAll, describe, expect, it } from 'vitest';

import {
  KEY_ENTRY, KEY_HEADING, OPTION_LABEL, QUESTION_LABEL, makeVariants, parseExam,
  readZip, writeVariant, type Exam, type Paper, type Variant,
} from '../src/testmess';
import { NS } from '../src/xml';
import {
  SOURCE, bodyParagraphs, countMath, documentRoot, documentText, keyEntries,
  paragraphTexts, sampleBytes,
} from './helpers';

describe('the written documents', () => {
  let exam: Exam;
  let variant: Variant;
  let student: Paper;
  let professor: Paper;
  let sourceBytes: Uint8Array;

  beforeAll(async () => {
    sourceBytes = sampleBytes(SOURCE);
    exam = await parseExam(sourceBytes, SOURCE);
    variant = makeVariants(exam, 1, 5)[0];
    [student, professor] = await writeVariant(exam, variant);
  });

  it('names the files per variant', () => {
    expect(student.name).toBe('student_1.docx');
    expect(professor.name).toBe('professor_1.docx');
  });

  it('keeps every part of the source package', async () => {
    const expected = (await readZip(sourceBytes)).map((part) => part.name).sort();
    for (const paper of [student, professor]) {
      const written = await readZip(paper.bytes);
      expect(written.map((part) => part.name).sort(), paper.name).toEqual(expected);
    }
  });

  it('leaves every part but the document untouched', async () => {
    const before = new Map((await readZip(sourceBytes)).map((part) => [part.name, part.data]));
    for (const paper of [student, professor]) {
      for (const part of await readZip(paper.bytes)) {
        if (part.name !== 'word/document.xml') {
          expect(part.data, `${paper.name}:${part.name}`).toEqual(before.get(part.name));
        }
      }
    }
  });

  it('writes well-formed XML that keeps the w: prefix', async () => {
    for (const paper of [student, professor]) {
      const xml = await documentText(paper.bytes);
      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'))
        .toBe(true);
      expect(xml).toContain('<w:body>');
      expect(xml).not.toContain('ns0:');
      await expect(documentRoot(paper.bytes)).resolves.toBeTruthy();
    }
  });

  it('keeps the root element\'s namespace declarations', async () => {
    const source = await documentText(sourceBytes);
    const declarations = source.match(/<w:document\b[^>]*>/)![0];
    for (const paper of [student, professor]) {
      expect(await documentText(paper.bytes)).toContain(declarations);
    }
  });

  it('loses no equation', async () => {
    const expected = countMath(await documentRoot(sourceBytes));
    expect(expected).toBeGreaterThan(0);
    for (const paper of [student, professor]) {
      expect(countMath(await documentRoot(paper.bytes)), paper.name).toBe(expected);
    }
  });

  it('gives the student copy no key', async () => {
    const texts = paragraphTexts(await documentRoot(student.bytes));
    expect(texts.some((text) => KEY_HEADING.test(text))).toBe(false);
    expect(keyEntries(texts)).toHaveLength(0);
  });

  it('does not let the key lines share paragraph ids', async () => {
    const ids: string[] = [];
    for (const paragraph of bodyParagraphs(await documentRoot(professor.bytes))) {
      const value = paragraph.getAttributeNS(NS.w14, 'paraId');
      if (value !== null) {
        ids.push(value);
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('prints a key that matches the variant', async () => {
    const texts = paragraphTexts(await documentRoot(professor.bytes));
    expect(keyEntries(texts)).toEqual(
      variant.questions.map((question) => [question.number, question.answer]));
    expect(texts.some((text) => KEY_HEADING.test(text))).toBe(true);
  });

  it('renumbers the questions in order in both documents', async () => {
    for (const paper of [student, professor]) {
      const texts = paragraphTexts(await documentRoot(paper.bytes));
      const numbers: number[] = [];
      const markers: string[][] = [];
      for (const text of texts) {
        if (KEY_HEADING.test(text)) {
          break;
        }
        const question = QUESTION_LABEL.exec(text);
        const option = OPTION_LABEL.exec(text);
        if (question) {
          numbers.push(Number(question[1]));
          markers.push([]);
        } else if (option && markers.length) {
          markers[markers.length - 1].push(option[1]);
        }
      }
      expect(numbers, paper.name).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      for (const item of markers) {
        expect(item, paper.name).toEqual(['A', 'B', 'C', 'D']);
      }
    }
  });

  it('carries the stem and option text through the round trip', async () => {
    const texts = paragraphTexts(await documentRoot(student.bytes));
    for (const question of variant.questions) {
      const stem = texts.find((text) => text.startsWith(`${question.number}.`))!;
      expect(stem).toContain(question.stemText.slice(0, 20));
      for (const option of question.options) {
        if (option.text) {
          expect(texts.some((text) => text.startsWith(`(${option.letter})`)
            && text.includes(option.text)), `${option.text} missing`).toBe(true);
        }
      }
    }
  });

  it('puts the same questions in both documents', async () => {
    const studentTexts = paragraphTexts(await documentRoot(student.bytes));
    const professorTexts = paragraphTexts(await documentRoot(professor.bytes));
    for (const text of studentTexts) {
      if (QUESTION_LABEL.test(text) || OPTION_LABEL.test(text)) {
        expect(professorTexts).toContain(text);
      }
    }
  });

  it('keeps the section properties last, where Word expects them', async () => {
    for (const paper of [student, professor]) {
      const doc = await documentRoot(paper.bytes);
      const body = doc.getElementsByTagNameNS(NS.w, 'body')[0];
      const last = body.children[body.children.length - 1];
      expect(last.localName, paper.name).toBe('sectPr');
    }
  });

  it('can be re-read as a source test in its own right', async () => {
    // A paper that this program cannot itself parse would be a paper Word has
    // no business opening either.
    const again = await parseExam(professor.bytes, professor.name);
    expect(again.questions).toHaveLength(10);
    expect(again.questions.map((question) => question.answer))
      .toEqual(variant.questions.map((question) => question.answer));
  });

  it('is deterministic: the same seed writes the same bytes', async () => {
    const [studentAgain] = await writeVariant(exam, makeVariants(exam, 1, 5)[0]);
    expect(studentAgain.bytes).toEqual(student.bytes);
  });

  it('has no key entry left in the student copy even as raw markup', async () => {
    const texts = paragraphTexts(await documentRoot(student.bytes));
    expect(texts.filter((text) => KEY_ENTRY.test(text))).toHaveLength(0);
  });
});
