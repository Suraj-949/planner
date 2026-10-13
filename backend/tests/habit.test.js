const test = require('node:test');
const assert = require('node:assert/strict');

const {
    computeStreak,
    computeLongestStreak,
    completionRate,
    periodKeyFor,
    weekStartKey,
} = require('../src/services/habit.service');

/*
 * R-HAB-1 and R-HAB-2, in BUSINESS-LOGIC.md §4.
 *
 * R-HAB-1 is the reason this file is not a copy of the task streak with the roles
 * swapped: a habit streak counts consecutive *scheduled* occurrences met, not consecutive
 * calendar days. The cadence decides what a period is.
 */

/*
 * 2026-10-12 is a Monday, so the week under test runs Mon 12th to Sun 18th.
 */
const MON = '2026-10-12';
const TUE = '2026-10-13';
const WED = '2026-10-14';
const THU = '2026-10-15';
const FRI = '2026-10-16';
const SAT = '2026-10-17';
const PREV_MON = '2026-10-05';

test('a weekly period is keyed by the Monday it starts on', () => {
    assert.equal(weekStartKey(WED), MON);
    assert.equal(weekStartKey('2026-10-18'), MON);
    assert.equal(periodKeyFor(WED, 'weekly'), MON);
});

test('daily and monthly periods key differently from weekly', () => {
    assert.equal(periodKeyFor(WED, 'daily'), WED);
    assert.equal(periodKeyFor(WED, 'monthly'), '2026-10');
});

// ---- daily cadence -------------------------------------------------------

test('a daily habit with a target of one counts consecutive days', () => {
    assert.equal(computeStreak([MON, TUE, WED], 'daily', 1, WED), 3);
});

test('a daily habit with a target of two needs two completions in a day', () => {
    // One tick on Monday does not meet a target of two, so Monday is not a met period.
    assert.equal(computeStreak([MON, TUE, TUE], 'daily', 2, TUE), 1);
});

test('a daily habit is not broken at the start of a day that is not done yet', () => {
    // R-HAB-1's grace: today has no completion, but the day is not over, so the run
    // continues from yesterday rather than resetting to zero every morning.
    assert.equal(computeStreak([MON, TUE], 'daily', 1, WED), 2);
});

// ---- weekly cadence ------------------------------------------------------

/*
 * R-HAB-2 — a habit with cadence "3x per week" is not broken by a missed Monday.
 *
 * This is the case the whole cadence field exists to express. Counting calendar days
 * would mark the habit broken on Tuesday morning no matter what was done the rest of the
 * week.
 */
test('a 3x-per-week habit survives a missed Monday', () => {
    const days = [TUE, WED, THU];

    assert.equal(computeStreak(days, 'weekly', 3, THU), 1);
});

test('a 3x-per-week habit is not yet met with only two days done', () => {
    assert.equal(computeStreak([TUE, WED], 'weekly', 3, WED), 0);
});

test('two consecutive met weeks give a streak of two', () => {
    const days = [MON, TUE, WED, PREV_MON, '2026-10-06', '2026-10-07'];

    assert.equal(computeStreak(days, 'weekly', 3, WED), 2);
});

test('a broken week resets the weekly streak', () => {
    // Previous week met, current week has only one of three days so far — but the current
    // week is still in progress, so the streak carries on from the previous week.
    const days = [PREV_MON, '2026-10-06', '2026-10-07', WED];

    assert.equal(computeStreak(days, 'weekly', 3, WED), 1);
});

test('a fully missed week breaks a weekly streak', () => {
    // Two weeks back met, last week empty, this week met. The run restarts at one.
    const days = ['2026-09-28', '2026-09-29', '2026-09-30', WED, TUE, FRI];

    assert.equal(computeStreak(days, 'weekly', 3, FRI), 1);
});

// ---- monthly cadence -----------------------------------------------------

test('a monthly habit counts consecutive met months', () => {
    // Three completions in September and three in October, against a target of three.
    const days = ['2026-09-03', '2026-09-11', '2026-09-20', '2026-10-02', '2026-10-09', '2026-10-20'];

    assert.equal(computeStreak(days, 'monthly', 3, '2026-10-20'), 2);
});

test('an unmet month does not count', () => {
    assert.equal(computeStreak(['2026-10-03'], 'monthly', 3, '2026-10-03'), 0);
});

// ---- longest streak ------------------------------------------------------

test('longest streak finds the best run anywhere in the history', () => {
    // A five-week run, then a break, then a two-week run. The longest is five.
    const days = [];

    for (let week = 0; week < 5; week += 1) {
        const monday = new Date(2026, 7, 3 + week * 7);
        for (const offset of [0, 1, 2]) {
            const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset);
            days.push(
                `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
                    date.getDate()
                ).padStart(2, '0')}`
            );
        }
    }

    for (let week = 0; week < 2; week += 1) {
        const monday = new Date(2026, 8, 21 + week * 7);
        for (const offset of [0, 1, 2]) {
            const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset);
            days.push(
                `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
                    date.getDate()
                ).padStart(2, '0')}`
            );
        }
    }

    assert.equal(computeLongestStreak(days, 'weekly', 3), 5);
});

test('longest streak with no history is zero, never NaN', () => {
    assert.equal(computeLongestStreak([], 'weekly', 3), 0);
});

// ---- completion rate -----------------------------------------------------

test('completion rate with no history is zero, never NaN', () => {
    // Invariant I-7: an empty dataset yields 0. The naive `met / periods` over an empty
    // collection is 0/0, which is NaN and renders as a blank or a "%" with no number.
    assert.equal(completionRate([], 'daily', 1, WED), 0);
});

test('completion rate is the share of started periods that were met', () => {
    // Three consecutive days, all met, walked back three periods.
    assert.equal(completionRate([MON, TUE, WED], 'daily', 1, WED), 100);
});

test('a partially met window scores proportionally', () => {
    // Five days walked, two met.
    const rate = completionRate([MON, WED], 'daily', 1, FRI);

    assert.equal(rate, 40);
});

test('completion rate is an integer, not a repeating decimal', () => {
    // Two of the three days tracked: 66.666...%, rounded to 67 as R-STAT-1 requires.
    const rate = completionRate([MON, TUE], 'daily', 1, WED);

    assert.equal(rate, 67);
    assert.ok(Number.isInteger(rate));
});

test('the current period is scored even with nothing done yet', () => {
    // Today has no completion, but the day is not over, so it is a period in the window
    // rather than an ignored one.
    assert.equal(completionRate([MON, TUE, WED], 'daily', 1, THU), 75);
});

test('a monthly rate is computed from month keys, not day keys', () => {
    // Guards the bug where the monthly walk stepped to '2026-09-01' while the counts were
    // keyed '2026-09', so no month after the first ever matched.
    const days = ['2026-09-03', '2026-09-11', '2026-09-20', '2026-10-02', '2026-10-09', '2026-10-20'];

    assert.equal(computeStreak(days, 'monthly', 3, '2026-10-20'), 2);
    assert.equal(completionRate(days, 'monthly', 3, '2026-10-20'), 100);
});
