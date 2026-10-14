const Task = require('../models/task.model');
const { asyncHandler, badRequest, notFound, buildUpdate } = require('../utils/http');
const { validateTaskPayload, isValidTaskId, parseCalendarDate } = require('../utils/taskValidation');
const { ok, created } = require('../utils/response');
const { materialiseNextOccurrence } = require('../services/recurrence.service');
const { getStats } = require('../services/stats.service');
const { getStreak, getLongestStreak } = require('../services/streak.service');

/*
 * Pagination bounds.
 *
 * Capped rather than trusted: a client asking for `limit=100000` would otherwise turn one
 * cheap query into a full collection scan that blocks the event loop while it serialises.
 */
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/*
 * Sortable fields, mapped to the column they order by.
 *
 * `priority` is deliberately absent. Its stored values are the strings 'high', 'medium'
 * and 'low', which sort alphabetically as high < low < medium — not by urgency. Offering
 * it would produce a list that looks sorted and is not. Ranking it properly needs an
 * aggregation with a `$switch`, which is not worth the cost on a list endpoint until
 * someone asks for it.
 */
const SORTABLE = {
    created: 'dateCreated',
    deadline: 'deadline',
    title: 'title',
};

// Escapes the user's search term before it is compiled, so a query containing "(" or "*"
// matches literally instead of throwing or matching everything.
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const createTask = asyncHandler(async (req, res) => {
    const { value, errors } = validateTaskPayload(req.body);

    if (errors.length > 0) {
        throw badRequest(errors[0], errors);
    }

    // userId comes from the verified token, never from the body — otherwise any caller
    // could create tasks against another account.
    const task = await Task.create({ ...value, userId: req.user });

    created(res, { message: 'Task created successfully', task });
});

/*
 * List tasks with filters, server-side search, sorting and pagination.
 *
 * Every one of these used to be done in the browser, which meant downloading the whole
 * collection before the first row could be shown. The filters and the search now narrow
 * the query itself, so the client receives only what it renders.
 */
const getTasks = asyncHandler(async (req, res) => {
    const filter = { userId: req.user };

    // Optional filters, applied server-side so the client never has to fetch everything
    // to narrow it down.
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.category) filter.category = req.query.category;

    // Hierarchy links, so a project or goal page can list only its own tasks without
    // pulling the rest of the collection over the wire.
    if (req.query.projectId) filter.projectId = String(req.query.projectId);
    if (req.query.goalId) filter.goalId = String(req.query.goalId);

    /*
     * Date window on the deadline. Deadlines are stored anchored at local noon, so the
     * bounds are used as given: `to=2026-10-14` means "due on or before the 14th", which
     * is what a user typing a date into a picker means.
     */
    const from = parseCalendarDate(req.query.from);
    const to = parseCalendarDate(req.query.to);

    if (from || to) {
        filter.deadline = {};
        if (from) filter.deadline.$gte = from;
        if (to) filter.deadline.$lte = to;
    }

    /*
     * Case-insensitive substring search across the fields a user actually types into.
     * Subtask titles and tags are included because "find the thing about the invoice" is
     * usually a note or a tag, not a title.
     */
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    if (query) {
        const pattern = new RegExp(escapeRegex(query), 'i');

        filter.$or = [
            { title: pattern },
            { description: pattern },
            { notes: pattern },
            { 'subtasks.title': pattern },
            { tags: pattern },
        ];
    }

    // Pagination. `Number.parseInt` on a missing or non-numeric value yields NaN, which
    // `||` turns back into the default — so the fallback covers both cases without a
    // separate check.
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = clamp(Number.parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);

    const sortKey = SORTABLE[req.query.sort] ?? 'dateCreated';
    // Ties broken by `_id` so paging is stable: without it, two tasks created in the same
    // millisecond can swap places between page 1 and page 2, and a row is skipped.
    const sortDirection = req.query.order === 'asc' ? 1 : -1;

    const [tasks, total] = await Promise.all([
        Task.find(filter)
            .sort({ [sortKey]: sortDirection, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Task.countDocuments(filter),
    ]);

    ok(res, 200, {
        message: 'Tasks fetched successfully',
        tasks,
        meta: {
            page,
            limit,
            total,
            pages: Math.max(1, Math.ceil(total / limit)),
        },
    });
});

/*
 * A single task.
 *
 * The list endpoint cannot serve this: it paginates, so a task that has fallen off the
 * current page has no way to be reached by id, and the detail view is where a user lands
 * from a deep link or a search result.
 */
const getTask = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidTaskId(id)) {
        throw notFound('Task not found');
    }

    // Scoped by userId, so a valid id belonging to someone else is a 404 rather than a
    // 403 — the resource is treated as not existing, which does not confirm the id was real.
    const task = await Task.findOne({ _id: id, userId: req.user }).lean();

    if (!task) {
        throw notFound('Task not found');
    }

    ok(res, 200, { message: 'Task fetched successfully', task });
});

