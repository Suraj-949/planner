const { isValidObjectId } = require('mongoose');
const { badRequest } = require('./http');
const {
    TASK_STATUSES,
    TASK_CATEGORIES,
    TASK_PRIORITIES,
    TASK_CONTEXTS,
    RECURRENCE_FREQUENCIES,
    RECURRENCE_WEEKDAYS,
    MAX_TITLE_LENGTH,
    MAX_DESCRIPTION_LENGTH,
    MAX_SUBTASK_TITLE_LENGTH,
    MAX_ESTIMATE_MINUTES,
    MAX_ACTUAL_MINUTES,
    MAX_TAG_COUNT,
    MAX_TAG_LENGTH,
    MAX_SUBTASK_COUNT,
    MAX_NOTES_LENGTH,
    MAX_RECURRENCE_INTERVAL,
} = require('../constants');

// Aliases kept for the existing import sites. The values now live in src/constants, so
// the schema and this validator cannot drift; the old names stay as the public surface.
const VALID_STATUSES = TASK_STATUSES;
const VALID_CATEGORIES = TASK_CATEGORIES;
const VALID_PRIORITIES = TASK_PRIORITIES;
const VALID_CONTEXTS = TASK_CONTEXTS;

/*
 * A calendar date arrives from the client as "YYYY-MM-DD". `new Date(value)` parses that
 * as UTC midnight, which renders as the *previous* day for every user west of UTC — the
 * cause of tasks showing as overdue a day early. Constructing from parts keeps it a local
 * calendar date, matching how the user reads it. See BUSINESS-LOGIC.md §3.3.
 *
 * The time is pinned to local **noon**, not midnight. A deadline stored at local midnight
 * serialises to the previous evening in UTC-5 and the following morning in UTC+5:30, so the
 * same instant reads as a different calendar date depending on where it is rendered. Noon
 * is the furthest point from both day boundaries, so every real-world offset (max ±14h)
 * leaves the date intact.
 */
const DEADLINE_HOUR = 12;

function parseCalendarDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());

    if (!match) return null;

    const [, year, month, day] = match.map(Number);
    const parsed = new Date(year, month - 1, day, DEADLINE_HOUR, 0, 0, 0);

    // Rejects impossible dates like 2025-02-30, which Date would roll over silently.
    if (
        parsed.getFullYear() !== year ||
        parsed.getMonth() !== month - 1 ||
        parsed.getDate() !== day
    ) {
        return null;
    }

    return parsed;
}

function normaliseDeadline(deadline) {
    if (deadline === undefined || deadline === null || deadline === '') return undefined;

    const bare = parseCalendarDate(deadline);

    // A bare date is anchored at local noon; a full timestamp is the caller's explicit
    // choice of instant and is stored verbatim.
    if (bare) return bare;

    const withTime = new Date(deadline);

    if (Number.isNaN(withTime.getTime())) {
        return null;
    }

    return withTime;
}

/*
 * Durations are whole minutes. A raw `<input type="number">` can emit "45.5", and a
 * number that cannot be summed exactly is not a duration.
 *
 * Returns `{ value }`, `{ cleared: true }` for an explicit null, or `{ errors }`. `null`
 * clears the field; an absent key never reaches here, so a partial update leaves the
 * stored value alone.
 */
function normaliseMinutes(raw, { field, max }) {
    // `Number('')` is 0, so a blank field would otherwise be stored as a real zero.
    const isBlank = typeof raw !== 'number' && String(raw).trim() === '';

    if (raw === null) return { cleared: true };

    if (isBlank || typeof raw === 'boolean') {
        return { errors: [`${field} must be a whole number of minutes`] };
    }

    const minutes = Number(raw);

    if (!Number.isInteger(minutes)) {
        return { errors: [`${field} must be a whole number of minutes`] };
    }

    if (minutes < 0 || minutes > max) {
        return { errors: [`${field} must be between 0 and ${max} minutes`] };
    }

    return { value: minutes };
}

/*
 * A link to another document. `null` and the empty string both clear it — a form that
 * submits "" for "no selection" is normal, and rejecting it would make un-filing a task
 * impossible from the UI.
 */
function normaliseRef(raw, field) {
    if (raw === null || raw === '') return { cleared: true };

    if (!isValidObjectId(raw)) {
        return { errors: [`${field} must be a valid id`] };
    }

    return { value: String(raw) };
}

/*
 * Normalises a recurrence rule, keeping only the keys that apply to its frequency.
 *
 * A day list on a non-weekly rule is rejected rather than kept: the scheduler would never
 * read it, so storing it would leave the document asserting something false.
 */
