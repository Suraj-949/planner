const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test_secret_that_is_definitely_long_enough_32';

const Task = require('../src/models/task.model');
const { createTask, getTasks, updateTask, deleteTask } = require('../src/controllers/task.controller');

const ALICE = new mongoose.Types.ObjectId();
const BOB = new mongoose.Types.ObjectId();

let mongo;
let db;

/*
 * A minimal stand-in for Express. The controllers only ever touch `req.user`, `req.body`,
 * `req.query`, `req.params` and `res.status().json()`, so mocking those is enough to
 * exercise the real query and update logic against a real database.
 *
 * Errors are captured rather than thrown, mirroring Express: a handler signals failure by
 * calling next(err), so `result.error` is where a 4xx lands.
 */
const call = async (handler, req = {}) => {
    const result = { statusCode: 200, body: null, error: null };
    const res = {
        status(code) {
            result.statusCode = code;
            return res;
        },
        json(payload) {
            result.body = payload;
            return res;
        },
    };

    await handler(
        {
            user: req.user ?? ALICE,
            body: req.body ?? {},
            query: req.query ?? {},
            params: req.params ?? {},
        },
        res,
        (err) => {
            result.error = err;
        }
    );

    return result;
};

const assertFails = (result, statusCode) => {
    assert.ok(result.error, 'expected the handler to fail');
    assert.equal(result.error.statusCode, statusCode);
    return result.error;
};

const validTask = (overrides = {}) => ({
    title: 'Write the report',
    deadline: '2099-10-24',
    ...overrides,
});

test.before(async () => {
    mongo = await MongoMemoryServer.create();
    db = await mongoose.connect(mongo.getUri());
});

test.after(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
});

test.beforeEach(async () => {
    await Task.deleteMany({});
});

/* ------------------------------------------------------------------ create */

test('createTask stores the task against the token user, not the request body', async () => {
    const res = await call(createTask, {
        user: ALICE,
        body: { ...validTask(), userId: BOB.toString() },
    });

    assert.equal(res.statusCode, 201);

    const stored = await Task.findById(res.body.data.task._id);
    assert.equal(stored.userId.toString(), ALICE.toString(), 'body userId must be ignored');
});

test('createTask applies the documented defaults', async () => {
    const res = await call(createTask, { user: ALICE, body: validTask() });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.task.status, 'pending');
    assert.equal(res.body.data.task.priority, 'medium');
    assert.equal(res.body.data.task.category, 'other');
});

test('createTask rejects a blank title with 400', async () => {
    const result = await call(createTask, { user: ALICE, body: validTask({ title: '   ' }) });

    assertFails(result, 400);
    assert.equal(await Task.countDocuments({}), 0, 'nothing may be written on a 400');
});

test('createTask persists the dashboard fields end to end', async () => {
    const res = await call(createTask, {
        user: ALICE,
        body: validTask({
            context: 'Planner Core',
            estimateMinutes: 105,
            tags: ['  Auth ', 'auth', 'Security'],
            subtasks: ['Draft the outline', { title: 'Review with the team', completed: true }],
        }),
    });

    assert.equal(res.statusCode, 201);

    // Re-read from the database rather than trusting the response body: the point is what
    // MongoDB actually holds, including the normalisation done before the write.
    const stored = await Task.findById(res.body.data.task._id);

    assert.equal(stored.context, 'Planner Core');
    assert.equal(stored.estimateMinutes, 105);
    assert.equal(typeof stored.estimateMinutes, 'number');
    assert.deepEqual(stored.tags, ['auth', 'security']);
    assert.deepEqual(
        stored.subtasks.map((subtask) => ({ ...subtask.toObject() })),
        [
            { title: 'Draft the outline', completed: false },
            { title: 'Review with the team', completed: true },
        ]
    );
    // Subtask identifiers are never read, so the schema must not mint them.
    assert.equal(stored.subtasks[0]._id, undefined);
});

test('createTask omits context rather than guessing one', async () => {
    const res = await call(createTask, { user: ALICE, body: validTask() });
    const stored = await Task.findById(res.body.data.task._id);

    assert.equal(res.statusCode, 201);
    assert.equal(stored.context, undefined);
});

test('createTask rejects an unknown project and writes nothing', async () => {
    const result = await call(createTask, {
        user: ALICE,
        body: validTask({ context: 'Some New Project' }),
    });

    assertFails(result, 400);
    assert.equal(await Task.countDocuments({}), 0);
});

test('createTask rejects an over-long estimate and writes nothing', async () => {
    const result = await call(createTask, {
        user: ALICE,
        body: validTask({ estimateMinutes: 5000 }),
    });

    assertFails(result, 400);
    assert.equal(await Task.countDocuments({}), 0);
});

