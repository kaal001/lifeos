export type FitnessWeightSpecResult = {
  valid: boolean;
  value: string | null;
  numericValue: number | null;
  error?: string;
};

const WEIGHT_NUMBER_PATTERN = /^\d+(?:\.\d{1,2})?$/;

/**
 * Accepts a single load (30), a load range (40-55), a list (34,50), or
 * a mixed list (30,40-55,50). Values are in kg, > 0, <= 1000, and use
 * at most two decimal places. Whitespace is removed before persistence.
 */
export function parseFitnessWeightSpec(input: string): FitnessWeightSpecResult {
  const compact = input.trim().replace(/\s+/g, '');

  if (!compact) {
    return { valid: true, value: null, numericValue: null };
  }

  if (compact.length > 64) {
    return {
      valid: false,
      value: null,
      numericValue: null,
      error: 'Keep the weight specification within 64 characters.',
    };
  }

  const segments = compact.split(',');
  if (segments.length > 10 || segments.some((segment) => segment.length === 0)) {
    return {
      valid: false,
      value: null,
      numericValue: null,
      error: 'Use comma-separated values, for example 30,40-55,50.',
    };
  }

  for (const segment of segments) {
    const parts = segment.split('-');
    if (parts.length > 2 || parts.some((part) => !WEIGHT_NUMBER_PATTERN.test(part))) {
      return {
        valid: false,
        value: null,
        numericValue: null,
        error: 'Use a value (30), a range (40-55), or a list (34,50).',
      };
    }

    const values = parts.map(Number);
    if (values.some((value) => !Number.isFinite(value) || value <= 0 || value > 1000)) {
      return {
        valid: false,
        value: null,
        numericValue: null,
        error: 'Each weight must be greater than 0 and no more than 1000 kg.',
      };
    }

    if (values.length === 2 && values[0] > values[1]) {
      return {
        valid: false,
        value: null,
        numericValue: null,
        error: 'In a weight range, the lower value must come first (for example 40-55).',
      };
    }
  }

  return {
    valid: true,
    value: compact,
    numericValue: segments.length === 1 && !segments[0].includes('-')
      ? Number(segments[0])
      : null,
  };
}

/** Returns a readable weight value without appending the unit. */
export function getFitnessWeightText(
  weightSpec?: string | null,
  legacyWeight?: number | null,
): string {
  const explicit = weightSpec?.trim();
  if (explicit) return explicit;
  return legacyWeight == null || !Number.isFinite(legacyWeight)
    ? ''
    : String(legacyWeight);
}
