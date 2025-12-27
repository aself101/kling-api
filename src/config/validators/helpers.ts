/**
 * Validation Helpers
 *
 * Shared validation utilities used across all validators.
 */

import { MAX_PROMPT_LENGTH } from '../constants.js';

// ============================================================================
// ValidationError Class
// ============================================================================

/** Validation error with field information */
export class ValidationError extends Error {
  constructor(
    public field: string,
    message: string
  ) {
    super(`${field}: ${message}`);
    this.name = 'ValidationError';
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

/** Range definition for numeric validation */
export interface Range {
  readonly min: number;
  readonly max: number;
}

/**
 * Validate that a value is within a numeric range
 * @throws ValidationError if value is outside range
 */
export function validateRange(field: string, value: number, range: Range): void {
  if (value < range.min || value > range.max) {
    throw new ValidationError(field, `must be between ${range.min} and ${range.max}`);
  }
}

/**
 * Validate that a value is one of the allowed enum values
 * @throws ValidationError if value is not in allowed list
 */
export function validateEnumValue<T extends string>(
  field: string,
  value: T,
  allowed: readonly T[] | T[]
): void {
  if (!allowed.includes(value)) {
    throw new ValidationError(field, `must be one of: ${allowed.join(', ')}`);
  }
}

/**
 * Validate prompt length (for optional prompts)
 * @throws ValidationError if prompt exceeds max length
 */
export function validatePromptLength(field: string, prompt: string | undefined): void {
  if (prompt && prompt.length > MAX_PROMPT_LENGTH) {
    throw new ValidationError(field, `cannot exceed ${MAX_PROMPT_LENGTH} characters`);
  }
}

/**
 * Validate a required string field is present and non-empty
 * @throws ValidationError if field is missing or empty
 */
export function validateRequired(field: string, value: string | undefined, label?: string): void {
  if (!value || value.trim() === '') {
    throw new ValidationError(field, `${label ?? field} is required`);
  }
}

/**
 * Validate model exists in model registry
 * @returns The model capabilities
 * @throws ValidationError if model is invalid
 */
export function validateModel<T>(
  modelName: string | undefined,
  defaultModel: string,
  registry: Record<string, T>
): T {
  const model = modelName ?? defaultModel;
  if (!(model in registry)) {
    throw new ValidationError(
      'model_name',
      `Invalid model. Must be one of: ${Object.keys(registry).join(', ')}`
    );
  }
  return registry[model];
}
