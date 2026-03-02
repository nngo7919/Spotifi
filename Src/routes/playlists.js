
const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

// GET /api/playlists/user/:userId — cần login
router.get('/user/:userId', verifyToken, async (req, res) => {
	try {
		// Chỉ được xem playlist của chính mình
		if (req.user.userId != req.params.userId)
			return res.status(403).json({ error: 'Không có quyền truy cập.' });

		const playlists = await db.getUserPlaylists(req.params.userId);
		res.json(playlists);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// GET /api/playlists/:id — public (playlist công khai) hoặc cần login (playlist riêng)
router.get('/:id', async (req, res) => {
	try {
		const playlist = await db.getPlaylistById(req.params.id);
		if (!playlist) return res.status(404).json({ error: 'Không tìm thấy playlist' });
		res.json(playlist);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// POST /api/playlists — cần login
router.post('/', verifyToken, async (req, res) => {
	try {
		const { name, isPublic } = req.body;
		if (!name) return res.status(400).json({ error: 'Thiếu tên playlist' });

		// Lấy userId từ token
		const id = await db.createPlaylist(req.user.userId, name, isPublic);
		res.status(201).json({ id, message: 'Tạo playlist thành công' });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// POST /api/playlists/:id/songs — cần login
router.post('/:id/songs', verifyToken, async (req, res) => {
	try {
		const { songId } = req.body;
		await db.addSongToPlaylist(req.params.id, songId);
		res.json({ success: true, message: 'Đã thêm bài hát vào playlist' });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// DELETE /api/playlists/:id/songs/:songId — cần login
router.delete('/:id/songs/:songId', verifyToken, async (req, res) => {
	try {
		await db.removeSongFromPlaylist(req.params.id, req.params.songId);
		res.json({ success: true, message: 'Đã xóa bài hát khỏi playlist' });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;