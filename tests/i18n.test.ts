// feature: exam-variants
//
// Two languages is two chances to ship a page with a hole in it: a key that
// exists in one table and not the other, a sentence in the markup that drifts
// from the sentence in the table, an error nobody translated, a placeholder
// that survives into the text somebody reads.  These tests are what keeps the
// Greek page as complete as the English one.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  AppError, ExamError, LANGS, STRINGS, detectLanguage, format, parseExam, t,
} from '../src/testmess';
import { SOURCE, sampleBytes } from './helpers';

const read = (name: string) => readFileSync(join(process.cwd(), name), 'utf-8');
// Comments are stripped first: the file's own header documents the
// data-i18n convention, and a scan that reads comments would find that.
const html = read('index.html').replace(/<!--[\s\S]*?-->/g, '');
const flat = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('the string tables', () => {
  it('know the same keys in both languages', () => {
    const [en, el] = LANGS.map((lang) => Object.keys(STRINGS[lang]).sort());
    expect(el).toEqual(en);
  });

  it('leave nothing untranslated', () => {
    const untranslated = Object.keys(STRINGS.en)
      .filter((key) => STRINGS.el[key] === STRINGS.en[key]);
    expect(untranslated).toEqual([]);
  });

  it('have no empty strings', () => {
    for (const lang of LANGS) {
      for (const [key, value] of Object.entries(STRINGS[lang])) {
        expect(value.trim(), `${lang}:${key}`).not.toBe('');
      }
    }
  });

  it('use the same placeholders in both languages', () => {
    // A {name} that exists in one language and not the other is either a
    // missing detail or a stray brace in somebody's face.
    const placeholders = (text: string) =>
      (text.match(/\{(\w+)\}/g) ?? []).sort().join(',');
    for (const key of Object.keys(STRINGS.en)) {
      expect(placeholders(STRINGS.el[key]), key)
        .toBe(placeholders(STRINGS.en[key]));
    }
  });

  it('are actually Greek, where they say they are', () => {
    // A copy-paste that left English behind would pass every other check.
    const greekish = Object.entries(STRINGS.el)
      .filter(([key]) => !key.startsWith('page.') && key !== 'error.not-a-docx')
      .filter(([, value]) => !/\p{Script=Greek}/u.test(value));
    expect(greekish.map(([key]) => key)).toEqual([]);
  });
});

describe('the markup and the table', () => {
  const keyed = Array.from(
    html.matchAll(/data-i18n="([^"]+)"[^>]*>([\s\S]*?)<\//g),
    (match) => ({ key: match[1], text: flat(match[2]) }),
  );

  it('carry the English inline, so the page reads before any script runs', () => {
    expect(keyed.length).toBeGreaterThan(20);
    for (const { key, text } of keyed) {
      expect(flat(STRINGS.en[key] ?? ''), `data-i18n="${key}"`).toBe(text);
    }
  });

  it('name only keys that exist', () => {
    for (const key of [...html.matchAll(/data-i18n(?:-placeholder)?="([^"]+)"/g)]
      .map((match) => match[1])) {
      expect(Object.keys(STRINGS.en), key).toContain(key);
    }
  });

  it('offer exactly the languages the table has', () => {
    const offered = [...html.matchAll(/data-lang="([^"]+)"/g)].map((match) => match[1]);
    expect(offered.sort()).toEqual([...LANGS].sort());
  });

  it('gives each flag the language name in its own language', () => {
    expect(html).toMatch(/data-lang="en"[\s\S]*?<span>English<\/span>/);
    expect(html).toMatch(/data-lang="el"[\s\S]*?<span>Ελληνικά<\/span>/);
  });
});

describe('the Greek notice', () => {
  const required: Array<[string, RegExp]> = [
    ['notice.warranty', /χωρίς\s+καμία\s+απολύτως\s+εγγύηση/],
    ['notice.warranty.detail', /εμπορευσιμότητας/],
    ['notice.check', /Οφείλετε να ελέγχετε κάθε έγγραφο/],
    ['notice.liability', /δεν φέρουν καμία ευθύνη/],
    ['notice.liability', /αδικοπραξίας \(συμπεριλαμβανομένης της αμέλειας\)/],
    ['notice.responsibility', /δεν επιτρέπεται νομίμως να αποκλειστεί/],
    ['notice.responsibility', /κριθεί ανίσχυρο/],
    ['notice.accept.licence', /άδειας MIT/],
  ];

  it.each(required)('%s says what the English one says', (key, pattern) => {
    expect(STRINGS.el[key]).toMatch(pattern);
  });

  it('says which text prevails if the two disagree', () => {
    // A translated disclaimer is a second text that could be read against the
    // first; this is the line that decides which one wins.
    expect(STRINGS.el['notice.prevail']).toMatch(/υπερισχύει το\s+αγγλικό κείμενο/);
    expect(STRINGS.en['notice.prevail']).toMatch(/the English\s+text prevails/);
  });
});

