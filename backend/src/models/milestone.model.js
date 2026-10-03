const mongoose = require('mongoose');
const { MAX_TITLE_LENGTH } = require('../constants');

/*
 * A milestone is the unit R-GOAL-1 measures goal progress by, so it is the smallest thing
 * a user can tick as "done" on the way to a goal.
 *
 * Stored embedded-style: a milestone is always read together with the goal it belongs
 * to, so it gets its own collection rather than an array on Goal. Unlike Task subtasks
 * (which are embedded, per ROADMAP "Open Architecture Decisions") a milestone outlives
 * the goal view it was created in and is queried on its own `dueDate` for reminders.
 *
 * There is no `userId`. It is reached through `goalId`. That keeps one source of tenancy
 * truth — a milestone cannot disagree with its goal about who owns it — at the cost of a
 * lookup on every per-user query. If per-user milestone reads ever become hot enough to
 * measure, denormalise then, not before.
 */
const milestoneSchema = new mongoose.Schema({
    goalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Goal',
        required: true,
    },
    title: {
        type: String,
        required: true,
        maxlength: MAX_TITLE_LENGTH,
    },
    dueDate: {
        type: Date,
    },
    /*
     * Null until completed, then the instant it happened. A boolean `completed` would
     * lose the when, and the when is what makes a late milestone legible later.
     */
    completedAt: {
        type: Date,
    },
});

// Milestones are listed under their goal in due-date order, and progress counts the
// completed ones. Both queries lead with goalId.
milestoneSchema.index({ goalId: 1, dueDate: 1 }, { background: true });
milestoneSchema.index({ goalId: 1, completedAt: 1 }, { background: true });

module.exports = mongoose.model('Milestone', milestoneSchema);