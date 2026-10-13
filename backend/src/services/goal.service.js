const Goal = require('../models/goal.model');
const Milestone = require('../models/milestone.model');

/*
 * Goal progress.
 *
 * R-GOAL-1: a goal's progress is the percentage of its *milestones* that are complete.
 * There is no `progress` field on the schema, so this aggregation is the only place the
 * number exists — it cannot drift from the milestones it was computed from, which is the
 * whole point (guiding principle 2: derive, never store).
 */

/*
 * Empty goals read as 0%, not null and not NaN. A goal with no milestones is not 100%
 * complete — that would reward never planning it — and not undefined either, because a
 * progress bar with no value cannot render.
 */
const progressFor = async (goalId) => {
    const [total, completed] = await Promise.all([
        Milestone.countDocuments({ goalId }),
        Milestone.countDocuments({ goalId, completedAt: { $ne: null } }),
    ]);

    return {
        total,
        completed,
        percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
};

/*
 * Progress for a list of goals, using one grouped count rather than two queries per goal.
 *
 * A N+1 here is not a theoretical concern: a user with twenty goals would otherwise fire
 * forty queries on page load.
 */
const progressForMany = async (goalIds) => {
    const result = new Map(goalIds.map((id) => [String(id), { total: 0, completed: 0, percent: 0 }]));

    if (goalIds.length === 0) return result;

    const rows = await Milestone.aggregate([
        {
            $match: {
                goalId: { $in: goalIds },
            },
        },
        {
            $group: {
                _id: '$goalId',
                total: { $sum: 1 },
                completed: {
                    $sum: { $cond: [{ $ne: ['$completedAt', null] }, 1, 0] },
                },
            },
        },
    ]);

    for (const row of rows) {
        result.set(String(row._id), {
            total: row.total,
            completed: row.completed,
            percent: row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0,
        });
    }

    return result;
};

/*
 * A goal as the API returns it: the stored document plus its derived progress, in one
 * object, so a client never has to know the two come from different places.
 */
const withProgress = async (goal) => ({
    ...goal,
    progress: await progressFor(goal._id),
});

const withProgressFor = async (goals) => {
    const progress = await progressForMany(goals.map((goal) => goal._id));

    return goals.map((goal) => ({
        ...goal,
        progress: progress.get(String(goal._id)) ?? { total: 0, completed: 0, percent: 0 },
    }));
};

/*
 * Create, list, update and delete for goals. Kept in a service rather than the controller
 * so the same ownership rules apply wherever a goal is touched — including from the
 * milestone controller, which has to resolve a goal to check tenancy at all.
 */
module.exports = { progressFor, progressForMany, withProgress, withProgressFor, Goal };
