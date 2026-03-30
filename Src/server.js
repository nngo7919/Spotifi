// =============================================
//  SoundWave - server.js
//  Cài đặt: npm install express cors dotenv
//  Chạy:    node server.js
// =============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());

// Tạo middleware JSON riêng
const jsonParser = express.json();

// ── Serve static files ──
app.use(express.static(path.join(__dirname, '../Public')));

// ── API Routes ──
app.use('/api/songs', jsonParser, require('./routes/songs'));
app.use('/api/albums', jsonParser, require('./routes/albums'));
app.use('/api/artists', jsonParser, require('./routes/artists'));
app.use('/api/playlists', jsonParser, require('./routes/playlists'));
app.use('/api/users', jsonParser, require('./routes/users'));
app.use('/api/auth', jsonParser, require('./routes/auth'));
app.use('/api/stream', jsonParser, require('./routes/stream'));

// ⭐ Route ADMIN dùng Multer - KHÔNG có jsonParser
app.use('/api/admin', require('./routes/admin'));
app.use('/api/artist-dashboard', jsonParser, require('./routes/artist-dashboard'));
app.use('/api/artist-requests', jsonParser, require('./routes/artist-requests'));

// ── Catch all (SPA fallback) ──
app.use((req, res) => {
	res.sendFile(path.join(__dirname, '../Public/html/login.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server đang chạy tại http://localhost:${PORT}`);
});