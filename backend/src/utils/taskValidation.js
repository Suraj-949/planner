const { isValidObjectId } = require('mongoose');
const { badRequest } = require('./http');

const VALID_STATUSES = ['pending', 'in-progress', 'completed'];
const VALID_CATEGORIES = ['DSA', 'development', 'college', 'personal', 'work', 'other'];
const VALID_PRIORITIES = ['high', 'medium', 'low'];

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;

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
    parseCalendarDate,
    normaliseDeadline,
    validateTaskPayload,
    isValidTaskId,
    badRequest,
};
