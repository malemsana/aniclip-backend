const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// ==============================================
// 0. AUTH CHECK
// ==============================================
router.get('/verify', (req, res) => {
    res.json({ status: 'success', message: 'Token valid' });
});

// ==============================================
// 1. DASHBOARD STATISTICS
// ==============================================
router.get('/stats', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                -- Library Totals
                (SELECT COUNT(*) FROM animes)::int as total_series,
                
                -- Download Stats (Sum of historical counters + recent logs)
                (SELECT COALESCE(SUM(download_count), 0) FROM animes)::int as total_downloads,
                (SELECT COUNT(*) FROM analytics WHERE type = 'download' AND created_at >= NOW() - INTERVAL '24 HOURS')::int as dl_today,
                (SELECT COUNT(*) FROM analytics WHERE type = 'download' AND created_at >= NOW() - INTERVAL '7 DAYS')::int as dl_week,
                (SELECT COUNT(*) FROM analytics WHERE type = 'download' AND created_at >= NOW() - INTERVAL '30 DAYS')::int as dl_month,

                -- Visit Stats
                (SELECT COALESCE(SUM(visit_count), 0) FROM animes)::int as total_visits,
                (SELECT COUNT(*) FROM analytics WHERE type = 'visit' AND created_at >= NOW() - INTERVAL '24 HOURS')::int as visits_today,
                (SELECT COUNT(*) FROM analytics WHERE type = 'visit' AND created_at >= NOW() - INTERVAL '7 DAYS')::int as visits_week
        `);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ==============================================
// 2. ANIME SERIES MANAGEMENT
// ==============================================

// GET LIST (For Admin Table) - Solves the 404 error
router.get('/animes', async (req, res) => {
    const limit = req.query.limit || 100;
    try {
        // Newest created first, or modify to ORDER BY name ASC
        const result = await db.query('SELECT * FROM animes ORDER BY id DESC LIMIT $1', [limit]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// UPSERT (Create OR Update Metadata)
router.post('/animes', async (req, res) => {
    const { name, title, description, poster_url, genres, is_featured } = req.body;
    
    if (!name) return res.status(400).json({ status: 'error', message: 'Slug name is required' });

    // Ensure array format for Postgres
    const safeGenres = Array.isArray(genres) ? genres : [];

    try {
        const query = `
            INSERT INTO animes (name, title, description, poster_url, genres, is_featured, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (name) 
            DO UPDATE SET 
                title = EXCLUDED.title, 
                description = EXCLUDED.description, 
                poster_url = EXCLUDED.poster_url,
                genres = EXCLUDED.genres,
                is_featured = EXCLUDED.is_featured,
                updated_at = NOW()
            RETURNING *;
        `;
        const result = await db.query(query, [
            name, title || name, description, poster_url, safeGenres, is_featured || false
        ]);
        res.json({ status: 'success', anime: result.rows[0] });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// DELETE ANIME
router.delete('/animes/:id', async (req, res) => {
    try {
        // ON DELETE CASCADE in schema handles episodes/clips/analytics cleanup
        await db.query('DELETE FROM animes WHERE id = $1', [req.params.id]);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ==============================================
// 3. EPISODE MANAGEMENT
// ==============================================

// Create Episode
router.post('/episodes', async (req, res) => {
    const { anime_id, number, title } = req.body;
    try {
        const query = `
            INSERT INTO episodes (anime_id, number, title) VALUES ($1, $2, $3)
            ON CONFLICT (anime_id, number) DO UPDATE SET title = EXCLUDED.title
            RETURNING *;
        `;
        const result = await db.query(query, [anime_id, number, title]);
        res.json({ status: 'success', episode: result.rows[0] });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Delete Episode
router.delete('/episodes/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM episodes WHERE id = $1', [req.params.id]);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ==============================================
// 4. CLIP MANAGEMENT
// ==============================================

// BULK CREATE (Used by 'Add Clip' Drawer)
router.post('/clips/bulk', async (req, res) => {
    const { anime, episode, clips } = req.body;
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Get Anime ID (And verify it exists)
        const animeRes = await client.query('SELECT id FROM animes WHERE name = $1', [anime]);
        if (animeRes.rows.length === 0) throw new Error(`Anime '${anime}' not found. Create series first.`);
        const animeId = animeRes.rows[0].id;

        // 2. Bump "Fresh" Status
        await client.query('UPDATE animes SET updated_at = NOW() WHERE id = $1', [animeId]);

        // 3. Get or Create Episode
        let epRes = await client.query('SELECT id FROM episodes WHERE anime_id = $1 AND number = $2', [animeId, episode]);
        if (epRes.rows.length === 0) {
            epRes = await client.query(
                'INSERT INTO episodes (anime_id, number, title) VALUES ($1, $2, $3) RETURNING id', 
                [animeId, episode, `Episode ${episode}`]
            );
        }
        const epId = epRes.rows[0].id;

        // 4. Insert Clips
        for (const c of clips) {
            await client.query(
                `INSERT INTO clips (episode_id, video_url, preview_url, thumb_url, clip_name, start_time, end_time)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    epId, 
                    c.video_url, 
                    c.preview_url || '', 
                    c.thumb_url || '', 
                    c.clip_name || 'Clip', 
                    c.start_time || 0, 
                    c.end_time || 0
                ]
            );
        }

        await client.query('COMMIT');
        res.json({ status: 'success', message: `${clips.length} clips added.` });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ status: 'error', message: err.message });
    } finally {
        client.release();
    }
});

