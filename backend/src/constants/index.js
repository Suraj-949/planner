/*
 * Shared enum and limit definitions.
 *
 * These values used to be written out twice — once as an `enum:` array in the Mongoose
 * schema and again as a `VALID_*` array in utils/taskValidation.js — with comments on
 * both sides holding them together by hand. Every model, validator and (later) service
 * imports from here instead, so adding an enum value is a one-line change that cannot
 * leave the schema and the validator disagreeing.
 *
 * Nothing in this file imports anything. Keep it dependency-free.
 */

// ---- Task ----------------------------------------------------------------

const TASK_STATUSES = ['pending', 'in-progress', 'completed'];
const TASK_PRIORITIES = ['high', 'medium', 'low'];

/*
 * The preset categories the UI offers. `category` itself is NOT enum-locked: the form has
 * a "Custom" option that stores whatever the user types, so the schema holds a bounded
 * free string and this list only drives the dropdown. Keeping it here means the form, the
 * filter bar and any future client read one shared list.
 */
const TASK_CATEGORIES = ['personal', 'learning', 'office-work', 'side hustle'];

// A category is a short label, not prose. One line in a dense row is all it ever gets.
const MAX_CATEGORY_LENGTH = 40;

// ---- Goal ----------------------------------------------------------------

/*
 * Progress is deliberately not a field. R-GOAL-1: a goal's progress is the percentage
 * of its *milestones* completed. Storing that number would create a second source of
 * truth that silently rots the moment a milestone is ticked, so it is derived on read
 * (guiding principle 2, "derive, never store").
 */
const GOAL_STATUSES = ['active', 'completed', 'abandoned'];

// ---- Recurrence ----------------------------------------------------------

/*
 * A custom object rather than an RRULE string. ROADMAP "Open Architecture Decisions":
 * an RRULE parser is a dependency, and the fraction of the spec real users need is
 * `FREQ`, `INTERVAL` and a weekly day list.
 */
const RECURRENCE_FREQUENCIES = ['daily', 'weekly', 'monthly'];

/*
 * 0 = Sunday, matching `Date.prototype.getDay`, so no translation layer is needed when
 * a recurrence is evaluated. Stored as numbers rather than 'mon'/'tue' strings because
 * the comparison is arithmetic.
 */
const RECURRENCE_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

// ---- Habit ---------------------------------------------------------------

/*
 * The period `targetPerPeriod` is counted over. R-HAB-2 needs this distinction: a
 * "3x per week" habit is not broken by a missed Monday, which is only expressible if
 * the cadence is stored rather than inferred from the completions.
 */
const HABIT_CADENCES = ['daily', 'weekly', 'monthly'];

// ---- Limits --------------------------------------------------------------

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_SUBTASK_TITLE_LENGTH = 200;

/*
 * A single task estimated beyond a day is data-entry error, not a real plan.
 * `actualMinutes` deliberately has no such cap beyond a generous ceiling: unlike an
 * estimate, logged time legitimately accumulates across sessions, and a task that took
 * three weeks should be able to say so.
 */
const MAX_ESTIMATE_MINUTES = 1440;
const MAX_ACTUAL_MINUTES = 1440 * 30;

const MAX_TAG_COUNT = 20;
const MAX_TAG_LENGTH = 50;
const MAX_SUBTASK_COUNT = 50;

/*
 * Notes are the one deliberately generous free-text field. They are written after the
 * fact and read as prose, so a tight cap would truncate a retrospective rather than
 * reject bad input.
 */
const MAX_NOTES_LENGTH = 10000;

// "Every 400 days" is a typo, not a plan. One year is already generous.
const MAX_RECURRENCE_INTERVAL = 365;

module.exports = {
    TASK_STATUSES,
    TASK_CATEGORIES,
    TASK_PRIORITIES,
    GOAL_STATUSES,
    RECURRENCE_FREQUENCIES,
    RECURRENCE_WEEKDAYS,
    HABIT_CADENCES,
    MAX_TITLE_LENGTH,
    MAX_DESCRIPTION_LENGTH,
    MAX_SUBTASK_TITLE_LENGTH,
    MAX_CATEGORY_LENGTH,
    MAX_ESTIMATE_MINUTES,
    MAX_ACTUAL_MINUTES,
    MAX_TAG_COUNT,
    MAX_TAG_LENGTH,
    MAX_SUBTASK_COUNT,
    MAX_NOTES_LENGTH,
    MAX_RECURRENCE_INTERVAL,
};