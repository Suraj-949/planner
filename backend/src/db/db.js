const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

/*
 * Validates configuration once at boot rather than on first use. A missing JWT_SECRET
 * previously surfaced as a confusing "JWT_SECRET is not set" error on the user's first
 * login, long after the process looked healthy.
 */
function assertEnv() {
    const required = ['MONGO_URI', 'JWT_SECRET'];
    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    if (process.env.JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters');
    }
}

async function connectDB() {
    assertEnv();

    // Fail fast instead of buffering operations for 30s when Mongo is unreachable.
    mongoose.set('bufferCommands', false);

    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
        });

        logger.info('MongoDB connected successfully');

        return mongoose.connection;
    } catch (err) {
        logger.error('Error connecting to MongoDB', { error: err.message });
        throw err;
    }
}

async function disconnectDB() {
    if (mongoose.connection.readyState === 0) return;

    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
}

module.exports = { connectDB, disconnectDB, assertEnv };
