const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// ==============================================
// 1. HOMEPAGE
// ==============================================

// TRENDING
router.get('/animes/trending', async (req, res) => {
    try {
        const query = `SELECT *, (visit_count + (download_count * 5)) as score FROM animes ORDER BY score DESC LIMIT 20`;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Trending Error:", err.message); // PRINT ERROR TO LOGS
        res.status(500).json({ error: err.message });
    }
});

// RECENT
router.get('/animes/recent', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM animes ORDER BY updated_at DESC LIMIT 15');
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Recent Error:", err.message);
        res.status(500).json({ status: 'error' });
    }
});

// FEATURED
router.get('/animes/featured', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM animes WHERE is_featured = true LIMIT 5');
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Featured Error:", err.message);
        res.status(500).json({ status: 'error' });
    }
});

// ARCHIVE (Seeded Shuffle)
router.get('/animes/archive', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 18;
    const offset = (page - 1) * limit;
    const seed = req.query.seed || 'default';

    try {
        const query = `SELECT * FROM animes ORDER BY md5(id::text || $1) ASC LIMIT $2 OFFSET $3`;
        const result = await db.query(query, [seed, limit, offset]);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Archive Error:", err.message);
        res.status(500).json({ status: 'error' });
    }
});

// BROWSE TAGS
router.get('/animes/browse', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM animes WHERE $1 = ANY(genres) ORDER BY updated_at DESC LIMIT 100', [req.query.tag]);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Browse Error:", err.message);
        res.status(500).json({ status: 'error' });
    }
});

// SEARCH
router.get('/search', async (req, res) => {
    if (!req.query.q) return res.json([]);
    try {
        const query = `SELECT * FROM animes WHERE title ILIKE $1 OR $1 = ANY(genres) LIMIT 10`;
        const result = await db.query(query, [`%${req.query.q}%`]);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Search Error:", err.message);
        res.status(500).json({ status: 'error' });
    }
});

// TRACKING
router.post('/animes/:id/track-download', async (req, res) => {
    (async () => {
        try {
            await db.query('UPDATE animes SET download_count = download_count + 1 WHERE id = $1', [req.params.id]);
            await db.query("INSERT INTO analytics (anime_id, type) VALUES ($1, 'download')", [req.params.id]);
        } catch (e) { console.error("Analytics DB Error:", e.message); }
    })();
    res.json({ status: 'success' });
});

// DETAILS
router.get('/animes/:name', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM animes WHERE name = $1', [req.params.name]);
        if (result.rows.length === 0) return res.status(404).json({});
        const id = result.rows[0].id;
        (async () => {
            try {
                await db.query('UPDATE animes SET visit_count = visit_count + 1 WHERE id = $1', [id]);
                await db.query("INSERT INTO analytics (anime_id, type) VALUES ($1, 'visit')", [id]);
            } catch (e) { console.error(e); }
        })();
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Details Error:", err.message);
        res.status(500).json({ status: 'error' });
    }
});

router.get('/animes/:name/episodes', async (req, res) => {
    try {
        const result = await db.query('SELECT e.* FROM episodes e JOIN animes a ON e.anime_id = a.id WHERE a.name = $1 ORDER BY e.number ASC', [req.params.name]);
        res.json(result.rows);
    } catch(e) { console.error(e); res.status(500).json([]); }
});

router.get('/animes/:name/episodes/:number/clips', async (req, res) => {
    try {
        const result = await db.query('SELECT c.* FROM clips c JOIN episodes e ON c.episode_id = e.id JOIN animes a ON e.anime_id = a.id WHERE a.name = $1 AND e.number = $2 ORDER BY c.start_time ASC', [req.params.name, req.params.number]);
        res.json(result.rows);
    } catch(e) { console.error(e); res.status(500).json([]); }
});

module.exports = router;