function normaliseRecurrence(raw) {
    if (raw === null) return { cleared: true };

    if (typeof raw !== 'object' || Array.isArray(raw)) {
        return { errors: ['Recurrence must be an object'] };
    }

    const { freq, interval, daysOfWeek } = raw;
    const errors = [];

    if (!RECURRENCE_FREQUENCIES.includes(freq)) {
        errors.push(`Recurrence frequency must be one of: ${RECURRENCE_FREQUENCIES.join(', ')}`);
    }

    // Absent means every 1 period, which is also the schema default.
    const step = interval === undefined || interval === null ? 1 : Number(interval);

    if (!Number.isInteger(step) || step < 1 || step > MAX_RECURRENCE_INTERVAL) {
        errors.push(`Recurrence interval must be a whole number between 1 and ${MAX_RECURRENCE_INTERVAL}`);
    }

    let days;

    if (freq === 'weekly') {
        if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
            errors.push('A weekly recurrence must list at least one day');
        } else if (daysOfWeek.some((day) => !RECURRENCE_WEEKDAYS.includes(day))) {
            errors.push('Recurrence days must be numbers from 0 to 6, where 0 is Sunday');
        } else {
            // De-duplicated and sorted so "every Mon, Wed" and "every Wed, Mon, Mon" are
            // stored identically and compare equal.
            days = [...new Set(daysOfWeek)].sort((a, b) => a - b);
        }
    } else if (daysOfWeek !== undefined && daysOfWeek !== null) {
        errors.push('Only a weekly recurrence can specify daysOfWeek');
    }

    if (errors.length) return { errors };

    const value = { freq, interval: step };

    if (days) value.daysOfWeek = days;

    return { value };
}

/*
 * Validates and normalises a task payload. `partial` is used by the update route, where
 * an omitted field means "leave unchanged" rather than "clear the value" — which is why
 * the required-field checks only run on create.
 *
 * Returns `{ value, errors }`. `value` contains only known fields, so a client cannot
 * inject `userId` or `dateCreated` and reassign someone else's task.
 */
