// feature: exam-variants
//
// Errors carry a code and its parameters, not a finished sentence.
//
// "no answer key entry for question 3" is the moment a teacher most needs to
// understand what went wrong, so it has to be readable in their own language.
// The English text is attached as the Error's message so anything that only
// logs it still says something useful; the page renders `code` and `params`
// through the string table instead.

import { format, STRINGS, type Params } from './i18n';

export class AppError extends Error {
  readonly code: string;
  readonly params: Params;

  constructor(code: string, params: Params = {}) {
    super(format(STRINGS.en[`error.${code}`] ?? code, params));
    this.name = 'AppError';
    this.code = code;
    this.params = params;
  }

  /** The key the string table knows this error by. */
  get key(): string {
    return `error.${this.code}`;
  }
}

/** An input document this program refuses to guess about. */
export class ExamError extends AppError {
  constructor(code: string, params: Params = {}) {
    super(code, params);
    this.name = 'ExamError';
  }
}
