const mongoose = require('mongoose');
const {
    MAX_TITLE_LENGTH,
    MAX_DESCRIPTION_LENGTH,
} = require('../constants');

/*
 * A project groups tasks that serve one outcome. It sits between Goal and Task:
 * a goal holds milestones, a project does the work, a task is one step of it.
 *
 * `archivedAt` rather than a boolean: archiving needs to answer "what did this project
 * look like in March", which a flag with no timestamp cannot.
 */
const projectSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        maxlength: MAX_TITLE_LENGTH,
    },
    description: {
        type: String,
        maxlength: MAX_DESCRIPTION_LENGTH,
    },
    /*
     * Six-digit hex, e.g. "#4f46e5". No default: a colour is a choice the user makes
     * from a palette, and any default we invented would quietly become "the colour of
     * every project created this month". Optional rather than required, because a project
     * without a colour is still a valid project.
     */
    color: {
        type: String,
        match: /^#[0-9a-fA-F]{6}$/,
    },
    archivedAt: {
        type: Date,
    },
    /*
     * Optional. Most projects are not attached to a goal — plenty of work is just work.
     */
    goalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Goal',
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
});

/*
 * The project list filters on "not archived", which in MongoDB means archivedAt is null,
 * and the field is usually absent rather than explicitly null. A sparse index would skip
 * those documents, so the index is not sparse: the filter has to be able to match the
 * documents where the field is missing.
 */
projectSchema.index({ userId: 1, archivedAt: 1 }, { background: true });
projectSchema.index({ userId: 1, goalId: 1 }, { background: true });

module.exports = mongoose.model('Project', projectSchema);