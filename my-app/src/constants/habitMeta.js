// Habit enums and labels.
//
// Mirrors backend/src/constants/index.js across the package boundary. `HABIT_CADENCES` and
// the target bounds must stay identical to the backend's, or a habit the API accepts would
// render unlabelled.

export const HABIT_CADENCES = ['daily', 'weekly', 'monthly']

export const HABIT_CADENCE_LABELS = {
    daily: 'Every day',
    weekly: 'Every week',
    monthly: 'Every month',
}

/*
 * The largest number of days a month can hold. Anything beyond it is unreachable on every
 * cadence, so the form stops it at the same bound the schema enforces — rejecting it in the
 * UI rather than letting the server be the one to say no.
 */
export const MAX_HABIT_TARGET = 31

// How the cadence is described next to the target, so "3 per week" reads as a sentence
// rather than as two unrelated fields.
export const CADENCE_SUFFIX = {
    daily: 'days',
    weekly: 'days per week',
    monthly: 'days per month',
}
