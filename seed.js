const axios = require('axios'); // We need to install this: npm install axios

// CONFIGURATION
const API_URL = 'https://aniclip-backend.onrender.com/api';
const ADMIN_KEY = 'mysecretadminpassword'; // Must match your .env

async function seedDatabase() {
    console.log('🌱 Starting Database Seed...');

    try {
        // 1. Create Anime
        console.log('1️⃣ Adding Anime...');
        const animeRes = await axios.post(`${API_URL}/admin/animes`, 
            { name: 'hyouka_test' },
            { headers: { 'Authorization': `Bearer ${ADMIN_KEY}` } }
        );
        console.log('   ✅ Anime created:', animeRes.data);

        // 2. Create Episode
        console.log('\n2️⃣ Adding Episode...');
        const epRes = await axios.post(`${API_URL}/admin/episodes`, 
            { anime: 'hyouka_test', number: 1, title: 'The Beginning' },
            { headers: { 'Authorization': `Bearer ${ADMIN_KEY}` } }
        );
        console.log('   ✅ Episode created:', epRes.data);

        // 3. Add Clips
        console.log('\n3️⃣ Adding Batch of Clips...');
        const clipsRes = await axios.post(`${API_URL}/admin/clips/bulk`, 
            { 
                anime: 'hyouka_test', 
                episode: 1, 
                clips: [
                    { start_time: 0, end_time: 10, video_url: 'https://vidplay.io/test1.mp4' },
                    { start_time: 10, end_time: 20, video_url: 'https://vidplay.io/test2.mp4' }
                ]
            },
            { headers: { 'Authorization': `Bearer ${ADMIN_KEY}` } }
        );
        console.log('   ✅ Clips inserted:', clipsRes.data);

        console.log('\n🎉 SEEDING COMPLETE! Your backend is fully functional.');

    } catch (error) {
        console.error('❌ Error:', error.response ? error.response.data : error.message);
    }
}

seedDatabase();