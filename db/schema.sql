-- 1. Anime Table
CREATE TABLE IF NOT EXISTS animes (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

-- 2. Episodes Table
CREATE TABLE IF NOT EXISTS episodes (
    id SERIAL PRIMARY KEY,
    anime_id INTEGER REFERENCES animes(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    title TEXT,
    UNIQUE(anime_id, number)
);

-- 3. Clips Table
CREATE TABLE IF NOT EXISTS clips (
    id SERIAL PRIMARY KEY,
    episode_id INTEGER REFERENCES episodes(id) ON DELETE CASCADE,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    video_url TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_animes_name ON animes(name);
CREATE INDEX IF NOT EXISTS idx_episodes_anime_id ON episodes(anime_id);
CREATE INDEX IF NOT EXISTS idx_clips_episode_id ON clips(episode_id);