function validateTaskPayload(body, { partial = false } = {}) {
    const errors = [];
    const value = {};

    const has = (key) => body[key] !== undefined;

    if (!partial || has('title')) {
        const title = typeof body.title === 'string' ? body.title.trim() : '';

        if (!title) {
            errors.push('Title is required');
        } else if (title.length > MAX_TITLE_LENGTH) {
            errors.push(`Title must be at most ${MAX_TITLE_LENGTH} characters`);
        } else {
            value.title = title;
        }
    }

    if (has('description')) {
        const description =
            body.description === null ? undefined : String(body.description).trim();

        if (description && description.length > MAX_DESCRIPTION_LENGTH) {
            errors.push(`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
        } else {
            value.description = description;
        }
    }

    if (has('status')) {
        if (!VALID_STATUSES.includes(body.status)) {
            errors.push(`Status must be one of: ${VALID_STATUSES.join(', ')}`);
        } else {
            value.status = body.status;
        }
    }

    if (has('priority')) {
        if (!VALID_PRIORITIES.includes(body.priority)) {
            errors.push(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
        } else {
            value.priority = body.priority;
        }
    }

    if (has('category')) {
        if (!VALID_CATEGORIES.includes(body.category)) {
            errors.push(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`);
        } else {
            value.category = body.category;
        }
    }

    if (has('context')) {
        // No default: `category` falls back to 'other' because that value is a real choice,
        // whereas any project here would be a guess. An explicit null clears it.
        if (body.context === null) {
            value.context = undefined;
        } else if (!VALID_CONTEXTS.includes(body.context)) {
            errors.push(`Context must be one of: ${VALID_CONTEXTS.join(', ')}`);
        } else {
            value.context = body.context;
        }
    }

    /*
     * Stored as minutes, not "1h 30m". A stringified duration cannot be summed or sorted, so
     * the dashboard's "total time logged" footer would have to be assembled client-side.
     * `Number.isInteger` also rejects the fractional minutes a raw `<input type="number">`
     * can produce.
     */
    if (has('estimateMinutes')) {
        const result = normaliseMinutes(body.estimateMinutes, {
            field: 'Estimate',
            max: MAX_ESTIMATE_MINUTES,
        });

        if (result.errors) errors.push(...result.errors);
        else value.estimateMinutes = result.cleared ? undefined : result.value;
    }

    /*
     * Tags are trimmed, lowercased and de-duplicated so search matching does not depend on
     * how the user capitalised the keyword. Blanks are dropped rather than stored, which
     * keeps `"a,b,,"` from producing an empty tag that matches every search for "".
     */
    if (has('tags')) {
        if (!Array.isArray(body.tags)) {
            errors.push('Tags must be an array of strings');
        } else if (body.tags.length > MAX_TAG_COUNT) {
            errors.push(`A task can have at most ${MAX_TAG_COUNT} tags`);
        } else {
            const tags = [];
            let failed = false;

            for (const entry of body.tags) {
                if (typeof entry !== 'string') {
                    errors.push('Tags must be an array of strings');
                    failed = true;
                    break;
                }

                const tag = entry.trim().toLowerCase();

                if (!tag) continue;

                if (tag.length > MAX_TAG_LENGTH) {
                    errors.push(`Each tag must be at most ${MAX_TAG_LENGTH} characters`);
                    failed = true;
                    break;
                }

                if (!tags.includes(tag)) tags.push(tag);
            }

            if (!failed) value.tags = tags;
        }
    }

    /*
     * Accepts both `{ title, completed }` and a bare string, because the dashboard panel
     * holds checklist items as plain strings while the stored shape carries completion state.
     */
    if (has('subtasks')) {
        if (!Array.isArray(body.subtasks)) {
            errors.push('Subtasks must be an array');
        } else if (body.subtasks.length > MAX_SUBTASK_COUNT) {
            errors.push(`A task can have at most ${MAX_SUBTASK_COUNT} subtasks`);
        } else {
            const subtasks = [];
            let failed = false;

            for (const entry of body.subtasks) {
                const title = typeof entry === 'string'
                    ? entry.trim()
                    : String(entry?.title ?? '').trim();

                if (!title) {
                    errors.push('Subtask titles cannot be empty');
                    failed = true;
                    break;
                }

                if (title.length > MAX_SUBTASK_TITLE_LENGTH) {
                    errors.push(`Each subtask must be at most ${MAX_SUBTASK_TITLE_LENGTH} characters`);
                    failed = true;
                    break;
                }

                subtasks.push({ title, completed: Boolean(entry?.completed) });
            }

            if (!failed) value.subtasks = subtasks;
        }
    }

    /*
     * Hierarchy links. Both are checked for shape here; whether the referenced document
     * exists, and belongs to the same user, is the service layer's problem — a validator
     * that queried the database would turn every create into three round trips.
     */
    for (const field of ['projectId', 'goalId']) {
        if (!has(field)) continue;

        const label = field === 'projectId' ? 'Project' : 'Goal';
        const result = normaliseRef(body[field], label);

        if (result.errors) errors.push(...result.errors);
        else value[field] = result.cleared ? undefined : result.value;
    }

    if (has('recurrence')) {
        const result = normaliseRecurrence(body.recurrence);

        if (result.errors) errors.push(...result.errors);
        else value.recurrence = result.cleared ? undefined : result.value;
    }

    /*
     * Logged time, against the estimate above. Same rules and the same helper, so the two
     * can never disagree about what a valid duration is — only the ceiling differs, because
     * actual time accumulates across sessions while an estimate describes one sitting.
     */
    if (has('actualMinutes')) {
        const result = normaliseMinutes(body.actualMinutes, {
            field: 'Actual',
            max: MAX_ACTUAL_MINUTES,
        });

        if (result.errors) errors.push(...result.errors);
        else value.actualMinutes = result.cleared ? undefined : result.value;
    }

    if (has('notes')) {
        const notes = body.notes === null ? undefined : String(body.notes).trim();

        if (notes && notes.length > MAX_NOTES_LENGTH) {
            errors.push(`Notes must be at most ${MAX_NOTES_LENGTH} characters`);
        } else {
            value.notes = notes;
        }
    }

    // On create a missing deadline is an error; on update an omitted one means
    // "unchanged". `has()` alone covered neither, because a create with no deadline
    // never entered this branch at all.
    if (partial ? has('deadline') : true) {
        if (!body.deadline) {
            errors.push('Deadline is required');
        } else {
            const deadline = normaliseDeadline(body.deadline);

            if (deadline === null) {
                errors.push('Invalid deadline. Use YYYY-MM-DD or a valid ISO date.');
            } else {
                value.deadline = deadline;
            }
        }
    }

    return { value, errors };
}

const isValidTaskId = (id) => isValidObjectId(id);

module.exports = {
    VALID_STATUSES,
    VALID_CATEGORIES,
    VALID_PRIORITIES,
    VALID_CONTEXTS,
    MAX_ESTIMATE_MINUTES,
    MAX_ACTUAL_MINUTES,
    MAX_NOTES_LENGTH,
    MAX_RECURRENCE_INTERVAL,
    RECURRENCE_FREQUENCIES,
    MAX_TAG_COUNT,
    MAX_TAG_LENGTH,
    MAX_SUBTASK_COUNT,
    MAX_SUBTASK_TITLE_LENGTH,
    parseCalendarDate,
    normaliseDeadline,
    validateTaskPayload,
    isValidTaskId,
    badRequest,
};
