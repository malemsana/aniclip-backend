const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // ⚠️ NEON REQUIRED SETTINGS:
    ssl: {
        rejectUnauthorized: false 
    }
});

// Test connection on startup
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ FATAL: Database Connection Failed!', err.stack);
    } else {
        console.log('✅ Database Connected Successfully');
        release();
    }
});

module.exports = pool;