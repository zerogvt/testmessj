// feature: exam-variants
//
// What the page actually calls.  The command line's "one run replaces the
// whole set or touches nothing" becomes, in a browser, "one run is one
// archive": there is no folder to half-overwrite, and the set is handed over
// whole or not at all.

import { describe, expect, it } from 'vitest';

import { bundlePapers, generatePapers, keyLine, readZip } from '../src/testmess';
import { SOURCE, sampleBytes } from './helpers';

describe('generatePapers', () => {
  it('writes two documents per variant, named per variant', async () => {
    const { papers } = await generatePapers(sampleBytes(SOURCE), SOURCE,
      { count: 4, seed: 9 });
    expect(papers.map((paper) => paper.name)).toEqual([
      'student_1.docx', 'professor_1.docx',
      'student_2.docx', 'professor_2.docx',
      'student_3.docx', 'professor_3.docx',
      'student_4.docx', 'professor_4.docx',
    ]);
  });

  it('makes three variants when not told otherwise', async () => {
    // The command line's default, kept.
    const { variants } = await generatePapers(sampleBytes(SOURCE), SOURCE, { seed: 1 });
    expect(variants).toHaveLength(3);
  });

  it('reports the seed it used, so a run can be repeated', async () => {
    const first = await generatePapers(sampleBytes(SOURCE), SOURCE, { count: 1 });
    const again = await generatePapers(sampleBytes(SOURCE), SOURCE,
      { count: 1, seed: first.seed });
    expect(again.seed).toBe(first.seed);
    expect(again.papers[0].bytes).toEqual(first.papers[0].bytes);
  });

  it('draws a fresh seed when none is given', async () => {
    const seeds = new Set<number>();
    for (let run = 0; run < 3; run += 1) {
      seeds.add((await generatePapers(sampleBytes(SOURCE), SOURCE, { count: 1 })).seed);
    }
    expect(seeds.size).toBeGreaterThan(1);
  });

  it('refuses a file it cannot read', async () => {
    await expect(generatePapers(new TextEncoder().encode('nope'), 'notes.txt'))
      .rejects.toMatchObject({ code: 'not-an-archive' });
  });

  it('refuses fewer than one variant', async () => {
    await expect(generatePapers(sampleBytes(SOURCE), SOURCE, { count: 0 }))
      .rejects.toMatchObject({ code: 'count-too-small' });
    await expect(generatePapers(sampleBytes(SOURCE), SOURCE, { count: 2.5 }))
      .rejects.toMatchObject({ code: 'count-too-small' });
  });

  it('prints a key line a teacher can check a paper against', async () => {
    const { variants } = await generatePapers(sampleBytes(SOURCE), SOURCE,
      { count: 1, seed: 2026 });
    expect(keyLine(variants[0])).toMatch(/^1[A-D], 2[A-D], .*10[A-D]$/);
  });
});

describe('bundlePapers', () => {
  it('puts the whole run in one archive', async () => {
    const { papers } = await generatePapers(sampleBytes(SOURCE), SOURCE,
      { count: 3, seed: 5 });
    const archive = await readZip(await bundlePapers(papers));
    expect(archive.map((entry) => entry.name)).toEqual(papers.map((paper) => paper.name));
  });

  it('hands over papers that are still valid .docx packages', async () => {
    const { papers } = await generatePapers(sampleBytes(SOURCE), SOURCE,
      { count: 1, seed: 5 });
    const archive = await readZip(await bundlePapers(papers));
    for (const entry of archive) {
      const parts = await readZip(entry.data);
      expect(parts.map((part) => part.name)).toContain('word/document.xml');
    }
  });

  it('carries the documents through unchanged', async () => {
    const { papers } = await generatePapers(sampleBytes(SOURCE), SOURCE,
      { count: 2, seed: 8 });
    const archive = await readZip(await bundlePapers(papers));
    for (const [index, entry] of archive.entries()) {
      expect(entry.data, entry.name).toEqual(papers[index].bytes);
    }
  });
});
