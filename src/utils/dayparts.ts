import { Daypart } from '../types/pcr';

/*
  Brand kit validators. Kept outside the page component so they can be
  unit-tested and reused by the Phase 2 report builder.
*/

const HEX_COLOUR_REGEX = /^#[0-9a-fA-F]{6}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;

export function isValidHexColour(value: string): boolean {
  return HEX_COLOUR_REGEX.test(value);
}

/** 'HH:MM' 24-hour. '24:00' is accepted so a daypart can end at midnight. */
export function isValidTime(value: string): boolean {
  return TIME_REGEX.test(value);
}

export function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

/** Name used when a local time falls outside every configured daypart. */
export const UNASSIGNED_DAYPART = 'Unassigned';

/**
 * Assign a station-local 'HH:MM' time to a daypart by name. A time belongs to
 * the window [start, end); an end of '24:00' means midnight (1440). Dayparts
 * do not wrap past midnight (Nova's late windows are 22:00-24:00 and
 * 00:00-05:30 as two separate rows), so no wrap handling is needed. Returns
 * UNASSIGNED_DAYPART if the time matches no window or is malformed.
 */
export function assignDaypart(localHHMM: string, dayparts: Daypart[]): string {
  if (!isValidTime(localHHMM) || localHHMM === '24:00') {
    return UNASSIGNED_DAYPART;
  }
  const minutes = timeToMinutes(localHHMM);
  for (const d of dayparts) {
    if (!isValidTime(d.start) || !isValidTime(d.end)) {
      continue;
    }
    const start = timeToMinutes(d.start);
    const end = timeToMinutes(d.end); // '24:00' -> 1440
    if (minutes >= start && minutes < end) {
      return d.name;
    }
  }
  return UNASSIGNED_DAYPART;
}

export interface DaypartValidation {
  /** Row-level messages keyed by row index. */
  rowErrors: Record<number, string>;
  /** Set-level messages (overlaps, empty set). */
  globalErrors: string[];
  isValid: boolean;
}

export function validateDayparts(dayparts: Daypart[]): DaypartValidation {
  const rowErrors: Record<number, string> = {};
  const globalErrors: string[] = [];

  if (dayparts.length === 0) {
    globalErrors.push('At least one daypart is required.');
  }

  dayparts.forEach((d, i) => {
    if (d.name.trim() === '') {
      rowErrors[i] = 'Name is required.';
      return;
    }
    if (!isValidTime(d.start)) {
      rowErrors[i] = 'Start must be HH:MM (24h).';
      return;
    }
    if (!isValidTime(d.end)) {
      rowErrors[i] = 'End must be HH:MM (24h), 24:00 allowed.';
      return;
    }
    if (d.start === '24:00') {
      rowErrors[i] = 'Start cannot be 24:00.';
      return;
    }
    if (timeToMinutes(d.end) <= timeToMinutes(d.start)) {
      rowErrors[i] = 'End must be after start.';
    }
  });

  // Overlap check only across rows that are individually valid.
  const valid = dayparts
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => rowErrors[i] === undefined)
    .map(({ d, i }) => ({ i, name: d.name, start: timeToMinutes(d.start), end: timeToMinutes(d.end) }))
    .sort((a, b) => a.start - b.start);

  for (let k = 1; k < valid.length; k += 1) {
    const prev = valid[k - 1];
    const curr = valid[k];
    if (curr.start < prev.end) {
      globalErrors.push(`"${prev.name}" and "${curr.name}" overlap.`);
    }
  }

  return {
    rowErrors,
    globalErrors,
    isValid: Object.keys(rowErrors).length === 0 && globalErrors.length === 0,
  };
}
