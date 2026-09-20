// feature: exam-variants
//
// Reading the source test into the intermediate object -- the contract every
// later stage works against, and the reason the whole thing is testable
// without ever opening Word.
//
// Every stem and every option keeps *its own paragraph elements*, lifted from
// the source document and never mutated, plus a plain-text rendering used only
// for label matching, the on-screen key and the tests.

import {
  foldMarker, KEY_ENTRY, KEY_HEADING, OPTION_LABEL, QUESTION_LABEL, sameMarker,
} from './markers';
import { AppError, ExamError } from './errors';
import { readZip, type ZipEntry } from './zip';
import {
  childElements, documentBody, hasPageBreak, isTag, paragraphText, parseXml,
} from './xml';

export const DOCUMENT_PART = 'word/document.xml';

export interface ExamOption {
  /** The marker as the document writes it: "A", "a", "α", "iii". */
  letter: string;
  text: string;
  nodes: Element[];
}

export interface ExamQuestion {
  number: number;
  stemText: string;
  stemNodes: Element[];
  options: ExamOption[];
  answer: string | null;
}

export interface KeyTemplates {
  /** The paragraph carrying the page break before the key, if there is one. */
  pageBreak: Element | null;
  heading: Element | null;
  entry: Element | null;
}

export interface Exam {
  source: string;
  title: string;
  /**
   * Whether the source has an answer key page at all.
   *
   * A test that ends with its last question is a perfectly ordinary test --
   * plenty of teachers know their own answers -- so it is accepted, and only
   * student papers are written from it.  This is not the same as a key that is
   * *incomplete*: a document that announces a key and then misses an entry is
   * still refused, because there the teacher believes there is a key.
   */
  hasKey: boolean;
  /** Everything above question 1, copied to every variant as-is. */
  preamble: Element[];
  keyTemplates: KeyTemplates;
  questions: ExamQuestion[];
  /** word/document.xml exactly as the source wrote it. */
  documentXml: string;
  /** The whole source package, so a variant can be written from memory. */
  parts: ZipEntry[];
}

export function documentPart(parts: ZipEntry[]): string {
  const part = parts.find((entry) => entry.name === DOCUMENT_PART);
  if (!part) {
    throw new ExamError('not-a-docx');
  }
  return new TextDecoder('utf-8').decode(part.data);
}

/** Read a .docx into the intermediate object. */
export async function parseExam(bytes: Uint8Array, source = 'test.docx'): Promise<Exam> {
  let parts: ZipEntry[];
  try {
    parts = await readZip(bytes);
  } catch (error) {
    // A coded error already says what is wrong, in whatever language the page
    // is in; only something unforeseen needs wrapping.
    if (error instanceof AppError) {
      throw error;
    }
    throw new ExamError('unreadable', { source, detail: (error as Error).message });
  }
  const documentXml = documentPart(parts);
  const body = documentBody(parseXml(documentXml));

  const preamble: Element[] = [];
  const questions: ExamQuestion[] = [];
  const keyTemplates: KeyTemplates = { pageBreak: null, heading: null, entry: null };
  const answers = new Map<number, string>();
  let sawKeyPage = false;
  let section: 'preamble' | 'questions' | 'key' = 'preamble';
  let current: ExamQuestion | null = null;
  let previous: Element | null = null;

  for (const child of childElements(body)) {
    if (!isTag(child, 'w', 'p')) {
      continue;
    }
    const text = paragraphText(child).trim();

    if (KEY_HEADING.test(text)) {
      section = 'key';
      sawKeyPage = true;
      keyTemplates.heading = child;
      if (previous !== null && hasPageBreak(previous)) {
        keyTemplates.pageBreak = previous;
      }
      previous = child;
      continue;
    }

    if (section === 'key') {
      const match = KEY_ENTRY.exec(text);
      if (match) {
        answers.set(Number(match[1]), match[2]);
        if (keyTemplates.entry === null) {
          keyTemplates.entry = child;
        }
      }
      previous = child;
      continue;
    }

    const question = QUESTION_LABEL.exec(text);
    const option = current !== null ? OPTION_LABEL.exec(text) : null;

    if (question) {
      section = 'questions';
      current = {
        number: Number(question[1]),
        stemText: text.slice(question[0].length).trim(),
        stemNodes: [child],
        options: [],
        answer: null,
      };
      questions.push(current);
    } else if (option && current !== null) {
      current.options.push({
        letter: option[1],
        text: text.slice(option[0].length).trim(),
        nodes: [child],
      });
    } else if (section === 'preamble') {
      preamble.push(child);
    } else if (text && current !== null) {
      // A stem or an option that runs over several paragraphs: keep it with
      // whatever it continues, so nothing is dropped.
      const target = current.options.length
        ? current.options[current.options.length - 1]
        : current;
      if ('stemNodes' in target) {
        target.stemNodes.push(child);
        target.stemText = `${target.stemText} ${text}`.trim();
      } else {
        target.nodes.push(child);
        target.text = `${target.text} ${text}`.trim();
      }
    }

    previous = child;
  }

  for (const question of questions) {
    question.answer = answers.get(question.number) ?? null;
  }

  const exam: Exam = {
    source,
    title: preamble.length ? paragraphText(preamble[0]).trim() : '',
    hasKey: sawKeyPage || answers.size > 0,
    preamble,
    keyTemplates,
    questions,
    documentXml,
    parts,
  };
  validateExam(exam);
  return exam;
}

/** Fail loudly rather than emit a test with a wrong or missing key. */
export function validateExam(exam: Exam): void {
  if (!exam.questions.length) {
    throw new ExamError('no-questions', { source: exam.source });
  }
  for (const question of exam.questions) {
    const { number } = question;
    if (question.options.length < 2) {
      throw new ExamError('too-few-options',
        { number, count: question.options.length });
    }
    const markers = question.options.map((option) => option.letter);
    const folded = markers.map(foldMarker);
    if (new Set(folded).size !== folded.length) {
      throw new ExamError('duplicate-markers', { number, markers: markers.join(', ') });
    }
    if (!exam.hasKey) {
      // No key page: there is nothing to check the questions against, and
      // nothing to get wrong.  Only student papers come out of this.
      continue;
    }
    if (question.answer === null) {
      throw new ExamError('no-key-entry', { number });
    }
    const answer = question.answer;
    if (!markers.some((marker) => sameMarker(answer, marker))) {
      throw new ExamError('key-not-an-option',
        { number, answer, markers: markers.join(', ') });
    }
  }
}
