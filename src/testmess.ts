// feature: exam-variants
//
// The whole pipeline in one call, for the page and for the tests:
//
//   .docx bytes -> parseExam -> makeVariants -> writeVariant -> papers.zip
//
// Nothing here touches the network or the disk.  The source test is read in
// the browser, the papers are built in the browser, and the only thing that
// ever leaves the tab is the ZIP the user saves.

import { AppError } from './errors';
import { DEFAULT_LANG, type Lang } from './i18n';
import { carriedOverWarnings, scrubMetadata } from './metadata';
import { parseExam, type Exam } from './parse';
import { writeVariant, type Paper } from './render';
import { makeVariants, randomSeed, type Variant } from './variants';
import { writeZip, zipEntry } from './zip';

export interface GenerateOptions {
  /** How many variants to build (default 3, as the command line has it). */
  count?: number;
  /** Seed; omitted means a fresh random one, which is reported back. */
  seed?: number;
  /**
   * Keep the source's author, company and template metadata in the papers.
   * Off by default: a student paper naming its teacher is a leak the teacher
   * did not ask for.  See `scrubMetadata`.
   */
  keepMetadata?: boolean;
  /**
   * The language of the one line this program writes into a paper: the
   * professor copy's "Variant N" banner.  Everything else in the document is
   * the teacher's own.
   */
  lang?: Lang;
}

export interface Generated {
  exam: Exam;
  variants: Variant[];
  papers: Paper[];
  /** The seed actually used -- show it, so the run can be repeated. */
  seed: number;
  /**
   * What the source carries that scrubbing cannot reach -- comments, tracked
   * changes -- for the page to warn about.
   */
  warnings: string[];
}

export async function generatePapers(
  bytes: Uint8Array, source: string, options: GenerateOptions = {},
): Promise<Generated> {
  const count = options.count ?? 3;
  if (!Number.isInteger(count) || count < 1) {
    throw new AppError('count-too-small');
  }
  const seed = options.seed ?? randomSeed();

  const exam = await parseExam(bytes, source);
  // Scrubbed once, at the package level: every paper of the run is written
  // from these parts, and the document part itself is untouched by it.
  const written = options.keepMetadata
    ? exam
    : { ...exam, parts: scrubMetadata(exam.parts) };

  const variants = makeVariants(exam, count, seed);
  const papers: Paper[] = [];
  for (const variant of variants) {
    papers.push(...await writeVariant(written, variant, options.lang ?? DEFAULT_LANG));
  }
  return { exam, variants, papers, seed, warnings: carriedOverWarnings(exam.parts) };
}

/**
 * Put the whole run in one archive.
 *
 * A browser cannot be asked "overwrite these six files?" the way the command
 * line can, so the run is handed over as a single download instead: one ZIP
 * holding the complete set, never a folder half from this run and half from
 * the last one.
 */
export async function bundlePapers(papers: Paper[]): Promise<Uint8Array> {
  const when = new Date();
  return writeZip(papers.map((paper) => zipEntry(paper.name, paper.bytes, when)));
}

export { parseExam, validateExam } from './parse';
export { AppError, ExamError } from './errors';
export { STRINGS, LANGS, DEFAULT_LANG, t, format, detectLanguage } from './i18n';
export type { Lang, Params } from './i18n';
export type { Exam, ExamOption, ExamQuestion } from './parse';
export { makeVariant, makeVariants, keyLine, seedFrom, randomSeed, Rng } from './variants';
export type { Variant, VariantOption, VariantQuestion } from './variants';
export { renderDocumentXml, writeDocx, writeVariant, variantNames } from './render';
export type { Paper } from './render';
export { scrubMetadata, metadataNames, carriedOverWarnings } from './metadata';
export { readZip, writeZip, zipEntry } from './zip';
export type { ZipEntry } from './zip';
export { sameMarker, KEY_ENTRY, KEY_HEADING, OPTION_LABEL, QUESTION_LABEL } from './markers';
