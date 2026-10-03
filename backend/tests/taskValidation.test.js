const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parseCalendarDate,
    normaliseDeadline,
    validateTaskPayload,
    VALID_CONTEXTS,
    MAX_ESTIMATE_MINUTES,
    MAX_ACTUAL_MINUTES,
    MAX_NOTES_LENGTH,
    MAX_RECURRENCE_INTERVAL,
    MAX_TAG_COUNT,
    MAX_SUBTASK_COUNT,
} = require('../src/utils/taskValidation');

test('parseCalendarDate reads YYYY-MM-DD as a local calendar date', () => {
    const parsed = parseCalendarDate('2025-10-24');

    assert.equal(parsed.getFullYear(), 2025);
    assert.equal(parsed.getMonth(), 9);
    assert.equal(parsed.getDate(), 24);
    // The bug this guards: new Date('2025-10-24') is UTC midnight, which is the 23rd
    // for anyone west of UTC. Constructing from parts keeps it local.
    assert.equal(parsed.getHours(), 12);
    assert.equal(parsed.getMinutes(), 0);
    assert.equal(parsed.getSeconds(), 0);
});

/*
 * Invariant I-4 — a task's calendar date is identical in every timezone.
 *
 * Checking the host's own timezone proves very little: this suite originally passed the
 * date assertions on a machine east of UTC, where a midnight anchor happens to survive.
 * `process.env.TZ` is re-read by the Date constructor on every call, so the whole matrix
 * can be exercised from any single host.
 */
