const { isValidObjectId } = require('mongoose');
const { parseCalendarDate } = require('./taskValidation');
const {
    GOAL_STATUSES,
    HABIT_CADENCES,
    MAX_TITLE_LENGTH,
    MAX_DESCRIPTION_LENGTH,
} = require('../constants');

/*
 * Validators for the Phase 2 domain entities: Goal, Milestone, Project, Habit.
 *
 * Deliberately shaped like `taskValidation.js`, and sharing its `parseCalendarDate`, so a
 * milestone due date is anchored at local noon exactly the way a task deadline is. Two
 * different helpers for the same job is how a bug ends up fixed in one and left in the
 * other.
 *
 * Like the task validator, these accept `{ value, errors }` and whitelist fields, so a
 * client cannot inject `userId`, `progress` or a completion counter through the body.
 */

// Habit.targetPerPeriod is capped at 31: the largest number of days a month can hold.
// Beyond that the target is unreachable on every cadence, and storing it would mean
// keeping a habit that can never succeed.
const MAX_HABIT_TARGET = 31;

const PROJECT_COLOUR = /^#[0-9a-fA-F]{6}$/;

/*
 * A calendar date that may be cleared.
 *
 * Unlike a task's deadline, these dates are all optional, so "absent" simply never calls
 * this and an explicit `null` or blank string is what clears a stored value.
 */
function normaliseDate(raw, field) {
    if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
        return { cleared: true };
    }

    const bare = parseCalendarDate(raw);

    if (bare) return { value: bare };

    const withTime = new Date(raw);

    if (Number.isNaN(withTime.getTime())) {
        return { errors: [`${field} is not a valid date`] };
    }

    return { value: withTime };
}

function normaliseRef(raw, field) {
    if (raw === null || raw === '') return { cleared: true };

    if (!isValidObjectId(raw)) {
        return { errors: [`${field} must be a valid id`] };
    }

    return { value: String(raw) };
}

function normaliseTitle(body, value, errors, { partial, field = 'title', label = 'Title' }) {
    if (partial && body[field] === undefined) return;

    const title = typeof body[field] === 'string' ? body[field].trim() : '';

    if (!title) {
        // On create a missing title is an error; on update it is how a client says
        // "unchanged", so a partial request never reaches this branch at all.
        errors.push(`${label} is required`);
        return;
    }

    if (title.length > MAX_TITLE_LENGTH) {
        errors.push(`${label} must be at most ${MAX_TITLE_LENGTH} characters`);
        return;
    }

    value[field] = title;
}

