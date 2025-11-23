const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 1. ALLOW C.O.R.S (Crucial!)
// This allows your GitHub Pages frontend to talk to this server.
// Later, you can restrict this to: app.use(cors({ origin: 'https://yourname.github.io' }));
app.use(cors()); 

// 2. Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. API Routes
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const authenticateAdmin = require('./utils/auth');

app.use('/api', publicRoutes);
app.use('/api/admin', authenticateAdmin, adminRoutes);

// 4. Root Check
app.get('/', (req, res) => {
    res.json({ status: 'active', message: 'Aniclips API is Running' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});