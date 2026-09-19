// feature: exam-variants
import { beforeAll, describe, expect, it } from 'vitest';

import { Rng, makeVariants, parseExam, seedFrom, type Exam, type Variant } from '../src/testmess';
import { SOURCE, sampleBytes } from './helpers';

/** Everything a shuffle may change, flattened so two runs can be compared. */
function signature(variants: Variant[]): string {
  return variants.flatMap((variant) => variant.questions.map((question) => [
    variant.index,
    question.number,
    question.sourceNumber,
    question.options.map((option) => option.sourceLetter).join(''),
    question.answer,
  ].join(':'))).join('|');
}

function examSignature(exam: Exam): string {
  return exam.questions.map((question) => [
    question.number,
    question.options.map((option) => option.letter).join(''),
    question.answer,
    question.options.map((option) => option.text).join('/'),
  ].join(':')).join('|');
}

describe('makeVariants', () => {
  let exam: Exam;

  beforeAll(async () => {
    exam = await parseExam(sampleBytes(SOURCE), SOURCE);
  });

  const variants = (count = 5, seed = 7): Variant[] => makeVariants(exam, count, seed);

  it('renumbers the questions from one, as a permutation of the source', () => {
    for (const variant of variants()) {
      expect(variant.questions.map((question) => question.number))
        .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(variant.questions.map((question) => question.sourceNumber).sort((a, b) => a - b))
        .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  });

  it('re-marks the options with the question\'s own markers', () => {
    for (const variant of variants()) {
      for (const question of variant.questions) {
        expect(question.options.map((option) => option.letter)).toEqual(['A', 'B', 'C', 'D']);
        expect(question.options.map((option) => option.sourceLetter).sort())
          .toEqual(['A', 'B', 'C', 'D']);
      }
    }
  });

  it('keeps every question\'s own options together', () => {
    const byNumber = new Map(exam.questions.map((question) => [question.number, question]));
    for (const variant of variants()) {
      for (const question of variant.questions) {
        const source = byNumber.get(question.sourceNumber)!;
        expect(question.options.map((option) => option.text).sort())
          .toEqual(source.options.map((option) => option.text).sort());
        expect(question.stemText).toBe(source.stemText);
      }
    }
  });

  it('makes the correct answer follow the shuffle by content', () => {
    const byNumber = new Map(exam.questions.map((question) => [question.number, question]));
    for (const variant of variants()) {
      for (const question of variant.questions) {
        const source = byNumber.get(question.sourceNumber)!;
        const expected = source.options.find((option) => option.letter === source.answer)!.text;
        const actual = question.options.find((option) => option.letter === question.answer)!.text;
        expect(actual, `question ${question.sourceNumber}`).toBe(expected);
      }
    }
  });

  it('actually shuffles', () => {
    // Not a property of any single variant, but over a handful the original
    // order must not survive everywhere.
    const many = variants(8, 3);
    const orders = many.map(
      (variant) => variant.questions.map((question) => question.sourceNumber).join(''));
    expect(orders.some((order) => order !== '12345678910')).toBe(true);
    const letters = many.flatMap((variant) => variant.questions.map(
      (question) => question.options.map((option) => option.sourceLetter).join('')));
    expect(letters.some((item) => item !== 'ABCD')).toBe(true);
  });

  it('gives the same variants for the same seed', () => {
    expect(signature(makeVariants(exam, 3, 42))).toBe(signature(makeVariants(exam, 3, 42)));
  });

  it('gives different variants for different seeds', () => {
    expect(signature(makeVariants(exam, 3, 1)))
      .not.toBe(signature(makeVariants(exam, 3, 2)));
  });

  it('gives a different paper to each variant of one run', () => {
    const [first, second, third] = makeVariants(exam, 3, 2026);
    expect(signature([first])).not.toBe(signature([second]));
    expect(signature([second])).not.toBe(signature([third]));
  });

  it('does not mutate the exam', () => {
    const before = examSignature(exam);
    makeVariants(exam, 3, 11);
    expect(examSignature(exam)).toBe(before);
  });

  it('shares the paragraph nodes rather than copying them', () => {
    // The XML is never mutated in place, so sharing is safe -- and it is what
    // keeps a hundred variants of a big test cheap.
    const variant = makeVariants(exam, 1, 5)[0];
    const question = variant.questions[0];
    const source = exam.questions.find((item) => item.number === question.sourceNumber)!;
    expect(question.stemNodes[0]).toBe(source.stemNodes[0]);
  });
});

describe('Rng', () => {
  it('repeats itself for a given seed', () => {
    const first = Array.from({ length: 8 }, () => new Rng(99).next());
    expect(new Set(first).size).toBe(1);
    const a = new Rng(4);
    const b = new Rng(4);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it('stays inside the bound', () => {
    const rng = new Rng(1);
    for (let index = 0; index < 500; index += 1) {
      const value = rng.below(10);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(10);
    }
  });

  it('permutes without losing or duplicating anything', () => {
    const items = Array.from({ length: 40 }, (_value, index) => index);
    const shuffled = new Rng(7).shuffle([...items]);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    expect(shuffled).not.toEqual(items);
  });
});

describe('seedFrom', () => {
  it('turns any text into a stable seed', () => {
    expect(seedFrom('period 3')).toBe(seedFrom('period 3'));
    expect(seedFrom('period 3')).not.toBe(seedFrom('period 4'));
    expect(Number.isInteger(seedFrom('x'))).toBe(true);
  });
});
