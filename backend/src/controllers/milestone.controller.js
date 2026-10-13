const Milestone = require('../models/milestone.model');
const { asyncHandler, badRequest, notFound } = require('../utils/http');
const { ok, created } = require('../utils/response');
const { validateMilestonePayload, isValidEntityId } = require('../utils/entityValidation');
const { assertOwnedGoal, assertOwnedMilestone } = require('../services/ownership.service');

/*
 * Milestones have no `userId` of their own; tenancy is resolved through the goal. Every
 * handler therefore touches the goal first — either to prove the caller may create under
 * it, or to resolve the goal a given milestone belongs to before authorising anything.
 */

const createMilestone = asyncHandler(async (req, res) => {
    const { value, errors } = validateMilestonePayload(req.body);

    if (errors.length > 0) throw badRequest(errors[0], errors);

    // Rejects a goal that does not exist *or* belongs to someone else, before the
    // milestone is written. Writing first would leave an orphan pointing at a goal the
    // caller cannot see.
    await assertOwnedGoal(value.goalId, req.user);

    const milestone = await Milestone.create(value);

    created(res, { message: 'Milestone created successfully', milestone });
});

const getMilestones = asyncHandler(async (req, res) => {
    const { goalId } = req.query;

    if (!goalId) throw badRequest('goalId is required');

    if (!isValidEntityId(goalId)) throw badRequest('Invalid goal id');

    await assertOwnedGoal(goalId, req.user);

    // Due date first so overdue milestones lead the list, then completion so finished ones
    // sink below everything still open regardless of their date.
    const milestones = await Milestone.find({ goalId })
        .sort({ completedAt: 1, dueDate: 1, _id: -1 })
        .lean();

    ok(res, 200, { message: 'Milestones fetched successfully', milestones });
});

const updateMilestone = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidEntityId(id)) throw badRequest('Invalid milestone id');

    const { value, errors } = validateMilestonePayload(req.body, { partial: true });

    if (errors.length > 0) throw badRequest(errors[0], errors);
    if (Object.keys(value).length === 0) throw badRequest('No valid fields provided to update');

    const existing = await assertOwnedMilestone(id, req.user);

    // Moving a milestone between goals is refused rather than applied: the target goal
    // would need its own ownership check, and a silent cross-user move would be a tenancy
    // hole dressed up as a feature.
    if (value.goalId !== undefined && String(value.goalId) !== String(existing.goalId)) {
        throw badRequest('A milestone cannot be moved to a different goal');
    }

    delete value.goalId;

    const milestone = await Milestone.findOneAndUpdate(
        { _id: id },
        { $set: value },
        { returnDocument: 'after', runValidators: true }
    ).lean();

    ok(res, 200, { message: 'Milestone updated successfully', milestone });
});

/*
 * Ticking a milestone sets `completedAt` to now; un-ticking clears it.
 *
 * The timestamp rather than a boolean is what makes a late milestone legible later —
 * which one slipped, and by how much — and it is also what R-GOAL-1 counts.
 */
const setMilestoneCompleted = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidEntityId(id)) throw badRequest('Invalid milestone id');

    await assertOwnedMilestone(id, req.user);

    const completed = req.body?.completed !== false;

    const milestone = await Milestone.findOneAndUpdate(
        { _id: id },
        { $set: { completedAt: completed ? new Date() : null } },
        { returnDocument: 'after', runValidators: true }
    ).lean();

    if (!milestone) throw notFound('Milestone not found');

    ok(res, 200, { message: completed ? 'Milestone completed' : 'Milestone reopened', milestone });
});

const deleteMilestone = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidEntityId(id)) throw badRequest('Invalid milestone id');

    await assertOwnedMilestone(id, req.user);

    await Milestone.deleteOne({ _id: id });

    ok(res, 200, { message: 'Milestone deleted successfully' });
});

module.exports = {
    createMilestone,
    getMilestones,
    updateMilestone,
    setMilestoneCompleted,
    deleteMilestone,
};
