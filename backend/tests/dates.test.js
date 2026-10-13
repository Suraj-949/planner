const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parseDateValue,
    atNoon,
    toLocalDayKey,
    fromLocalDayKey,
    daysBetweenLocal,
    addLocalDays,
    addLocalMonths,
    todayLocalKey,
} = require('../src/utils/dates');

test('a bare YYYY-MM-DD reads as a local calendar date, not UTC midnight', () => {
    const parsed = parseDateValue('2026-10-14');

    // The bug this guards: new Date('2026-10-14') is UTC midnight, which is the 13th for
    // anyone west of UTC. Building from parts keeps it the day the user typed.
    assert.equal(toLocalDayKey(parsed), '2026-10-14');
});

test('day keys round-trip', () => {
    for (const key of ['2026-01-01', '2026-02-28', '2026-12-31']) {
        assert.equal(toLocalDayKey(fromLocalDayKey(key)), key);
    }
});

test('toLocalDayKey rejects nonsense rather than inventing a day', () => {
    assert.equal(toLocalDayKey(null), '');
    assert.equal(toLocalDayKey(undefined), '');
    assert.equal(toLocalDayKey('not a date'), '');
});

test('addLocalDays rolls across month and year boundaries', () => {
    assert.equal(toLocalDayKey(addLocalDays(fromLocalDayKey('2026-01-31'), 1)), '2026-02-01');
    assert.equal(toLocalDayKey(addLocalDays(fromLocalDayKey('2026-12-31'), 1)), '2027-01-01');
    assert.equal(toLocalDayKey(addLocalDays(fromLocalDayKey('2026-03-01'), -1)), '2026-02-28');
});

test('addLocalDays keeps the calendar day across a DST transition', () => {
    const realTZ = process.env.TZ;

    try {
        // US spring-forward: 2am becomes 3am on 2026-03-08, so that local day is 23 hours
        // long. Millisecond arithmetic (24 * 60 * 60 * 1000) would land on the 9th's
        // early hours and report the 9th instead of the 8th.
        process.env.TZ = 'America/New_York';

        assert.equal(
            toLocalDayKey(addLocalDays(fromLocalDayKey('2026-03-07'), 1)),
            '2026-03-08'
        );

        // Autumn fall-back is 25 hours, the same failure in reverse.
        assert.equal(
            toLocalDayKey(addLocalDays(fromLocalDayKey('2026-10-31'), 1)),
            '2026-11-01'
        );
    } finally {
        process.env.TZ = realTZ;
    }
});

test('addLocalMonths clamps to the last day of a shorter month', () => {
    // Jan 31 + 1 month must be Feb's last day, not somewhere in March — which is what a
    // naive `new Date(y, m + 1, 31)` produces.
    assert.equal(toLocalDayKey(addLocalMonths(fromLocalDayKey('2026-01-31'), 1)), '2026-02-28');
    assert.equal(toLocalDayKey(addLocalMonths(fromLocalDayKey('2024-01-31'), 1)), '2024-02-29');
    assert.equal(toLocalDayKey(addLocalMonths(fromLocalDayKey('2026-03-31'), 1)), '2026-04-30');
});

test('addLocalMonths rolls across the year boundary', () => {
    assert.equal(toLocalDayKey(addLocalMonths(fromLocalDayKey('2026-12-15'), 1)), '2027-01-15');
    assert.equal(toLocalDayKey(addLocalMonths(fromLocalDayKey('2026-01-15'), -1)), '2025-12-15');
});

test('addLocalMonths handles month arithmetic that is not a whole year', () => {
    assert.equal(toLocalDayKey(addLocalMonths(fromLocalDayKey('2026-01-15'), 13)), '2027-02-15');
});

test('daysBetweenLocal counts whole calendar days, not elapsed hours', () => {
    // 23:00 one day to 01:00 the next is two hours, but one day.
    const from = new Date(2026, 9, 14, 23, 0, 0);
    const to = new Date(2026, 9, 15, 1, 0, 0);

    assert.equal(daysBetweenLocal(from, to), 1);
});

test('daysBetweenLocal is negative when the second date is earlier', () => {
    const from = new Date(2026, 9, 15);
    const to = new Date(2026, 9, 10);

    assert.equal(daysBetweenLocal(from, to), -5);
});

test('atNoon pins any instant to 12:00 local', () => {
    assert.equal(atNoon(new Date(2026, 9, 14, 23, 59, 59)).getHours(), 12);
    assert.equal(atNoon(new Date(2026, 9, 14, 0, 0, 1)).getHours(), 12);
    assert.equal(atNoon('2026-10-14').getHours(), 12);
});

test('todayLocalKey matches a freshly built day key', () => {
    assert.equal(todayLocalKey(), toLocalDayKey(new Date()));
});
