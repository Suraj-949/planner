const mongoose = require('mongoose');
const {
    GOAL_STATUSES,
    MAX_TITLE_LENGTH,
    MAX_DESCRIPTION_LENGTH,
} = require('../constants');

/*
 * A goal is the top of the Phase 2 hierarchy: Goal -> Milestone -> Project -> Task.
 *
 * There is no `progress` field. R-GOAL-1 derives it from the milestones that are
 * complete, so the number can never disagree with the milestones it was computed from.
 */
const goalSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        maxlength: MAX_TITLE_LENGTH,
    },
    description: {
        type: String,
        maxlength: MAX_DESCRIPTION_LENGTH,
    },
    // When the user expects to have reached the goal. Deliberately optional: a goal with
    // no date is a direction, not a commitment, and forcing one would be inventing intent.
    targetDate: {
        type: Date,
    },
    status: {
        type: String,
        enum: GOAL_STATUSES,
        default: 'active',
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
});

/*
 * The goal list is always scoped by user and filtered by status, so those lead the
 * compound index together. `targetDate` is indexed on its own for the "what is due next"
 * ordering; without it MongoDB would sort every goal in memory.
 */
goalSchema.index({ userId: 1 }, { background: true });
goalSchema.index({ userId: 1, status: 1 }, { background: true });
goalSchema.index({ userId: 1, targetDate: 1 }, { background: true });

module.exports = mongoose.model('Goal', goalSchema);