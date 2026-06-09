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

module.exports = mongoose.model('Task', taskSchema);

