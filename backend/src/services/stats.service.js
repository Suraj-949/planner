const mongoose = require('mongoose');
const Task = require('../models/task.model');
const { TASK_STATUSES } = require('../constants');
const { SERVER_TIMEZONE } = require('../utils/dates');

/*
 * Dashboard aggregates.
 *
 * Two invariants shape every function here (DOMAIN.md §4):
 *
 *  - I-7 — an empty dataset yields 0, never NaN, Infinity or null. A pipeline over an
 *    empty collection returns *no documents*, so the naive `docs[0].count` yields
 *    undefined and every rate built on it yields NaN. Each function therefore starts from
 *    a zeroed result object and fills it in.
 *
 *  - I-10 — statistics are always recomputable from source records. Nothing here reads a
 *    stored counter; every number is derived from the tasks themselves.
 */

// Only these three count towards the buckets (R-STAT-3). Anything else is excluded
// rather than silently treated as pending (R-STAT-4) — an out-of-enum status belonging to
// no bucket is an honest answer, and counting it as pending would quietly inflate that
// figure.
const COUNTED_STATUSES = TASK_STATUSES;

const emptyCounts = () =>
    Object.fromEntries([...COUNTED_STATUSES, 'total', 'overdue', 'completionRate'].map((key) => [key, 0]));

const roundRate = (completed, total) => (total > 0 ? Math.round((completed / total) * 100) : 0);

/*
 * Window filter. `from` / `to` bound the deadline, so "this month" means "due this month",
 * which is what the planning view asks. Left unset, the aggregate covers everything, which
 * is the lifetime figure the Phase 1 dashboard used to show unlabelled.
 */
const windowMatch = ({ from, to } = {}) => {
    if (!from && !to) return {};

    const deadline = {};

    if (from) deadline.$gte = from;
    if (to) deadline.$lte = to;

    return { deadline };
};

/*
 * Aggregates for one user, optionally narrowed by a deadline window and by hierarchy.
 *
 * `filter` carries extra match clauses (a project or a goal) so a project page's counts
 * come from the same derivation as the dashboard's rather than from a second
 * implementation that can disagree with it.
 */
const statsFor = async (userId, { from, to, filter } = {}) => {
    const match = {
        userId: new mongoose.Types.ObjectId(String(userId)),
        ...windowMatch({ from, to }),
        ...(filter ?? {}),
    };

    const [grouped, overdue] = await Promise.all([
        Task.aggregate([
            { $match: match },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        // Overdue is derived, never stored (DOMAIN §2): a deadline before today that is not
        // completed.
        Task.countDocuments({
            ...match,
            status: { $ne: 'completed' },
            deadline: { $lt: new Date() },
        }),
    ]);

    const counts = emptyCounts();

    for (const row of grouped) {
        if (!COUNTED_STATUSES.includes(row._id)) continue;

        counts[row._id] = row.count;
        counts.total += row.count;
    }

    counts.overdue = overdue;
    counts.completionRate = roundRate(counts.completed, counts.total);

    return counts;
};

const getStats = (userId, window) => statsFor(userId, window);

/*
 * Per-day completion counts over a window, for the streak and activity views.
 *
 * Bucketed by the same local day key the streak uses, so a bar chart and the streak number
 * can never disagree about which day a completion belongs to.
 */
const getCompletionSeries = async (userId, { from, to } = {}) => {
    const match = {
        userId: new mongoose.Types.ObjectId(String(userId)),
        completedAt: { $ne: null },
    };

    if (from || to) {
        match.completedAt = { ...match.completedAt, ...(from && { $gte: from }), ...(to && { $lte: to }) };
    }

    const docs = await Task.aggregate([
        { $match: match },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: '%Y-%m-%d',
                        date: '$completedAt',
                        timezone: SERVER_TIMEZONE,
                    },
                },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    return docs.map((doc) => ({ date: doc._id, count: doc.count }));
};

module.exports = { getStats, getCompletionSeries, roundRate };
