const mongoose = require('mongoose');
const Habit = require('../models/habit.model');
const HabitCompletion = require('../models/habitCompletion.model');
const {
    SERVER_TIMEZONE,
    toLocalDayKey,
    fromLocalDayKey,
    addLocalDays,
    todayLocalKey,
} = require('../utils/dates');

/*
 * Habit analytics: current streak, longest streak, completion rate.
 *
 * R-HAB-1 is the whole reason this is not the task streak with the roles swapped: a habit
 * streak counts consecutive *scheduled* occurrences met, not consecutive calendar days.
 * A habit set to three times a week has seven days in which it can be done and only needs
 * three, so a missed Monday does not break it (R-HAB-2). Counting calendar days would
 * make that habit unbreakable only by luck.
 *
 * The unit therefore depends on the cadence:
 *
 *   daily   — one day counts when completions that day reach the target
 *   weekly  — one week counts when completions in it reach the target
 *   monthly — one month counts when completions in it reach the target
 *
 * The same functions are pure over a list of completion day keys, so every rule is
 * testable without a database.
 */

const MAX_DAYS_TO_SCAN = 400;

// The first day of the week. ISO weeks start on Monday, which is also what a planner
// view shows, so the two agree on where a week begins.
const WEEK_START_OFFSET = 1;

const weekStartKey = (dayKey) => {
    const date = fromLocalDayKey(dayKey);

    if (!date) return dayKey;

    const sinceMonday = (date.getDay() - WEEK_START_OFFSET + 7) % 7;

    return toLocalDayKey(addLocalDays(date, -sinceMonday));
};

const monthKey = (dayKey) => String(dayKey).slice(0, 7);

/*
 * The key identifying the period a day belongs to.
 *
 * Weekly periods are keyed by the Monday they start on rather than by an ISO week number,
 * so the key is a date the rest of the code can step backwards through without needing a
 * calendar library.
 */
const periodKeyFor = (dayKey, cadence) => {
    if (cadence === 'weekly') return weekStartKey(dayKey);
    if (cadence === 'monthly') return monthKey(dayKey);
    return dayKey;
};

const previousPeriodKey = (key, cadence) => {
    if (cadence === 'weekly') return toLocalDayKey(addLocalDays(fromLocalDayKey(key), -7));

    /*
     * Returns a *month* key, not a day key. Getting this wrong leaves the walk looking up
     * '2026-09-01' in a map keyed by '2026-09', which never matches — so a monthly habit
     * would silently report a streak of one forever.
     */
    if (cadence === 'monthly') {
        const [year, month] = String(key).split('-').map(Number);
        const previous = new Date(year, month - 2, 1);

        return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
    }

    return toLocalDayKey(addLocalDays(fromLocalDayKey(key), -1));
};

const currentPeriodKey = (cadence, todayKey) => periodKeyFor(todayKey, cadence);

