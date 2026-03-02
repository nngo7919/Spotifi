
const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

// GET /api/users/:id — cần login, chỉ xem được chính mình
router.get('/:id', verifyToken, async (req, res) => {
	try {
		if (req.user.userId != req.params.id)
			return res.status(403).json({ error: 'Không có quyền truy cập.' });

		const user = await db.getUserById(req.params.id);
		if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });
		res.json(user);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// GET /api/users/:id/liked — cần login
router.get('/:id/liked', verifyToken, async (req, res) => {
	try {
		if (req.user.userId != req.params.id)
			return res.status(403).json({ error: 'Không có quyền truy cập.' });

		const songs = await db.getLikedSongs(req.params.id);
		res.json(songs);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// POST /api/users/:id/liked/:songId — cần login
router.post('/:id/liked/:songId', verifyToken, async (req, res) => {
	try {
		if (req.user.userId != req.params.id)
			return res.status(403).json({ error: 'Không có quyền truy cập.' });

		const result = await db.toggleLikeSong(req.params.id, req.params.songId);
		res.json(result);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// GET /api/users/:id/history — cần login
router.get('/:id/history', verifyToken, async (req, res) => {
	try {
		if (req.user.userId != req.params.id)
			return res.status(403).json({ error: 'Không có quyền truy cập.' });

		const limit = parseInt(req.query.limit) || 20;
		const history = await db.getPlayHistory(req.params.id, limit);
		res.json(history);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// GET /api/users/:id/following — cần login
router.get('/:id/following', verifyToken, async (req, res) => {
	try {
		if (req.user.userId != req.params.id)
			return res.status(403).json({ error: 'Không có quyền truy cập.' });

		const artists = await db.getFollowedArtists(req.params.id);
		res.json(artists);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// GET /api/users/:id/recommendations — cần login
router.get('/:id/recommendations', verifyToken, async (req, res) => {
	try {
		if (req.user.userId != req.params.id)
			return res.status(403).json({ error: 'Không có quyền truy cập.' });

		const limit = parseInt(req.query.limit) || 20;
		const songs = await db.getRecommendations(req.params.id, limit);
		res.json(songs);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;