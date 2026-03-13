// =============================================
//  routes/albums.js
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/albums — lấy tất cả album
router.get('/', async (req, res) => {
	try {
		const albums = await db.getAllAlbums();
		res.json(albums);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// GET /api/albums/:id — lấy album + danh sách bài hát
router.get('/:id', async (req, res) => {
	try {
		const album = await db.getAlbumById(req.params.id);
		if (!album) return res.status(404).json({ error: 'Không tìm thấy album' });
		res.json(album);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;