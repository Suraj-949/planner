const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    dateCreated: {
        type: Date,
        default: Date.now
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
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

module.exports = mongoose.model('Task', taskSchema);

