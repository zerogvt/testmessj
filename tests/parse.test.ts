// feature: exam-variants
import { beforeAll, describe, expect, it } from 'vitest';

import { ExamError, parseExam, validateExam, type Exam } from '../src/testmess';
import { parseXml, serialize } from '../src/xml';
import { FIXTURES, SOURCE, countMath, sampleBytes } from './helpers';

const EXPECTED_KEY = FIXTURES[0].key;

describe('parseExam', () => {
  let exam: Exam;

  beforeAll(async () => {
    exam = await parseExam(sampleBytes(SOURCE), SOURCE);
  });

  it('reads every question', () => {
    expect(exam.questions.map((question) => question.number))
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('gives every question four lettered options', () => {
    for (const question of exam.questions) {
      expect(question.options.map((option) => option.letter),
        `question ${question.number}`).toEqual(['A', 'B', 'C', 'D']);
    }
  });

  it('reads the answer key', () => {
    const found = Object.fromEntries(
      exam.questions.map((question) => [question.number, question.answer]));
    expect(found).toEqual(EXPECTED_KEY);
  });

  it('does not mistake the key page for questions', () => {
    // "1.  A" on the key page must not become an eleventh question.
    expect(exam.questions).toHaveLength(10);
    expect(exam.keyTemplates.heading).not.toBeNull();
    expect(exam.keyTemplates.entry).not.toBeNull();
  });

  it('strips the labels from the stored text', () => {
    const first = exam.questions[0];
    expect(first.stemText.startsWith('Evaluate the limit')).toBe(true);
    expect(first.options[0].text).toBe('4');
    expect(first.options[3].text).toBe('Does not exist');
  });

  it('keeps the equation markup verbatim', () => {
    // Question 1's stem holds the limit; question 4's options are equations.
    const stem = parseXml(serialize(exam.questions[0].stemNodes[0]));
    expect(countMath(stem)).toBe(1);
    for (const option of exam.questions[3].options) {
      expect(countMath(parseXml(serialize(option.nodes[0]))), option.text).toBe(1);
    }
    // The raw OMML, not a text rendering: the fraction is still a fraction.
    const markup = serialize(exam.questions[0].stemNodes[0]);
    expect(markup).toContain('oMath');
    expect(markup).toContain(':f>');
  });

  it('captures the preamble', () => {
    expect(exam.title).toBe('Calculus Practice Test');
    expect(exam.preamble).toHaveLength(3);
  });

  it('keeps the source package for writing', async () => {
    expect(exam.parts.some((part) => part.name === 'word/document.xml')).toBe(true);
    expect(exam.parts.some((part) => part.name === '[Content_Types].xml')).toBe(true);
  });

  it('refuses a file that is not a Word document', async () => {
    await expect(parseExam(new TextEncoder().encode('not a zip at all'), 'notes.txt'))
      .rejects.toThrow(ExamError);
  });
});

describe('validateExam', () => {
  let exam: Exam;

  beforeAll(async () => {
    exam = await parseExam(sampleBytes(SOURCE), SOURCE);
  });

  const withExam = (change: (copy: Exam) => void): Exam => {
    const copy: Exam = {
      ...exam,
      questions: exam.questions.map((question) => ({
        ...question,
        options: question.options.map((option) => ({ ...option })),
      })),
    };
    change(copy);
    return copy;
  };

  it('rejects a missing key entry', () => {
    expect(() => validateExam(withExam((copy) => {
      copy.questions[2].answer = null;
    }))).toThrow(/no answer key entry for question 3/);
  });

  it('rejects a key pointing at a missing option', () => {
    expect(() => validateExam(withExam((copy) => {
      copy.questions[2].answer = 'Z';
    }))).toThrow(/not one of/);
  });

  it('rejects a question without options', () => {
    expect(() => validateExam(withExam((copy) => {
      copy.questions[0].options = [];
    }))).toThrow(/option\(s\)/);
  });

  it('rejects duplicate option markers', () => {
    expect(() => validateExam(withExam((copy) => {
      copy.questions[0].options[1].letter = 'a';
    }))).toThrow(/duplicate option markers/);
  });

  it('rejects a document with no questions at all', () => {
    expect(() => validateExam(withExam((copy) => {
      copy.questions = [];
    }))).toThrow(/no questions found/);
  });
});
