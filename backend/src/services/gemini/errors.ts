export type GeminiErrorCode =
  | 'GEMINI_MISSING_CONFIGURATION'
  | 'GEMINI_MALFORMED_RESPONSE'
  | 'GEMINI_EMPTY_RESULT'
  | 'GEMINI_SAFETY_BLOCK'
  | 'GEMINI_TIMEOUT'
  | 'GEMINI_RATE_LIMITED'
  | 'GEMINI_UNAVAILABLE'
  | 'GEMINI_FAILED';

export class GeminiServiceError extends Error {
  readonly code: GeminiErrorCode;
  readonly retryable: boolean;

  constructor(code: GeminiErrorCode, message: string, retryable = false) {
    super(message);
    this.name = 'GeminiServiceError';
    this.code = code;
    this.retryable = retryable;
  }
}

export function mapGeminiError(error: unknown): GeminiServiceError {
  if (error instanceof GeminiServiceError) return error;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('safety') || message.includes('blocked') || message.includes('harm')) {
    return new GeminiServiceError('GEMINI_SAFETY_BLOCK', 'The image could not be analyzed by the safety system.');
  }
  if (message.includes('429') || message.includes('rate') || message.includes('quota') || message.includes('resource_exhausted')) {
    return new GeminiServiceError('GEMINI_RATE_LIMITED', 'Gemini is temporarily rate-limited. Please try again shortly.', true);
  }
  if (message.includes('timeout') || message.includes('timed out') || message.includes('deadline')) {
    return new GeminiServiceError('GEMINI_TIMEOUT', 'Gemini took too long to respond. Please try again.', true);
  }
  if (message.includes('503') || message.includes('unavailable') || message.includes('network') || message.includes('fetch failed')) {
    return new GeminiServiceError('GEMINI_UNAVAILABLE', 'Gemini is temporarily unavailable. Please try again.', true);
  }
  return new GeminiServiceError('GEMINI_FAILED', 'Product identification could not be completed.');
}
