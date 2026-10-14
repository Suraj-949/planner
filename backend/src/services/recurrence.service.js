const Task = require('../models/task.model');
const { logger } = require('../utils/logger');
const { atNoon, addLocalDays, addLocalMonths, toLocalDayKey } = require('../utils/dates');

/*
 * Recurrence: turning a completed task into its next occurrence.
 *
 * All date arithmetic is local-calendar based, through the same helpers the streak and the
 * habit cadence use. Deadlines are stored anchored at local noon (BUSINESS-LOGIC §3), so
 * adding milliseconds would drift across a DST transition and could hand the next
 * occurrence a different calendar day; whole-day arithmetic rebuilt from date parts
 * cannot. The result is pinned back to noon because `addLocalDays` deliberately preserves
 * whatever time of day it was given.
 */

/*
 * The next weekly occurrence strictly after `date`.
 *
 * `interval` is honoured as "every N weeks" only for the simple case of a single named
 * day; the UI never produces a multi-day rule with an interval above 1, and the semantics
 * of "every 2 weeks on Mon, Wed" depend on which week the pattern started in, which is
 * not recoverable from a deadline alone.
 */
const nextWeekly = (date, interval, daysOfWeek) => {
    const days = Array.isArray(daysOfWeek) && daysOfWeek.length ? [...daysOfWeek] : [date.getDay()];
    const sorted = days.sort((a, b) => a - b);

    for (let offset = 1; offset <= 7; offset += 1) {
        const candidate = addLocalDays(date, offset);

        if (sorted.includes(candidate.getDay())) return atNoon(candidate);
    }

    return atNoon(addLocalDays(date, 7));
};

/*
 * Advance a deadline by one period.
 *
 * Exported separately from the service so it can be unit-tested as pure date maths,
 * without a database.
 */
const advanceDeadline = (deadline, recurrence) => {
    const from = atNoon(deadline);

    if (!from || !recurrence) return null;

    const { freq, interval = 1, daysOfWeek } = recurrence;
    const step = Number.isInteger(interval) && interval > 0 ? interval : 1;

    if (freq === 'daily') return atNoon(addLocalDays(from, step));
    if (freq === 'weekly') return nextWeekly(from, step, daysOfWeek);
    if (freq === 'monthly') return atNoon(addLocalMonths(from, step));

    return null;
};

/*
 * Next deadline that is not already in the past (R-RECUR-2).
 *
 * A recurring task left unfinished for a month would otherwise spawn thirty overdue
 * copies. Missed occurrences collapse into a single instance with the next future date,
 * which is the behaviour the rule names: one task, not a backlog.
 */
const nextFutureDeadline = (deadline, recurrence, today = new Date()) => {
    let cursor = advanceDeadline(deadline, recurrence);

    if (!cursor) return null;

    /*
     * Compared as day keys rather than as instants. A deadline is stored at local noon,
     * so comparing it against `new Date()` — which is some later hour of the same day —
     * would push every "due today" occurrence out to tomorrow depending on what time the
     * request happened to arrive.
     *
     * A deadline of *today* is kept: it is not overdue, and the user still has the day in
     * which to do it.
     */
    const todayKey = toLocalDayKey(today);

    // Bounded so a rule that somehow fails to advance cannot spin.
    for (let guard = 0; toLocalDayKey(cursor) < todayKey && guard < 500; guard += 1) {
        cursor = advanceDeadline(cursor, recurrence);
    }

    return cursor;
};

const serialiseForModel = (task) => ({
    title: task.title,
    description: task.description,
    status: 'pending',
    deadline: task.deadline,
    userId: task.userId,
    category: task.category,
    priority: task.priority,
    projectId: task.projectId,
    goalId: task.goalId,
    recurrence: task.recurrence,
    estimateMinutes: task.estimateMinutes,
    tags: task.tags,
    /*
     * Notes and subtasks are deliberately not carried over. The next occurrence is a new
     * unit of work: notes describe what was done this time, and subtasks were completed
     * as part of finishing it. Copying them would silently re-open finished work.
     */
});

/*
 * Called when a recurring task completes: creates the next occurrence with an advanced
 * deadline.
 *
 * Returns the new task, or null when the task is not recurring or the rule cannot be
 * advanced. A failure here never fails the completion itself — the user asked to finish a
 * task, not to schedule one — so errors are logged and swallowed.
 */
const materialiseNextOccurrence = async (task) => {
    if (!task?.recurrence || !task?.userId) return null;

    const deadline = nextFutureDeadline(task.deadline, task.recurrence);

    if (!deadline) return null;

    try {
        return await Task.create({ ...serialiseForModel(task), deadline });
    } catch (error) {
        logger.error('Could not create the next occurrence of a recurring task', {
            taskId: String(task._id),
            error: error.message,
        });

        return null;
    }
};

module.exports = {
    advanceDeadline,
    nextFutureDeadline,
    materialiseNextOccurrence,
    addLocalDays,
    addLocalMonths,
};
