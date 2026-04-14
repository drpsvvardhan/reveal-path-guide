/**
 * Parser and shape analysis for structured time series blocks
 * emitted by patient-chat LLM responses.
 *
 * Format:
 *   {time_series:start}
 *   marker: HbA1c
 *   unit: %
 *   points:
 *     2020-05-27 | 5.3
 *     2020-11-06 | 5.7
 *   {time_series:end}
 */

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface ParsedTimeSeries {
  marker: string;
  unit: string;
  points: TimeSeriesPoint[];
}

export type TrajectoryShape =
  | 'monotonic_up'
  | 'monotonic_down'
  | 'peak'
  | 'valley'
  | 'stable'
  | 'oscillating'
  | 'other';

const BLOCK_RE = /\{time_series:start\}([\s\S]*?)\{time_series:end\}/g;

/** Parse all time series blocks from raw LLM text */
export function parseTimeSeriesBlocks(text: string): ParsedTimeSeries[] {
  const results: ParsedTimeSeries[] = [];
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = BLOCK_RE.exec(text)) !== null) {
    const inner = match[1];
    const markerMatch = inner.match(/marker:\s*(.+)/i);
    const unitMatch = inner.match(/unit:\s*(.+)/i);
    if (!markerMatch) continue;

    const marker = markerMatch[1].trim();
    const unit = unitMatch ? unitMatch[1].trim() : '';
    const points: TimeSeriesPoint[] = [];

    const pointLines = inner.split('\n');
    for (const line of pointLines) {
      const trimmed = line.trim();
      const pm = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s*\|\s*([\d.]+)$/);
      if (pm) {
        points.push({ date: pm[1], value: parseFloat(pm[2]) });
      }
    }

    if (points.length > 0) {
      results.push({ marker, unit, points });
    }
  }
  return results;
}

/** Strip time series block markup from text */
export function stripTimeSeriesBlocks(text: string): string {
  return text.replace(BLOCK_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Compute the trajectory shape of a series of values */
export function computeTrajectoryShape(values: number[]): TrajectoryShape {
  if (values.length < 2) return 'other';

  const range = Math.max(...values) - Math.min(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  // Stable: all values within 10% of mean or within a tiny absolute range
  if (range <= mean * 0.1 || range < 0.5) return 'stable';

  // Check monotonic
  let allUp = true;
  let allDown = true;
  for (let i = 1; i < values.length; i++) {
    if (values[i] < values[i - 1]) allUp = false;
    if (values[i] > values[i - 1]) allDown = false;
  }
  if (allUp) return 'monotonic_up';
  if (allDown) return 'monotonic_down';

  // Peak: max is in the interior (not first or last)
  const maxIdx = values.indexOf(Math.max(...values));
  if (maxIdx > 0 && maxIdx < values.length - 1) return 'peak';

  // Valley: min is in the interior
  const minIdx = values.indexOf(Math.min(...values));
  if (minIdx > 0 && minIdx < values.length - 1) return 'valley';

  // Count direction changes
  let changes = 0;
  for (let i = 2; i < values.length; i++) {
    const prev = values[i - 1] - values[i - 2];
    const curr = values[i] - values[i - 1];
    if ((prev > 0 && curr < 0) || (prev < 0 && curr > 0)) changes++;
  }
  if (changes >= 2) return 'oscillating';

  return 'other';
}

/** Shape-description words that imply a specific trajectory */
const MONOTONIC_DOWN_CLAIMS = [
  'trending downward', 'steady decline', 'consistent decrease',
  'progressively lower', 'declining trend', 'steadily decreased',
  'steadily declining', 'continuous decline', 'monotonic decrease',
];

const MONOTONIC_UP_CLAIMS = [
  'trending upward', 'steady increase', 'consistent increase',
  'progressively higher', 'rising trend', 'steadily increased',
  'steadily rising', 'continuous increase', 'monotonic increase',
];

export interface ShapeMismatch {
  marker: string;
  claimedShape: string;
  actualShape: TrajectoryShape;
  matchedPhrase: string;
}

/** Check prose for shape claims that contradict the actual data */
export function detectShapeMismatches(
  prose: string,
  seriesList: ParsedTimeSeries[],
): ShapeMismatch[] {
  const lowered = prose.toLowerCase();
  const mismatches: ShapeMismatch[] = [];

  for (const series of seriesList) {
    const shape = computeTrajectoryShape(series.points.map(p => p.value));

    if (shape !== 'monotonic_down') {
      for (const phrase of MONOTONIC_DOWN_CLAIMS) {
        if (lowered.includes(phrase)) {
          mismatches.push({
            marker: series.marker,
            claimedShape: phrase,
            actualShape: shape,
            matchedPhrase: phrase,
          });
          break;
        }
      }
    }

    if (shape !== 'monotonic_up') {
      for (const phrase of MONOTONIC_UP_CLAIMS) {
        if (lowered.includes(phrase)) {
          mismatches.push({
            marker: series.marker,
            claimedShape: phrase,
            actualShape: shape,
            matchedPhrase: phrase,
          });
          break;
        }
      }
    }
  }

  return mismatches;
}
