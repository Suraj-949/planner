const test = require('node:test');
const assert = require('node:assert/strict');

const { computeStreak } = require('../src/services/streak.service');

/*
 * The rules under test are R-STREAK-1 to R-STREAK-8 in BUSINESS-LOGIC.md §4. They are
 * exercised against the pure function rather than the database: the interesting cases are
 * all about which days count, and none of them need Mongo to be decided.
 */

test('no completions at all is a streak of zero, not of one', () => {
    assert.equal(computeStreak([], '2026-10-14'), 0);
    assert.equal(computeStreak(undefined, '2026-10-14'), 0);
});

test('a single day completed today is a streak of one', () => {
    assert.equal(computeStreak(['2026-10-14'], '2026-10-14'), 1);
});

/*
 * R-STREAK-4 — the streak survives until the end of the day it is due.
 *
 * Checked at 9am the streak must still count yesterday, or it would reset every morning
 * before the user had a chance to do anything.
 */
test('a streak from yesterday still stands today, before anything is done', () => {
    assert.equal(computeStreak(['2026-10-13'], '2026-10-14'), 1);
});

test('a run of consecutive days counts the whole run', () => {
    assert.equal(
        computeStreak(['2026-10-14', '2026-10-13', '2026-10-12', '2026-10-11'], '2026-10-14'),
        4
    );
});

test('a run that does not reach today is counted from yesterday backwards', () => {
    assert.equal(computeStreak(['2026-10-13', '2026-10-12', '2026-10-11'], '2026-10-14'), 3);
});

/*
 * R-STREAK-5 — a gap resets to the most recent run, not to zero.
 *
 * A streak is a measure of the *current* run. Having once reached twenty is history, and
 * the number should still report the three days the user has actually put in.
 */
test('a two-day gap restarts the count from the most recent run', () => {
    const days = ['2026-10-13', '2026-10-12', '2026-10-11', '2026-10-08', '2026-10-07'];

    assert.equal(computeStreak(days, '2026-10-14'), 3);
});

test('a single missed day breaks the run', () => {
    // 13th missing, so the 12th and 11th are no longer part of the current run.
    assert.equal(computeStreak(['2026-10-14', '2026-10-12', '2026-10-11'], '2026-10-14'), 1);
});

test('completions are counted by day, so finishing five tasks is still one day', () => {
    // R-STREAK-3 — a day counts once no matter how many tasks were done in it. In
    // practice the aggregation already de-duplicates, but the walk must not be fooled by
    // a repeated key either.
    const days = ['2026-10-14', '2026-10-14', '2026-10-13', '2026-10-13'];

    assert.equal(computeStreak(days, '2026-10-14'), 2);
});

/*
 * R-STREAK-6 — the streak is never negative.
 *
 * Satisfied by construction here: the walk only ever moves backwards through days that
 * are known to be completed, so there is no subtraction that could go below zero. The
 * test documents the property rather than exercising a clamp that does not exist.
 */
test('a run shorter than the calendar gap never yields a negative number', () => {
    assert.equal(computeStreak(['2026-10-14'], '2026-10-30'), 0);
});

test('a future day key does not extend the run backwards into the past', () => {
    assert.equal(computeStreak(['2026-10-15'], '2026-10-14'), 0);
});

test('a long unbroken run is counted in full', () => {
    const days = [];
    const start = new Date(2026, 9, 14);

    for (let offset = 0; offset < 60; offset += 1) {
        const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() - offset);
        days.push(
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
                date.getDate()
            ).padStart(2, '0')}`
        );
    }

    assert.equal(computeStreak(days, '2026-10-14'), 60);
});

test('an unsorted day list is handled, because the walk is set-based', () => {
    const days = ['2026-10-11', '2026-10-13', '2026-10-12', '2026-10-14'];

    assert.equal(computeStreak(days, '2026-10-14'), 4);
});
