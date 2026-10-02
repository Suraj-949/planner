/*
 * Seeds a demo account with a spread of tasks so the dashboard has something to show.
 *
 * Idempotent: re-running updates the demo user's tasks rather than duplicating them, so it
 * is safe to wire into a deploy or run repeatedly by hand.
 *
 * Usage:  npm run seed
 *
 * Credentials are printed on completion so they can be pasted into the login form. The
 * password is fixed and public, which is safe only because this is a throwaway demo user —
 * never point this script at a production database without changing SEED_PASSWORD first.
 */

require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { connectDB, disconnectDB } = require('../db/db');
const { logger } = require('../utils/logger');

const User = require('../models/user.model');
const Task = require('../models/task.model');
const { parseCalendarDate, validateTaskPayload } = require('../utils/taskValidation');

const SEED_USERNAME = process.env.SEED_USERNAME || 'demo';
const SEED_EMAIL = process.env.SEED_EMAIL || 'demo@planner.local';
const SEED_PASSWORD = process.env.SEED_PASSWORD || 'demo1234';

/*
 * Deadlines go through the same parser the API uses, so seeded rows carry the local-noon
 * anchor (invariant I-4) instead of drifting a day in some timezones.
 */
const daysFromNow = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);

    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate()
    ).padStart(2, '0')}`;

    return parseCalendarDate(iso);
};

const TASKS = [
    {
        title: 'Finish the auth hardening write-up',
        description: 'Document the refresh-token rotation and the CSRF origin check.',
        status: 'in-progress',
        priority: 'high',
        category: 'work',
        deadline: 1,
        context: 'Planner Core',
        estimateMinutes: 90,
        tags: ['auth', 'security', 'documentation'],
        subtasks: ['Summarise the refresh-token rotation', 'Record the CSRF origin decision'],
    },
    {
        title: 'Revise graph theory for the midterm',
        description: 'Spanning trees and cut properties.',
        status: 'pending',
        priority: 'high',
        category: 'college',
        deadline: 4,
        context: 'Planner Core',
        estimateMinutes: 120,
        tags: ['graphs', 'midterm', 'revision'],
        subtasks: ['Spanning trees', 'Cut properties'],
    },
    {
        title: 'Refactor the task validation module',
        description: 'Pull the enum lists into a single shared constant.',
        status: 'pending',
        priority: 'medium',
        category: 'development',
        deadline: 6,
        context: 'Planner Core',
        estimateMinutes: 75,
        tags: ['refactor', 'validation'],
        // Mixed shapes on purpose: the string form is accepted as `completed: false`, which is
        // how the dashboard panel still holds checklist items.
        subtasks: [
            { title: 'Extract shared enum constants', completed: true },
            'Update the controller call sites',
        ],
    },
    {
        title: 'Weekly review',
        description: 'Clear the inbox and plan next week.',
        status: 'pending',
        priority: 'low',
        category: 'personal',
        deadline: 7,
        context: 'Strategy 2025',
        estimateMinutes: 45,
        tags: ['review', 'planning'],
    },
    {
        title: 'Set up the CI pipeline',
        description: 'Lint, test and build on every push.',
        status: 'completed',
        priority: 'medium',
        category: 'development',
        deadline: -2,
        context: 'Planner Core',
        estimateMinutes: 60,
        tags: ['ci', 'github-actions', 'devops'],
        subtasks: ['Add the lint step', 'Add the test step', 'Add the build step'],
    },
    {
        title: 'Solve three DSA problems',
        description: 'Arrays and hashing.',
        status: 'completed',
        priority: 'medium',
        category: 'DSA',
        deadline: -1,
        context: 'Strategy 2025',
        estimateMinutes: 90,
        tags: ['arrays', 'hashing', 'practice'],
    },
    {
        title: 'Renew the passport',
        description: 'Book an appointment at the post office.',
        status: 'pending',
        priority: 'high',
        category: 'personal',
        deadline: 21,
        context: 'Infrastructure',
        estimateMinutes: 30,
        tags: ['errand', 'documents'],
        subtasks: ['Find the nearest post office', 'Check required documents'],
    },
    {
        title: 'Plan the team offsite',
        description: 'Pick dates and shortlist venues.',
        status: 'pending',
        priority: 'low',
        category: 'work',
        deadline: 14,
        context: 'Strategy 2025',
        estimateMinutes: 135,
        tags: ['offsite', 'venue'],
        subtasks: ['Shortlist three venues', 'Draft the agenda'],
    },
    {
        title: 'Back up the laptop',
        description: 'Time Machine before the OS update.',
        status: 'pending',
        priority: 'low',
        category: 'other',
        deadline: 3,
        context: 'Infrastructure',
        estimateMinutes: 25,
        tags: ['backup', 'macos'],
    },
];

async function seed() {
    await connectDB();

    const password = await bcrypt.hash(SEED_PASSWORD, 12);

    // upsert so re-running refreshes the demo user instead of hitting the unique index
    const user = await User.findOneAndUpdate(
        { username: SEED_USERNAME },
        { $set: { email: SEED_EMAIL, password } },
        { upsert: true, returnDocument: 'after', runValidators: true }
    ).select('+password');

    logger.info('Demo user ready', { username: user.username });

    /*
     * Tasks are replaced wholesale rather than merged, so editing the list above and
     * re-running produces exactly the list above — no stale rows accumulating.
     */
    await Task.deleteMany({ userId: user._id });

    /*
     * Seed rows go through the same validator the API uses, so a task written here is one the
     * create endpoint would also accept. Writing to `insertMany` directly would let the seed
     * drift from the contract — and a typo in TASKS would fail at the database rather than
     * with a message naming the offending field.
     */
    const docs = TASKS.map((task) => {
        const { value, errors } = validateTaskPayload({
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            category: task.category,
            context: task.context,
            estimateMinutes: task.estimateMinutes,
            tags: task.tags,
            subtasks: task.subtasks,
            deadline: daysFromNow(task.deadline),
        });

        if (errors.length) {
            throw new Error(`Seed task "${task.title}" is invalid: ${errors.join('; ')}`);
        }

        return { ...value, userId: user._id };
    });

    await Task.insertMany(docs);

    const byStatus = docs.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
    }, {});

    logger.info('Tasks seeded', {
        count: docs.length,
        byStatus: JSON.stringify(byStatus),
    });

    console.log('');
    console.log('  Seed complete. Log in with:');
    console.log(`    username: ${SEED_USERNAME}`);
    console.log(`    email:    ${SEED_EMAIL}`);
    console.log(`    password: ${SEED_PASSWORD}`);
    console.log('');
}

seed()
    .then(() => disconnectDB())
    .then(() => process.exit(0))
    .catch(async (err) => {
        logger.error('Seed failed', { error: err.message });
        console.error(`\n  Seed failed: ${err.message}\n`);

        try {
            await disconnectDB();
        } catch {
            // The connection may never have opened; nothing to clean up.
        }

        process.exit(1);
    });