test('a deadline renders as the same calendar day in every real-world timezone', () => {
    const REAL_TZ = process.env.TZ;

    // The bug is only visible in *local* rendering. toISOString() normalises to UTC and
    // would hide it, which is part of why this escaped notice for so long.
    const localDay = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
            date.getDate()
        ).padStart(2, '0')}`;

    const zones = [
        'UTC',
        'America/New_York', // UTC-4
        'America/Chicago', // UTC-5
        'America/Denver', // UTC-6
        'America/Los_Angeles', // UTC-7
        'Pacific/Honolulu', // UTC-10
        'Europe/London', // UTC+1
        'Asia/Kolkata', // UTC+5:30
        'Asia/Tokyo', // UTC+9
        'Pacific/Auckland', // UTC+12
    ];

    try {
        for (const tz of zones) {
            process.env.TZ = tz;

            for (const day of ['2025-01-01', '2025-10-24', '2025-12-31']) {
                assert.equal(
                    localDay(parseCalendarDate(day)),
                    day,
                    `${day} rendered as the wrong day in ${tz}`
                );
            }
        }
    } finally {
        if (REAL_TZ === undefined) delete process.env.TZ;
        else process.env.TZ = REAL_TZ;
    }
});

/*
 * The contrast that proves the matrix above is not vacuous: the naive UTC-midnight parse
 * really does render a day early in western zones. `new Date('2025-10-24')` is 00:00 UTC,
 * which is 17:00 on the 23rd in Los Angeles.
 */
test('the naive UTC-midnight parse does render a day early behind UTC', () => {
    const REAL_TZ = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';

    const localDay = (date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

    try {
        assert.equal(localDay(new Date('2025-10-24')), '2025-10-23');
        assert.equal(localDay(parseCalendarDate('2025-10-24')), '2025-10-24');
    } finally {
        if (REAL_TZ === undefined) delete process.env.TZ;
        else process.env.TZ = REAL_TZ;
    }
});

test('parseCalendarDate rejects impossible dates instead of rolling them over', () => {
    assert.equal(parseCalendarDate('2025-02-30'), null);
    assert.equal(parseCalendarDate('2025-13-01'), null);
    assert.equal(parseCalendarDate('not-a-date'), null);
});

test('normaliseDeadline distinguishes absent from invalid', () => {
    assert.equal(normaliseDeadline(''), undefined);
    assert.equal(normaliseDeadline(undefined), undefined);
    assert.equal(normaliseDeadline('garbage'), null);
    assert.ok(normaliseDeadline('2025-10-24') instanceof Date);
});

test('create requires title and deadline', () => {
    const { errors } = validateTaskPayload({});

    assert.ok(errors.some((message) => /Title is required/.test(message)));
    assert.ok(errors.some((message) => /Deadline is required/.test(message)));
});

test('create trims the title and rejects an over-long one', () => {
    const { value, errors } = validateTaskPayload({
        title: '   Ship the release   ',
        deadline: '2025-10-24',
    });

    assert.deepEqual(errors, []);
    assert.equal(value.title, 'Ship the release');
    assert.ok(value.deadline instanceof Date);

    const tooLong = validateTaskPayload({
        title: 'x'.repeat(201),
        deadline: '2025-10-24',
    });

    assert.ok(tooLong.errors.length > 0);
});

test('create rejects values outside the enums', () => {
    const { errors } = validateTaskPayload({
        title: 'Valid',
        deadline: '2025-10-24',
        status: 'archived',
        priority: 'urgent',
        category: 'Marketing',
    });

    assert.equal(errors.length, 3);
});

test('update only validates the fields that were sent', () => {
    const { value, errors } = validateTaskPayload(
        { status: 'completed' },
        { partial: true }
    );

    assert.deepEqual(errors, []);
    // A PATCH must not blank out fields the client did not mention.
    assert.deepEqual(value, { status: 'completed' });
});

/*
 * Defect B-4, and the one regression this suite previously failed to catch.
 *
 * An empty string must be rejected rather than treated as "not provided". This is the
 * `findOneAndUpdate` hole: with `runValidators` off, an empty enum persisted, and because a
 * task with a status outside the enum belongs to no bucket (R-STAT-4), it then vanished from
 * every progress counter — so the dashboard's percentages silently drifted instead of
 * erroring. Nothing else in the codebase would notice.
 */
test('an empty string enum is rejected rather than treated as absent', () => {
    for (const field of ['status', 'priority', 'category']) {
        const { value, errors } = validateTaskPayload(
            { title: 'Valid', deadline: '2025-10-24', [field]: '' },
            { partial: true }
        );

        assert.ok(errors.length > 0, `expected ${field}: '' to be rejected`);
        assert.equal(value[field], undefined, `${field} must not reach the database`);
    }
});

test('an omitted enum on update is left alone, not blanked', () => {
    // The counterpart to the test above: absent and empty must behave differently.
    const { value, errors } = validateTaskPayload({ title: 'Still here' }, { partial: true });

    assert.deepEqual(errors, []);
    assert.equal(value.priority, undefined);
    assert.equal(value.title, 'Still here');
});

test('payload normalisation drops unknown fields so userId cannot be injected', () => {
    const { value } = validateTaskPayload(
        {
            title: 'Legit task',
            deadline: '2025-10-24',
            userId: '507f1f77bcf86cd799439011',
            dateCreated: '1999-01-01',
            _id: 'nope',
        },
        { partial: true }
    );

    assert.equal(value.userId, undefined);
    assert.equal(value.dateCreated, undefined);
    assert.equal(value._id, undefined);
    assert.equal(value.title, 'Legit task');
});

/*
 * Dashboard fields. Each is rejected by an empty string like every other enum, which the
 * loop above already covers for status/priority/category — these assert the same treatment
 * for `context` so the four stay symmetrical.
 */
test('context accepts each known project and rejects anything else', () => {
    for (const context of VALID_CONTEXTS) {
        const { value, errors } = validateTaskPayload(
            { title: 'Valid', deadline: '2025-10-24', context },
            { partial: true }
        );

        assert.deepEqual(errors, [], `expected "${context}" to be accepted`);
        assert.equal(value.context, context);
    }

    const rejected = validateTaskPayload(
        { title: 'Valid', deadline: '2025-10-24', context: 'Some New Project' },
        { partial: true }
    );

    assert.ok(rejected.errors.some((message) => /Context must be one of/.test(message)));
    assert.equal(rejected.value.context, undefined);
});

test('context has no default but an explicit null clears it', () => {
    // Guessing a project would file a task under the wrong one, so omission is left absent
    // rather than defaulted the way `category` defaults to 'other'.
    const omitted = validateTaskPayload({ title: 'Valid', deadline: '2025-10-24' });

    assert.deepEqual(omitted.errors, []);
    assert.equal(omitted.value.context, undefined);

    const cleared = validateTaskPayload({ context: null }, { partial: true });

    assert.deepEqual(cleared.errors, []);
    assert.equal(cleared.value.context, undefined);
});

test('an empty string context is rejected rather than treated as absent', () => {
    const { value, errors } = validateTaskPayload({ context: '' }, { partial: true });

    assert.ok(errors.some((message) => /Context must be one of/.test(message)));
    assert.equal(value.context, undefined);
});

test('estimate is stored as whole minutes and bounded', () => {
    const ok = validateTaskPayload({ estimateMinutes: 105 }, { partial: true });

    assert.deepEqual(ok.errors, []);
    assert.equal(ok.value.estimateMinutes, 105);

    // A numeric string from a form field is coerced...
    const coerced = validateTaskPayload({ estimateMinutes: '90' }, { partial: true });

    assert.deepEqual(coerced.errors, []);
    assert.equal(coerced.value.estimateMinutes, 90);

    // ...but Number('') is 0, which would silently store a zero estimate for a blank field.
    for (const bad of ['', '   ', '1.5', -1, MAX_ESTIMATE_MINUTES + 1]) {
        const result = validateTaskPayload({ estimateMinutes: bad }, { partial: true });

        assert.ok(
            result.errors.some((message) => /Estimate must be/.test(message)),
            `expected estimateMinutes: ${JSON.stringify(bad)} to be rejected`
        );
        assert.equal(result.value.estimateMinutes, undefined);
    }
});

test('tags are trimmed, lowercased and de-duplicated', () => {
    const { value, errors } = validateTaskPayload(
        { tags: ['  Auth ', 'auth', 'SECURITY', '', '   '] },
        { partial: true }
    );

    assert.deepEqual(errors, []);
    // Blanks dropped, so a stray comma cannot produce a tag that matches every empty search.
    assert.deepEqual(value.tags, ['auth', 'security']);
});

test('tags reject a non-array, non-string entries and oversized input', () => {
    assert.ok(
        validateTaskPayload({ tags: 'auth' }, { partial: true }).errors.length > 0,
        'a bare string must not be silently accepted as a one-tag list'
    );
    assert.ok(validateTaskPayload({ tags: ['ok', 7] }, { partial: true }).errors.length > 0);
    assert.ok(
        validateTaskPayload({ tags: ['x'.repeat(51)] }, { partial: true }).errors.length > 0
    );
    assert.ok(
        validateTaskPayload(
            { tags: Array(MAX_TAG_COUNT + 1).fill('tag') },
            { partial: true }
        ).errors.length > 0
    );
});

test('subtasks accept both the string form and the stored object form', () => {
    const { value, errors } = validateTaskPayload(
        { subtasks: ['Define SVG matrix dimensions', { title: 'Wire tooltips', completed: true }] },
        { partial: true }
    );

    assert.deepEqual(errors, []);
    assert.deepEqual(value.subtasks, [
        { title: 'Define SVG matrix dimensions', completed: false },
        { title: 'Wire tooltips', completed: true },
    ]);
});

test('subtasks reject blank titles and oversized input', () => {
    assert.ok(
        validateTaskPayload({ subtasks: ['   '] }, { partial: true }).errors.some((message) =>
            /Subtask titles cannot be empty/.test(message)
        )
    );
    assert.ok(
        validateTaskPayload({ subtasks: ['x'.repeat(201)] }, { partial: true }).errors.length > 0
    );
    assert.ok(
        validateTaskPayload(
            { subtasks: Array(MAX_SUBTASK_COUNT + 1).fill('step') },
            { partial: true }
        ).errors.length > 0
    );
    assert.ok(validateTaskPayload({ subtasks: 'step' }, { partial: true }).errors.length > 0);
});

test('an update touching only new fields leaves the rest untouched', () => {
    const { value, errors } = validateTaskPayload(
        { context: 'Obsidian UI', estimateMinutes: 30, tags: ['icons'], subtasks: ['Crop'] },
        { partial: true }
    );

    assert.deepEqual(errors, []);
    assert.deepEqual(Object.keys(value).sort(), [
        'context',
        'estimateMinutes',
        'subtasks',
        'tags',
    ]);
});

/* ------------------------------------------------------- recurrence (2.1) */

test('a recurrence without an interval means every one period', () => {
    const { value, errors } = validateTaskPayload(
        { recurrence: { freq: 'daily' } },
        { partial: true }
    );

    assert.deepEqual(errors, []);
    assert.deepEqual(value.recurrence, { freq: 'daily', interval: 1 });
});

test('weekly recurrence days are de-duplicated and ordered', () => {
    // Otherwise two clients that build the same rule differently would store documents
    // that should be identical but would not compare equal.
    const { value, errors } = validateTaskPayload(
        { recurrence: { freq: 'weekly', daysOfWeek: [5, 1, 3, 1] } },
        { partial: true }
    );

    assert.deepEqual(errors, []);
    assert.deepEqual(value.recurrence, { freq: 'weekly', interval: 1, daysOfWeek: [1, 3, 5] });
});

test('a weekly recurrence must name at least one day', () => {
    for (const daysOfWeek of [undefined, []]) {
        const { errors } = validateTaskPayload(
            { recurrence: { freq: 'weekly', daysOfWeek } },
            { partial: true }
        );

        assert.ok(
            errors.some((message) => /at least one day/.test(message)),
            `expected daysOfWeek=${JSON.stringify(daysOfWeek)} to be rejected`
        );
    }
});

test('only a weekly recurrence may carry a day list', () => {
    // Keeping it would store a claim the scheduler never reads.
    const { errors } = validateTaskPayload(
        { recurrence: { freq: 'daily', daysOfWeek: [1] } },
        { partial: true }
    );

    assert.ok(errors.some((message) => /only a weekly recurrence/i.test(message)));
});

test('recurrence rejects an unknown frequency, a bad day and a bad interval', () => {
    const cases = [
        [{ recurrence: { freq: 'hourly' } }, /frequency/],
        [{ recurrence: { freq: 'weekly', daysOfWeek: [7] } }, /0 to 6/],
        [{ recurrence: { freq: 'weekly', daysOfWeek: [-1] } }, /0 to 6/],
        [{ recurrence: { freq: 'daily', interval: 0 } }, /interval/],
        [{ recurrence: { freq: 'daily', interval: 1.5 } }, /interval/],
        [{ recurrence: { freq: 'daily', interval: MAX_RECURRENCE_INTERVAL + 1 } }, /interval/],
        [{ recurrence: 'daily' }, /must be an object/],
    ];

    for (const [payload, pattern] of cases) {
        const { errors } = validateTaskPayload(payload, { partial: true });

        assert.ok(
            errors.some((message) => pattern.test(message)),
            `expected ${JSON.stringify(payload)} to be rejected with ${pattern}`
        );
    }
});

test('an explicit null clears recurrence', () => {
    const { value, errors } = validateTaskPayload({ recurrence: null }, { partial: true });

    assert.deepEqual(errors, []);
    assert.equal(value.recurrence, undefined);
});

/* --------------------------------------------------- hierarchy links (2.1) */

test('project and goal links must be ids, and empty clears them', () => {
    const id = '507f1f77bcf86cd799439011';

    const linked = validateTaskPayload({ projectId: id, goalId: id }, { partial: true });

    assert.deepEqual(linked.errors, []);
    assert.equal(linked.value.projectId, id);
    assert.equal(linked.value.goalId, id);

    // "" is what a form submits for "no selection", so it has to un-file rather than fail.
    const cleared = validateTaskPayload({ projectId: '', goalId: null }, { partial: true });

    assert.deepEqual(cleared.errors, []);
    assert.equal(cleared.value.projectId, undefined);
    assert.equal(cleared.value.goalId, undefined);

    for (const bad of ['not-an-id', 12345]) {
        const { errors } = validateTaskPayload({ projectId: bad }, { partial: true });

        assert.ok(
            errors.some((message) => /Project must be a valid id/.test(message)),
            `expected projectId ${JSON.stringify(bad)} to be rejected`
        );
    }
});

/* ------------------------------------------------ logged time and notes (2.1) */

test('actual minutes follow the same rules as estimates, with a larger ceiling', () => {
    const ok = validateTaskPayload({ actualMinutes: MAX_ACTUAL_MINUTES }, { partial: true });

    assert.deepEqual(ok.errors, []);
    assert.equal(ok.value.actualMinutes, MAX_ACTUAL_MINUTES);

    // A whole number still matters, and the ceiling is not the estimate's: logged time
    // accumulates across sessions.
    for (const bad of ['', '  ', '7.5', -1, MAX_ACTUAL_MINUTES + 1, true]) {
        const { errors } = validateTaskPayload({ actualMinutes: bad }, { partial: true });

        assert.ok(
            errors.some((message) => /Actual must be/.test(message)),
            `expected actualMinutes ${JSON.stringify(bad)} to be rejected`
        );
    }

    assert.ok(MAX_ACTUAL_MINUTES > MAX_ESTIMATE_MINUTES);
});

test('notes are trimmed and length-capped', () => {
    const ok = validateTaskPayload({ notes: '  reviewed with Sam  ' }, { partial: true });

    assert.deepEqual(ok.errors, []);
    assert.equal(ok.value.notes, 'reviewed with Sam');

    const atLimit = validateTaskPayload({ notes: 'x'.repeat(MAX_NOTES_LENGTH) }, { partial: true });

    assert.deepEqual(atLimit.errors, []);

    const tooLong = validateTaskPayload({ notes: 'x'.repeat(MAX_NOTES_LENGTH + 1) }, { partial: true });

    assert.ok(tooLong.errors.some((message) => /Notes must be at most/.test(message)));
    assert.equal(tooLong.value.notes, undefined);
});

test('an update touching only the new fields leaves the rest untouched', () => {
    const { value, errors } = validateTaskPayload(
        {
            projectId: '507f1f77bcf86cd799439011',
            recurrence: { freq: 'weekly', daysOfWeek: [2] },
            actualMinutes: 45,
            notes: 'blocked on review',
        },
        { partial: true }
    );

    assert.deepEqual(errors, []);
    assert.deepEqual(Object.keys(value).sort(), [
        'actualMinutes',
        'notes',
        'projectId',
        'recurrence',
    ]);
});
