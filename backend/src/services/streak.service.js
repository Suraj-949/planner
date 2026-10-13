const mongoose = require('mongoose');
const Task = require('../models/task.model');
const {
    SERVER_TIMEZONE,
    toLocalDayKey,
    fromLocalDayKey,
    addLocalDays,
    todayLocalKey,
} = require('../utils/dates');

/*
 * Server-side streak, per user, derived from the database.
 *
 * Replaces the localStorage counter, which violated R-STREAK-7 outright: it was not scoped
 * to a user, so two people sharing a browser inherited each other's streak, and it
 * survived logout. It also could not be recomputed — BUSINESS-LOGIC's invariant I-10 says
 * statistics must always be reconstructible from source records, and a number in
 * localStorage is not reconstructible from anything.
 *
 * The source record is `Task.completedAt`, stamped once on the first transition into
 * `completed` and never cleared, so reopening a task does not erase the day it was
 * finished (R-STREAK-8).
 */

// How far back to read when rebuilding a streak. A year of unbroken activity is 365 days;
// past that the loop stops regardless, so this is a cost bound rather than a correctness
// one.
const MAX_DAYS_TO_SCAN = 400;

/*
 * Distinct local calendar days on which the user completed at least one task, newest
 * first.
 *
 * Grouped in the database rather than pulled as raw timestamps: R-STREAK-3 says a day
 * counts once no matter how many tasks were finished in it, so the de-duplication is the
 * point of the query, not a step performed afterwards.
 *
 * `$dateToString` needs an explicit timezone or it buckets in UTC, which would put a
 * 6pm completion in the wrong day for anyone east of UTC.
 */
const completionDays = async (userId) => {
    const docs = await Task.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(String(userId)),
                completedAt: { $ne: null },
            },
        },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: '%Y-%m-%d',
                        date: '$completedAt',
                        timezone: SERVER_TIMEZONE,
                    },
                },
            },
        },
        { $sort: { _id: -1 } },
        { $limit: MAX_DAYS_TO_SCAN },
    ]);

    return docs.map((doc) => doc._id).filter(Boolean);
};

/*
 * Walk a set of completed day keys backwards from `todayKey`.
 *
 * Pure, so the whole rule set — including the awkward cases — is testable without a
 * database.
 *
 *  - Nothing completed today is allowed, so the walk starts from yesterday (R-STREAK-4).
 *  - A gap of two or more days resets to whatever the most recent run is, not to zero
 *    (R-STREAK-5): a streak measures the current run, and the fact that it previously
 *    reached 20 is history, not part of the number.
 *  - The walk only ever moves backwards through days that are known to be completed, so a
 *    negative gap cannot occur — R-STREAK-6 is satisfied by construction rather than by a
 *    clamp.
 */
const computeStreak = (dayKeys, todayKey) => {
    if (!Array.isArray(dayKeys) || dayKeys.length === 0) return 0;

    const completed = new Set(dayKeys);

    let cursor = completed.has(todayKey) ? todayKey : addLocalDays(fromLocalDayKey(todayKey), -1);

    // Rendered back to a key rather than kept as a Date, so the set membership test stays
    // a string comparison and DST cannot insert a day between two that look consecutive.
    cursor = toLocalDayKey(cursor);

    if (!completed.has(cursor)) return 0;

    let streak = 0;

    while (completed.has(cursor)) {
        streak += 1;
        cursor = toLocalDayKey(addLocalDays(fromLocalDayKey(cursor), -1));
    }

    return streak;
};

/*
 * Current streak for a user.
 *
 * `todayKey` is injectable so tests are not hostage to the clock, and so a request that
 * spans midnight cannot compute against two different "todays".
 */
const getStreak = async (userId, todayKey = todayLocalKey()) => {
    if (!userId) return 0;

    const days = await completionDays(userId);

    return computeStreak(days, todayKey);
};

/*
 * Longest consecutive run in the scanned history.
 *
 * Computed from the same day list as the current streak so the two can never disagree
 * about which days count.
 */
const getLongestStreak = async (userId) => {
    if (!userId) return 0;

    const days = await completionDays(userId);

    if (days.length === 0) return 0;

    // `completionDays` returns newest-first, so consecutive runs are found by walking the
    // list and comparing each day against the one before it.
    const completed = new Set(days);
    let longest = 0;

    for (const dayKey of days) {
        if (longest >= completed.size) break;

        let length = 1;
        let cursor = toLocalDayKey(addLocalDays(fromLocalDayKey(dayKey), -1));

        while (completed.has(cursor)) {
            length += 1;
            cursor = toLocalDayKey(addLocalDays(fromLocalDayKey(cursor), -1));
        }

        if (length > longest) longest = length;
    }

    return longest;
};

module.exports = { getStreak, getLongestStreak, computeStreak, completionDays };