const updateTask = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidTaskId(id)) {
        throw notFound('Task not found');
    }

    const { value, errors } = validateTaskPayload(req.body, { partial: true });

    if (errors.length > 0) {
        throw badRequest(errors[0], errors);
    }

    if (Object.keys(value).length === 0) {
        throw badRequest('No valid fields provided to update');
    }

    /*
     * Stamp the first transition into `completed`, which is what the server-side streak
     * counts (R-STREAK-1 / R-STREAK-2).
     *
     * Needs the previous status, which a returning-'after' update cannot supply, so the
     * row is read first. It is only written when the task was not already completed:
     * re-saving a completed task must not move the day it was finished, or the streak
     * would rewrite its own history every time someone saved a form.
     *
     * `buildUpdate` below handles the $set/$unset split, so an explicit clear still
     * reaches Mongo as an unset rather than being dropped.
     */
    let justCompleted = false;

    if (value.status === 'completed') {
        const current = await Task.findOne({ _id: id, userId: req.user })
            .select('status completedAt')
            .lean();

        if (!current) {
            throw notFound('Task not found');
        }

        justCompleted = current.status !== 'completed';

        if (justCompleted && !current.completedAt) {
            value.completedAt = new Date();
        }
    }

    // returnDocument was missing, so the *pre*-update document was sent back and the
    // client rendered stale data. runValidators was also missing, which let an
    // out-of-enum value be written straight to Mongo.
    const task = await Task.findOneAndUpdate(
        { _id: id, userId: req.user },
        buildUpdate(value),
        { returnDocument: 'after', runValidators: true }
    );

    if (!task) {
        throw notFound('Task not found');
    }

    /*
     * A recurring task, just completed, produces its next occurrence (R-RECUR-1).
     *
     * Deliberately after the update has already succeeded. Scheduling the next task is a
     * convenience; finishing this one is what the user asked for, and a failure to create
     * the successor must not roll back a completion that already happened.
     */
    const nextTask = justCompleted ? await materialiseNextOccurrence(task) : null;

    ok(res, 200, {
        message: 'Task updated successfully',
        task,
        ...(nextTask ? { nextTask } : {}),
    });
});

const deleteTask = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidTaskId(id)) {
        throw notFound('Task not found');
    }

    const task = await Task.findOneAndDelete({ _id: id, userId: req.user });

    if (!task) {
        throw notFound('Task not found');
    }

    ok(res, 200, { message: 'Task deleted successfully', task });
});

/*
 * Dashboard aggregates.
 *
 * Scoping to a project or goal keeps the same "one number, derived from source records"
 * contract as the unfiltered view, so a project page's counts cannot disagree with the
 * dashboard's.
 */
const getTaskStats = asyncHandler(async (req, res) => {
    // Only the hierarchy clauses are passed through; `userId` is applied by the service
    // itself, so it cannot be overridden from the query string.
    const filter = {};

    if (req.query.projectId) filter.projectId = String(req.query.projectId);
    if (req.query.goalId) filter.goalId = String(req.query.goalId);

    const from = parseCalendarDate(req.query.from);
    const to = parseCalendarDate(req.query.to);

    const stats = await getStats(req.user, {
        ...(from && { from }),
        ...(to && { to }),
        ...(Object.keys(filter).length > 0 && { filter }),
    });

    ok(res, 200, { message: 'Stats fetched successfully', stats });
});

/*
 * The streak, now computed from the database rather than localStorage.
 *
 * The stored counter violated R-STREAK-7 outright: it was not scoped to a user, so two
 * people sharing a browser inherited each other's streak and it survived logout. It also
 * could not be recomputed, which is what invariant I-10 requires of every statistic.
 */
const getTaskStreak = asyncHandler(async (req, res) => {
    const [streak, longestStreak] = await Promise.all([
        getStreak(req.user),
        getLongestStreak(req.user),
    ]);

    ok(res, 200, { message: 'Streak fetched successfully', streak, longestStreak });
});

module.exports = {
    createTask,
    getTask,
    getTasks,
    updateTask,
    deleteTask,
    getTaskStats,
    getTaskStreak,
};
