// feature: exam-variants
//
// Building the variants: pure data, no documents, no I/O.  The paragraph
// elements are shared with the exam -- they are never mutated, only cloned at
// render time -- while numbers, markers and the answer are new.

import { AppError } from './errors';
import { sameMarker } from './markers';
import type { Exam, ExamOption } from './parse';

export interface VariantOption {
  /** The marker this option carries in this variant. */
  letter: string;
  /** The marker it carried in the source: the provenance of the shuffle. */
  sourceLetter: string;
  text: string;
  nodes: Element[];
}

export interface VariantQuestion {
  /** Position in this variant. */
  number: number;
  /** Which question of the source this is. */
  sourceNumber: number;
  stemText: string;
  stemNodes: Element[];
  options: VariantOption[];
  /** Marker of the correct option, in this variant. */
  answer: string;
}

export interface Variant {
  index: number;
  source: string;
  questions: VariantQuestion[];
}

/**
 * A small seeded generator (mulberry32).
 *
 * Math.random cannot be seeded, and a seed is what lets a teacher reprint
 * variant 3 next week and get variant 3 back rather than a new paper.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** A float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  /** An integer in [0, bound). */
  below(bound: number): number {
    return Math.floor(this.next() * bound);
  }

  /** Fisher-Yates, in place. */
  shuffle<T>(items: T[]): T[] {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const other = this.below(index + 1);
      [items[index], items[other]] = [items[other], items[index]];
    }
    return items;
  }
}

/** Turn whatever the user typed into a seed (FNV-1a). */
export function seedFrom(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A seed to show the user, so this run can be repeated later. */
export function randomSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0];
}

/**
 * Derive one variant: questions reordered, options reshuffled.
 *
 * Markers are not generated, they are reused: slot 1 of a variant carries
 * whatever marker slot 1 of that question carried in the source.  A test
 * lettered (A)-(D) stays Latin, one lettered α)-δ) stays Greek, and the
 * document keeps agreeing with its own instructions line.
 */
export function makeVariant(exam: Exam, index: number, rng: Rng): Variant {
  const order = rng.shuffle(exam.questions.map((_question, position) => position));

  const questions: VariantQuestion[] = order.map((sourceIndex, position) => {
    const source = exam.questions[sourceIndex];
    const markers = source.options.map((option) => option.letter);
    const shuffled: ExamOption[] = rng.shuffle([...source.options]);

    let answer: string | null = null;
    const options = shuffled.map((option, slot) => {
      const letter = markers[slot];
      if (source.answer !== null && sameMarker(option.letter, source.answer)) {
        answer = letter;
      }
      return {
        letter,
        sourceLetter: option.letter,
        text: option.text,
        nodes: option.nodes,
      };
    });

    if (answer === null) {
      // validateExam() rules this out; reaching it would mean handing over a
      // paper whose key points at nothing, which is worse than no paper.
      throw new AppError('lost-answer', { number: source.number });
    }

    return {
      number: position + 1,
      sourceNumber: source.number,
      stemText: source.stemText,
      stemNodes: source.stemNodes,
      options,
      answer,
    };
  });

  return { index, source: exam.source, questions };
}

export function makeVariants(exam: Exam, count: number, seed: number): Variant[] {
  const rng = new Rng(seed);
  const variants: Variant[] = [];
  for (let index = 1; index <= count; index += 1) {
    variants.push(makeVariant(exam, index, rng));
  }
  return variants;
}

/** "1C, 2A, 3D, ..." -- the line a teacher checks a paper against. */
export function keyLine(variant: Variant): string {
  return variant.questions
    .map((question) => `${question.number}${question.answer}`)
    .join(', ');
}
