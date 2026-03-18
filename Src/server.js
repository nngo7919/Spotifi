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
app.use(express.json());

// ── Serve file HTML/CSS/JS tĩnh từ thư mục Public ──
app.use(express.static(path.join(__dirname, '../Public')));

// ── API Routes ──
app.use('/api/songs', require('./routes/songs'));
app.use('/api/albums', require('./routes/albums'));
app.use('/api/artists', require('./routes/artists'));
app.use('/api/playlists', require('./routes/playlists'));
app.use('/api/users', require('./routes/users'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/stream', require('./routes/stream'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/artist-dashboard', require('./routes/artist-dashboard'));
app.use('/api/artist-requests', require('./routes/artist-requests'));

// ── Mọi route khác → trả về login.html ──
app.get('/{*path}', (req, res) => {
	res.sendFile(path.join(__dirname, '../Public/html/login.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server đang chạy tại http://localhost:${PORT}`);
});