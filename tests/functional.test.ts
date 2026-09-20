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
import { KEY_HEADING } from '../src/markers';
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
          (option) => sameMarker(option.letter, question.answer!))!.text;
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

/**
 * The same test with its key page headed differently.
 *
 * Built from a sample rather than kept as a fixture file, so these cannot go
 * stale when the samples are re-exported -- and so each heading is exercised
 * against a real document, package and all, rather than against the regex.
 */
async function headedWith(file: string, heading: string): Promise<Uint8Array> {
  const parts = await readZip(sampleBytes(file));
  return writeZip(parts.map((part) => {
    if (part.name !== 'word/document.xml') {
      return part;
    }
    const xml = new TextDecoder().decode(part.data);
    expect(xml).toContain('>Answer Key<');
    return {
      ...part,
      data: new TextEncoder().encode(xml.replace('>Answer Key<', `>${heading}<`)),
    };
  }));
}

describe.each([
  // English, as teachers actually write it
  ['Answer Key', 'calculus_practice_test_2.docx'],
  ['ANSWER KEY', 'calculus_practice_test_2.docx'],
  ['Answer Keys', 'calculus_practice_test_2.docx'],
  ['Answers', 'calculus_practice_test_2.docx'],
  ['Key', 'calculus_practice_test_2.docx'],
  ['Keys', 'calculus_practice_test_2.docx'],
  ['KEY', 'calculus_practice_test_2.docx'],
  ['Solutions', 'calculus_practice_test_2.docx'],
  ['Answer Key — Variant A', 'calculus_practice_test_2.docx'],
  ['Answers:', 'calculus_practice_test_2.docx'],
  // Greek, where a whole paper may be Greek
  ['Λύσεις', 'calculus_practice_test_3.docx'],
  ['ΛΥΣΕΙΣ', 'calculus_practice_test_3.docx'],
  ['Απαντήσεις', 'calculus_practice_test_3.docx'],
  ['ΑΠΑΝΤΗΣΕΙΣ', 'calculus_practice_test_3.docx'],
  ['Κλείδα απαντήσεων', 'calculus_practice_test_3.docx'],
  ['Σωστές απαντήσεις', 'calculus_practice_test_3.docx'],
  ['Απαντήσεις:', 'calculus_practice_test_3.docx'],
])('a key page headed "%s"', (heading, file) => {
  const expected = file === 'calculus_practice_test_2.docx' ? FIXTURES[0] : FIXTURES[1];

  it('is found, and its answers are read', async () => {
    const exam = await parseExam(await headedWith(file, heading), 'headed.docx');
    expect(exam.hasKey).toBe(true);
    expect(exam.questions).toHaveLength(10);
    expect(Object.fromEntries(
      exam.questions.map((question) => [question.number, question.answer])))
      .toEqual(expected.key);
  });

  it('produces a professor copy that carries that heading, and the right key',
    async () => {
      const bytes = await headedWith(file, heading);
      const { papers, variants } = await generatePapers(bytes, 'headed.docx',
        { count: 1, seed: 7 });
      expect(papers.map((item) => item.kind)).toEqual(['student', 'professor']);

      const professor = papers.find((item) => item.kind === 'professor')!;
      const texts = paragraphTexts(await documentRoot(professor.bytes));
      // The heading is the source's own paragraph, reused as it was written.
      expect(texts.some((text) => text.trim() === heading.trim())).toBe(true);
      expect(keyEntries(texts)).toEqual(
        variants[0].questions.map((question) => [question.number, question.answer]));

      // And the student copy still carries no key of any spelling.
      const student = papers.find((item) => item.kind === 'student')!;
      const studentTexts = paragraphTexts(await documentRoot(student.bytes));
      expect(hasKeyHeading(studentTexts)).toBe(false);
      expect(keyEntries(studentTexts)).toHaveLength(0);
    });
});

describe('a heading that only looks like one', () => {
  it.each([
    'Key concepts covered in this test',
    'Answer the following questions in the space provided',
    'Απαντήστε στην ερώτηση που ακολουθεί',
  ])('%s is not read as the start of the key page', async (line) => {
    // A sentence that merely opens with "Key" or "Answer" would swallow every
    // question after it, so the whole-paragraph match matters as much as the
    // words do.
    expect(KEY_HEADING.test(line)).toBe(false);

    // And in a real document: with the heading replaced by prose, the lines
    // below it are no longer read as key entries -- "1.  A" becomes a question
    // with no options, and the document is refused rather than mis-parsed.
    const bytes = await headedWith('calculus_practice_test_2.docx', line);
    await expect(parseExam(bytes, 'prose.docx'))
      .rejects.toMatchObject({ code: 'too-few-options' });
  });
});

// (A test headed in Greek had its own block here; every heading, Greek
// included, is now exercised by the table above.)
