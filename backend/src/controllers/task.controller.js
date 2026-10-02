const Task = require('../models/task.model');
const { asyncHandler, badRequest, notFound } = require('../utils/http');
const { validateTaskPayload, isValidTaskId } = require('../utils/taskValidation');
const { ok, created } = require('../utils/response');

const createTask = asyncHandler(async (req, res) => {
    const { value, errors } = validateTaskPayload(req.body);

    if (errors.length > 0) {
        throw badRequest(errors[0], errors);
    }

    // userId comes from the verified token, never from the body — otherwise any caller
    // could create tasks against another account.
    const task = await Task.create({ ...value, userId: req.user });

    created(res, { message: 'Task created successfully', task });
});

const getTasks = asyncHandler(async (req, res) => {
    const filter = { userId: req.user };

    // Optional filters, applied server-side so the client never has to fetch everything
    // to narrow it down.
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.category) filter.category = req.query.category;

    const tasks = await Task.find(filter).sort({ dateCreated: -1 });

    ok(res, 200, { message: 'Tasks fetched successfully', tasks });
});

const updateTask = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidTaskId(id)) {
        throw notFound('Task not found');
    }

    const { value, errors } = validateTaskPayload(req.body, { partial: true });

    if (errors.length > 0) {
        throw badRequest(errors[0], errors);
    }

    if (Object.keys(value).length === 0) {
        throw badRequest('No valid fields provided to update');
    }

    /*
     * A field the client explicitly nulled lands in `value` as `undefined`, meaning "clear
     * this". Mongoose strips undefined keys out of `$set`, so passing that straight through
     * silently ignored the request and returned the unchanged document — "clear the
     * description" had never actually worked. Those keys go to `$unset` instead.
     */
    const set = Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
    const unset = Object.fromEntries(
        Object.keys(value)
            .filter((key) => value[key] === undefined)
            .map((key) => [key, 1])
    );

    const update = {};

    if (Object.keys(set).length > 0) update.$set = set;
    if (Object.keys(unset).length > 0) update.$unset = unset;

    // returnDocument was missing, so the *pre*-update document was sent back and the
    // client rendered stale data. runValidators was also missing, which let an
    // out-of-enum value be written straight to Mongo.
    const task = await Task.findOneAndUpdate(
        { _id: id, userId: req.user },
        update,
        { returnDocument: 'after', runValidators: true }
    );

    if (!task) {
        throw notFound('Task not found');
    }

    ok(res, 200, { message: 'Task updated successfully', task });
});

const deleteTask = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidTaskId(id)) {
        throw notFound('Task not found');
    }

    const task = await Task.findOneAndDelete({ _id: id, userId: req.user });

    if (!task) {
        throw notFound('Task not found');
    }

    ok(res, 200, { message: 'Task deleted successfully', task });
});

module.exports = { createTask, getTasks, updateTask, deleteTask };
