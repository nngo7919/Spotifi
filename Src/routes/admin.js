// =============================================
//  Src/routes/admin.js
//  npm install multer
// =============================================

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Kết nối DB
const db = require('../db');

// Auth middleware
const { verifyAdmin } = require('../middleware/auth');

// ── Multer config ──
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		const dir = path.join(__dirname, '../../Public/audio');
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		cb(null, dir);
	},
	filename: (req, file, cb) => {
		cb(null, 'song_' + Date.now() + path.extname(file.originalname));
	},
});

const upload = multer({
	storage,
	limits: { fileSize: 50 * 1024 * 1024 },
	fileFilter: (req, file, cb) => {
		if (file.mimetype === 'audio/mpeg' || file.originalname.toLowerCase().endsWith('.mp3')) {
			cb(null, true);
		} else {
			cb(new Error('Chi chap nhan file MP3'));
		}
	},
});

// ─────────────────────────────────────────────
// POST /api/admin/songs
// ─────────────────────────────────────────────
router.post('/songs', verifyAdmin, upload.single('audio'), async (req, res) => {
	try {
		const { title, duration, artist_id, album_id, track_number, is_explicit, lyrics } = req.body;

		if (!title || !duration || !artist_id) {
			return res.status(400).json({ error: 'Thieu title, duration hoac artist_id' });
		}
		if (!req.file) {
			return res.status(400).json({ error: 'Thieu file MP3' });
		}

		const file_url = '/audio/' + req.file.filename;

		// Khong chon album -> tu tao Single
		let finalAlbumId = album_id ? parseInt(album_id) : null;
		if (!finalAlbumId) {
			const today = new Date().toISOString().slice(0, 10);
			const single = await db.query(
				"INSERT INTO albums (title, artist_id, type, release_date) VALUES (?, ?, 'single', ?)",
				[title.trim(), parseInt(artist_id), today]
			);
			finalAlbumId = single.insertId;
		}

		const result = await db.query(
			'INSERT INTO songs (title, duration, artist_id, album_id, track_number, is_explicit, file_url, lyrics, plays_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
			[
				title.trim(),
				parseInt(duration),
				parseInt(artist_id),
				finalAlbumId,
				track_number ? parseInt(track_number) : 1,
				is_explicit === '1' ? 1 : 0,
				file_url,
				lyrics || null,
			]
		);

		res.json({
			success: true,
			id: result.insertId,
			album_id: finalAlbumId,
			auto_single: !album_id,
			file_url,
		});

	} catch (err) {
		if (req.file) fs.unlink(req.file.path, () => { });
		console.error('[ADMIN/songs]', err.message);
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// POST /api/admin/albums
// ─────────────────────────────────────────────
router.post('/albums', verifyAdmin, async (req, res) => {
	try {
		const { title, artist_id, type, release_date, cover_url } = req.body;

		if (!title || !artist_id) {
			return res.status(400).json({ error: 'Thieu title hoac artist_id' });
		}

		const result = await db.query(
			'INSERT INTO albums (title, artist_id, type, release_date, cover_url) VALUES (?, ?, ?, ?, ?)',
			[title.trim(), parseInt(artist_id), type || 'album', release_date || null, cover_url || null]
		);

		res.json({ success: true, id: result.insertId });

	} catch (err) {
		console.error('[ADMIN/albums]', err.message);
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// POST /api/admin/artists
// ─────────────────────────────────────────────
router.post('/artists', verifyAdmin, async (req, res) => {
	try {
		const { name, bio, avatar_url, country } = req.body;
		if (!name) return res.status(400).json({ error: 'Thieu ten nghe si' });

		const result = await db.query(
			'INSERT INTO artists (name, bio, avatar_url, country, verified) VALUES (?, ?, ?, ?, 0)',
			[name.trim(), bio || null, avatar_url || null, country || null]
		);

		res.json({ success: true, id: result.insertId, name: name.trim() });

	} catch (err) {
		console.error('[ADMIN/artists]', err.message);
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;