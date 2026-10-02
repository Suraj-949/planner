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

    // returnDocument was missing, so the *pre*-update document was sent back and the
    // client rendered stale data. runValidators was also missing, which let an
    // out-of-enum value be written straight to Mongo.
    const task = await Task.findOneAndUpdate(
        { _id: id, userId: req.user },
        { $set: value },
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