// Update Single Clip
router.put('/clips/:id', async (req, res) => {
    const { video_url, preview_url, thumb_url, clip_name, end_time } = req.body;
    try {
        const result = await db.query(
            `UPDATE clips SET 
                video_url = COALESCE($1, video_url),
                preview_url = COALESCE($2, preview_url),
                thumb_url = COALESCE($3, thumb_url),
                clip_name = COALESCE($4, clip_name),
                end_time = COALESCE($5, end_time)
             WHERE id = $6 RETURNING *`,
            [video_url, preview_url, thumb_url, clip_name, end_time, req.params.id]
        );
        res.json({ status: 'success', clip: result.rows[0] });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Delete Clip
router.delete('/clips/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM clips WHERE id = $1', [req.params.id]);
        res.json({ status: 'success' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ==============================================
// 5. DATA IMPORTER (JSON Pipeline)
// ==============================================
router.post('/import/season', async (req, res) => {
    const { anime_slug, anime_title, episodes } = req.body;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        
        // Create/Update Anime & Refresh Time
        const animeRes = await client.query(
            `INSERT INTO animes (name, title, updated_at) VALUES ($1, $2, NOW()) 
             ON CONFLICT (name) DO UPDATE SET title = $2, updated_at = NOW() 
             RETURNING id`,
            [anime_slug, anime_title]
        );
        const animeId = animeRes.rows[0].id;

        // Process Episodes
        for (const ep of episodes) {
            const epRes = await client.query(
                `INSERT INTO episodes (anime_id, number, title) VALUES ($1, $2, $3)
                 ON CONFLICT (anime_id, number) DO UPDATE SET title = $3
                 RETURNING id`,
                [animeId, ep.episode_num, ep.episode_title]
            );
            const epId = epRes.rows[0].id;

            // Reset Clips for this episode to prevent duplicates on re-import
            await client.query('DELETE FROM clips WHERE episode_id = $1', [epId]);

            // Insert Clips
            for (const clip of ep.clips) {
                await client.query(
                    `INSERT INTO clips (episode_id, start_time, end_time, video_url, preview_url, thumb_url, clip_name)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        epId, 
                        0, 
                        clip.duration, 
                        clip.video_url, 
                        clip.preview_url || '', 
                        clip.thumb_url || '', 
                        clip.original_clip_name
                    ]
                );
            }
        }
        await client.query('COMMIT');
        res.json({ status: 'success', message: 'Import successful' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ status: 'error', message: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;