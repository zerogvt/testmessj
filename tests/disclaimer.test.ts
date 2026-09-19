// feature: exam-variants
//
// The notice is a promise made to whoever uses the page, so it is held in
// place the way the exam invariants are: by a test.  These read the shipped
// files rather than a rendered page, because what matters is that the warning
// is in the markup a browser receives -- present even if the JavaScript never
// runs -- and that nothing quietly deletes it in a later tidy-up.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(join(process.cwd(), name), 'utf-8');

/**
 * Collapse whitespace before matching a phrase.
 *
 * The notice is wrapped for reading in the source, so "without warranty of any
 * kind" is split across two lines there; what matters is the sentence, not
 * where the editor broke it.
 */
const flat = (text: string) => text.replace(/\s+/g, ' ');

const html = read('index.html');
const main = read('src/main.ts');
const licence = read('LICENSE');
const readme = read('README.md');

describe('the standing banner', () => {
  it('is in the static markup, not painted in by a script', () => {
    // If the bundle fails to load, this is still the first thing on the page.
    expect(html).toMatch(/<aside class="banner"/);
    const banner = flat(/<aside class="banner"[\s\S]*?<\/aside>/.exec(html)![0]);
    expect(banner).toMatch(/check every paper/i);
    expect(banner).toMatch(/no warranty of any kind/i);
    expect(banner).toMatch(/you are responsible/i);
  });

  it("comes before the page's own content", () => {
    expect(html.indexOf('class="banner"')).toBeLessThan(html.indexOf('<header>'));
  });

  it('has no dismiss control', () => {
    const banner = flat(/<aside class="banner"[\s\S]*?<\/aside>/.exec(html)![0]);
    expect(banner).not.toMatch(/dismiss|close|hide/i);
  });
});

describe('the acknowledgement', () => {
  const dialog = flat(/<dialog id="notice"[\s\S]*?<\/dialog>/.exec(html)?.[0] ?? '');

  it('is a modal that has to be acknowledged', () => {
    expect(dialog).toBeTruthy();
    expect(dialog).toMatch(/role="alertdialog"/);
    expect(dialog).toMatch(/I understand/);
    expect(main).toMatch(/showModal\(\)/);
  });

  it('opens on every visit and remembers nothing', () => {
    // No storage: an acknowledgement that is remembered is an acknowledgement
    // stored in somebody's browser, and this page stores nothing.
    expect(main).toMatch(/^openNotice\(\);$/m);
    expect(main).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });

  it('cannot be dismissed with Escape', () => {
    // Both halves matter: the prevented cancel, and putting the notice back
    // when the browser closes it anyway -- which Chromium does.
    expect(main).toMatch(/'cancel'[\s\S]{0,60}preventDefault/);
    expect(main).toMatch(/'close'[\s\S]{0,120}acknowledged[\s\S]{0,60}openNotice/);
    expect(main).toMatch(/#accept-notice[\s\S]{0,140}acknowledged = true/);
  });

  it('still shows the notice where <dialog> is not supported', () => {
    expect(main).toMatch(/setAttribute\('open'/);
  });

  it.each([
    [/free of charge/i, 'that it costs nothing'],
    [/as is/i, 'the "as is" formula'],
    [/without warranty of any kind/i, 'the warranty disclaimer'],
    [/merchantability/i, 'the implied warranties'],
    [/fitness for a particular purpose/i, 'fitness for purpose'],
    [/you must check every document it produces/i, 'the duty to check'],
    [/no liability/i, 'the liability exclusion'],
    [/misgraded examinations|incorrect marks/i, 'what is actually at stake'],
    [/tort\s*\(including negligence\)/i, 'the heads of liability'],
    [/cannot lawfully be\s*excluded/i, 'the saver for non-excludable liability'],
    [/unenforceable/i, 'severability'],
    [/MIT licence/i, 'the licence it rests on'],
  ])('states %s (%s)', (pattern) => {
    expect(dialog).toMatch(pattern);
  });

  it('can be reopened after it has been acknowledged', () => {
    expect(html).toMatch(/id="show-notice"/);
    expect(html).toMatch(/id="show-notice-footer"/);
    expect(main).toMatch(/show-notice/);
  });
});

describe('the licence', () => {
  it('is MIT, with the warranty and liability clauses intact', () => {
    expect(licence).toMatch(/MIT License/);
    expect(flat(licence))
      .toContain('THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND');
    expect(flat(licence))
      .toContain('IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE');
  });

  it('names no individual', () => {
    // The samples were scrubbed of their author, and the licence must not put
    // a name back on the page.  Pinned by asserting the line that belongs
    // there: a test that spells out the name it is guarding against would put
    // that name straight back into the repository it is meant to keep it out
    // of.
    expect(licence).toMatch(/^Copyright \(c\) \d{4} the testmessj authors$/m);
  });
});

describe('the README', () => {
  it('carries the same warning as the page', () => {
    expect(readme).toMatch(/## Disclaimer/);
    expect(flat(readme)).toMatch(/without warranty of any kind/i);
    expect(flat(readme)).toMatch(/check every document/i);
  });
});
