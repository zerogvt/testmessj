// feature: exam-variants
//
// A .docx is a ZIP archive, and this is the whole of the archive handling:
// read the parts out of the source package, write them back with one part
// swapped.  The browser supplies the compressor (CompressionStream /
// DecompressionStream, 'deflate-raw'), so there is no third-party code in the
// shipped bundle -- the same bargain the Python version struck with zipfile.
//
// A written package keeps the source's entry order, compression method,
// timestamps and attributes, so a variant differs from its source in exactly
// one part: word/document.xml.  Archive comments and extra fields are the one
// thing dropped; Word writes none in these documents and carrying them would
// mean carrying zip64 and data-descriptor records that no longer describe the
// bytes we just wrote.

import { AppError } from './errors';

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const EOCD_SIZE = 22;
const ZIP64_MARKER = 0xffffffff;

export const STORED = 0;
export const DEFLATED = 8;

// A .docx holding an exam is measured in tens of kilobytes; one holding a
// scanned textbook in a few megabytes.  These caps are far above anything a
// teacher will meet and far below what it takes to wedge a browser tab, so a
// deliberately malformed archive -- a "zip bomb", a few kilobytes that inflate
// to gigabytes -- is refused instead of being unpacked.
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_PART_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;

function megabytes(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}

export interface ZipEntry {
  name: string;
  /** Decompressed contents. */
  data: Uint8Array;
  method: number;
  /** MS-DOS time and date, carried over so a copy keeps the source's stamps. */
  time: number;
  date: number;
  /** General-purpose flags, as read; on writing they are derived from the name. */
  flags: number;
  versionMadeBy: number;
  internalAttributes: number;
  externalAttributes: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

// --------------------------------------------------------------------------
// deflate, through the platform
// --------------------------------------------------------------------------

/** Push one buffer through a compression stream and collect what comes out. */
async function pump(
  transform: { readable: ReadableStream<Uint8Array>; writable: WritableStream<BufferSource> },
  data: Uint8Array,
): Promise<Uint8Array> {
  const writer = transform.writable.getWriter();
  // Deliberately not awaited: a large chunk fills the transform's queue and
  // only drains once the reader below starts pulling, so awaiting the write
  // first would deadlock.
  // The cast only sheds the SharedArrayBuffer half of BufferSource, which
  // nothing here ever produces.
  void writer.write(data as BufferSource).then(() => writer.close()).catch(() => undefined);

  const reader = transform.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    total += value.length;
  }
  return concat(chunks, total);
}

export function concat(chunks: Uint8Array[], total?: number): Uint8Array {
  const size = total ?? chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  return pump(new DecompressionStream('deflate-raw'), data);
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  return pump(new CompressionStream('deflate-raw'), data);
}

// --------------------------------------------------------------------------
// CRC-32
// --------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc = CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// --------------------------------------------------------------------------
// Reading
// --------------------------------------------------------------------------

function findEndOfCentralDirectory(view: DataView): number {
  // The record is last, but a trailing comment may follow it; 64 KiB back is
  // as far as a comment can push it.
  const limit = Math.max(0, view.byteLength - EOCD_SIZE - 0xffff);
  for (let offset = view.byteLength - EOCD_SIZE; offset >= limit; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIG) {
      return offset;
    }
  }
  throw new AppError('not-an-archive');
}

