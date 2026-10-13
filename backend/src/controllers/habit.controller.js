const mongoose = require('mongoose');
const Habit = require('../models/habit.model');
const HabitCompletion = require('../models/habitCompletion.model');
const { asyncHandler, badRequest, buildUpdate } = require('../utils/http');
const { ok, created } = require('../utils/response');
const {
    validateHabitPayload,
    validateHabitCompletionPayload,
    isValidEntityId,
} = require('../utils/entityValidation');
const { assertOwnedHabit, deleteHabitData } = require('../services/ownership.service');
const { summarise, summariseAll } = require('../services/habit.service');
const { SERVER_TIMEZONE } = require('../utils/dates');

const createHabit = asyncHandler(async (req, res) => {
    const { value, errors } = validateHabitPayload(req.body);

    if (errors.length > 0) throw badRequest(errors[0], errors);

    const habit = await Habit.create({ ...value, userId: req.user });

    created(res, {
        message: 'Habit created successfully',
        habit: { ...habit.toObject(), currentStreak: 0, longestStreak: 0, completionRate: 0 },
    });
});

const getHabits = asyncHandler(async (req, res) => {
    // Archived habits are hidden unless explicitly asked for; the same missing-vs-null
    // rule as the project list applies.
    const filter = { userId: req.user };

    if (req.query.archived === 'true') filter.archivedAt = { $ne: null };
    else filter.archivedAt = null;

    // One call, not one per habit: the streak logic is the same pure function either way,
    // and a pipeline that also bucketed by cadence would have to reimplement it in MQL.
    const summaries = await summariseAll(req.user);

    const habits = summaries
        .map(({ habit, currentStreak, longestStreak, completionRate, completedCount }) => ({
            ...habit,
            currentStreak,
            longestStreak,
            completionRate,
            completedCount,
        }))
        .filter((habit) =>
            req.query.archived === 'true' ? habit.archivedAt != null : habit.archivedAt == null
        );

    ok(res, 200, { message: 'Habits fetched successfully', habits });
});

const getHabit = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidEntityId(id)) throw badRequest('Invalid habit id');

    const habit = await assertOwnedHabit(id, req.user);

    ok(res, 200, { message: 'Habit fetched successfully', habit: { ...habit, ...(await summarise(habit)) } });
});

const updateHabit = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidEntityId(id)) throw badRequest('Invalid habit id');

    const { value, errors } = validateHabitPayload(req.body, { partial: true });

    if (errors.length > 0) throw badRequest(errors[0], errors);
    if (Object.keys(value).length === 0) throw badRequest('No valid fields provided to update');

    await assertOwnedHabit(id, req.user);

    const habit = await Habit.findOneAndUpdate(
        { _id: id, userId: req.user },
        buildUpdate(value),
        { returnDocument: 'after', runValidators: true }
    ).lean();

    ok(res, 200, { message: 'Habit updated successfully', habit });
});

/*
 * Archive rather than delete, so the completion history survives — otherwise archiving a
 * habit would erase the streak that made it worth tracking, and un-archiving would start
 * from zero.
 */
const archiveHabit = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidEntityId(id)) throw badRequest('Invalid habit id');

    await assertOwnedHabit(id, req.user);

    const habit = await Habit.findOneAndUpdate(
        { _id: id, userId: req.user },
        { $set: { archivedAt: new Date() } },
        { returnDocument: 'after', runValidators: true }
    ).lean();

    ok(res, 200, { message: 'Habit archived successfully', habit });
});

const unarchiveHabit = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidEntityId(id)) throw badRequest('Invalid habit id');

    await assertOwnedHabit(id, req.user);

    const habit = await Habit.findOneAndUpdate(
        { _id: id, userId: req.user },
        { $unset: { archivedAt: 1 } },
        { returnDocument: 'after', runValidators: true }
    ).lean();

    ok(res, 200, { message: 'Habit restored successfully', habit });
});

/*
 * Deleting a habit removes its completion rows in the same call (see
 * ownership.service). Leaving them behind would leak a user's history into an aggregate
 * that no longer has a habit to attribute it to.
 */
const deleteHabit = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidEntityId(id)) throw badRequest('Invalid habit id');

    await assertOwnedHabit(id, req.user);
    await deleteHabitData(id, req.user);

    ok(res, 200, { message: 'Habit deleted successfully' });
});

/*
 * Tick or untick a habit for a date.
 *
 * Idempotent: ticking twice creates one row, not two. The unique index on
 * (habitId, date) makes that the database's problem rather than a race the service has
 * to win — a duplicate-key error here means "already ticked", which is a success, not a
 * failure. Without it the streak would count the same day twice.
 *
 * Unticking deletes the row rather than flagging it, so the streak cannot drift out of
 * step with a counter that someone forgot to decrement.
 */
const tickHabit = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidEntityId(id)) throw badRequest('Invalid habit id');

    await assertOwnedHabit(id, req.user);

    const { value, errors } = validateHabitCompletionPayload({ ...req.body, habitId: id });

    if (errors.length > 0) throw badRequest(errors[0], errors);

    const completed = req.body?.completed !== false;

    if (completed) {
        try {
            await HabitCompletion.create({ habitId: id, userId: req.user, date: value.date });
        } catch (error) {
            // 11000 is the unique index doing its job — the day is already ticked.
            if (error.code !== 11000) throw error;
        }
    } else {
        await HabitCompletion.deleteMany({ habitId: id, userId: req.user, date: value.date });
    }

    const habit = await Habit.findById(id).lean();

    ok(res, 200, {
        message: completed ? 'Habit ticked' : 'Habit unticked',
        habit: { ...habit, ...(await summarise(habit)) },
    });
});

/*
 * History for a habit over a date range, for the calendar and the streak graph.
 *
 * Dates are returned as local day keys so the client never has to re-derive "which day is
 * this instant" — that is the step that produces off-by-one errors in every timezone
 * west of UTC.
 */
const getHabitHistory = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidEntityId(id)) throw badRequest('Invalid habit id');

    await assertOwnedHabit(id, req.user);

    // Bucketed to a local day key here rather than returned as raw instants, so the client
    // never re-derives "which day is this" — the step that produces off-by-one errors in
    // every timezone west of UTC.
    const completions = await HabitCompletion.aggregate([
        { $match: { habitId: new mongoose.Types.ObjectId(String(id)), userId: req.user } },
        { $sort: { date: -1 } },
        { $limit: 400 },
        {
            $project: {
                day: {
                    $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: SERVER_TIMEZONE },
                },
            },
        },
    ]);

    ok(res, 200, {
        message: 'Habit history fetched successfully',
        dates: completions.map((row) => row.day).filter(Boolean),
    });
});

module.exports = {
    createHabit,
    getHabits,
    getHabit,
    updateHabit,
    archiveHabit,
    unarchiveHabit,
    deleteHabit,
    tickHabit,
    getHabitHistory,
};
