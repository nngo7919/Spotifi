// =============================================
//  Src/routes/admin.js
//  npm install multer
// =============================================

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const { verifyAdmin } = require('../middleware/auth');

// ── Multer config ──
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		const uploadDir = path.join(__dirname, '../Public/audio');
		// Tạo folder nếu chưa tồn tại
		if (!fs.existsSync(uploadDir)) {
			fs.mkdirSync(uploadDir, { recursive: true });
		}
		cb(null, uploadDir);
	},
	filename: (req, file, cb) => {
		// Lưu theo timestamp để tránh trùng tên
		const timestamp = Date.now();
		const ext = path.extname(file.originalname);
		cb(null, `audio-${timestamp}${ext}`);
	},
});

const upload = multer({
	storage,
	limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
	fileFilter: (req, file, cb) => {
		const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
		if (allowedTypes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error(`File type ${file.mimetype} không được hỗ trợ`), false);
		}
	},
});

// ─────────────────────────────────────────────
// UPLOAD
// ─────────────────────────────────────────────

// POST /api/admin/songs — upload bài hát
router.post('/songs', verifyAdmin, upload.single('audio'), async (req, res) => {
	console.log('[ADMIN/songs] req.file:', req.file);
	console.log('[ADMIN/songs] req.body:', req.body);
	try {
		const { title, duration, artist_id, album_id, track_number, is_explicit, lyrics, cover_url } = req.body;
		if (!title || !duration || !artist_id) return res.status(400).json({ error: 'Thiếu title, duration hoặc artist_id' });
		if (!req.file) return res.status(400).json({ error: 'Thiếu file MP3' });

		const file_url = '/audio/' + req.file.filename;

		// Parse album_id safely - avoid NaN from empty string
		let finalAlbumId = null;
		if (album_id && album_id !== '' && !isNaN(parseInt(album_id))) {
			finalAlbumId = parseInt(album_id);
		}
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
			[title.trim(), parseInt(duration), parseInt(artist_id), finalAlbumId,
			track_number ? parseInt(track_number) : 1, is_explicit === '1' ? 1 : 0, file_url, lyrics || null]
		);

		res.json({ success: true, id: result.insertId, album_id: finalAlbumId, auto_single: !album_id, file_url });
	} catch (err) {
		if (req.file) fs.unlink(req.file.path, () => { });
		console.error('[ADMIN/songs POST]', err.message);
		res.status(500).json({ error: err.message });
	}
});

// POST /api/admin/albums — tạo album
router.post('/albums', verifyAdmin, async (req, res) => {
	try {
		const { title, artist_id, type, release_date, cover_url } = req.body;
		if (!title || !artist_id) return res.status(400).json({ error: 'Thiếu title hoặc artist_id' });
		const result = await db.query(
			'INSERT INTO albums (title, artist_id, type, release_date, cover_url) VALUES (?, ?, ?, ?, ?)',
			[title.trim(), parseInt(artist_id), type || 'album', release_date || null, cover_url || null]
		);
		res.json({ success: true, id: result.insertId });
	} catch (err) {
		console.error('[ADMIN/albums POST]', err.message);
		res.status(500).json({ error: err.message });
	}
});

