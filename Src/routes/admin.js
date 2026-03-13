// =============================================
//  routes/admin.js
//  Upload song + album
//  npm install multer
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyAdmin } = require('../middleware/auth');

// ── Multer: lưu MP3 vào Public/audio/ ──
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		const dir = path.join(__dirname, '../../Public/audio');
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		cb(null, dir);
	},
	filename: (req, file, cb) => {
		// Tên file: song_<timestamp>.mp3
		const ext = path.extname(file.originalname);
		const name = 'song_' + Date.now() + ext;
		cb(null, name);
	},
});

const upload = multer({
	storage,
	limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
	fileFilter: (req, file, cb) => {
		if (file.mimetype === 'audio/mpeg' || file.originalname.endsWith('.mp3')) {
			cb(null, true);
		} else {
			cb(new Error('Chỉ chấp nhận file MP3'));
		}
	},
});

// ─────────────────────────────────────────────
// POST /api/admin/songs — upload bài hát mới
// ─────────────────────────────────────────────
router.post('/songs', verifyAdmin, upload.single('audio'), async (req, res) => {
	try {
		const { title, duration, artist_id, album_id, track_number, is_explicit, lyrics } = req.body;

		// Validate
		if (!title || !duration || !artist_id) {
			return res.status(400).json({ error: 'Thiếu thông tin: title, duration, artist_id là bắt buộc' });
		}
		if (!req.file) {
			return res.status(400).json({ error: 'Thiếu file MP3' });
		}

		const file_url = '/audio/' + req.file.filename;

		// Nếu không chọn album → tự động tạo Single cùng tên bài hát
		let finalAlbumId = album_id ? parseInt(album_id) : null;
		if (!finalAlbumId) {
			const today = new Date().toISOString().slice(0, 10);
			const singleResult = await db.query(
				`INSERT INTO albums (title, artist_id, type, release_date) VALUES (?, ?, 'single', ?)`,
				[title.trim(), parseInt(artist_id), today]
			);
			finalAlbumId = singleResult.insertId;
		}

		const result = await db.query(
			`INSERT INTO songs
        (title, duration, artist_id, album_id, track_number, is_explicit, file_url, lyrics, plays_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
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
			auto_single: !album_id, // báo client biết có tạo single tự động không
			file_url,
			message: `Đã upload bài hát "${title}" thành công`,
		});

	} catch (err) {
		// Xóa file nếu DB lỗi
		if (req.file) {
			fs.unlink(req.file.path, () => { });
		}
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// POST /api/admin/albums — tạo album mới
// ─────────────────────────────────────────────
router.post('/albums', verifyAdmin, async (req, res) => {
	try {
		const { title, artist_id, type, release_date, cover_url } = req.body;

		if (!title || !artist_id) {
			return res.status(400).json({ error: 'Thiếu thông tin: title và artist_id là bắt buộc' });
		}

		const result = await db.query(
			`INSERT INTO albums (title, artist_id, type, release_date, cover_url)
       VALUES (?, ?, ?, ?, ?)`,
			[
				title.trim(),
				parseInt(artist_id),
				type || 'album',
				release_date || null,
				cover_url || null,
			]
		);

		res.json({
			success: true,
			id: result.insertId,
			message: `Đã tạo album "${title}" thành công`,
		});

	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// POST /api/admin/artists — tạo nghệ sĩ mới
// ─────────────────────────────────────────────
router.post('/artists', verifyAdmin, async (req, res) => {
	try {
		const { name, bio, avatar_url, country } = req.body;
		if (!name) return res.status(400).json({ error: 'Thiếu tên nghệ sĩ' });

		const result = await db.query(
			'INSERT INTO artists (name, bio, avatar_url, country, verified) VALUES (?, ?, ?, ?, 0)',
			[name.trim(), bio || null, avatar_url || null, country || null]
		);

		res.json({
			success: true,
			id: result.insertId,
			name: name.trim(),
			message: `Đã tạo nghệ sĩ "${name}" thành công`,
		});
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// GET /api/admin/artists — lấy danh sách nghệ sĩ
// ─────────────────────────────────────────────
router.get('/artists', async (req, res) => {
	try {
		const artists = await db.query('SELECT id, name FROM artists ORDER BY name');
		res.json(artists);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;