test('updateTask can clear an estimate but not a required field', async () => {
    const created = await call(createTask, {
        user: ALICE,
        body: validTask({ estimateMinutes: 60 }),
    });
    const id = created.body.data.task._id;

    const cleared = await call(updateTask, {
        user: ALICE,
        params: { id },
        body: { estimateMinutes: null },
    });

    assert.equal(cleared.statusCode, 200);

    const stored = await Task.findById(id);
    assert.equal(stored.estimateMinutes, undefined);
    // The response must reflect the cleared state, not the pre-update document.
    assert.equal(cleared.body.data.task.estimateMinutes, undefined);
});

test('updateTask can clear a description', async () => {
    // Same defect, found while testing estimateMinutes: `$set: { description: undefined }`
    // was stripped by Mongoose, so nulling a description returned success and changed
    // nothing.
    const created = await call(createTask, {
        user: ALICE,
        body: validTask({ description: 'Remove me' }),
    });
    const id = created.body.data.task._id;

    assert.equal(created.body.data.task.description, 'Remove me');

    const cleared = await call(updateTask, {
        user: ALICE,
        params: { id },
        body: { description: null },
    });

    assert.equal(cleared.statusCode, 200);

    const stored = await Task.findById(id);
    assert.equal(stored.description, undefined);
});

/* -------------------------------------------------------------------- read */

test('getTasks never returns another user\'s tasks', async () => {
    await Task.create({ ...validTask({ title: 'Alice one' }), userId: ALICE });
    await Task.create({ ...validTask({ title: 'Alice two' }), userId: ALICE });
    await Task.create({ ...validTask({ title: 'Bob secret' }), userId: BOB });

    const res = await call(getTasks, { user: ALICE });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.tasks.length, 2, 'cross-user leakage in getTasks');
    for (const task of res.body.data.tasks) {
        assert.equal(task.userId.toString(), ALICE.toString());
    }
});

test('getTasks applies server-side filters', async () => {
    await Task.create({ ...validTask({ title: 'A' }), userId: ALICE, status: 'completed' });
    await Task.create({ ...validTask({ title: 'B' }), userId: ALICE, status: 'pending' });

    const res = await call(getTasks, { user: ALICE, query: { status: 'completed' } });

    assert.equal(res.body.data.tasks.length, 1);
    assert.equal(res.body.data.tasks[0].status, 'completed');
});

test('getTasks sorts newest first', async () => {
    const older = await Task.create({ ...validTask({ title: 'Older' }), userId: ALICE });
    const newer = await Task.create({ ...validTask({ title: 'Newer' }), userId: ALICE });
    await Task.updateOne({ _id: older._id }, { dateCreated: new Date('2020-01-01') });

    const res = await call(getTasks, { user: ALICE });

    // A real Express response is JSON-encoded, which stringifies the ObjectId; the mock
    // hands back the raw document, so compare via toString() as the wire format would.
    assert.equal(res.body.data.tasks[0]._id.toString(), newer._id.toString());
});

/* ------------------------------------------------------------------ update */

/*
 * Defect B-5, and the reason this file exists. `findOneAndUpdate` defaults to returning the
 * document as it was *before* the update, so the response — and therefore the dashboard row
 * the user is looking at — silently showed stale values. A test that only checked the status
 * code would never have caught it.
 */
