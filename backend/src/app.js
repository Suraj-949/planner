const express = require('express');
const authRoutes = require('./routes/auth.routes');
const taskRoutes = require('./routes/task.routes');
const cookies = require('cookie-parser');

const app = express();

app.use((req, res, next) => {

  // Set CORS headers to allow requests from the frontend
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true'); // Allow cookies to be sent to the frontend   

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// Middleware to parse cookies
app.use(cookies());

// Middleware to parse JSON bodies
app.use(express.json());

//auth routes
app.use('/api/auth', authRoutes);

// task routes
app.use('/api/tasks', taskRoutes);

module.exports = app;
