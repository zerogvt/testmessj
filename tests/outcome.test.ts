// feature: exam-variants
//
// Step 1 has one job beyond taking a file: answering "did that work?".  The
// answer is a card directly under the picker -- the document's own name first,
// then what was read out of it, then what that means for the run -- and its
// colour carries the verdict.  The advice for first-time users folds away
// behind a summary, because a teacher who has done this before should see
// their own document, not the instructions.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { LANGS, STRINGS } from '../src/testmess';

const read = (name: string) => readFileSync(join(process.cwd(), name), 'utf-8');
const html = read('index.html').replace(/<!--[\s\S]*?-->/g, '');
const main = read('src/main.ts');
const css = read('src/style.css');

describe('the card that says what was read', () => {
  const card = /<div id="source"[\s\S]*?<\/div>\s*<\/div>/.exec(html)?.[0] ?? '';

  it('sits directly under the file picker, above the first-timer advice', () => {
    expect(html.indexOf('id="source"')).toBeGreaterThan(html.indexOf('id="drop"'));
    expect(html.indexOf('id="source"')).toBeLessThan(html.indexOf('<details class="samples"'));
  });

  it('puts the document name first, then the facts, then what they mean', () => {
    const order = ['id="source-name"', 'id="source-detail"', 'id="source-note"']
      .map((id) => card.indexOf(id));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((index) => index > -1)).toBe(true);
  });

  it('starts hidden, and is announced when it appears', () => {
    expect(card).toMatch(/hidden/);
    expect(card).toMatch(/role="status"/);
  });

  it('is painted green when the document was read and red when it was not', () => {
    expect(main).toMatch(/showOutcome\('ok'/);
    expect(main).toMatch(/showOutcome\('error'/);
    expect(css).toMatch(/\.outcome\.ok\s*\{[^}]*--ok-bg/);
    expect(css).toMatch(/\.outcome\.error\s*\{[^}]*--error-bg/);
  });

  it('draws its colours from the page palette, not from fresh ones', () => {
    // Both themes define every tint, so the card belongs to the page in dark
    // mode as much as in light.
    for (const token of ['--ok-bg', '--ok-line', '--error-bg', '--error-line',
      '--warn-bg', '--warn-line']) {
      expect(css.match(new RegExp(`${token}:`, 'g'))?.length, token).toBe(2);
    }
  });

  it('says whether there is an answer key, in both languages', () => {
    // What comes out of the run depends on it, so it is said where the file is
    // chosen rather than left to be noticed afterwards.
    for (const lang of LANGS) {
      expect(STRINGS[lang]['status.haskey'], lang).toBeTruthy();
      expect(STRINGS[lang]['status.nokey'], lang).toBeTruthy();
      expect(STRINGS[lang]['status.failed'], lang).toBeTruthy();
    }
    expect(main).toMatch(/exam\.hasKey \? 'status\.haskey' : 'status\.nokey'/);
  });

  it('keeps the file name out of the sentences, so it is not translated', () => {
    // The name is the document's own; only what was read out of it is a
    // sentence in a language.
    expect(STRINGS.en['status.source']).not.toMatch(/\{name\}/);
    expect(STRINGS.el['status.source']).not.toMatch(/\{name\}/);
  });

  it('follows the page when the language changes', () => {
    expect(main).toMatch(/function setLanguage[\s\S]{0,400}renderOutcome\(\)/);
  });
});

describe('the first-timer advice', () => {
  it('folds away behind a summary', () => {
    expect(html).toMatch(/<details class="samples">\s*<summary data-i18n="samples\.summary">/);
  });

  it('is closed until it is asked for', () => {
    // No `open` attribute: the default view is the teacher's own work.
    expect(/<details class="samples"([^>]*)>/.exec(html)![1]).not.toMatch(/\bopen\b/);
  });

  it('says what is behind it, in both languages', () => {
    for (const lang of LANGS) {
      expect(STRINGS[lang]['samples.summary'], lang).toBeTruthy();
    }
  });
});