test('updateTask returns the document as it is after the change', async () => {
    const created = await Task.create({ ...validTask(), userId: ALICE });

    const res = await call(updateTask, {
        user: ALICE,
        params: { id: created._id.toString() },
        body: { title: 'Renamed after update' },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.task.title, 'Renamed after update');
    assert.notEqual(res.body.data.task.title, 'Write the report');
});

/*
 * Defect B-4's actual persistence half. With `runValidators` unset, Mongo accepts a value
 * outside the enum, and the task then belongs to no bucket — so progress percentages drift
 * instead of erroring.
 */
test('updateTask refuses to persist an out-of-enum value', async () => {
    const created = await Task.create({ ...validTask(), userId: ALICE });

    assertFails(
        await call(updateTask, {
            user: ALICE,
            params: { id: created._id.toString() },
            body: { priority: 'urgent' },
        }),
        400
    );

    const untouched = await Task.findById(created._id);
    assert.equal(untouched.priority, 'medium', 'the bad write must not land');
});

/*
 * The test above is stopped by validateTaskPayload, not by the database — so on its own it
 * proves nothing about `runValidators`. This one isolates the option: the exact write the
 * validator blocks, issued straight at the model.
 *
 * It matters because `runValidators` is the second line of defence. The moment a field is
 * added to the schema without a matching rule in the validator, this is the only thing
 * standing between a bad request and a silently corrupt row.
 */
test('runValidators is load-bearing: it blocks the write that the validator would have blocked', async () => {
    const created = await Task.create({ ...validTask(), userId: ALICE });
    const id = created._id.toString();

    const unguarded = await Task.findOneAndUpdate(
        { _id: id },
        { $set: { priority: 'urgent' } },
        { returnDocument: 'after' }
    );
    assert.equal(unguarded.priority, 'urgent', 'without the option Mongo accepts the bad value');

    await assert.rejects(
        Task.findOneAndUpdate(
            { _id: id },
            { $set: { category: 'Marketing' } },
            { returnDocument: 'after', runValidators: true }
        ),
        /validation/i
    );

    const stored = await Task.findById(id);
    assert.equal(stored.category, 'other', 'the guarded write must not land');
});

/*
 * The schema mirrors the validator's length limits. Without this, `runValidators` in the
 * controller has nothing to enforce for text fields — the enums are already blocked by
 * validateTaskPayload, so a too-long title was the one bad write that could slip through
 * to the database.
 */
test('the schema enforces the same title limit as the validator', async () => {
    await assert.rejects(
        Task.create({ ...validTask({ title: 'x'.repeat(201) }), userId: ALICE }),
        /validation/i
    );

    await assert.rejects(
        Task.create({ ...validTask(), description: 'y'.repeat(5001), userId: ALICE }),
        /validation/i
    );

    const ok = await Task.create({ ...validTask({ title: 'x'.repeat(200) }), userId: ALICE });
    assert.equal(ok.title.length, 200, 'exactly at the limit must be allowed');
});

test('updateTask cannot be used to move a task between users', async () => {
    const bobTask = await Task.create({ ...validTask({ title: 'Bob only' }), userId: BOB });

    assertFails(
        await call(updateTask, {
            user: ALICE,
            params: { id: bobTask._id.toString() },
            body: { title: 'Hijacked' },
        }),
        404
    );

    assert.equal((await Task.findById(bobTask._id)).title, 'Bob only');
});

test('updateTask ignores a spoofed userId in the body', async () => {
    const created = await Task.create({ ...validTask(), userId: ALICE });

    const res = await call(updateTask, {
        user: ALICE,
        params: { id: created._id.toString() },
        body: { title: 'Renamed', userId: BOB.toString() },
    });

    assert.equal(res.body.data.task.userId.toString(), ALICE.toString());
});

test('updateTask rejects an empty update', async () => {
    const created = await Task.create({ ...validTask(), userId: ALICE });

    assertFails(
        await call(updateTask, {
            user: ALICE,
            params: { id: created._id.toString() },
            body: {},
        }),
        400
    );
});

test('updateTask rejects a malformed id without touching the database', async () => {
    assertFails(
        await call(updateTask, {
            user: ALICE,
            params: { id: 'not-an-object-id' },
            body: { title: 'Renamed' },
        }),
        404
    );

    assert.equal(await Task.countDocuments({}), 0);
});

/* ------------------------------------------------------------------ delete */

test('deleteTask removes the caller\'s own task', async () => {
    const created = await Task.create({ ...validTask(), userId: ALICE });

    const res = await call(deleteTask, {
        user: ALICE,
        params: { id: created._id.toString() },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(await Task.countDocuments({}), 0);
});

test('deleteTask cannot delete another user\'s task', async () => {
    const bobTask = await Task.create({ ...validTask(), userId: BOB });

    assertFails(
        await call(deleteTask, {
            user: ALICE,
            params: { id: bobTask._id.toString() },
        }),
        404
    );

    assert.equal(await Task.countDocuments({}), 1, 'Bob\'s task must survive');
});

test('deleting an already-deleted task reports 404 rather than succeeding twice', async () => {
    const created = await Task.create({ ...validTask(), userId: ALICE });
    const id = created._id.toString();

    await call(deleteTask, { user: ALICE, params: { id } });

    assertFails(await call(deleteTask, { user: ALICE, params: { id } }), 404);
});

/* ---------------------------------------------------------------- response */

test('every controller response uses the standard envelope', async () => {
    const created = await Task.create({ ...validTask(), userId: ALICE });
    const id = created._id.toString();

    const responses = [
        await call(createTask, { user: ALICE, body: validTask({ title: 'Envelope' }) }),
        await call(getTasks, { user: ALICE }),
        await call(updateTask, { user: ALICE, params: { id }, body: { title: 'Envelope 2' } }),
        await call(deleteTask, { user: ALICE, params: { id } }),
    ];

    for (const res of responses) {
        assert.equal(res.body.ok, true, 'envelope must carry ok');
        assert.ok('data' in res.body, 'envelope must carry data');
        // The human-readable message lives inside `data`, alongside the payload itself,
        // so that adding a field can never collide with `ok`.
        assert.equal(typeof res.body.data.message, 'string');
    }
});

/* ------------------------------------------------------------------ dates */

test('a deadline is persisted at local noon, not UTC midnight', async () => {
    const res = await call(createTask, {
        user: ALICE,
        body: validTask({ deadline: '2099-10-24' }),
    });

    const stored = await Task.findById(res.body.data.task._id);

    // The round-trip through Mongo can shift the instant, so compare the calendar day as
    // the server reports it — that is exactly what invariant I-4 is about.
    assert.equal(stored.deadline.getFullYear(), 2099);
    assert.equal(stored.deadline.getMonth(), 9);
    assert.equal(stored.deadline.getDate(), 24);
});