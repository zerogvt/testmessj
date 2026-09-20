// feature: exam-variants
//
// The full pipeline over *both* sample tests, the Latin-lettered one and the
// Greek-lettered one, held to exactly the same standard -- so nothing can
// quietly come to depend on the markers being A-D.
//
// Nothing about the sample documents is hard-coded here that the documents
// themselves can answer: the equation count is read from the source, so
// re-exporting a sample does not break the suite.

import { describe, expect, it } from 'vitest';

import {
  generatePapers, makeVariants, parseExam, readZip, sameMarker, writeZip,
  type Paper,
} from '../src/testmess';
import { paragraphText } from '../src/xml';
import {
  FIXTURES, bodyParagraphs, countMath, documentRoot, hasKeyHeading, keyEntries,
  mathSignature, paragraphTexts, sampleBytes, stripLabel, tally,
} from './helpers';

const paper = (papers: Paper[], kind: 'student' | 'professor', index: number): Paper =>
  papers.find((item) => item.kind === kind && item.variant === index)!;

describe.each(FIXTURES)('$name sample', (fixture) => {
  const bytes = () => sampleBytes(fixture.file);

  it('is present', () => {
    expect(bytes().length).toBeGreaterThan(0);
  });

  it('parses in its own marker alphabet', async () => {
    const exam = await parseExam(bytes(), fixture.file);
    expect(exam.questions).toHaveLength(10);
    const found: Record<number, string | null> = {};
    for (const question of exam.questions) {
      expect(question.options.map((option) => option.letter),
        `question ${question.number}`).toEqual([...fixture.markers]);
      found[question.number] = question.answer;
    }
    expect(found).toEqual(fixture.key);
  });

  it('keeps the source markers in every variant', async () => {
    const exam = await parseExam(bytes(), fixture.file);
    for (const variant of makeVariants(exam, 3, 4)) {
      for (const question of variant.questions) {
        expect(question.options.map((option) => option.letter)).toEqual([...fixture.markers]);
        expect(fixture.markers).toContain(question.answer);
      }
    }
  });

  it('adds nothing at all to the student copy', async () => {
    // A student paper is the source test, shuffled -- and nothing else.  No
    // variant banner, no added heading, no blank line: apart from the
    // reordering and the renumbering it must be paragraph-for-paragraph what
    // the class would have been given, so nothing on the page says which copy
    // it is.
    const exam = await parseExam(bytes(), fixture.file);
    const expected: string[] = [];
    for (const item of exam.preamble) {
      expected.push(paragraphText(item).trim());
    }
    for (const question of exam.questions) {
      expected.push(question.stemText);
      for (const option of question.options) {
        expected.push(option.text);
      }
    }

    const { papers } = await generatePapers(bytes(), fixture.file, { count: 1, seed: 3 });
    const student = await documentRoot(paper(papers, 'student', 1).bytes);
    const professor = await documentRoot(paper(papers, 'professor', 1).bytes);

    const found = paragraphTexts(student).map(stripLabel);
    expect(tally(found)).toEqual(tally(expected));
    // Same count too, so an added blank paragraph cannot slip through.
    expect(bodyParagraphs(student)).toHaveLength(expected.length);

    // The professor copy is that plus exactly the key apparatus: a variant
    // banner, a page break, the heading, one line per question.
    expect(bodyParagraphs(professor))
      .toHaveLength(bodyParagraphs(student).length + 3 + exam.questions.length);
  });

  it('writes papers that hold every equation the source holds', async () => {
    const source = await documentRoot(bytes());
    // Counted from the source rather than hard-coded: these documents get
    // re-exported, and the invariant is "the variants hold every equation the
    // source holds", not "the source holds 31 of them".
    const expectedMath = countMath(source);
    const expectedShapes = mathSignature(source);
    expect(expectedMath).toBeGreaterThan(0);

    const { papers } = await generatePapers(bytes(), fixture.file, { count: 2, seed: 13 });
    expect(papers.map((item) => item.name).sort()).toEqual([
      'professor_1.docx', 'professor_2.docx', 'student_1.docx', 'student_2.docx',
    ]);

    for (const item of papers) {
      const doc = await documentRoot(item.bytes);
      expect(countMath(doc), `${item.name} lost an equation`).toBe(expectedMath);
      // Not just as many equations -- the same ones, markup for markup.
      expect(mathSignature(doc), `${item.name} altered an equation`).toEqual(expectedShapes);
    }
  });

  it('prints a key that points at the same answers the source key did', async () => {
    const exam = await parseExam(bytes(), fixture.file);
    const byNumber = new Map(exam.questions.map((question) => [question.number, question]));
    const { papers, variants } = await generatePapers(bytes(), fixture.file,
      { count: 2, seed: 13 });

    for (const variant of variants) {
      const studentTexts = paragraphTexts(
        await documentRoot(paper(papers, 'student', variant.index).bytes));
      expect(hasKeyHeading(studentTexts)).toBe(false);
      expect(keyEntries(studentTexts)).toHaveLength(0);

      const professorTexts = paragraphTexts(
        await documentRoot(paper(papers, 'professor', variant.index).bytes));
      expect(hasKeyHeading(professorTexts)).toBe(true);
      expect(keyEntries(professorTexts)).toEqual(
        variant.questions.map((question) => [question.number, question.answer]));

      // The printed key must point at the same answer *content* as the source
      // key did, not merely at some marker.
      for (const question of variant.questions) {
        const source = byNumber.get(question.sourceNumber)!;
        const expected = source.options.find(
          (option) => sameMarker(option.letter, source.answer!))!.text;
        const actual = question.options.find(
          (option) => sameMarker(option.letter, question.answer))!.text;
        expect(actual, `variant ${variant.index} question ${question.number}`)
          .toBe(expected);
      }
    }
  });

  it('lays the questions out the same way in every paper', async () => {
    const { papers } = await generatePapers(bytes(), fixture.file, { count: 2, seed: 13 });
    for (const item of papers) {
      const texts = paragraphTexts(await documentRoot(item.bytes));
      const numbers: number[] = [];
      const markers: string[][] = [];
      for (const text of texts) {
        if (hasKeyHeading([text])) {
          break;
        }
        const question = /^\s*(\d+)\s*[.)]/u.exec(text);
        if (question) {
          numbers.push(Number(question[1]));
          markers.push([]);
          continue;
        }
        const marker = markers.length
          ? new RegExp(`^\\s*[(\\[]?\\s*(${fixture.markers.join('|')})\\s*[.)\\]]`, 'u')
            .exec(text)
          : null;
        if (marker) {
          markers[markers.length - 1].push(marker[1]);
        }
      }
      expect(numbers, item.name).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      for (const item2 of markers) {
        expect(item2, item.name).toEqual([...fixture.markers]);
      }
    }
  });
});

