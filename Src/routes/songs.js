
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
		res.json(songs);
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