// feature: exam-variants
//
// A paper handed to a class must not name the teacher who wrote it.  Word
// puts that name inside the file whether or not anyone asks, so the scrub is
// on by default and checked here from both ends: the parts it edits, and the
// papers that come out of the pipeline.

import { describe, expect, it } from 'vitest';

import {
  carriedOverWarnings, generatePapers, metadataNames, parseExam, readZip,
  scrubMetadata, zipEntry, type ZipEntry,
} from '../src/testmess';
import { SOURCE, sampleBytes } from './helpers';

const decode = (entry: ZipEntry) => new TextDecoder().decode(entry.data);
const part = (parts: ZipEntry[], name: string) => parts.find((entry) => entry.name === name)!;

const CORE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="c" xmlns:dc="d" xmlns:dcterms="t" xmlns:xsi="x"><dc:title>Test</dc:title><dc:creator>Ada Lovelace</dc:creator><cp:lastModifiedBy>Ada Lovelace</cp:lastModifiedBy><cp:revision>2</cp:revision><dcterms:created xsi:type="dcterms:W3CDTF">2026-09-18T18:13:00Z</dcterms:created></cp:coreProperties>`;

const APP = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="p"><Template>\\\\school\\staff\\ada\\exam.dotm</Template><TotalTime>412</TotalTime><Pages>3</Pages><Company>St Ada's</Company><AppVersion>16.0000</AppVersion></Properties>`;

const packageWith = (core: string, app: string): ZipEntry[] => [
  zipEntry('word/document.xml', new TextEncoder().encode('<w:document/>')),
  zipEntry('docProps/core.xml', new TextEncoder().encode(core)),
  zipEntry('docProps/app.xml', new TextEncoder().encode(app)),
];

describe('scrubMetadata', () => {
  it('takes the names out of core.xml', () => {
    const scrubbed = scrubMetadata(packageWith(CORE, APP));
    const core = decode(part(scrubbed, 'docProps/core.xml'));
    expect(core).not.toContain('Ada Lovelace');
    expect(core).toContain('<dc:creator></dc:creator>');
    expect(core).toContain('<cp:lastModifiedBy></cp:lastModifiedBy>');
  });

  it('takes the company, the template path and the editing time out of app.xml', () => {
    const app = decode(part(scrubMetadata(packageWith(CORE, APP)), 'docProps/app.xml'));
    expect(app).not.toContain("St Ada's");
    expect(app).not.toContain('school');
    expect(app).toContain('<Template>Normal.dotm</Template>');
    expect(app).toContain('<TotalTime>0</TotalTime>');
  });

  it('leaves everything else alone, byte for byte', () => {
    const before = packageWith(CORE, APP);
    const after = scrubMetadata(before);
    expect(part(after, 'word/document.xml').data).toEqual(part(before, 'word/document.xml').data);
    // The title, the revision count and the dates are not identity, and a
    // typed dcterms element does not want to be emptied.
    const core = decode(part(after, 'docProps/core.xml'));
    expect(core).toContain('<dc:title>Test</dc:title>');
    expect(core).toContain('2026-09-18T18:13:00Z');
    expect(decode(part(after, 'docProps/app.xml'))).toContain('<Pages>3</Pages>');
  });

  it('copes with a self-closing field, and does not invent absent ones', () => {
    const core = `<cp:coreProperties xmlns:cp="c" xmlns:dc="d"><dc:creator/></cp:coreProperties>`;
    const app = '<Properties xmlns="p"><Pages>1</Pages></Properties>';
    const scrubbed = scrubMetadata(packageWith(core, app));
    expect(decode(part(scrubbed, 'docProps/core.xml'))).toContain('<dc:creator/>');
    expect(decode(part(scrubbed, 'docProps/app.xml'))).not.toContain('Company');
  });

  it('leaves a package with no metadata parts untouched', () => {
    const parts = [zipEntry('word/document.xml', new TextEncoder().encode('<w:document/>'))];
    expect(scrubMetadata(parts)).toEqual(parts);
  });

  it('is what metadataNames reports on', () => {
    expect(metadataNames(packageWith(CORE, APP)).sort())
      .toEqual(['Ada Lovelace', 'Ada Lovelace', "St Ada's"]);
    expect(metadataNames(scrubMetadata(packageWith(CORE, APP)))).toEqual([]);
  });
});

describe('the papers a run produces', () => {
  it('name nobody, by default', async () => {
    const { papers } = await generatePapers(sampleBytes(SOURCE), SOURCE, { count: 1, seed: 3 });
    for (const paper of papers) {
      expect(metadataNames(await readZip(paper.bytes)), paper.name).toEqual([]);
    }
  });

  it('keep the source metadata when asked to', async () => {
    const source = await readZip(sampleBytes(SOURCE));
    const { papers } = await generatePapers(sampleBytes(SOURCE), SOURCE,
      { count: 1, seed: 3, keepMetadata: true });
    for (const paper of papers) {
      const parts = await readZip(paper.bytes);
      expect(part(parts, 'docProps/core.xml').data)
        .toEqual(part(source, 'docProps/core.xml').data);
      expect(part(parts, 'docProps/app.xml').data)
        .toEqual(part(source, 'docProps/app.xml').data);
    }
  });

  it('are otherwise identical whether scrubbed or not', async () => {
    // The scrub must not reach the document: same seed, same questions, same
    // key, same equations -- only the two metadata parts may differ.
    const plain = await generatePapers(sampleBytes(SOURCE), SOURCE,
      { count: 1, seed: 3, keepMetadata: true });
    const scrubbed = await generatePapers(sampleBytes(SOURCE), SOURCE, { count: 1, seed: 3 });
    const left = await readZip(plain.papers[0].bytes);
    const right = await readZip(scrubbed.papers[0].bytes);
    expect(right.map((entry) => entry.name)).toEqual(left.map((entry) => entry.name));
    for (const entry of left) {
      if (!entry.name.startsWith('docProps/')) {
        expect(part(right, entry.name).data, entry.name).toEqual(entry.data);
      }
    }
  });

  it('still keeps the samples anonymous at rest', async () => {
    // The sample documents are published with the page; they must not name
    // whoever exported them either.
    expect(metadataNames(await readZip(sampleBytes(SOURCE)))).toEqual([]);
  });
});

describe('carriedOverWarnings', () => {
  it('says nothing about a clean document', async () => {
    const exam = await parseExam(sampleBytes(SOURCE), SOURCE);
    expect(carriedOverWarnings(exam.parts)).toEqual([]);
  });

  it('notices comments, which a scrub cannot reach', () => {
    const parts = [
      zipEntry('word/document.xml', new TextEncoder().encode('<w:document/>')),
      zipEntry('word/comments.xml', new TextEncoder().encode('<w:comments/>')),
    ];
    expect(carriedOverWarnings(parts)).toEqual(['comments']);
  });

  it('notices tracked changes', () => {
    const parts = [zipEntry('word/document.xml',
      new TextEncoder().encode('<w:document><w:ins w:author="Ada"/></w:document>'))];
    expect(carriedOverWarnings(parts)).toEqual(['tracked changes']);
  });
});
