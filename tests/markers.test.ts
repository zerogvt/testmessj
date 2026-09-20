// feature: exam-variants
//
// The label patterns must not assume the Latin alphabet -- and must not read
// ordinary prose as a marker.

import { describe, expect, it } from 'vitest';

import { KEY_ENTRY, KEY_HEADING, OPTION_LABEL, QUESTION_LABEL, sameMarker } from '../src/testmess';

describe('option markers', () => {
  it.each([
    ['(A)  4', 'A'], ['A)  4', 'A'], ['A.  4', 'A'], ['a)  4', 'a'],
    ['α)  4', 'α'], ['δ)  Does not exist', 'δ'], ['(β)  0', 'β'],
    ['б)  0', 'б'], ['[C]  2', 'C'], ['  (D)  2', 'D'],
    ['i)  4', 'i'], ['(iii)  4', 'iii'], ['iv.  4', 'iv'],
  ])('reads %s as %s', (text, expected) => {
    expect(OPTION_LABEL.exec(text)?.[1]).toBe(expected);
  });

  it.each([
    'Does not exist', 'Any value', 'Evaluate the limit:',
    'Note: assume x > 0', 'Choose the best answer.',
    'Eq. 4 applies here', '12x3 - 4x',
  ])('does not read %s as a marker', (text) => {
    expect(OPTION_LABEL.exec(text)).toBeNull();
  });

  it('never reads a digit as an option marker', () => {
    // "1)" cannot be told apart from a question number.
    expect(OPTION_LABEL.exec('1)  4')).toBeNull();
  });
});

describe('question labels', () => {
  it.each([['1.  Evaluate', '1'], ['7)  Find', '7'], [' 10. Find', '10']])(
    'reads %s as question %s', (text, expected) => {
      expect(QUESTION_LABEL.exec(text)?.[1]).toBe(expected);
    });

  it('does not read prose as a question', () => {
    expect(QUESTION_LABEL.exec('Calculus Practice Test')).toBeNull();
  });
});

describe('key entries', () => {
  it.each([
    ['1.  A', '1', 'A'], ['10)  δ', '10', 'δ'],
    ['3.  (c)', '3', 'c'], ['7.  iii', '7', 'iii'],
  ])('reads %s', (text, number, marker) => {
    const match = KEY_ENTRY.exec(text);
    expect(match?.[1]).toBe(number);
    expect(match?.[2]).toBe(marker);
  });

  it('does not swallow a question', () => {
    expect(KEY_ENTRY.exec('1.  Evaluate the limit')).toBeNull();
  });

  it.each([
    'Answer Key', 'ANSWER KEY', 'answer key', 'Answer Keys', 'AnswerKey',
    'Key', 'Keys', 'KEY', 'key', 'Answers', 'Answer', 'ANSWERS',
    'Solutions', 'Solution', 'Answer Key:', '  Keys  ',
    'Answer Key — Variant A', 'Answer Key (page 3)',
  ])('reads %s as the key heading', (text) => {
    expect(KEY_HEADING.test(text)).toBe(true);
  });

  it.each([
    'Λύσεις', 'ΛΥΣΕΙΣ', 'λύσεις', 'Λυσεις', 'Απαντήσεις', 'ΑΠΑΝΤΗΣΕΙΣ',
    'απαντήσεις', 'Κλείδα', 'Κλείδα απαντήσεων', 'ΚΛΕΙΔΑ ΑΠΑΝΤΗΣΕΩΝ',
    'Σωστές απαντήσεις', 'ΣΩΣΤΕΣ ΑΠΑΝΤΗΣΕΙΣ', 'Απαντητικό', 'Απαντήσεις:',
    'Λύσεις – Παραλλαγή Α',
  ])('reads %s as the key heading too', (text) => {
    // Uppercase Greek drops its accents, and a heading is usually written in
    // capitals, so both spellings have to be recognised.
    expect(KEY_HEADING.test(text)).toBe(true);
  });

  it.each([
    'Key concepts covered in this test', 'Keyboard shortcuts',
    'Answer the following questions', 'Answer sheet',
    'Keys to the kingdom are many', 'Απαντήστε στην ερώτηση',
    'Απαντήσεις που δόθηκαν από τους μαθητές', 'Questions', 'Ερωτήσεις',
    'Choose the best answer. Mark one letter (A–D) for each question.',
    '1. Answers', '(A) Answers', 'Multiple Choice  ·  10 Questions',
  ])('does not read %s as the key heading', (text) => {
    // Matching the whole paragraph rather than its opening is what makes a
    // heading as short as "Key" safe to accept.
    expect(KEY_HEADING.test(text)).toBe(false);
  });
});

describe('sameMarker', () => {
  it('compares case-insensitively, inside one script', () => {
    expect(sameMarker('A', 'a')).toBe(true);
    expect(sameMarker('α', 'Α')).toBe(true);
    expect(sameMarker('α', 'a')).toBe(false);
    expect(sameMarker('A', 'B')).toBe(false);
  });

  it('folds the Greek final sigma the way a case-fold would', () => {
    expect(sameMarker('ς', 'Σ')).toBe(true);
  });
});
