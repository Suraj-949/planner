const test = require('node:test');
const assert = require('node:assert/strict');

const {
    validateGoalPayload,
    validateMilestonePayload,
    validateProjectPayload,
    validateHabitPayload,
    validateHabitCompletionPayload,
} = require('../src/utils/entityValidation');
const { GOAL_STATUSES, HABIT_CADENCES, MAX_TITLE_LENGTH } = require('../src/constants');

/*
 * These validators share a shape with `taskValidation.js` on purpose: the same
 * `{ value, errors }` contract, the same "whitelist the fields" rule, and the same
 * calendar-date anchoring. What differs is which fields are required, and that is all
 * that is tested here beyond the shared behaviour.
 */

test('a goal takes a title and normalises its target date to local noon', () => {
    const { value, errors } = validateGoalPayload({ title: '  Ship it  ', targetDate: '2026-12-31' });

    assert.deepEqual(errors, []);
    assert.equal(value.title, 'Ship it');
    assert.equal(value.targetDate.getHours(), 12);
});

test('a goal rejects a title that is too long, and one that is blank', () => {
    const blank = validateGoalPayload({ title: '   ' });
    assert.ok(blank.errors.length > 0);

    const long = validateGoalPayload({ title: 'x'.repeat(MAX_TITLE_LENGTH + 1) });
    assert.ok(long.errors.length > 0);
});

test('a goal rejects an unknown status', () => {
    const { errors } = validateGoalPayload({ title: 'A', status: 'in-progress' });

    assert.ok(errors[0].includes(GOAL_STATUSES.join(', ')));
});

test('a goal accepts every documented status', () => {
    for (const status of GOAL_STATUSES) {
        const { errors } = validateGoalPayload({ title: 'A', status });
        assert.deepEqual(errors, [], `status ${status} should be accepted`);
    }
});

test('a goal cannot smuggle userId or progress through the body', () => {
    const { value } = validateGoalPayload({
        title: 'A',
        userId: 'someone-elses-id',
        progress: 100,
        completedAt: '2026-01-01',
    });

    // `userId` is taken from the verified token, and `progress` is derived from the
    // milestones (R-GOAL-1) — neither is ever read from the request.
    assert.deepEqual(value, { title: 'A' });
});

test('a goal update can clear its target date with an explicit null', () => {
    const { value, errors } = validateGoalPayload({ targetDate: null }, { partial: true });

    assert.deepEqual(errors, []);
    assert.ok('targetDate' in value);
    assert.equal(value.targetDate, undefined);
});

test('a goal update leaves an omitted field untouched', () => {
    const { value } = validateGoalPayload({ description: 'new' }, { partial: true });

    assert.ok(!('title' in value));
});

// ---- milestone -----------------------------------------------------------

test('a milestone requires a goal, because the goal is its only tenancy anchor', () => {
    const { errors } = validateMilestonePayload({ title: 'Draft' });

    assert.ok(errors.some((message) => message.includes('Goal is required')));
});

test('a milestone accepts a goal id and a due date', () => {
    const goalId = '507f1f77bcf86cd799439011';
    const { value, errors } = validateMilestonePayload({ goalId, title: 'Draft', dueDate: '2026-11-01' });

    assert.deepEqual(errors, []);
    assert.equal(value.goalId, goalId);
    assert.equal(value.dueDate.getHours(), 12);
});

test('a milestone records completion as a timestamp, not a boolean', () => {
    const goalId = '507f1f77bcf86cd799439011';
    const { value, errors } = validateMilestonePayload({ goalId, title: 'Draft', completedAt: '2026-10-14' });

    assert.deepEqual(errors, []);
    assert.ok(value.completedAt instanceof Date);
});

test('a milestone update may omit its goal, but not supply a malformed one', () => {
    const okUpdate = validateMilestonePayload({ title: 'x' }, { partial: true });
    assert.deepEqual(okUpdate.errors, []);

    const badUpdate = validateMilestonePayload({ goalId: 'not-an-id' }, { partial: true });
    assert.ok(badUpdate.errors.some((message) => message.includes('valid id')));
});

// ---- project -------------------------------------------------------------

test('a project accepts a six-digit hex colour', () => {
    const { value, errors } = validateProjectPayload({ title: 'Planner', color: '#4f46e5' });

    assert.deepEqual(errors, []);
    assert.equal(value.color, '#4f46e5');
});

test('a project rejects a colour that is not six hex digits', () => {
    for (const color of ['red', '#fff', '#12345', '#1234567', '4f46e5']) {
        const { errors } = validateProjectPayload({ title: 'P', color });
        assert.ok(errors.some((message) => message.includes('Color')), `${color} should be rejected`);
    }
});

test('a project may omit its colour, and clear it with null', () => {
    assert.deepEqual(validateProjectPayload({ title: 'P' }).errors, []);

    const cleared = validateProjectPayload({ color: null }, { partial: true });
    assert.deepEqual(cleared.errors, []);
    assert.equal(cleared.value.color, undefined);
});

// ---- habit ---------------------------------------------------------------

test('a habit accepts every documented cadence', () => {
    for (const cadence of HABIT_CADENCES) {
        const { errors } = validateHabitPayload({ title: 'Read', cadence });
        assert.deepEqual(errors, [], `cadence ${cadence} should be accepted`);
    }
});

test('a habit rejects an unknown cadence', () => {
    const { errors } = validateHabitPayload({ title: 'Read', cadence: 'hourly' });
    assert.ok(errors[0].includes(HABIT_CADENCES.join(', ')));
});

test('a habit target must be a whole number between 1 and 31', () => {
    // 31 is the largest number of days a month can hold; anything beyond it is
    // unreachable on every cadence.
    for (const targetPerPeriod of [0, -1, 1.5, 32, 'two']) {
        const { errors } = validateHabitPayload({ title: 'R', targetPerPeriod });
        assert.ok(errors.length > 0, `${targetPerPeriod} should be rejected`);
    }

    assert.deepEqual(validateHabitPayload({ title: 'R', targetPerPeriod: 1 }).errors, []);
    assert.deepEqual(validateHabitPayload({ title: 'R', targetPerPeriod: 31 }).errors, []);
});

test('a habit tick anchors its date at local noon', () => {
    const { value, errors } = validateHabitCompletionPayload({
        habitId: '507f1f77bcf86cd799439011',
        date: '2026-10-14',
    });

    assert.deepEqual(errors, []);
    assert.equal(value.date.getHours(), 12);
});

test('a habit tick requires the habit to be named', () => {
    const { errors } = validateHabitCompletionPayload({ date: '2026-10-14' });
    assert.ok(errors.some((message) => message.includes('Habit is required')));
});

test('a habit tick reports a missing habit and a bad habit exactly once each', () => {
    const missing = validateHabitCompletionPayload({ date: '2026-10-14' });
    assert.equal(missing.errors.filter((m) => m.includes('required')).length, 1);

    const malformed = validateHabitCompletionPayload({ habitId: 'nope', date: '2026-10-14' });
    assert.equal(malformed.errors.length, 1, 'a malformed id reports one problem, not two');
});
