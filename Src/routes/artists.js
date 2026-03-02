const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

// GET /api/artists/:id — public
router.get('/:id', async (req, res) => {
	try {
		const artist = await db.getArtistById(req.params.id);
		if (!artist) return res.status(404).json({ error: 'Không tìm thấy nghệ sĩ' });
		res.json(artist);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// POST /api/artists/:id/follow — cần login
router.post('/:id/follow', verifyToken, async (req, res) => {
	try {
		const result = await db.toggleFollowArtist(req.user.userId, req.params.id);
		res.json(result);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;