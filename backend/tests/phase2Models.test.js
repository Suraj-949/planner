const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Task = require('../src/models/task.model');
const Goal = require('../src/models/goal.model');
const Milestone = require('../src/models/milestone.model');
const Project = require('../src/models/project.model');
const Habit = require('../src/models/habit.model');
const HabitCompletion = require('../src/models/habitCompletion.model');

const {
    TASK_STATUSES,
    TASK_CATEGORIES,
    TASK_PRIORITIES,
    TASK_CONTEXTS,
    GOAL_STATUSES,
    RECURRENCE_FREQUENCIES,
    HABIT_CADENCES,
} = require('../src/constants');

const ALICE = new mongoose.Types.ObjectId();

let mongo;

/*
 * These tests cover the schema contract only — required fields, enum rejection, defaults,
 * index definitions. Query and mutation behaviour belongs to the controllers, which arrive
 * with module 2.2.
 */

test.before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
});

test.after(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
});

/* ------------------------------------------------- shared enum single source */

test('task schema reads its enums from the shared module', () => {
    // The Phase 1 failure mode this prevents: the schema listing one set of values while
    // the validator lists another. Both now import src/constants, and this test fails the
    // moment anyone reintroduces a hand-written copy.
    assert.deepEqual(Task.schema.path('status').enumValues, [...TASK_STATUSES]);
    assert.deepEqual(Task.schema.path('priority').enumValues, [...TASK_PRIORITIES]);
    assert.deepEqual(Task.schema.path('category').enumValues, [...TASK_CATEGORIES]);
    assert.deepEqual(Task.schema.path('context').enumValues, [...TASK_CONTEXTS]);
    assert.deepEqual(Goal.schema.path('status').enumValues, [...GOAL_STATUSES]);
    assert.deepEqual(Task.schema.path('recurrence.freq').enumValues, [...RECURRENCE_FREQUENCIES]);
    assert.deepEqual(Habit.schema.path('cadence').enumValues, [...HABIT_CADENCES]);
});

/* ------------------------------------------------------------------- goal */

test('goal requires a title and an owner', async () => {
    await assert.rejects(() => Goal.create({ userId: ALICE }), /title/);
    await assert.rejects(() => Goal.create({ title: 'Ship Phase 2' }), /userId/);

    const goal = await Goal.create({ title: 'Ship Phase 2', userId: ALICE });

    assert.equal(goal.status, 'active');
    assert.ok(goal._id);
});

test('goal rejects a status outside the enum', async () => {
    await assert.rejects(
        () => Goal.create({ title: 'Ship Phase 2', userId: ALICE, status: 'half-done' }),
        /status/
    );
});

test('goal stores no progress value', () => {
    // R-GOAL-1: progress is the percentage of completed milestones, derived on read.
    // A stored number would be a second source of truth free to disagree with them.
    assert.equal(Object.hasOwn(Goal.schema.paths, 'progress'), false);
});

test('goal indexes the queries the list and due views make', () => {
    const indexed = Goal.schema.indexes().map(([fields]) => Object.keys(fields).join(','));

    assert.ok(indexed.includes('userId'));
    assert.ok(indexed.includes('userId,status'));
    assert.ok(indexed.includes('userId,targetDate'));
});

/* -------------------------------------------------------------- milestone */

test('milestone requires a goal and a title', async () => {
    await assert.rejects(() => Milestone.create({ title: 'Draft spec' }), /goalId/);
    await assert.rejects(() => Milestone.create({ goalId: ALICE }), /title/);
});

test('milestone is incomplete until completedAt is set', async () => {
    const open = await Milestone.create({ goalId: ALICE, title: 'Draft spec' });

    assert.equal(open.completedAt, undefined);

    const done = await Milestone.create({
        goalId: ALICE,
        title: 'Ship it',
        completedAt: new Date(),
    });

    assert.ok(done.completedAt instanceof Date);
});

