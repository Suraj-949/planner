const mongoose = require('mongoose');

/*
 * One row per habit per calendar day on which it was completed. Streaks are then a read
 * over these rows, never a counter that can drift out of step with reality.
 *
 * Stored as a collection rather than a counter or a bitmask on Habit: the moment a user
 * un-ticks a day, a counter needs decrementing logic that can be wrong, whereas deleting
 * the row is correct by construction.
 */
const habitCompletionSchema = new mongoose.Schema({
    habitId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Habit',
        required: true,
    },
    /*
     * A local calendar date, not an instant — see BUSINESS-LOGIC.md §3. The validator
     * anchors it to local noon using the same helper as a task deadline, so the stored
     * value renders as the same day in every timezone. The model itself does no coercion;
     * anchoring belongs to the validation layer, not the schema.
     */
    date: {
        type: Date,
        required: true,
    },
    /*
     * Denormalised from the habit so a streak query never has to join. The cost is that
     * it is a second place tenancy lives, which the service layer must keep in step when
     * a habit is reassigned or deleted.
     */
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
});

/*
 * The load-bearing index of the whole habits feature. Without it a habit ticked twice in
 * one day produces two rows, the streak counts both, and the number is quietly inflated.
 * A unique index makes the invariant the database's problem instead of the service's.
 *
 * The pair is habitId + date rather than habitId + userId + date because the habit
 * already identifies its owner.
 */
habitCompletionSchema.index({ habitId: 1, date: 1 }, { unique: true, background: true });

// Streak and calendar views read every completion for a user across a date range.
habitCompletionSchema.index({ userId: 1, date: -1 }, { background: true });

module.exports = mongoose.model('HabitCompletion', habitCompletionSchema);