describe('a test written in Greek', () => {
  it('is read when its key page is headed in Greek', async () => {
    // The page speaks Greek, so the documents it is given will too: a teacher
    // heading the last page "ΑΠΑΝΤΗΣΕΙΣ" must not be told there is no key.
    // Built from a sample rather than a fixture file, so it cannot go stale.
    const parts = await readZip(sampleBytes('calculus_practice_test_3.docx'));
    const rewritten = parts.map((part) => {
      if (part.name !== 'word/document.xml') {
        return part;
      }
      const xml = new TextDecoder().decode(part.data).replace('Answer Key', 'ΑΠΑΝΤΗΣΕΙΣ');
      return { ...part, data: new TextEncoder().encode(xml) };
    });

    const exam = await parseExam(await writeZip(rewritten), 'greek_headed.docx');
    expect(exam.questions).toHaveLength(10);
    expect(exam.questions.map((question) => question.answer))
      .toEqual(Object.values(FIXTURES[1].key));
    expect(exam.keyTemplates.heading).not.toBeNull();

    // And the papers it writes keep that heading, rather than reverting to
    // English: the professor copy is stamped from the source's own paragraph.
    const { papers } = await generatePapers(
      await writeZip(rewritten), 'greek_headed.docx', { count: 1, seed: 3 });
    const professor = papers.find((paper) => paper.kind === 'professor')!;
    const texts = paragraphTexts(await documentRoot(professor.bytes));
    expect(texts.some((text) => text.includes('ΑΠΑΝΤΗΣΕΙΣ'))).toBe(true);
    // The heading is the source's own paragraph, not one this program writes,
    // so it stays Greek.  (The banner is a different matter -- see below.)
    expect(texts.some((text) => text.trim() === 'Answer Key')).toBe(false);
  });
});
