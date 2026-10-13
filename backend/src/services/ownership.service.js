const Goal = require('../models/goal.model');
const Project = require('../models/project.model');
const Habit = require('../models/habit.model');
const HabitCompletion = require('../models/habitCompletion.model');
const Milestone = require('../models/milestone.model');
const { notFound } = require('../utils/http');

/*
 * Per-user ownership guards.
 *
 * Every Phase 2 query is scoped by `userId` at the point it hits the database, so an
 * attacker holding a valid id for someone else's goal gets a 404 rather than a 403 — the
 * resource is treated as not existing, which does not confirm the id was real.
 *
 * Written once, here, rather than re-derived in each controller: a hand-rolled
 * `findOne({ _id, userId })` per endpoint is exactly the pattern that gets copied with one
 * field missing, and the missing field is always the one that matters.
 */

const assertOwned = async (Model, id, userId, label) => {
    const doc = await Model.findOne({ _id: id, userId }).lean();

    if (!doc) throw notFound(`${label} not found`);

    return doc;
};

/*
 * Milestones have no `userId` of their own — they inherit it from the goal (see the model
 * comment). Any milestone operation therefore has to resolve the goal first, which is also
 * the only way to prove the caller may touch the milestone at all.
 */
const assertOwnedGoal = (goalId, userId) => assertOwned(Goal, goalId, userId, 'Goal');
const assertOwnedProject = (projectId, userId) => assertOwned(Project, projectId, userId, 'Project');
const assertOwnedHabit = (habitId, userId) => assertOwned(Habit, habitId, userId, 'Habit');

const assertOwnedMilestone = async (milestoneId, userId) => {
    const milestone = await Milestone.findById(milestoneId).lean();

    if (!milestone) throw notFound('Milestone not found');

    // Resolves the goal, and with it the ownership check, in the same call.
    await assertOwnedGoal(milestone.goalId, userId);

    return milestone;
};

/*
 * Deletes a habit's completion rows as part of deleting the habit itself.
 *
 * `habitCompletion` denormalises `userId` precisely so this cascade does not have to
 * scan every completion of every habit to find the ones to drop.
 */
const deleteHabitData = async (habitId, userId) => {
    await Promise.all([
        Habit.deleteOne({ _id: habitId, userId }),
        HabitCompletion.deleteMany({ habitId, userId }),
    ]);
};

/*
 * Deletes a goal's milestones as part of deleting the goal.
 *
 * Deliberately *not* cascading to tasks. A task linked to a goal is still real work, and
 * deleting a goal the user finished would silently erase the tasks that remain open under
 * it. They are unlinked instead, which keeps the work and drops only the association.
 */
const deleteGoalData = async (goalId, userId) => {
    await Promise.all([
        Goal.deleteOne({ _id: goalId, userId }),
        Milestone.deleteMany({ goalId }),
    ]);
};

module.exports = {
    assertOwned,
    assertOwnedGoal,
    assertOwnedProject,
    assertOwnedHabit,
    assertOwnedMilestone,
    deleteHabitData,
    deleteGoalData,
};
