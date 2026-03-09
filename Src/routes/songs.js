// =============================================
//  routes/songs.js
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken,
	optionalToken } = require('../middleware/auth');

// GET /api/songs — public
router.get('/', optionalToken, async (req, res) => {
	try {
		const songs = await db.getAllSongs();
		res.json(songs);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// GET /api/songs/top — public
router.get('/top', async (req, res) => {
	try {
		const limit = parseInt(req.query.limit) || 10;
		const songs = await db.getTopSongs(limit);
		console.log(`[TOP] limit=${limit}, found=${songs.length} songs`);
		res.json(songs);
	} catch (err) {
		console.error('[TOP] SQL error:', err.message);
		res.status(500).json({ error: err.message, detail: 'Kiểm tra terminal server' });
	}
});

// GET /api/songs/debug — xem cấu trúc DB (xóa sau khi debug xong)
router.get('/debug', async (req, res) => {
	try {
		const songs = await db.query('SHOW COLUMNS FROM songs');
		const artists = await db.query('SHOW COLUMNS FROM artists');
		res.json({ songs_columns: songs.map(c => c.Field), artists_columns: artists.map(c => c.Field) });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// GET /api/songs/search?q=keyword — public
router.get('/search', async (req, res) => {
	try {
		const keyword = req.query.q || '';
		if (!keyword) return res.json([]);
		const results = await db.search(keyword);
		res.json(results);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// GET /api/songs/:id — public
router.get('/:id', async (req, res) => {
	try {
		const song = await db.getSongById(req.params.id);
		if (!song) return res.status(404).json({ error: 'Không tìm thấy bài hát' });
		res.json(song);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// POST /api/songs/:id/play — cần login
router.post('/:id/play', verifyToken, async (req, res) => {
	try {
		await db.recordPlay(req.user.userId, req.params.id);
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;