/*
 * Server-side calendar-date helpers.
 *
 * Mirrors `my-app/src/utils/dates.js`. Deadlines are stored anchored at local noon
 * (BUSINESS-LOGIC §3), so every "which day is this" question is answered in local terms —
 * a UTC ISO string reports the previous day for anyone west of UTC.
 *
 * Whole-day arithmetic is built from `new Date(y, m, d + n)` rather than by adding
 * milliseconds, so month rollover and DST transitions are handled by the Date constructor
 * instead of by a constant that is 23 or 25 hours long on those days.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const BARE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// The zone the process is running in. Mongo aggregation pipelines that bucket by calendar
// day have to name a timezone explicitly, and defaulting to UTC would disagree with the
// local `new Date()` arithmetic used everywhere else here.
const SERVER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const isDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());

const parseDateValue = (value) => {
    if (!value) return null;

    if (isDate(value)) return value;

    const match = BARE_DATE.exec(String(value).trim());

    if (match) {
        const [, year, month, day] = match;

        // Built from parts, so this is a local calendar date rather than UTC midnight.
        return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const atNoon = (value) => {
    const date = isDate(value) ? new Date(value) : parseDateValue(value);

    if (!date) return null;

    date.setHours(12, 0, 0, 0);

    return date;
};

// Local `YYYY-MM-DD` for a date. The single day-identity function on the server: the
// streak buckets completions by exactly this, so both agree on where a day ends.
const toLocalDayKey = (value) => {
    const date = parseDateValue(value);

    if (!date) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const fromLocalDayKey = (key) => {
    const match = BARE_DATE.exec(String(key).trim());

    if (!match) return null;

    const [, year, month, day] = match;

    return new Date(Number(year), Number(month) - 1, Number(day));
};

// Whole local days from `from` to `to`. Rounded rather than divided, so a DST transition
// producing 23 or 25 hours still yields the correct calendar count.
const daysBetweenLocal = (from, to) => {
    const start = fromLocalDayKey(toLocalDayKey(from));
    const end = fromLocalDayKey(toLocalDayKey(to));

    if (!start || !end) return null;

    return Math.round((end.getTime() - start.getTime()) / DAY_MS);
};

const addLocalDays = (date, days) => {
    const source = isDate(date) ? date : parseDateValue(date);

    if (!source) return null;

    return new Date(source.getFullYear(), source.getMonth(), source.getDate() + days);
};

/*
 * Whole local months, clamped to the target month's length. Adding a month to Jan 31 must
 * yield the last day of February, not somewhere in March.
 */
const addLocalMonths = (date, months) => {
    const source = isDate(date) ? date : parseDateValue(date);

    if (!source) return null;

    const first = new Date(source.getFullYear(), source.getMonth() + months, 1);
    const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();

    return new Date(first.getFullYear(), first.getMonth(), Math.min(source.getDate(), lastDay));
};

const todayLocalKey = () => toLocalDayKey(new Date());

module.exports = {
    SERVER_TIMEZONE,
    parseDateValue,
    atNoon,
    toLocalDayKey,
    fromLocalDayKey,
    daysBetweenLocal,
    addLocalDays,
    addLocalMonths,
    todayLocalKey,
};
