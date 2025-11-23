const { Pool } = require('pg');
require('dotenv').config();

// If DATABASE_URL has '?sslmode=require', standard drivers need this config:
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Neon/Render connection
    }
});

module.exports = pool;