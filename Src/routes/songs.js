// =============================================
//  routes/songs.js
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken,
	optionalToken } = require('../middleware/auth');
const { getEmbedding, cosineSimilarity, buildSongText } = require('../ai');

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

// GET /api/songs/:id/lyrics — public
router.get('/:id/lyrics', async (req, res) => {
	try {
		const song = await db.getSongById(req.params.id);
		if (!song) return res.status(404).json({ error: 'Không tìm thấy bài hát' });
		res.json({
			id: song.id,
			title: song.title,
			artist: song.artist_name,
			lyrics: song.lyrics || null,
		});
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


// ─────────────────────────────────────────────
// POST /api/songs/embed-all — generate embedding cho tất cả bài (admin)
// Gọi 1 lần sau khi setup, hoặc khi thêm bài mới
// ─────────────────────────────────────────────
router.post('/embed-all', async (req, res) => {
	try {
		const songs = await db.getSongsWithoutEmbedding();
		if (!songs.length) return res.json({ message: 'Tất cả bài đã có embedding', count: 0 });

		let done = 0, failed = 0;
		for (const song of songs) {
			try {
				const text = buildSongText(song);
				const vector = await getEmbedding(text);
				if (vector) {
					await db.saveSongEmbedding(song.id, vector);
					done++;
				}
				// Delay nhẹ để không bị rate limit
				await new Promise(r => setTimeout(r, 300));
			} catch (e) {
				console.error(`[EMBED] song ${song.id} failed:`, e.message);
				failed++;
			}
		}
		res.json({ message: `Đã embed ${done} bài, thất bại ${failed}`, done, failed });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// GET /api/songs/smart-search?q=keyword — tìm kiếm thông minh bằng AI
// Hiểu ngữ nghĩa: "bài buồn", "nhạc vui", "bài tình cảm"...
// ─────────────────────────────────────────────
router.get('/smart-search', async (req, res) => {
	try {
		const q = req.query.q || '';
		if (!q.trim()) return res.json([]);

		// 1. Encode query thành vector
		const queryVector = await getEmbedding(q);
		if (!queryVector) return res.json([]);

		// 2. Lấy tất cả bài có embedding
		const songs = await db.getAllSongsWithEmbedding();

		// 3. Tính similarity, lọc bài có embedding
		const scored = songs
			.filter(s => s.embedding)
			.map(s => {
				const vec = typeof s.embedding === 'string'
					? JSON.parse(s.embedding)
					: s.embedding;
				return { ...s, score: cosineSimilarity(queryVector, vec) };
			})
			.sort((a, b) => b.score - a.score)
			.slice(0, 10);

		// 4. Format giống search thường
		res.json(scored.map(s => ({
			type: 'song',
			id: s.id,
			name: s.title,
			artist: s.artist_name,
			image: s.album_cover,
			score: Math.round(s.score * 100),
		})));
	} catch (err) {
		console.error('[SMART-SEARCH]', err.message);
		// Fallback về search thường nếu AI lỗi
		try {
			const results = await db.search(req.query.q);
			res.json(results);
		} catch (e) {
			res.status(500).json({ error: err.message });
		}
	}
});

// ─────────────────────────────────────────────
// GET /api/songs/:id/similar?limit=5 — tìm bài tương tự (Smart Queue)
// ─────────────────────────────────────────────
router.get('/:id/similar', async (req, res) => {
	try {
		const songId = parseInt(req.params.id);
		const limit = parseInt(req.query.limit) || 5;

		// Lấy embedding bài hiện tại
		const allSongs = await db.getAllSongsWithEmbedding();
		const current = allSongs.find(s => s.id === songId);

		if (!current || !current.embedding) {
			// Fallback: trả bài cùng genre
			const song = await db.getSongById(songId);
			if (song && song.genres) {
				const genre = song.genres.split(',')[0].trim();
				const similar = await db.getSongsByGenre(genre, limit + 1);
				return res.json(similar.filter(s => s.id !== songId).slice(0, limit));
			}
			return res.json([]);
		}

		const currentVec = typeof current.embedding === 'string'
			? JSON.parse(current.embedding)
			: current.embedding;

		// Tính similarity với tất cả bài còn lại
		const similar = allSongs
			.filter(s => s.id !== songId && s.embedding)
			.map(s => {
				const vec = typeof s.embedding === 'string'
					? JSON.parse(s.embedding)
					: s.embedding;
				return { ...s, score: cosineSimilarity(currentVec, vec) };
			})
			.sort((a, b) => b.score - a.score)
			.slice(0, limit);

		res.json(similar.map(s => ({
			id: s.id,
			title: s.title,
			artist_name: s.artist_name,
			album_cover: s.album_cover,
			score: Math.round(s.score * 100),
		})));
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;