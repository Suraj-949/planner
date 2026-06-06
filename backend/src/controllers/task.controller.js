const Task = require('../models/task.model');

async function createTask(req, res) {

    try {
        
        const { title, description, status, deadline } = req.body;
        // Get the user ID from the authenticated request
        const userId = req.user; 

        console.log("header : ", req.headers)
        
        // Validate required fields
        if (!title || !deadline ) {
            return res.status(400).json({
                message: 'Title and deadline are required'
            });
        }

        // Validate deadline format
        const parsedDeadline = new Date(deadline);
        if (isNaN(parsedDeadline.getTime())) {
            return res.status(400).json({
                message: 'Invalid deadline format. Please provide a valid date.'
            });
        }

        // Valid status values
        const validStatuses = ['pending', 'in-progress', 'completed'];

        const taskData = { title, description, deadline: parsedDeadline, userId };

        // validate status
        if (status !== undefined && status !== null && status !== '') {
            if (!validStatuses.includes(status)) {
                return res.status(400) .json({
                    message : "Invalid status."
                })
            }
            taskData.status = status;
        }

        // Create a new task instance and save it to the database
        const task = new Task( taskData );
        await task.save()

        res.status(201).json({
            message: 'Task created successfully',
            task: task
        });

    } catch(err) {
        res.status(400).json({
            message: 'Error creating task',
            error: err
        });
    }

}

async function getTasks(req, res) {
    try {
        const userId = req.user;

        const tasks = await Task.find({ userId }).sort({ dateCreated: -1 });

        res.status(200).json({
            message: 'Tasks fetched successfully',
            tasks
        });
    } catch (err) {
        res.status(500).json({
            message: 'Error fetching tasks',
            error: err.message
        });
    }
}

module.exports = { createTask, getTasks };