// Completions bucketed by the period they fall in.
const countByPeriod = (dayKeys, cadence) => {
    const counts = new Map();

    for (const dayKey of dayKeys) {
        const key = periodKeyFor(dayKey, cadence);

        counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return counts;
};

/*
 * Streak of consecutive periods in which the target was met.
 *
 * A period that has not finished yet gets a grace: if it has not yet reached the target,
 * the streak continues from the previous period rather than breaking, because there is
 * still time left in which to meet it. Breaking now would mean a habit is always "broken"
 * at the start of the day.
 */
const computeStreak = (dayKeys, cadence, target, todayKey) => {
    const counts = countByPeriod(dayKeys, cadence);
    const current = currentPeriodKey(cadence, todayKey);
    const previous = previousPeriodKey(current, cadence);

    const met = (key) => (counts.get(key) ?? 0) >= target;

    const start = met(current) ? current : previous;

    if (!met(start)) return 0;

    let streak = 0;
    let cursor = start;

    // Bounded by the number of distinct periods actually present in the data, so a bug in
    // the walk cannot loop forever.
    for (let guard = 0; guard < MAX_DAYS_TO_SCAN && met(cursor); guard += 1) {
        streak += 1;
        cursor = previousPeriodKey(cursor, cadence);
    }

    return streak;
};

const computeLongestStreak = (dayKeys, cadence, target) => {
    const counts = countByPeriod(dayKeys, cadence);

    if (counts.size === 0) return 0;

    let longest = 0;

    for (const start of counts.keys()) {
        let length = 0;
        let cursor = start;

        for (let guard = 0; guard < MAX_DAYS_TO_SCAN && (counts.get(cursor) ?? 0) >= target; guard += 1) {
            length += 1;
            cursor = previousPeriodKey(cursor, cadence);
        }

        if (length > longest) longest = length;
    }

    return longest;
};

/*
 * Share of periods, from today back to the earliest observed one, in which the target
 * was met.
 *
 * The window is defined by the data rather than by a fixed number of periods, so the
 * denominator is always "how long has this habit been tracked", and a missed day inside
 * that window scores as a miss. The current period is included even when it has nothing
 * done yet — it is still in progress, and scoring it as a miss would penalise the user
 * for the day not being over.
 *
 * An empty history is 0, never NaN (invariant I-7): `met / periods` over zero periods is
 * 0/0.
 */
const completionRate = (dayKeys, cadence, target, todayKey) => {
    const counts = countByPeriod(dayKeys, cadence);

    if (counts.size === 0) return 0;

    const current = currentPeriodKey(cadence, todayKey);

    // Period keys are lexicographically ordered — 'YYYY-MM-DD' for daily and weekly,
    // 'YYYY-MM' for monthly — so the earliest one is the smallest string.
    let earliest = current;

    for (const key of counts.keys()) {
        if (key < earliest) earliest = key;
    }

    let periods = 0;
    let met = 0;
    let cursor = current;

    while (cursor >= earliest) {
        periods += 1;

        if ((counts.get(cursor) ?? 0) >= target) met += 1;

        if (periods >= MAX_DAYS_TO_SCAN) break;

        cursor = previousPeriodKey(cursor, cadence);
    }

    return periods > 0 ? Math.round((met / periods) * 100) : 0;
};

const completionDays = async (habitId) => {
    const docs = await HabitCompletion.aggregate([
        { $match: { habitId: new mongoose.Types.ObjectId(String(habitId)) } },
        { $sort: { date: 1 } },
        { $limit: MAX_DAYS_TO_SCAN },
        {
            $project: {
                day: {
                    $dateToString: {
                        format: '%Y-%m-%d',
                        date: '$date',
                        timezone: SERVER_TIMEZONE,
                    },
                },
            },
        },
    ]);

    return docs.map((doc) => doc.day).filter(Boolean);
};

const summarise = async (habit, todayKey = todayLocalKey()) => {
    const days = await completionDays(habit._id);
    const { cadence, targetPerPeriod = 1 } = habit;

    return {
        currentStreak: computeStreak(days, cadence, targetPerPeriod, todayKey),
        longestStreak: computeLongestStreak(days, cadence, targetPerPeriod),
        completionRate: completionRate(days, cadence, targetPerPeriod, todayKey),
        completedCount: days.length,
    };
};

/*
 * Streaks for every live habit of a user, in one round trip each.
 *
 * Kept as N queries rather than an aggregation across habits because the per-habit
 * period logic is the same pure function either way, and a single pipeline that also
 * bucketed by cadence would duplicate it in MQL.
 */
const summariseAll = async (userId, todayKey = todayLocalKey()) => {
    const habits = await Habit.find({ userId, archivedAt: null }).lean();

    return Promise.all(
        habits.map(async (habit) => ({
            habit,
            ...(await summarise(habit, todayKey)),
        }))
    );
};

module.exports = {
    summarise,
    summariseAll,
    computeStreak,
    computeLongestStreak,
    completionRate,
    countByPeriod,
    periodKeyFor,
    weekStartKey,
};
