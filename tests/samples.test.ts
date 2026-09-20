// feature: exam-variants
//
// The samples are not just fixtures: the page offers them for download so a
// teacher who has never seen the expected layout can open one in Word and
// copy it.  That makes their names part of the page's contract -- a rename or
// a move breaks a link somebody was told to click -- so the two are held
// together here.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseExam } from '../src/testmess';
import { FIXTURES, NOKEY, sampleBytes } from './helpers';

const OFFERED = [...FIXTURES.map((fixture) => fixture.file), NOKEY];

const read = (name: string) => readFileSync(join(process.cwd(), name), 'utf-8');

const html = read('index.html');
const main = read('src/main.ts');
const config = read('vite.config.ts');

describe('the sample downloads', () => {
  it.each(OFFERED)('offers %s for download', (file) => {
    const link = new RegExp(
      `<a class="link" href="\\./${file.replace('.', '\\.')}"[\\s\\S]{0,80}download="${file.replace('.', '\\.')}"`);
    expect(html).toMatch(link);
  });

  it.each(OFFERED)('%s is actually there', (file) => {
    expect(existsSync(join(process.cwd(), 'samples', file))).toBe(true);
  });

  it('serves them from a stable path, not a fingerprinted asset name', () => {
    // publicDir copies samples/ to the root of the build under its own names,
    // so a link to a sample keeps working across builds and can be sent to
    // somebody.
    expect(config).toMatch(/publicDir: 'samples'/);
    expect(main).not.toMatch(/\?url/);
  });

  it('loads them from the same names the download links use', () => {
    expect(main).toMatch(/latin: 'calculus_practice_test_2\.docx'/);
    expect(main).toMatch(/greek: 'calculus_practice_test_3\.docx'/);
    expect(main).toMatch(/nokey: 'calculus_practice_test_3_no_key\.docx'/);
    expect(main).toMatch(/fetch\(`\.\/\$\{name\}`\)/);
  });

  it('offers one without an answer key, and says so', () => {
    const block = /<div class="samples">[\s\S]*?<\/ul>/.exec(html)![0].replace(/\s+/g, ' ');
    expect(block).toMatch(/no answer key/i);
    expect(block).toContain('data-sample="nokey"');
  });

  it('says what the downloads are for', () => {
    const block = /<div class="samples">[\s\S]*?<\/div>/.exec(html)![0].replace(/\s+/g, ' ');
    expect(block).toMatch(/open it in Word/i);
    expect(block).toMatch(/answer key/i);
    expect(block).toMatch(/load it/i);
  });

  it('reports a sample that cannot be loaded instead of failing silently', () => {
    // The sentence itself lives in the string table, in both languages.
    expect(main).toMatch(/'error\.sample'/);
  });
});

describe('what a teacher downloads', () => {
  it.each(FIXTURES)('$file is a test this program can read', async (fixture) => {
    // Whatever is offered as an example must itself be a valid example.
    const exam = await parseExam(sampleBytes(fixture.file), fixture.file);
    expect(exam.questions.length).toBeGreaterThan(0);
    expect(exam.questions[0].options.map((option) => option.letter))
      .toEqual([...fixture.markers]);
    expect(exam.keyTemplates.heading).not.toBeNull();
  });
});
