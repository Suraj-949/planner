const mongoose = require('mongoose');
const {
    HABIT_CADENCES,
    MAX_TITLE_LENGTH,
} = require('../constants');

/*
 * A habit is a repeated obligation with a target, e.g. "read 20 minutes, 5 days a week".
 *
 * The pair (cadence, targetPerPeriod) is what makes R-HAB-1 and R-HAB-2 expressible: a
 * streak counts consecutive *scheduled* occurrences met, so "3x per week" has to be
 * storable as intent rather than reconstructed afterwards from a list of dates.
 */
const habitSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        maxlength: MAX_TITLE_LENGTH,
    },
    cadence: {
        type: String,
        enum: HABIT_CADENCES,
        default: 'daily',
    },
    /*
     * How many times per `cadence` period counts as success. Defaults to 1 because "do
     * it every day" is the overwhelmingly common case and spelling it out is noise.
     *
     * Capped at 31 — the largest number of days a monthly period can contain. A larger
     * target on a daily or weekly cadence is unreachable by construction, so rejecting it
     * at the door is better than storing a habit that can never succeed.
     */
    targetPerPeriod: {
        type: Number,
        min: 1,
        max: 31,
        default: 1,
    },
    archivedAt: {
        type: Date,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
});

habitSchema.index({ userId: 1 }, { background: true });
habitSchema.index({ userId: 1, archivedAt: 1 }, { background: true });

module.exports = mongoose.model('Habit', habitSchema);