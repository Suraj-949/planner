const test = require('node:test');
const assert = require('node:assert/strict');

const { advanceDeadline, nextFutureDeadline } = require('../src/services/recurrence.service');
const { toLocalDayKey } = require('../src/utils/dates');

const day = (key) => {
    const [year, month, date] = key.split('-').map(Number);
    return new Date(year, month - 1, date, 12, 0, 0, 0);
};

const key = (date) => toLocalDayKey(date);

test('a daily rule advances by one day', () => {
    assert.equal(key(advanceDeadline(day('2026-10-14'), { freq: 'daily', interval: 1 })), '2026-10-15');
});

test('a daily rule honours its interval', () => {
    assert.equal(key(advanceDeadline(day('2026-10-14'), { freq: 'daily', interval: 3 })), '2026-10-17');
});

test('a daily rule rolls across the year boundary', () => {
    assert.equal(key(advanceDeadline(day('2026-12-31'), { freq: 'daily', interval: 1 })), '2027-01-01');
});

test('a weekly rule moves to the next named day', () => {
    // 2026-10-14 is a Wednesday. Mon+Wed means the next hit is Monday the 19th.
    assert.equal(
        key(advanceDeadline(day('2026-10-14'), { freq: 'weekly', interval: 1, daysOfWeek: [1, 3] })),
        '2026-10-19'
    );
});

test('a weekly rule with one day lands exactly a week later', () => {
    assert.equal(
        key(advanceDeadline(day('2026-10-14'), { freq: 'weekly', interval: 1, daysOfWeek: [3] })),
        '2026-10-21'
    );
});

test('a weekly rule falls back to the deadline day when no days are named', () => {
    assert.equal(
        key(advanceDeadline(day('2026-10-14'), { freq: 'weekly', interval: 1 })),
        '2026-10-21'
    );
});

test('a monthly rule keeps the day of month', () => {
    assert.equal(key(advanceDeadline(day('2026-10-14'), { freq: 'monthly', interval: 1 })), '2026-11-14');
});

test('a monthly rule clamps to the end of a shorter month', () => {
    // The case that silently produces March 2nd or 3rd if months are added naively.
    assert.equal(key(advanceDeadline(day('2026-01-31'), { freq: 'monthly', interval: 1 })), '2026-02-28');
    assert.equal(key(advanceDeadline(day('2024-01-31'), { freq: 'monthly', interval: 1 })), '2024-02-29');
});

test('a monthly rule rolls across the year boundary', () => {
    assert.equal(key(advanceDeadline(day('2026-12-14'), { freq: 'monthly', interval: 1 })), '2027-01-14');
});

test('an absent or malformed interval is treated as one period', () => {
    assert.equal(key(advanceDeadline(day('2026-10-14'), { freq: 'daily' })), '2026-10-15');
    assert.equal(key(advanceDeadline(day('2026-10-14'), { freq: 'daily', interval: 0 })), '2026-10-15');
    assert.equal(key(advanceDeadline(day('2026-10-14'), { freq: 'daily', interval: -2 })), '2026-10-15');
    assert.equal(key(advanceDeadline(day('2026-10-14'), { freq: 'daily', interval: 2.5 })), '2026-10-15');
});

test('no recurrence, an unknown frequency or a bad date advances to nothing', () => {
    assert.equal(advanceDeadline(day('2026-10-14'), null), null);
    assert.equal(advanceDeadline(day('2026-10-14'), undefined), null);
    assert.equal(advanceDeadline(day('2026-10-14'), { freq: 'fortnightly' }), null);
    assert.equal(advanceDeadline(null, { freq: 'daily' }), null);
});

test('a deadline always lands at local noon', () => {
    // Anchoring the next occurrence at midnight would put it in the previous day for
    // anyone west of UTC the moment it was rendered.
    assert.equal(advanceDeadline(day('2026-10-14'), { freq: 'daily', interval: 1 }).getHours(), 12);
});

/*
 * R-RECUR-2 — missed occurrences collapse into one instance.
 *
 * The alternative, spawning a copy for every skipped period, turns one unfinished daily
 * task into thirty overdue ones the next time the user opens the app.
 */
test('a month of missed daily occurrences collapses to a single future task', () => {
    const next = nextFutureDeadline(day('2026-09-14'), { freq: 'daily', interval: 1 }, day('2026-10-14'));

    // Not 2026-09-15 — that is already past. One occurrence that is due today, which the
    // user still has the day in which to do, rather than thirty overdue ones.
    assert.equal(key(next), '2026-10-14');
});

test('collapsing stops at today rather than pushing the task to tomorrow', () => {
    // The deadline is at local noon, so comparing instants would depend on what hour the
    // request arrived. Day keys do not.
    const noon = nextFutureDeadline(day('2026-09-14'), { freq: 'daily', interval: 1 }, day('2026-10-14'));
    const evening = nextFutureDeadline(
        day('2026-09-14'),
        { freq: 'daily', interval: 1 },
        new Date(2026, 9, 14, 23, 59, 0)
    );

    assert.equal(key(noon), key(evening));
});

test('an occurrence already in the future is left alone', () => {
    assert.equal(
        key(nextFutureDeadline(day('2026-10-14'), { freq: 'daily', interval: 1 }, day('2026-10-01'))),
        '2026-10-15'
    );
});

test('collapsing a non-recurring task yields nothing', () => {
    assert.equal(nextFutureDeadline(day('2026-09-14'), null, day('2026-10-14')), null);
});

test('a weekly rule that has been missed for months still produces one future date', () => {
    const next = nextFutureDeadline(
        day('2026-01-05'),
        { freq: 'weekly', interval: 1, daysOfWeek: [1] },
        day('2026-10-14')
    );

    assert.equal(key(next), '2026-10-19');
});
