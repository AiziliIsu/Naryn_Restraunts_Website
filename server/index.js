const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Load environment variables from .env file
const db = require('./config/db');

const app = express();
const port = process.env.PORT || 5000; // Use the PORT environment variable or default to 5000
const authRoutes = require('./routes/auth');

// Middleware
app.use(cors());
app.use(express.json()); // For parsing application/json

// Routes
app.use('/api/auth', authRoutes); // Mount auth routes

// Basic GET / endpoint
app.get('/', (req, res) => {
  res.send('Hello from the Naryn Restaurants Backend!');
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});