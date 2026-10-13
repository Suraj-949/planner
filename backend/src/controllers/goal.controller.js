const Goal = require('../models/goal.model');
const { asyncHandler, badRequest, buildUpdate } = require('../utils/http');
const { ok, created } = require('../utils/response');
const { validateGoalPayload, isValidEntityId } = require('../utils/entityValidation');
const { withProgress, withProgressFor } = require('../services/goal.service');
const { assertOwnedGoal, deleteGoalData } = require('../services/ownership.service');

const createGoal = asyncHandler(async (req, res) => {
    const { value, errors } = validateGoalPayload(req.body);

    if (errors.length > 0) throw badRequest(errors[0], errors);

    const goal = await Goal.create({ ...value, userId: req.user });

    // Returned with progress (0%, zero milestones) rather than bare, so the create response
    // has the same shape as every later read and a client needs no special case for it.
    created(res, { message: 'Goal created successfully', goal: await withProgress(goal) });
});

/*
 * List, newest-first by target date. Goals with no target date sort last on most
 * databases, which is the useful answer: an undated goal is a direction, not a
 * commitment, so it should not outrank one that is due.
 */
const getGoals = asyncHandler(async (req, res) => {
    const filter = { userId: req.user };

    if (req.query.status) filter.status = req.query.status;

    const goals = await Goal.find(filter).sort({ targetDate: 1, _id: -1 }).lean();

    ok(res, 200, { message: 'Goals fetched successfully', goals: await withProgressFor(goals) });
});

const getGoal = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidEntityId(id)) throw badRequest('Invalid goal id');

    const goal = await assertOwnedGoal(id, req.user);

    ok(res, 200, { message: 'Goal fetched successfully', goal: await withProgress(goal) });
});

const updateGoal = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidEntityId(id)) throw badRequest('Invalid goal id');

    const { value, errors } = validateGoalPayload(req.body, { partial: true });

    if (errors.length > 0) throw badRequest(errors[0], errors);
    if (Object.keys(value).length === 0) throw badRequest('No valid fields provided to update');

    // Confirms the goal exists *and* belongs to this user before anything is written — the
    // alternative is a write that succeeds for any valid id.
    await assertOwnedGoal(id, req.user);

    const goal = await Goal.findOneAndUpdate(
        { _id: id, userId: req.user },
        buildUpdate(value),
        { returnDocument: 'after', runValidators: true }
    ).lean();

    ok(res, 200, { message: 'Goal updated successfully', goal: await withProgress(goal) });
});

const deleteGoal = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidEntityId(id)) throw badRequest('Invalid goal id');

    await assertOwnedGoal(id, req.user);
    await deleteGoalData(id, req.user);

    ok(res, 200, { message: 'Goal deleted successfully' });
});

module.exports = { createGoal, getGoals, getGoal, updateGoal, deleteGoal };