describe('errors', () => {
  it('carry a code the table can translate', async () => {
    const error = await parseExam(new TextEncoder().encode('not a zip'), 'notes.txt')
      .catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(AppError);
    const coded = error as AppError;
    expect(STRINGS.en[coded.key]).toBeDefined();
    expect(STRINGS.el[coded.key]).toBeDefined();
    expect(t('el', coded.key, coded.params)).not.toBe(t('en', coded.key, coded.params));
  });

  it('say the same thing in English as their own message', () => {
    const error = new ExamError('no-key-entry', { number: 3 });
    expect(error.message).toBe('no answer key entry for question 3');
    expect(t('en', error.key, error.params)).toBe(error.message);
    expect(t('el', error.key, error.params)).toBe('δεν υπάρχει απάντηση για την ερώτηση 3');
  });

  it('are raised with codes the tables know', async () => {
    const exam = await parseExam(sampleBytes(SOURCE), SOURCE);
    const broken = {
      ...exam,
      questions: exam.questions.map((question) => ({ ...question, answer: 'Z' })),
    };
    const { validateExam } = await import('../src/parse');
    try {
      validateExam(broken);
      throw new Error('should have thrown');
    } catch (thrown) {
      const coded = thrown as AppError;
      expect(coded.code).toBe('key-not-an-option');
      expect(t('el', coded.key, coded.params)).toContain('η απάντηση της ερώτησης 1');
    }
  });
});

describe('format', () => {
  it('fills placeholders', () => {
    expect(format('{a} and {b}', { a: 1, b: 'two' })).toBe('1 and two');
  });

  it('leaves an unknown placeholder visible rather than printing "undefined"', () => {
    expect(format('{a} and {b}', { a: 1 })).toBe('1 and {b}');
  });

  it('fills every placeholder the status lines use', () => {
    // The page passes these; a typo in a key would otherwise show a teacher a
    // raw {name} in the middle of a sentence.
    for (const lang of LANGS) {
      expect(t(lang, 'status.source', { count: 10, markers: 'A B', name: 'x.docx' }))
        .not.toMatch(/\{/);
      expect(t(lang, 'status.ready', { variants: 2, papers: 4 })).not.toMatch(/\{/);
      expect(t(lang, 'results.seed', { seed: 7 })).not.toMatch(/\{/);
      expect(t(lang, 'download.button', { name: 'a.zip', papers: 2 })).not.toMatch(/\{/);
      expect(t(lang, 'status.warning', { what: 'x' })).not.toMatch(/\{/);
    }
  });
});

describe('detectLanguage', () => {
  it('honours ?lang= first, so a link can carry the language', () => {
    expect(detectLanguage('?lang=el', ['en-GB'])).toBe('el');
    expect(detectLanguage('?lang=en', ['el'])).toBe('en');
  });

  it('falls back to what the browser asks for', () => {
    expect(detectLanguage('', ['el-GR', 'en'])).toBe('el');
    expect(detectLanguage('', ['en-US'])).toBe('en');
  });

  it('ignores nonsense and languages it does not speak', () => {
    expect(detectLanguage('?lang=xx', ['fr-FR'])).toBe('en');
    expect(detectLanguage('', [])).toBe('en');
  });
});

describe('the one line this program writes into a paper', () => {
  it('is in the language the papers were built in', async () => {
    const { generatePapers: generate } = await import('../src/testmess');
    const { documentRoot, paragraphTexts } = await import('./helpers');

    for (const [lang, pattern] of [
      ['en', /^Variant 1 - Professor copy \(with answer key\)$/],
      ['el', /^Παραλλαγή 1 — Αντίτυπο καθηγητή \(με τις απαντήσεις\)$/],
    ] as const) {
      const { papers } = await generate(sampleBytes(SOURCE), SOURCE,
        { count: 1, seed: 3, lang });
      const professor = papers.find((paper) => paper.kind === 'professor')!;
      const texts = paragraphTexts(await documentRoot(professor.bytes));
      expect(texts.some((text) => pattern.test(text)), lang).toBe(true);
    }
  });

  it('is the only thing the language changes about a paper', async () => {
    // The teacher's own document must not depend on which flag is showing.
    const { generatePapers: generate } = await import('../src/testmess');
    const english = await generate(sampleBytes(SOURCE), SOURCE,
      { count: 1, seed: 3, lang: 'en' });
    const greek = await generate(sampleBytes(SOURCE), SOURCE,
      { count: 1, seed: 3, lang: 'el' });

    // The student copy has no banner, so it is identical byte for byte.
    const student = (papers: typeof english.papers) =>
      papers.find((paper) => paper.kind === 'student')!.bytes;
    expect(student(greek.papers)).toEqual(student(english.papers));
    expect(greek.variants[0].questions.map((question) => question.answer))
      .toEqual(english.variants[0].questions.map((question) => question.answer));
  });
});