function normaliseDescription(body, value, errors) {
    if (body.description === undefined) return;

    const description = body.description === null ? undefined : String(body.description).trim();

    if (description && description.length > MAX_DESCRIPTION_LENGTH) {
        errors.push(`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
    } else {
        // The key is present with `undefined` so the controller can distinguish "clear it"
        // from "leave it alone" — the same split the task update handler relies on.
        value.description = description;
    }
}

function dateField(body, value, errors, key, label) {
    if (body[key] === undefined) return;

    const result = normaliseDate(body[key], label);

    if (result.errors) errors.push(...result.errors);
    else value[key] = result.cleared ? undefined : result.value;
}

function refField(body, value, errors, key, label) {
    if (body[key] === undefined) return;

    const result = normaliseRef(body[key], label);

    if (result.errors) errors.push(...result.errors);
    else value[key] = result.cleared ? undefined : result.value;
}

/*
 * Goal: title required; status optional, no default beyond the schema's — a goal the user
 * has not chosen a status for is 'active', not a guess about whether they finished it.
 */
function validateGoalPayload(body, { partial = false } = {}) {
    const errors = [];
    const value = {};

    normaliseTitle(body, value, errors, { partial });
    normaliseDescription(body, value, errors);
    dateField(body, value, errors, 'targetDate', 'Target date');

    if (body.status !== undefined) {
        if (!GOAL_STATUSES.includes(body.status)) {
            errors.push(`Status must be one of: ${GOAL_STATUSES.join(', ')}`);
        } else {
            value.status = body.status;
        }
    }

    return { value, errors };
}

/*
 * Milestone: always belongs to a goal. Milestones carry no `userId` of their own, so the
 * goal is the only tenancy anchor there is — which is why `goalId` is required on every
 * payload, including updates.
 */
function validateMilestonePayload(body, { partial = false } = {}) {
    const errors = [];
    const value = {};

    normaliseTitle(body, value, errors, { partial, label: 'Milestone title' });
    dateField(body, value, errors, 'dueDate', 'Due date');
    dateField(body, value, errors, 'completedAt', 'Completed at');

    /*
     * `goalId` is the milestone's only tenancy anchor, so it is required on create. On a
     * partial update it may be omitted (unchanged) or explicitly nulled, and only a
     * malformed value is an error.
     */
    if (!partial && !body.goalId) {
        errors.push('Goal is required');
    } else if (body.goalId !== undefined) {
        refField(body, value, errors, 'goalId', 'Goal');
    }

    return { value, errors };
}

/*
 * Project: colour is validated here rather than only by the schema, because the schema's
 * `match` surfaces as a ValidationError *after* the document is built, where the message
 * names the pattern rather than the field.
 */
function validateProjectPayload(body, { partial = false } = {}) {
    const errors = [];
    const value = {};

    normaliseTitle(body, value, errors, { partial });
    normaliseDescription(body, value, errors);

    if (body.color !== undefined) {
        if (body.color === null || body.color === '') {
            value.color = undefined;
        } else if (!PROJECT_COLOUR.test(String(body.color))) {
            errors.push('Color must be a six-digit hex value such as #4f46e5');
        } else {
            value.color = String(body.color);
        }
    }

    refField(body, value, errors, 'goalId', 'Goal');
    dateField(body, value, errors, 'archivedAt', 'Archived at');

    return { value, errors };
}

/*
 * Habit: the cadence/target pair drives every streak calculation, so a target that cannot
 * be met is rejected rather than stored.
 */
function validateHabitPayload(body, { partial = false } = {}) {
    const errors = [];
    const value = {};

    normaliseTitle(body, value, errors, { partial, label: 'Habit title' });

    if (body.cadence !== undefined) {
        if (!HABIT_CADENCES.includes(body.cadence)) {
            errors.push(`Cadence must be one of: ${HABIT_CADENCES.join(', ')}`);
        } else {
            value.cadence = body.cadence;
        }
    }

    if (body.targetPerPeriod !== undefined && body.targetPerPeriod !== null) {
        const target = Number(body.targetPerPeriod);

        if (!Number.isInteger(target) || target < 1 || target > MAX_HABIT_TARGET) {
            errors.push(`Target per period must be a whole number between 1 and ${MAX_HABIT_TARGET}`);
        } else {
            value.targetPerPeriod = target;
        }
    }

    dateField(body, value, errors, 'archivedAt', 'Archived at');

    return { value, errors };
}

/*
 * A habit tick. Anchored to local noon through the same helper as a task deadline, so the
 * unique index on (habitId, date) means "one tick per calendar day" rather than "one tick
 * per instant", which a timestamp would leave open to a double-submit.
 */
function validateHabitCompletionPayload(body) {
    const errors = [];
    const value = {};

    const result = normaliseDate(body.date, 'Date');

    if (result.errors) {
        errors.push(...result.errors);
    } else {
        // Defaults to today when omitted, which is what every habit page submits anyway.
        value.date = result.value ?? parseCalendarDate(new Date().toISOString().slice(0, 10));
    }

    // Checked before refField so a missing habit reports "required" rather than "invalid
    // id" — the same split the task validator uses.
    if (!body.habitId) {
        errors.push('Habit is required');
    } else {
        refField(body, value, errors, 'habitId', 'Habit');
    }

    return { value, errors };
}

const isValidEntityId = (id) => isValidObjectId(id);

module.exports = {
    MAX_HABIT_TARGET,
    normaliseDate,
    normaliseRef,
    validateGoalPayload,
    validateMilestonePayload,
    validateProjectPayload,
    validateHabitPayload,
    validateHabitCompletionPayload,
    isValidEntityId,
};
