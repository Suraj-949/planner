const mongoose = require('mongoose');

/*
 * Subtask checklist. `_id: false` because a subdocument identifier is never read — the
 * position in the array is the identity, matching how the UI keys its rows.
 */
const subtaskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        // Mirrors MAX_SUBTASK_TITLE_LENGTH in utils/taskValidation.js.
        maxlength: 200,
    },
    completed: {
        type: Boolean,
        default: false,
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
        // Mirrors MAX_TITLE_LENGTH in utils/taskValidation.js. The validator rejects the
        // bad request first; this keeps the schema honest on its own, so the two layers
        // agree and runValidators stays a real second line of defence.
        maxlength: 200,
    },
    description: {
        type: String,
        // Mirrors MAX_DESCRIPTION_LENGTH in utils/taskValidation.js.
        maxlength: 5000,
    },
   
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'completed'],
        default: 'pending'
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
    category: {
        type : String,
        enum: ['DSA', 'development', 'college', 'personal', 'work', 'other'],
        default: 'other'
    },
    priority: {
        type: String,
        enum: ["high", "medium", "low"],
        default: "medium",
    },
    // Which project the task belongs to. Optional on purpose: it has no meaningful default,
    // and guessing one would file a task under the wrong project. Mirrors VALID_CONTEXTS.
    context: {
        type: String,
        enum: ['Planner Core', 'Obsidian UI', 'Strategy 2025', 'Infrastructure'],
    },
    // Stored as whole minutes rather than a pre-formatted "1h 30m" string, so durations can
    // be sorted, summed and aggregated in MongoDB. The UI formats on render.
    // Mirrors MAX_ESTIMATE_MINUTES in utils/taskValidation.js.
    estimateMinutes: {
        type: Number,
        min: 0,
        max: 1440,
    },
    // Free-text keywords backing the dashboard search. Distinct from `subtasks`, which is a
    // checklist; the UI previously fed subtask text into tags, conflating the two.
    tags: {
        type: [String],
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

// `context` backs the dashboard's project filter, `tags` backs its free-text search. Both are
// user-scoped, so they lead with userId. Only one array field is indexed — MongoDB refuses to
// build a compound multikey index across two arrays, which rules out `subtasks` here.
taskSchema.index({ userId: 1, context: 1 }, { background: true });
taskSchema.index({ userId: 1, tags: 1 }, { background: true });

module.exports = mongoose.model('Task', taskSchema);