/** Read every part of an archive, decompressing as it goes. */
export async function readZip(bytes: Uint8Array): Promise<ZipEntry[]> {
  if (bytes.length > MAX_ARCHIVE_BYTES) {
    throw new AppError('too-large', { limit: megabytes(MAX_ARCHIVE_BYTES) });
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  const count = view.getUint16(eocd + 10, true);
  const directory = view.getUint32(eocd + 16, true);
  if (count === 0xffff || directory === ZIP64_MARKER) {
    throw new AppError('zip64');
  }

  const entries: ZipEntry[] = [];
  let unpacked = 0;
  let offset = directory;
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== CENTRAL_SIG) {
      throw new AppError('corrupt-directory', { index: index + 1 });
    }
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const time = view.getUint16(offset + 12, true);
    const date = view.getUint16(offset + 14, true);
    const crc = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));

    if (flags & 0x1) {
      throw new AppError('encrypted', { name });
    }
    if (compressedSize === ZIP64_MARKER || uncompressedSize === ZIP64_MARKER
        || localOffset === ZIP64_MARKER) {
      throw new AppError('zip64');
    }
    if (view.getUint32(localOffset, true) !== LOCAL_SIG) {
      throw new AppError('corrupt-header', { name });
    }
    // Checked before inflating, not after: the point is not to unpack it.
    // The sizes are then verified against what actually came out, below, so a
    // header that understates itself does not get past this either.
    unpacked += uncompressedSize;
    if (uncompressedSize > MAX_PART_BYTES || unpacked > MAX_TOTAL_BYTES) {
      throw new AppError('unpacks-too-large', { name });
    }

    // The local header has its own name and extra lengths, which need not
    // match the central directory's, so the data start is computed from them.
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = bytes.subarray(start, start + compressedSize);

    let data: Uint8Array;
    if (method === STORED) {
      data = raw.slice();
    } else if (method === DEFLATED) {
      data = await inflateRaw(raw);
    } else {
      throw new AppError('unsupported-method', { name, method });
    }
    if (data.length !== uncompressedSize || crc32(data) !== crc) {
      throw new AppError('corrupt', { name });
    }

    entries.push({
      name,
      data,
      method,
      time,
      date,
      flags: flags & 0x800, // keep only "names are UTF-8"
      versionMadeBy: view.getUint16(offset + 4, true),
      internalAttributes: view.getUint16(offset + 36, true),
      externalAttributes: view.getUint32(offset + 38, true),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

// --------------------------------------------------------------------------
// Writing
// --------------------------------------------------------------------------

function dosStamp(when: Date): { time: number; date: number } {
  // MS-DOS keeps two-second resolution and counts years from 1980.
  const year = Math.max(1980, when.getFullYear());
  return {
    time: (when.getHours() << 11) | (when.getMinutes() << 5)
      | (Math.floor(when.getSeconds() / 2)),
    date: ((year - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate(),
  };
}

/** A fresh entry, deflated, stamped now -- for archives we invent ourselves. */
export function zipEntry(name: string, data: Uint8Array, when = new Date()): ZipEntry {
  const { time, date } = dosStamp(when);
  return {
    name,
    data,
    method: DEFLATED,
    time,
    date,
    flags: 0,
    versionMadeBy: 20,
    internalAttributes: 0,
    externalAttributes: 0,
  };
}

/** Write the entries into one archive, in the order given. */
export async function writeZip(entries: ZipEntry[]): Promise<Uint8Array> {
  const pieces: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    // Bit 11 says "the name is UTF-8".  Pure ASCII reads the same either way,
    // so it is set only where it has to be.
    const utf8 = /[^\x20-\x7e]/.test(entry.name) ? 0x800 : 0;
    const payload = entry.method === DEFLATED
      ? await deflateRaw(entry.data)
      : entry.data;
    const crc = crc32(entry.data);

    const header = new Uint8Array(30 + name.length);
    const headerView = new DataView(header.buffer);
    headerView.setUint32(0, LOCAL_SIG, true);
    headerView.setUint16(4, entry.method === DEFLATED ? 20 : 10, true);
    headerView.setUint16(6, utf8, true);
    headerView.setUint16(8, entry.method, true);
    headerView.setUint16(10, entry.time, true);
    headerView.setUint16(12, entry.date, true);
    headerView.setUint32(14, crc, true);
    headerView.setUint32(18, payload.length, true);
    headerView.setUint32(22, entry.data.length, true);
    headerView.setUint16(26, name.length, true);
    headerView.setUint16(28, 0, true);
    header.set(name, 30);

    const record = new Uint8Array(46 + name.length);
    const recordView = new DataView(record.buffer);
    recordView.setUint32(0, CENTRAL_SIG, true);
    recordView.setUint16(4, entry.versionMadeBy, true);
    recordView.setUint16(6, entry.method === DEFLATED ? 20 : 10, true);
    recordView.setUint16(8, utf8, true);
    recordView.setUint16(10, entry.method, true);
    recordView.setUint16(12, entry.time, true);
    recordView.setUint16(14, entry.date, true);
    recordView.setUint32(16, crc, true);
    recordView.setUint32(20, payload.length, true);
    recordView.setUint32(24, entry.data.length, true);
    recordView.setUint16(28, name.length, true);
    recordView.setUint16(30, 0, true); // extra
    recordView.setUint16(32, 0, true); // comment
    recordView.setUint16(34, 0, true); // disk
    recordView.setUint16(36, entry.internalAttributes, true);
    recordView.setUint32(38, entry.externalAttributes, true);
    recordView.setUint32(42, offset, true);
    record.set(name, 46);

    pieces.push(header, payload);
    central.push(record);
    offset += header.length + payload.length;
  }

  const directory = concat(central);
  const end = new Uint8Array(EOCD_SIZE);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, EOCD_SIG, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, directory.length, true);
  endView.setUint32(16, offset, true);
  return concat([...pieces, directory, end]);
}
