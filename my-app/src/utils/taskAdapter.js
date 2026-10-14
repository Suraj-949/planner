// Translates a Task document from the API into the shape the dashboard renders.
//
// The dashboard predates the backend and was built against a design reference, so it expects
// presentation-ready values: a pre-formatted "Today, 5:00 PM" label, a whole-day offset, and
// "1h 30m". The API returns raw data instead: an ISO timestamp, and a duration in minutes.
//
// The conversion lives here rather than in the components so that TaskRow, TaskList and the
// detail view all read one shape, and so a task arriving from any endpoint (list, detail,
// stats-adjacent refetch) is mapped the same way.

import { daysBetween, startOfLocalDay, MONTHS } from './dates';

// Seconds are dropped: a task estimated in whole minutes (R-TASK-13) has none to show, and a
// countdown showing ":47" would imply a precision the data does not have.
export const formatEstimate = (minutes) => {
    const total = Number(minutes);

    if (!Number.isFinite(total) || total <= 0) return '0m';

    const hours = Math.floor(total / 60);
    const rest = total % 60;

    if (!hours) return `${rest}m`;
    if (!rest) return `${hours}h`;

    return `${hours}h ${String(rest).padStart(2, '0')}m`;
};

export const estimateToMinutes = (value) => {
    const total = Number(value);

    return Number.isFinite(total) && total > 0 ? Math.round(total) : 0;
};

/*
 * Inverse of formatEstimate, for the create panel, whose estimate input is free text.
 *
 * The field is not typed as a number because the dashboard shows it as "1h 30m". Parsing
 * accepts a bare number ("90") and both unit forms ("90m", "1h 30m", "1h"), and unparseable
 * text becomes 0 rather than NaN — the API rejects a non-integer, so NaN would surface as an
 * opaque 400 instead of an honest zero.
 */
export const parseEstimate = (value) => {
    if (typeof value === 'number') return estimateToMinutes(value);

    const text = String(value ?? '').trim();

    if (!text) return 0;

    if (/^\d+(\.\d+)?$/.test(text)) return estimateToMinutes(Number(text));

    const hours = /(\d+(?:\.\d+)?)\s*h/i.exec(text);
    const minutes = /(\d+(?:\.\d+)?)\s*m/i.exec(text);

    if (!hours && !minutes) return 0;

    return Math.round(
        (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0)
    );
};

// Whole local days from today. Negative is overdue, 0 is today.
// daysBetween rounds rather than dividing, so a 23- or 25-hour DST day still lands correctly.
export const toDayOffset = (deadline) => {
    const diff = daysBetween(new Date(), deadline);

    return diff === null ? 0 : diff;
};

/*
 * Due label, relative where that reads naturally and absolute otherwise.
 *
 * `ref` is injectable so the format can be tested against a fixed date instead of drifting
 * with the clock; it defaults to the real today.
 */
export const formatDue = (deadline, ref = new Date()) => {
    const start = startOfLocalDay(deadline);

    if (!start) return 'No date';

    const today = startOfLocalDay(ref);
    const diff = daysBetween(today, start);

    if (diff === null) return 'No date';
    if (diff < 0) return `${MONTHS[start.getMonth()]} ${start.getDate()}`;

    const time = new Date(deadline);
    const clock = `${time.getHours() % 12 || 12}:${String(time.getMinutes()).padStart(2, '0')}`;

    if (diff === 0) return `Today, ${clock} ${time.getHours() < 12 ? 'AM' : 'PM'}`;
    if (diff === 1) return 'Tomorrow';

    return `${MONTHS[start.getMonth()]} ${start.getDate()}`;
};

export const sumEstimates = (tasks) =>
    tasks.reduce((total, task) => total + estimateToMinutes(task.estimateMinutes), 0);

export const formatTotal = (tasks) => formatEstimate(sumEstimates(tasks));

/*
 * Id comparison that tolerates either the raw `_id` or the mapped `id`.
 *
 * Tasks arrive as `{ _id }` from the API and as `{ id }` once mapped, so every toggle,
 * edit and delete compares through here rather than with `===` against one shape.
 */
export const matchTaskId = (task, id) => String(task.id ?? task._id) === String(id);

export const toViewTask = (task) => ({
    id: task._id ?? task.id,
    title: task.title,
    category: task.category ?? '',
    estimate: formatEstimate(task.estimateMinutes),
    estimateMinutes: estimateToMinutes(task.estimateMinutes),
    priority: task.priority,
    status: task.status,
    due: formatDue(task.deadline),
    dayOffset: toDayOffset(task.deadline),
    tags: task.tags ?? [],
    subtasks: task.subtasks ?? [],

    // Kept raw alongside the presentation fields above so the edit form can repopulate
    // itself without re-fetching: dropping them here made a round-trip through the API
    // the only way to open an existing task, and silently blanked every field the
    // dashboard does not render.
    description: task.description ?? '',
    notes: task.notes ?? '',
    deadline: task.deadline ?? null,
    actualMinutes: task.actualMinutes ?? null,
    recurrence: task.recurrence ?? null,
    projectId: task.projectId ?? null,
    goalId: task.goalId ?? null,
});

export const toViewTasks = (tasks) => (Array.isArray(tasks) ? tasks : []).map(toViewTask);