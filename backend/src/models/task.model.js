const mongoose = require('mongoose');
const {
    TASK_STATUSES,
    TASK_PRIORITIES,
    RECURRENCE_FREQUENCIES,
    MAX_TITLE_LENGTH,
    MAX_DESCRIPTION_LENGTH,
    MAX_SUBTASK_TITLE_LENGTH,
    MAX_CATEGORY_LENGTH,
    MAX_ESTIMATE_MINUTES,
    MAX_ACTUAL_MINUTES,
    MAX_NOTES_LENGTH,
    MAX_RECURRENCE_INTERVAL,
} = require('../constants');

/*
 * Subtask checklist. `_id: false` because a subdocument identifier is never read — the
 * position in the array is the identity, matching how the UI keys its rows.
 *
 * Embedded rather than a collection, per ROADMAP "Open Architecture Decisions": a subtask
 * has no life outside its task and is never queried on its own, so a join would buy
 * nothing. Splitting later stays cheap because the read path already loads the parent.
 */
const subtaskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        maxlength: MAX_SUBTASK_TITLE_LENGTH,
    },
    completed: {
        type: Boolean,
        default: false,
    },
}, { _id: false });

/*
 * Recurrence rule. `_id: false` for the same reason as subtasks — the rule is a value,
 * not an entity.
 */
const recurrenceSchema = new mongoose.Schema({
    freq: {
        type: String,
        enum: RECURRENCE_FREQUENCIES,
        required: true,
    },
    // "Every N periods". Defaults to 1 because "every day" is "every 1 day".
    interval: {
        type: Number,
        min: 1,
        max: MAX_RECURRENCE_INTERVAL,
        default: 1,
    },
    /*
     * Which weekdays a weekly rule fires on, 0 = Sunday. Only meaningful when
     * freq is 'weekly'; the validator rejects the other combinations rather than
     * letting a stale day list sit in the document implying it is honoured.
     */
    daysOfWeek: {
        type: [Number],
        default: undefined,
    },
}, { _id: false });

const taskSchema = new mongoose.Schema({
    dateCreated: {
        type: Date,
        default: Date.now
    },
    title: {
        type: String,
        required: true,
        // The validator rejects the bad request first; this keeps the schema honest on its
        // own, so the two layers agree and runValidators stays a real second line of defence.
        maxlength: MAX_TITLE_LENGTH,
    },
    description: {
        type: String,
        maxlength: MAX_DESCRIPTION_LENGTH,
    },
    
    status: {
        type: String,
        enum: TASK_STATUSES,
        default: 'pending'
    },
    /*
     * When this task first became `completed`.
     *
     * Required by the server-side streak, which counts the *days* a user completed
     * something — without this the history would have to be inferred from `deadline`,
     * which is a plan, not a record.
     *
     * Stamped once and never cleared, including when the task is reopened. That is what
     * makes R-STREAK-8 work: un-completing a task does not decrement the streak, so the
     * day it was finished has to survive being un-done. `status` remains the current
     * state; `completedAt` is the immutable record of when it first happened.
     */
    completedAt: {
        type: Date,
    },
    deadline: {
        type: Date,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    /*
     * A bounded free string rather than an enum: the form offers the presets in
     * TASK_CATEGORIES plus a "Custom" option that stores the user's own label, so a closed
     * enum would reject the very value the custom field exists to capture. `runValidators`
     * still guards the length.
     */
    category: {
        type: String,
        trim: true,
        maxlength: MAX_CATEGORY_LENGTH,
        default: 'personal'
    },
    priority: {
        type: String,
        enum: TASK_PRIORITIES,
        default: "medium",
    },
    /*
     * Where the task sits in the Phase 2 hierarchy. Both optional, and both nullable so a
     * task can be explicitly unfiled rather than silently keeping a stale link.
     *
     * `goalId` is denormalised — a Project already knows its Goal. Keeping it here means
     * "everything under this goal" is one indexed query instead of a two-hop lookup on
     * every filter, at the cost of the service layer having to restate it whenever a
     * project's goal changes.
     */
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
    },
    goalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Goal',
    },
    /*
     * Present when the task repeats. Absent means it does not — there is no `never`
     * sentinel, so "is this recurring" is a presence check and cannot be contradicted.
     * Advancing the deadline after completion is the recurrence service's job (2.2).
     */
    recurrence: {
        type: recurrenceSchema,
        default: undefined,
    },
    // Stored as whole minutes rather than a pre-formatted "1h 30m" string, so durations can
    // be sorted, summed and aggregated in MongoDB. The UI formats on render.
    estimateMinutes: {
        type: Number,
        min: 0,
        max: MAX_ESTIMATE_MINUTES,
    },
    /*
     * What was actually spent, against the estimate above. Deliberately uncapped at a
     * day's worth: unlike an estimate, logged time accumulates across sessions.
     */
    actualMinutes: {
        type: Number,
        min: 0,
        max: MAX_ACTUAL_MINUTES,
    },
    // Free-text keywords backing the dashboard search. Distinct from `subtasks`, which is a
    // checklist; the UI previously fed subtask text into tags, conflating the two.
    tags: {
        type: [String],
    },
    // Working notes: context and decisions, distinct from `description`, which is the brief.
    notes: {
        type: String,
        maxlength: MAX_NOTES_LENGTH,
    },
    subtasks: {
        type: [subtaskSchema],
        default: undefined,
    }
});

/*
 * getTasks() filters by userId and sorts by dateCreated desc. Without these the query
 * scans and sorts the whole collection; the compound index covers both halves so the
 * sort never spills to memory.
 *
 * `background: true` keeps index creation from blocking startup on a large collection.
 */
taskSchema.index({ userId: 1 }, { background: true });
taskSchema.index({ userId: 1, dateCreated: -1 }, { background: true });

// `category` backs the dashboard's category filter, `tags` backs its free-text search. Both
// are user-scoped, so they lead with userId. Only one array field is indexed — MongoDB
// refuses to build a compound multikey index across two arrays, which rules out `subtasks`
// here.
taskSchema.index({ userId: 1, category: 1 }, { background: true });
taskSchema.index({ userId: 1, tags: 1 }, { background: true });

/*
 * Hierarchy filters: "tasks in this project", "tasks under this goal". Both are single
 * non-array keys, so they can be indexed alongside each other and with the user scope
 * without hitting the multikey restriction that limits `tags`.
 */
taskSchema.index({ userId: 1, projectId: 1 }, { background: true });
taskSchema.index({ userId: 1, goalId: 1 }, { background: true });

/*
 * Backs the streak aggregation, which reads every completion date for a user and walks
 * them backwards.
 */
taskSchema.index({ userId: 1, completedAt: -1 }, { background: true });

module.exports = mongoose.model('Task', taskSchema);