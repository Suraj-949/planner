require('dotenv').config();

const app = require('./src/app');
const { connectDB, disconnectDB } = require('./src/db/db');
const { logger } = require('./src/utils/logger');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
    try {
        await connectDB();

        const server = app.listen(PORT, HOST, () => {
            logger.info('Server is running', { port: PORT, host: HOST, env: process.env.NODE_ENV || 'development' });
        });

        /*
         * Graceful shutdown. Without this, `npm start` leaves the process hanging after
         * Ctrl+C and open Mongo sockets leak on every restart.
         */
        const shutdown = async (signal) => {
            logger.info('Shutting down', { signal });

            server.close(async () => {
                try {
                    await disconnectDB();
                    process.exit(0);
                } catch (err) {
                    logger.error('Error during shutdown', { error: err.message });
                    process.exit(1);
                }
            });

            // Don't let a stuck connection block shutdown indefinitely.
            setTimeout(() => {
                logger.error('Forced shutdown after timeout');
                process.exit(1);
            }, 10000).unref();
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));

        // An unhandled rejection leaves the process in an undefined state; log and exit
        // so the supervisor restarts it cleanly.
        process.on('unhandledRejection', (reason) => {
            logger.error('Unhandled promise rejection', {
                error: reason?.stack || reason?.message || String(reason),
            });
            shutdown('unhandledRejection');
        });

        return server;
    } catch (err) {
        logger.error('Server start failed', { error: err.message });
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

// Exported so tests can import the app without opening a port.
module.exports = { startServer, app };
