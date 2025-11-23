const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// ==============================================
// 1. HOMEPAGE & DISCOVERY
// ==============================================

// TRENDING (Weighted Score)
// Logic: Visits = 1pt, Downloads = 5pts
router.get('/animes/trending', async (req, res) => {
    try {
        const query = `
            SELECT *, (visit_count + (download_count * 5)) as score 
            FROM animes 
            ORDER BY score DESC 
            LIMIT 20
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// FRESH / RECENT
// Logic: Sorted by 'updated_at', which we bump whenever new clips are added
router.get('/animes/recent', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM animes ORDER BY updated_at DESC LIMIT 15');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ status: 'error' });
    }
});

// FEATURED (Hero Carousel)
router.get('/animes/featured', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM animes WHERE is_featured = true LIMIT 5');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ status: 'error' });
    }
});

// THE ARCHIVE (Seeded Shuffle)
// Logic: MD5(ID + Seed) ensures random order stays consistent during infinite scroll
router.get('/animes/archive', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 18; // Good number divisible by 2, 3, 6 grid cols
    const offset = (page - 1) * limit;
    const seed = req.query.seed || 'default';

    try {
        const query = `
            SELECT * FROM animes 
            ORDER BY md5(id::text || $1) ASC 
            LIMIT $2 OFFSET $3
        `;
        const result = await db.query(query, [seed, limit, offset]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ status: 'error' });
    }
});

// BROWSE COLLECTIONS (Tag Filter)
router.get('/animes/browse', async (req, res) => {
    const { tag } = req.query;
    try {
        // Postgres array contains check
        const result = await db.query(
            'SELECT * FROM animes WHERE $1 = ANY(genres) ORDER BY updated_at DESC LIMIT 100', 
            [tag]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ status: 'error' });
    }
});

// SEARCH
router.get('/search', async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim() === '') return res.json([]);
    try {
        const query = `
            SELECT * FROM animes 
            WHERE title ILIKE $1 
            OR $1 = ANY(genres) 
            LIMIT 10
        `;
        const result = await db.query(query, [`%${q}%`]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ status: 'error' });
    }
});

// ==============================================
// 2. TRACKING & ANALYTICS (The "Brain")
// ==============================================

// TRACK DOWNLOAD
router.post('/animes/:id/track-download', async (req, res) => {
    const animeId = req.params.id;
    
    // Fire & Forget - Logging shouldn't block response
    (async () => {
        try {
            // 1. Update fast counter
            await db.query('UPDATE animes SET download_count = download_count + 1 WHERE id = $1', [animeId]);
            // 2. Log detailed timestamp entry
            await db.query("INSERT INTO analytics (anime_id, type) VALUES ($1, 'download')", [animeId]);
        } catch (e) { console.error("Analytics DB Error:", e.message); }
    })();

    res.json({ status: 'success' });
});

// ==============================================
// 3. ANIME DETAILS
// ==============================================

// Basic List (Legacy/Fallback)
router.get('/animes', async (req, res) => {
    const limit = req.query.limit || 50;
    try {
        const result = await db.query('SELECT * FROM animes ORDER BY visit_count DESC LIMIT $1', [limit]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// SINGLE ANIME (Triggers Visit Tracking)
router.get('/animes/:name', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM animes WHERE name = $1', [req.params.name]);
        if (result.rows.length === 0) return res.status(404).json({});
        
        const animeId = result.rows[0].id;

        // Track Visit (Async)
        (async () => {
            try {
                await db.query('UPDATE animes SET visit_count = visit_count + 1 WHERE id = $1', [animeId]);
                await db.query("INSERT INTO analytics (anime_id, type) VALUES ($1, 'visit')", [animeId]);
            } catch (e) { console.error(e); }
        })();

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ status: 'error' });
    }
});

// GET EPISODES
router.get('/animes/:name/episodes', async (req, res) => {
    try {
        const query = `
            SELECT e.* FROM episodes e
            JOIN animes a ON e.anime_id = a.id
            WHERE a.name = $1
            ORDER BY e.number ASC
        `;
        const result = await db.query(query, [req.params.name]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET CLIPS
router.get('/animes/:name/episodes/:number/clips', async (req, res) => {
    try {
        const query = `
            SELECT c.* FROM clips c
            JOIN episodes e ON c.episode_id = e.id
            JOIN animes a ON e.anime_id = a.id
            WHERE a.name = $1 AND e.number = $2
            ORDER BY c.start_time ASC
        `;
        const result = await db.query(query, [req.params.name, req.params.number]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;