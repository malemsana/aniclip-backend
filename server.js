const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 📝 LOGGER (So you see activity in Render Logs)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// --- API Routes ---
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const authenticateAdmin = require('./utils/auth');

app.use('/api', publicRoutes);
app.use('/api/admin', authenticateAdmin, adminRoutes);

// Root Check
app.get('/', (req, res) => {
    res.json({ status: 'active', system: 'Aniclip Backend Online' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});