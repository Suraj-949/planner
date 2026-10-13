const Project = require('../models/project.model');
const Task = require('../models/task.model');
const { asyncHandler, badRequest, buildUpdate } = require('../utils/http');
const { ok, created } = require('../utils/response');
const { validateProjectPayload, isValidEntityId } = require('../utils/entityValidation');
const { assertOwnedProject, assertOwnedGoal } = require('../services/ownership.service');

/*
 * Projects, plus the open-task count that makes a project list useful.
 *
 * The count is derived from the tasks rather than stored on the project (guiding
 * principle 2): a `taskCount` field would need incrementing on create and decrementing on
 * delete, and any missed update would leave it permanently wrong with nothing to
 * disagree with.
 */

/*
 * Open tasks per project, in one grouped count rather than one query per row. A project
 * page listing twenty projects would otherwise fire twenty extra round trips.
 */
const openTaskCounts = async (projectIds) => {
    const result = new Map(projectIds.map((id) => [String(id), 0]));

    if (projectIds.length === 0) return result;

    const rows = await Task.aggregate([
        {
            $match: {
                projectId: { $in: projectIds },
                status: { $ne: 'completed' },
            },
        },
        { $group: { _id: '$projectId', count: { $sum: 1 } } },
    ]);

    for (const row of rows) result.set(String(row._id), row.count);

    return result;
};

const createProject = asyncHandler(async (req, res) => {
    const { value, errors } = validateProjectPayload(req.body);

    if (errors.length > 0) throw badRequest(errors[0], errors);

    // A goal link is checked for existence *and* ownership before it is stored, so a
    // project cannot be filed under someone else's goal.
    if (value.goalId) await assertOwnedGoal(value.goalId, req.user);

    const project = await Project.create({ ...value, userId: req.user });

    created(res, { message: 'Project created successfully', project: { ...project.toObject(), openTaskCount: 0 } });
});

const getProjects = asyncHandler(async (req, res) => {
    const filter = { userId: req.user };

    if (req.query.goalId) filter.goalId = req.query.goalId;

    /*
     * Archived projects are excluded by default. `archivedAt: null` matches both documents
     * where the field is null and documents where it is absent, which is the whole reason
     * the model's index is not sparse — see project.model.js.
     */
    const archived = req.query.archived === 'true';

    if (archived) filter.archivedAt = { $ne: null };
    else filter.archivedAt = null;

    const projects = await Project.find(filter).sort({ _id: -1 }).lean();

    const counts = await openTaskCounts(projects.map((project) => project._id));

    ok(res, 200, {
        message: 'Projects fetched successfully',
        projects: projects.map((project) => ({
            ...project,
            openTaskCount: counts.get(String(project._id)) ?? 0,
        })),
    });
});

const updateProject = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidEntityId(id)) throw badRequest('Invalid project id');

    const { value, errors } = validateProjectPayload(req.body, { partial: true });

    if (errors.length > 0) throw badRequest(errors[0], errors);
    if (Object.keys(value).length === 0) throw badRequest('No valid fields provided to update');

    await assertOwnedProject(id, req.user);

    // Checked after the ownership check above, so a caller cannot use the goal link to
    // probe for the existence of a goal they do not own.
    if (value.goalId) await assertOwnedGoal(value.goalId, req.user);

    const project = await Project.findOneAndUpdate(
        { _id: id, userId: req.user },
        buildUpdate(value),
        { returnDocument: 'after', runValidators: true }
    ).lean();

    ok(res, 200, { message: 'Project updated successfully', project });
});

/*
 * Archive rather than delete, so the history of the tasks that belonged to it survives.
 * `archivedAt` is stamped rather than set true, which is what lets the UI later answer
 * "what did this look like in March".
 */
const archiveProject = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidEntityId(id)) throw badRequest('Invalid project id');

    await assertOwnedProject(id, req.user);

    const project = await Project.findOneAndUpdate(
        { _id: id, userId: req.user },
        { $set: { archivedAt: new Date() } },
        { returnDocument: 'after', runValidators: true }
    ).lean();

    ok(res, 200, { message: 'Project archived successfully', project });
});

const unarchiveProject = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidEntityId(id)) throw badRequest('Invalid project id');

    await assertOwnedProject(id, req.user);

    const project = await Project.findOneAndUpdate(
        { _id: id, userId: req.user },
        { $unset: { archivedAt: 1 } },
        { returnDocument: 'after', runValidators: true }
    ).lean();

    ok(res, 200, { message: 'Project restored successfully', project });
});

/*
 * A project is archived, not hard-deleted, but the route exists so the UI has one
 * consistent verb for "put this away". Hard deletion is deliberately absent: a project's
 * tasks are real work, and dropping the parent would orphan them silently.
 */
const deleteProject = archiveProject;

module.exports = {
    createProject,
    getProjects,
    updateProject,
    archiveProject,
    unarchiveProject,
    deleteProject,
};