test('milestone reaches its owner only through goalId', () => {
    // Tenancy lives in exactly one place per document. A userId here would be a second
    // copy free to drift from the goal's.
    assert.equal(Object.hasOwn(Milestone.schema.paths, 'userId'), false);
});

test('milestone indexes goal-scoped listing and progress counts', () => {
    const indexed = Milestone.schema.indexes().map(([fields]) => Object.keys(fields).join(','));

    assert.ok(indexed.includes('goalId,dueDate'));
    assert.ok(indexed.includes('goalId,completedAt'));
});

/* ---------------------------------------------------------------- project */

test('project requires a title and an owner', async () => {
    await assert.rejects(() => Project.create({ userId: ALICE }), /title/);
    await assert.rejects(() => Project.create({ title: 'Planner' }), /userId/);
});

test('project colour must be six-digit hex when present', async () => {
    // No default: a colour is the user's pick from a palette, so an invented default would
    // quietly become the colour of every project created that month.
    const plain = await Project.create({ title: 'Planner', userId: ALICE });

    assert.equal(plain.color, undefined);

    const coloured = await Project.create({
        title: 'Planner',
        userId: ALICE,
        color: '#4f46e5',
    });

    assert.equal(coloured.color, '#4f46e5');

    for (const bad of ['blue', '#fff', '#4f46e5ff', '4f46e5']) {
        await assert.rejects(
            () => Project.create({ title: 'Planner', userId: ALICE, color: bad }),
            /color/,
            `expected colour ${bad} to be rejected`
        );
    }
});

test('project archiving is a timestamp and stays optional', async () => {
    const live = await Project.create({ title: 'Planner', userId: ALICE });

    assert.equal(live.archivedAt, undefined);

    live.archivedAt = new Date();
    await live.save();

    assert.ok(live.archivedAt instanceof Date);
});

test('project indexes the unarchived list and the goal grouping', () => {
    const indexed = Project.schema.indexes().map(([fields]) => Object.keys(fields).join(','));

    assert.ok(indexed.includes('userId,archivedAt'));
    assert.ok(indexed.includes('userId,goalId'));
});

/* ------------------------------------------------------------------ habit */

test('habit defaults to once a day', async () => {
    const habit = await Habit.create({ title: 'Read', userId: ALICE });

    assert.equal(habit.cadence, 'daily');
    assert.equal(habit.targetPerPeriod, 1);
    assert.equal(habit.archivedAt, undefined);
});

test('habit rejects an unknown cadence', async () => {
    await assert.rejects(
        () => Habit.create({ title: 'Read', userId: ALICE, cadence: 'fortnightly' }),
        /cadence/
    );
});

test('habit target is bounded by what a period can contain', async () => {
    // 31 is the largest number of days a monthly period has, so a larger target is
    // unreachable by construction rather than merely unlikely.
    await assert.rejects(
        () => Habit.create({ title: 'Read', userId: ALICE, targetPerPeriod: 0 }),
        /targetPerPeriod/
    );
    await assert.rejects(
        () => Habit.create({ title: 'Read', userId: ALICE, targetPerPeriod: 32 }),
        /targetPerPeriod/
    );

    const ok = await Habit.create({ title: 'Read', userId: ALICE, targetPerPeriod: 5 });

    assert.equal(ok.targetPerPeriod, 5);
});

/* -------------------------------------------------------- habit completion */

test('habit completion requires a habit, a date and an owner', async () => {
    const habit = await Habit.create({ title: 'Read', userId: ALICE });

    await assert.rejects(() => HabitCompletion.create({ habitId: habit._id, userId: ALICE }), /date/);
    await assert.rejects(() => HabitCompletion.create({ date: new Date(), userId: ALICE }), /habitId/);
    await assert.rejects(() => HabitCompletion.create({ habitId: habit._id, date: new Date() }), /userId/);
});

