const Task = require('../models/task.model');


function validateStatus(status) {
    const validStatuses = ['pending', 'in-progress', 'completed'];
    
    // If status is provided, check if it's one of the valid options. If not, return an error message. If status is not provided, we can allow it to be optional and default to 'pending' in the model.
    if (status && !validStatuses.includes(status)) {
        return 'Invalid status value'
    }
}

function validateCategory(category) {
    const validCategories = ['DSA', 'development', 'college', 'personal', 'work', 'other'];
    
    if (category && !validCategories.includes(category)) {
        return 'Invalid category value'
    }
}

function validatePriority(priority) {
    const validPriorities = ['high', 'medium', 'low'];

    if (priority && !validPriorities.includes(priority)) {
        return 'Invalid priority value'
    }
}


// This function validates the deadline input and ensures it's a valid date. It returns an error message if the format is invalid, or the parsed date if it's valid.
function validateDeadline(deadline) {
    const parsedDeadline = new Date(deadline);

    if (isNaN(parsedDeadline.getTime())) {
        return {
            error: 'Invalid deadline format. Please provide a valid date.'
        }
    }

    return { value: parsedDeadline };
}


async function createTask(req, res) {
    try {
        
        const { title, description, status, deadline, category, priority } = req.body;
        // Get the user ID from the authenticated request
        const userId = req.user; 

        console.log("header : ", req.headers)
        
        // Validate required fields
        if (!title || !deadline ) {
            return res.status(400).json({
                message: 'Title and deadline are required'
            });
        }

        // validate status
        const statusError = validateStatus(status);
        if (statusError) {
            return res.status(400).json({
                message: statusError
            });
        }

        const categoryError = validateCategory(category);
        if (categoryError) {
            return res.status(400).json({
                message: categoryError
            });
        }

        const priorityError = validatePriority(priority);
        if (priorityError) {
            return res.status(400).json({
                message: priorityError
            });
        }

        // Validate deadline format
        const deadlineResult = validateDeadline(deadline);
        if (deadlineResult.error) {
            return res.status(400).json({
                message: deadlineResult.error
            });
        }

        const taskData = { title, description, status, deadline: deadlineResult.value, userId, category, priority };

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
        
        // Fetch tasks from the database that belong to the authenticated user, sorted by creation date (newest first)
        const tasks = await Task.find({ userId }).sort({ dateCreated: -1 });

        res.status(200).json({
            message: 'Tasks fetched successfully',
            tasks
        });
    } catch (err) {
        res.status(400).json({
            message: 'Error fetching tasks',
            error: err.message
        });
    }
}





async function updateTask(req, res) {
    
    try {
        const userID = req.user;
        const taskId = req.params.id;
        const { title, description, status, deadline, category, priority } = req.body;

        if (!title || !deadline ) {
            return res.status(400).json({
                message: 'Title and deadline are required'
            });
        }

        const statusError = validateStatus(status);
        if (statusError) {
            return res.status(400).json({
                message: statusError
            });
        }

        const categoryError = validateCategory(category);
        if (categoryError) {
            return res.status(400).json({
                message: categoryError
            });
        }

        const priorityError = validatePriority(priority);
        if (priorityError) {
            return res.status(400).json({
                message: priorityError
            });
        }

        const deadlineResult = validateDeadline(deadline);
        if (deadlineResult.error) {
            return res.status(400).json({
                message: deadlineResult.error
            });
        }

        const task = await Task.findOneAndUpdate(
            { _id: taskId, userId: userID },
            {
                title,
                description,
                status,
                deadline: deadlineResult.value,
                category,
                priority
            },
            { returnDocument: 'after' }
        );

        if (!task) {
            return res.status(404).json({
                message: 'Task not found'
            });
        }

        res.status(200).json({
            message: 'Task updated successfully',
            task
        });
    } catch (err) {
        res.status(400).json({
            message: 'Error updating task',
            error: err.message
        });
    }
}

async function deleteTask(req, res) {
    try {
        const userID = req.user;
        const taskId = req.params.id;

        const task = await Task.findOneAndDelete({ _id: taskId, userId: userID });

        if (!task) {
            return res.status(404).json({
                message: 'Task not found'
            });
        }

        res.status(200).json({
            message: 'Task deleted successfully',
            task : task
        });
    } catch (err) {
        res.status(400).json({
            message: 'Error deleting task',
            error: err.message
        });
    }
}

module.exports = { createTask, getTasks, updateTask, deleteTask };