// POST /api/admin/artists — tạo nghệ sĩ
router.post('/artists', verifyAdmin, async (req, res) => {
	try {
		const { name, bio, avatar_url, country } = req.body;
		if (!name) return res.status(400).json({ error: 'Thiếu tên nghệ sĩ' });
		const result = await db.query(
			'INSERT INTO artists (name, bio, avatar_url, country, verified) VALUES (?, ?, ?, ?, 0)',
			[name.trim(), bio || null, avatar_url || null, country || null]
		);
		res.json({ success: true, id: result.insertId, name: name.trim() });
	} catch (err) {
		console.error('[ADMIN/artists POST]', err.message);
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// MANAGE SONGS
// ─────────────────────────────────────────────

// GET /api/admin/manage/songs — danh sách tất cả bài hát
router.get('/manage/songs', verifyAdmin, async (req, res) => {
	try {
		const songs = await db.query(`
      SELECT
        s.id, s.title, s.duration, s.plays_count,
        s.file_url, s.is_explicit, s.track_number,
        s.lyrics,
        a.id   AS artist_id,   a.name AS artist_name,
        al.id  AS album_id,    al.title AS album_title,
        al.type AS album_type
      FROM songs s
      JOIN artists a      ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id  = al.id
      ORDER BY s.id DESC
    `);
		res.json(songs);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// DELETE /api/admin/manage/songs/:id — xóa bài hát
router.delete('/manage/songs/:id', verifyAdmin, async (req, res) => {
	try {
		const id = parseInt(req.params.id);

		// Lấy file_url để xóa file vật lý
		const rows = await db.query('SELECT file_url FROM songs WHERE id = ?', [id]);
		if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy bài hát' });

		const filePath = path.join(__dirname, '../../Public', rows[0].file_url);
		if (fs.existsSync(filePath)) fs.unlink(filePath, () => { });

		// Xóa khỏi các bảng liên quan trước
		await db.query('DELETE FROM liked_songs    WHERE song_id = ?', [id]);
		await db.query('DELETE FROM play_history   WHERE song_id = ?', [id]);
		await db.query('DELETE FROM playlist_songs WHERE song_id = ?', [id]);
		await db.query('DELETE FROM song_genres    WHERE song_id = ?', [id]);
		await db.query('DELETE FROM songs          WHERE id = ?', [id]);

		res.json({ success: true, message: 'Đã xóa bài hát' });
	} catch (err) {
		console.error('[ADMIN/delete song]', err.message);
		res.status(500).json({ error: err.message });
	}
});

// PATCH /api/admin/manage/songs/:id — sửa metadata
router.patch('/manage/songs/:id', verifyAdmin, async (req, res) => {
	try {
		const id = parseInt(req.params.id);
		const { title, duration, artist_id, album_id, track_number, is_explicit, lyrics } = req.body;

		const fields = [];
		const values = [];

		if (title !== undefined) { fields.push('title = ?'); values.push(title.trim()); }
		if (duration !== undefined) { fields.push('duration = ?'); values.push(parseInt(duration)); }
		if (artist_id !== undefined) { fields.push('artist_id = ?'); values.push(parseInt(artist_id)); }
		if (album_id !== undefined) { fields.push('album_id = ?'); values.push(album_id ? parseInt(album_id) : null); }
		if (track_number !== undefined) { fields.push('track_number = ?'); values.push(parseInt(track_number)); }
		if (is_explicit !== undefined) { fields.push('is_explicit = ?'); values.push(is_explicit ? 1 : 0); }
		if (lyrics !== undefined) { fields.push('lyrics = ?'); values.push(lyrics || null); }

		if (!fields.length) return res.status(400).json({ error: 'Không có gì để cập nhật' });

		values.push(id);
		await db.query(`UPDATE songs SET ${fields.join(', ')} WHERE id = ?`, values);

		res.json({ success: true, message: 'Đã cập nhật bài hát' });
	} catch (err) {
		console.error('[ADMIN/patch song]', err.message);
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────

// GET /api/admin/analytics — tổng quan
router.get('/analytics', verifyAdmin, async (req, res) => {
	try {
		const [totalSongs] = await db.query('SELECT COUNT(*) AS count FROM songs');
		const [totalPlays] = await db.query('SELECT SUM(plays_count) AS total FROM songs');
		const [totalAlbums] = await db.query('SELECT COUNT(*) AS count FROM albums');
		const [totalArtists] = await db.query('SELECT COUNT(*) AS count FROM artists');
		const top10 = await db.query(`
      SELECT s.id, s.title, s.plays_count,
             a.name AS artist_name,
             al.title AS album_title,
             al.cover_url AS cover
      FROM songs s
      JOIN artists a      ON s.artist_id = a.id
      LEFT JOIN albums al ON s.album_id  = al.id
      ORDER BY s.plays_count DESC
      LIMIT 10
    `);

		res.json({
			total_songs: totalSongs.count,
			total_plays: totalPlays.total || 0,
			total_albums: totalAlbums.count,
			total_artists: totalArtists.count,
			top10,
		});
	} catch (err) {
		console.error('[ADMIN/analytics]', err.message);
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;

// ─────────────────────────────────────────────
// GET /api/admin/users — danh sách users
// ─────────────────────────────────────────────
router.get('/users', verifyAdmin, async (req, res) => {
	try {
		const users = await db.query(
			'SELECT id, username, email, role, artist_id FROM users ORDER BY id DESC'
		);
		res.json(users);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// PATCH /api/admin/users/:id/role — gán role artist + artist_id
// ─────────────────────────────────────────────
router.patch('/users/:id/role', verifyAdmin, async (req, res) => {
	try {
		const { role, artist_id } = req.body;
		await db.query(
			'UPDATE users SET role = ?, artist_id = ? WHERE id = ?',
			[role || 'user', artist_id || null, req.params.id]
		);
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// GET /api/admin/artist-requests — danh sách requests
// ─────────────────────────────────────────────
router.get('/artist-requests', verifyAdmin, async (req, res) => {
	try {
		const requests = await db.query(`
      SELECT ar.id, ar.name, ar.bio, ar.avatar_url, ar.country,
             ar.status, ar.note, ar.created_at,
             u.id AS user_id, u.username, u.email
      FROM artist_requests ar
      JOIN users u ON ar.user_id = u.id
      ORDER BY ar.created_at DESC
    `);
		res.json(requests);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// PATCH /api/admin/artist-requests/:id — approve / reject
// ─────────────────────────────────────────────
router.patch('/artist-requests/:id', verifyAdmin, async (req, res) => {
	try {
		const { action, note } = req.body; // action: 'approve' | 'reject'
		const reqId = req.params.id;

		const rows = await db.query('SELECT * FROM artist_requests WHERE id = ?', [reqId]);
		if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy request' });
		const request = rows[0];

		if (action === 'approve') {
			// Tạo artist record
			const artistResult = await db.query(
				'INSERT INTO artists (name, bio, avatar_url, country, verified) VALUES (?, ?, ?, ?, 0)',
				[request.name, request.bio, request.avatar_url, request.country]
			);
			const artistId = artistResult.insertId;

			// Cập nhật user: role = artist, artist_id
			await db.query(
				"UPDATE users SET role = 'artist', artist_id = ? WHERE id = ?",
				[artistId, request.user_id]
			);

			// Cập nhật request status
			await db.query(
				"UPDATE artist_requests SET status = 'approved', note = ? WHERE id = ?",
				[note || null, reqId]
			);

			res.json({ success: true, artist_id: artistId, message: 'Đã duyệt và tạo tài khoản nghệ sĩ' });

		} else if (action === 'reject') {
			await db.query(
				"UPDATE artist_requests SET status = 'rejected', note = ? WHERE id = ?",
				[note || null, reqId]
			);
			res.json({ success: true, message: 'Đã từ chối yêu cầu' });

		} else {
			res.status(400).json({ error: 'action phải là approve hoặc reject' });
		}
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});