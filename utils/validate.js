const validate = {
    animeName: (name) => {
        if (!name || typeof name !== 'string') return false;
        // Allow lowercase alphanumeric, underscores, hyphens
        return /^[a-z0-9_-]+$/.test(name);
    },
    
    clipTiming: (start, end) => {
        if (typeof start !== 'number' || typeof end !== 'number') return false;
        if (start < 0) return false;
        if (end <= start) return false;
        if ((end - start) > 300) return false; // Max 300 seconds
        return true;
    },

    url: (url) => {
        try {
            const parsed = new URL(url);
            return ['http:', 'https:'].includes(parsed.protocol);
        } catch (e) {
            return false;
        }
    }
};

module.exports = validate;