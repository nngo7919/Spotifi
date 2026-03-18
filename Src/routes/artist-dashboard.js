// =============================================
//  Src/routes/artist-dashboard.js
//  Routes cho Artist Dashboard
// =============================================

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

// ── Middleware: chỉ artist mới vào được ──
function verifyArtist(req, res, next) {
	verifyToken(req, res, () => {
		if (req.user.role !== 'artist' && req.user.role !== 'admin')
			return res.status(403).json({ error: 'Bạn không phải nghệ sĩ.' });
		if (!req.user.artist_id)
			return res.status(403).json({ error: 'Tài khoản chưa được liên kết với hồ sơ nghệ sĩ.' });
		next();
	});
}

// ── Multer ──
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
		if (file.mimetype === 'audio/mpeg' || file.originalname.toLowerCase().endsWith('.mp3'))
			cb(null, true);
		else cb(new Error('Chỉ chấp nhận file MP3'));
	},
});

// ─────────────────────────────────────────────
// GET /api/artist-dashboard/me — thông tin artist
// ─────────────────────────────────────────────
router.get('/me', verifyArtist, async (req, res) => {
	try {
		const rows = await db.query(
			'SELECT id, name, bio, avatar_url, country, verified FROM artists WHERE id = ?',
			[req.user.artist_id]
		);
		if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy hồ sơ nghệ sĩ' });
		res.json(rows[0]);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// PATCH /api/artist-dashboard/me — cập nhật profile
// ─────────────────────────────────────────────
router.patch('/me', verifyArtist, async (req, res) => {
	try {
		const { bio, avatar_url, country } = req.body;
		const fields = [];
		const values = [];
		if (bio !== undefined) { fields.push('bio = ?'); values.push(bio || null); }
		if (avatar_url !== undefined) { fields.push('avatar_url = ?'); values.push(avatar_url || null); }
		if (country !== undefined) { fields.push('country = ?'); values.push(country || null); }
		if (!fields.length) return res.status(400).json({ error: 'Không có gì để cập nhật' });

		values.push(req.user.artist_id);
		await db.query(`UPDATE artists SET ${fields.join(', ')} WHERE id = ?`, values);
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// GET /api/artist-dashboard/stats — thống kê
// ─────────────────────────────────────────────
router.get('/stats', verifyArtist, async (req, res) => {
	try {
		const artistId = req.user.artist_id;

		const [songCount] = await db.query(
			'SELECT COUNT(*) AS count FROM songs WHERE artist_id = ?', [artistId]
		);
		const [totalPlays] = await db.query(
			'SELECT COALESCE(SUM(plays_count), 0) AS total FROM songs WHERE artist_id = ?', [artistId]
		);
		const [albumCount] = await db.query(
			'SELECT COUNT(*) AS count FROM albums WHERE artist_id = ?', [artistId]
		);
		const [followers] = await db.query(
			'SELECT COUNT(*) AS count FROM followed_artists WHERE artist_id = ?', [artistId]
		);
		const top10 = await db.query(`
      SELECT s.id, s.title, s.plays_count,
             al.title AS album_title, al.cover_url AS cover
      FROM songs s
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE s.artist_id = ?
      ORDER BY s.plays_count DESC
      LIMIT 10
    `, [artistId]);

		// Lượt nghe 30 ngày gần nhất (nếu có bảng play_history)
		let recentPlays = [];
		try {
			recentPlays = await db.query(`
        SELECT DATE(played_at) AS date, COUNT(*) AS plays
        FROM play_history
        WHERE song_id IN (SELECT id FROM songs WHERE artist_id = ?)
          AND played_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(played_at)
        ORDER BY date ASC
      `, [artistId]);
		} catch { }

		res.json({
			total_songs: songCount.count,
			total_plays: totalPlays.total,
			total_albums: albumCount.count,
			total_followers: followers.count,
			top10,
			recent_plays: recentPlays,
		});
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// GET /api/artist-dashboard/songs — danh sách bài của mình
// ─────────────────────────────────────────────
router.get('/songs', verifyArtist, async (req, res) => {
	try {
		const songs = await db.query(`
      SELECT s.id, s.title, s.duration, s.plays_count,
             s.file_url, s.is_explicit, s.track_number, s.lyrics,
             al.id AS album_id, al.title AS album_title, al.type AS album_type
      FROM songs s
      LEFT JOIN albums al ON s.album_id = al.id
      WHERE s.artist_id = ?
      ORDER BY s.id DESC
    `, [req.user.artist_id]);
		res.json(songs);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// GET /api/artist-dashboard/albums — danh sách album của mình
// ─────────────────────────────────────────────
router.get('/albums', verifyArtist, async (req, res) => {
	try {
		const albums = await db.query(`
      SELECT al.id, al.title, al.type, al.cover_url, al.release_date,
             COUNT(s.id) AS song_count
      FROM albums al
      LEFT JOIN songs s ON al.id = s.album_id
      WHERE al.artist_id = ?
      GROUP BY al.id
      ORDER BY al.id DESC
    `, [req.user.artist_id]);
		res.json(albums);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// POST /api/artist-dashboard/songs — upload bài hát
// ─────────────────────────────────────────────
router.post('/songs', verifyArtist, upload.single('audio'), async (req, res) => {
	try {
		const { title, duration, album_id, track_number, is_explicit, lyrics } = req.body;
		if (!title || !duration) return res.status(400).json({ error: 'Thiếu title hoặc duration' });
		if (!req.file) return res.status(400).json({ error: 'Thiếu file MP3' });

		const artistId = req.user.artist_id;
		const file_url = '/audio/' + req.file.filename;

		// Không chọn album → tự tạo Single
		let finalAlbumId = album_id ? parseInt(album_id) : null;
		if (!finalAlbumId) {
			const today = new Date().toISOString().slice(0, 10);
			const single = await db.query(
				"INSERT INTO albums (title, artist_id, type, release_date) VALUES (?, ?, 'single', ?)",
				[title.trim(), artistId, today]
			);
			finalAlbumId = single.insertId;
		}

		const result = await db.query(
			'INSERT INTO songs (title, duration, artist_id, album_id, track_number, is_explicit, file_url, lyrics, plays_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
			[title.trim(), parseInt(duration), artistId, finalAlbumId,
			track_number ? parseInt(track_number) : 1, is_explicit === '1' ? 1 : 0,
				file_url, lyrics || null]
		);

		res.json({ success: true, id: result.insertId, auto_single: !album_id, file_url });
	} catch (err) {
		if (req.file) fs.unlink(req.file.path, () => { });
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// POST /api/artist-dashboard/albums — tạo album
// ─────────────────────────────────────────────
router.post('/albums', verifyArtist, async (req, res) => {
	try {
		const { title, type, release_date, cover_url } = req.body;
		if (!title) return res.status(400).json({ error: 'Thiếu tên album' });

		const result = await db.query(
			'INSERT INTO albums (title, artist_id, type, release_date, cover_url) VALUES (?, ?, ?, ?, ?)',
			[title.trim(), req.user.artist_id, type || 'album', release_date || null, cover_url || null]
		);
		res.json({ success: true, id: result.insertId });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// PATCH /api/artist-dashboard/songs/:id — sửa bài hát
// ─────────────────────────────────────────────
router.patch('/songs/:id', verifyArtist, async (req, res) => {
	try {
		// Kiểm tra bài hát thuộc về artist này
		const rows = await db.query(
			'SELECT id FROM songs WHERE id = ? AND artist_id = ?',
			[req.params.id, req.user.artist_id]
		);
		if (!rows.length) return res.status(403).json({ error: 'Không có quyền sửa bài hát này' });

		const { title, duration, album_id, track_number, is_explicit, lyrics } = req.body;
		const fields = [];
		const values = [];
		if (title !== undefined) { fields.push('title = ?'); values.push(title.trim()); }
		if (duration !== undefined) { fields.push('duration = ?'); values.push(parseInt(duration)); }
		if (album_id !== undefined) { fields.push('album_id = ?'); values.push(album_id ? parseInt(album_id) : null); }
		if (track_number !== undefined) { fields.push('track_number = ?'); values.push(parseInt(track_number)); }
		if (is_explicit !== undefined) { fields.push('is_explicit = ?'); values.push(is_explicit ? 1 : 0); }
		if (lyrics !== undefined) { fields.push('lyrics = ?'); values.push(lyrics || null); }

		if (!fields.length) return res.status(400).json({ error: 'Không có gì để cập nhật' });
		values.push(req.params.id);
		await db.query(`UPDATE songs SET ${fields.join(', ')} WHERE id = ?`, values);
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// DELETE /api/artist-dashboard/songs/:id — xóa bài hát
// ─────────────────────────────────────────────
router.delete('/songs/:id', verifyArtist, async (req, res) => {
	try {
		const rows = await db.query(
			'SELECT id, file_url FROM songs WHERE id = ? AND artist_id = ?',
			[req.params.id, req.user.artist_id]
		);
		if (!rows.length) return res.status(403).json({ error: 'Không có quyền xóa bài hát này' });

		const filePath = path.join(__dirname, '../../Public', rows[0].file_url);
		if (fs.existsSync(filePath)) fs.unlink(filePath, () => { });

		await db.query('DELETE FROM liked_songs    WHERE song_id = ?', [req.params.id]);
		await db.query('DELETE FROM play_history   WHERE song_id = ?', [req.params.id]);
		await db.query('DELETE FROM playlist_songs WHERE song_id = ?', [req.params.id]);
		await db.query('DELETE FROM song_genres    WHERE song_id = ?', [req.params.id]);
		await db.query('DELETE FROM songs          WHERE id = ?', [req.params.id]);
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;