test('a habit can only be completed once per day', async () => {
    const habit = await Habit.create({ title: 'Read', userId: ALICE });
    const date = new Date(2026, 4, 12, 12, 0, 0);

    await HabitCompletion.create({ habitId: habit._id, date, userId: ALICE });

    // The invariant that makes streaks trustworthy: without the unique index a double-tap
    // stores two rows, the streak counts both, and the number is quietly inflated.
    await assert.rejects(
        () => HabitCompletion.create({ habitId: habit._id, date, userId: ALICE }),
        (err) => err.code === 11000,
        'expected a duplicate key error'
    );

    // A different day is fine, and so is the same day for a different habit.
    await HabitCompletion.create({ habitId: habit._id, date: new Date(2026, 4, 13, 12), userId: ALICE });
    const other = await Habit.create({ title: 'Stretch', userId: ALICE });

    await HabitCompletion.create({ habitId: other._id, date, userId: ALICE });
});

test('habit completion declares a unique habit+date index', () => {
    const entries = HabitCompletion.schema.indexes();
    const unique = entries.find(([fields]) => fields.habitId === 1 && fields.date === 1);

    assert.ok(unique, 'expected an index on { habitId, date }');
    assert.equal(unique[1].unique, true);
});

/* ------------------------------------------------------- task extensions */

test('task hierarchy links are optional and default to unset', async () => {
    const task = await Task.create({ title: 'Write spec', deadline: new Date(), userId: ALICE });

    assert.equal(task.projectId, undefined);
    assert.equal(task.goalId, undefined);
    assert.equal(task.recurrence, undefined);
    assert.equal(task.actualMinutes, undefined);
    assert.equal(task.notes, undefined);
});

test('task links to a project and a goal', async () => {
    const goal = await Goal.create({ title: 'Ship Phase 2', userId: ALICE });
    const project = await Project.create({ title: 'API', userId: ALICE, goalId: goal._id });

    const task = await Task.create({
        title: 'Write spec',
        deadline: new Date(),
        userId: ALICE,
        projectId: project._id,
        goalId: goal._id,
    });

    assert.equal(task.projectId.toString(), project._id.toString());
    assert.equal(task.goalId.toString(), goal._id.toString());
});

test('task recurrence stores a rule without a subdocument id', async () => {
    const task = await Task.create({
        title: 'Standup',
        deadline: new Date(),
        userId: ALICE,
        recurrence: { freq: 'weekly', daysOfWeek: [1, 3, 5] },
    });

    assert.equal(task.recurrence._id, undefined);
    // Absent interval means "every 1 week", which is the schema default.
    assert.equal(task.recurrence.interval, 1);
    assert.deepEqual(task.recurrence.daysOfWeek, [1, 3, 5]);
});

test('task recurrence rejects an unknown frequency', async () => {
    await assert.rejects(
        () => Task.create({
            title: 'Standup',
            deadline: new Date(),
            userId: ALICE,
            recurrence: { freq: 'hourly' },
        }),
        /recurrence\.freq/
    );
});

test('task logged time and notes respect their ceilings', async () => {
    const task = await Task.create({
        title: 'Write spec',
        deadline: new Date(),
        userId: ALICE,
        estimateMinutes: 90,
        actualMinutes: 240,
        notes: 'Discussed with the team.',
    });

    assert.equal(task.estimateMinutes, 90);
    assert.equal(task.actualMinutes, 240);
    assert.equal(task.notes, 'Discussed with the team.');

    await assert.rejects(
        () => Task.create({
            title: 'Write spec',
            deadline: new Date(),
            userId: ALICE,
            actualMinutes: -1,
        }),
        /actualMinutes/
    );
});

test('task indexes the hierarchy filters', () => {
    const indexed = Task.schema.indexes().map(([fields]) => Object.keys(fields).join(','));

    assert.ok(indexed.includes('userId,projectId'));
    assert.ok(indexed.includes('userId,goalId'));
});
