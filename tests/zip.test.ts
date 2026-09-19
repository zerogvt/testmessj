// feature: exam-variants
//
// The archive layer, which the Python version got from the standard library
// and this one writes by hand: everything a .docx needs and nothing it does
// not.

import { describe, expect, it } from 'vitest';

import { readZip, writeZip, zipEntry } from '../src/testmess';
import { DEFLATED, STORED, crc32 } from '../src/zip';
import { SOURCE, sampleBytes } from './helpers';

// A copy with a buffer of exactly its own length: TextEncoder may hand back
// one that is larger, which a byte-for-byte comparison would notice.
const bytes = (text: string) => new Uint8Array(new TextEncoder().encode(text));

describe('readZip', () => {
  it('reads every part of a real .docx', async () => {
    const parts = await readZip(sampleBytes(SOURCE));
    const names = parts.map((part) => part.name);
    expect(names).toContain('[Content_Types].xml');
    expect(names).toContain('word/document.xml');
    expect(names).toContain('word/styles.xml');
    const document = parts.find((part) => part.name === 'word/document.xml')!;
    expect(new TextDecoder().decode(document.data)).toContain('<w:body>');
  });

  it('refuses anything that is not an archive', async () => {
    await expect(readZip(bytes('Dear students, ...')))
      .rejects.toThrow(/not a ZIP archive/);
  });

  it('notices a corrupt part', async () => {
    const archive = await writeZip([zipEntry('a.txt', bytes('hello'))]);
    // Flip a byte inside the compressed payload.
    archive[40] ^= 0xff;
    await expect(readZip(archive)).rejects.toThrow();
  });
});

describe('writeZip', () => {
  it('round-trips names, contents and order', async () => {
    const entries = [
      zipEntry('first.txt', bytes('one')),
      zipEntry('nested/second.xml', bytes('<x>two</x>')),
      zipEntry('ünïcode.txt', bytes('three')),
    ];
    const parts = await readZip(await writeZip(entries));
    expect(parts.map((part) => part.name))
      .toEqual(['first.txt', 'nested/second.xml', 'ünïcode.txt']);
    expect(new TextDecoder().decode(parts[1].data)).toBe('<x>two</x>');
  });

  it('keeps a stored part stored and a deflated part deflated', async () => {
    const payload = bytes('x'.repeat(4000));
    const parts = await readZip(await writeZip([
      { ...zipEntry('stored.bin', payload), method: STORED },
      { ...zipEntry('deflated.bin', payload), method: DEFLATED },
    ]));
    expect(parts[0].method).toBe(STORED);
    expect(parts[1].method).toBe(DEFLATED);
    expect(parts[0].data).toEqual(payload);
    expect(parts[1].data).toEqual(payload);
  });

  it('carries the source package\'s methods and stamps over', async () => {
    const source = await readZip(sampleBytes(SOURCE));
    const copy = await readZip(await writeZip(source));
    expect(copy.map((part) => [part.name, part.method, part.date, part.time]))
      .toEqual(source.map((part) => [part.name, part.method, part.date, part.time]));
  });

  it('writes an archive byte-for-byte again from the same input', async () => {
    const source = await readZip(sampleBytes(SOURCE));
    expect(await writeZip(source)).toEqual(await writeZip(source));
  });

  it('handles an empty part', async () => {
    const parts = await readZip(await writeZip([zipEntry('empty.txt', new Uint8Array())]));
    expect(parts[0].data).toHaveLength(0);
  });
});

describe('crc32', () => {
  it('agrees with the known value for "123456789"', () => {
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926);
  });

  it('is zero for nothing at all', () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe('limits', () => {
  it('refuses an archive that is too big to be an exam', async () => {
    // Only the length is inspected before anything is unpacked, so this costs
    // nothing but the allocation.
    const huge = new Uint8Array(65 * 1024 * 1024);
    await expect(readZip(huge)).rejects.toThrow(/larger than/);
  });

  it('refuses a part that claims to unpack to absurdity', async () => {
    const archive = await writeZip([zipEntry('bomb.bin', bytes('x'.repeat(100)))]);
    // Overstate the uncompressed size in the central directory, the way a zip
    // bomb does: it must be refused before anything is inflated.
    const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
    let central = -1;
    for (let offset = 0; offset < archive.length - 4; offset += 1) {
      if (view.getUint32(offset, true) === 0x02014b50) { central = offset; break; }
    }
    expect(central).toBeGreaterThan(-1);
    view.setUint32(central + 24, 200 * 1024 * 1024, true);
    await expect(readZip(archive)).rejects.toThrow(/more than this page will handle/);
  });
});
