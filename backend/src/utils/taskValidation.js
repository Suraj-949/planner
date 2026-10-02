const { isValidObjectId } = require('mongoose');
const { badRequest } = require('./http');

const VALID_STATUSES = ['pending', 'in-progress', 'completed'];
const VALID_CATEGORIES = ['DSA', 'development', 'college', 'personal', 'work', 'other'];
const VALID_PRIORITIES = ['high', 'medium', 'low'];
const VALID_CONTEXTS = ['Planner Core', 'Obsidian UI', 'Strategy 2025', 'Infrastructure'];

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;

// A single task estimated beyond a day is data-entry error, not a real plan.
const MAX_ESTIMATE_MINUTES = 1440;
const MAX_TAG_COUNT = 20;
const MAX_TAG_LENGTH = 50;
const MAX_SUBTASK_COUNT = 50;
const MAX_SUBTASK_TITLE_LENGTH = 200;

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
        const raw = body.estimateMinutes;

        if (raw === null) {
            value.estimateMinutes = undefined;
        } else if (String(raw).trim() === '') {
            errors.push('Estimate must be a whole number of minutes');
        } else {
            const minutes = Number(raw);

            if (!Number.isInteger(minutes)) {
                errors.push('Estimate must be a whole number of minutes');
            } else if (minutes < 0 || minutes > MAX_ESTIMATE_MINUTES) {
                errors.push(`Estimate must be between 0 and ${MAX_ESTIMATE_MINUTES} minutes`);
            } else {
                value.estimateMinutes = minutes;
            }
        }
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
