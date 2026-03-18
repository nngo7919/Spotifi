// =============================================
//  Src/routes/artist-requests.js
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken,
	verifyAdmin } = require('../middleware/auth');

// ─────────────────────────────────────────────
// POST /api/artist-requests — user gửi request
// ─────────────────────────────────────────────
router.post('/', verifyToken, async (req, res) => {
	try {
		const { artist_name, bio, reason } = req.body;
		if (!artist_name) return res.status(400).json({ error: 'Vui lòng nhập tên nghệ sĩ' });

		// Kiểm tra đã có request pending chưa
		const existing = await db.query(
			"SELECT id FROM artist_requests WHERE user_id = ? AND status = 'pending'",
			[req.user.userId]
		);
		if (existing.length)
			return res.status(409).json({ error: 'Bạn đã có yêu cầu đang chờ duyệt' });

		// Kiểm tra đã là artist chưa
		const userRows = await db.query(
			"SELECT role FROM users WHERE id = ?", [req.user.userId]
		);
		if (userRows[0]?.role === 'artist')
			return res.status(409).json({ error: 'Bạn đã là nghệ sĩ' });

		await db.query(
			'INSERT INTO artist_requests (user_id, artist_name, bio, reason) VALUES (?, ?, ?, ?)',
			[req.user.userId, artist_name.trim(), bio || null, reason || null]
		);

		res.json({ success: true, message: 'Đã gửi yêu cầu. Admin sẽ xem xét sớm!' });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// GET /api/artist-requests/me — user kiểm tra status
// ─────────────────────────────────────────────
router.get('/me', verifyToken, async (req, res) => {
	try {
		const rows = await db.query(
			'SELECT id, artist_name, status, created_at, reviewed_at FROM artist_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
			[req.user.userId]
		);
		res.json(rows[0] || null);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// GET /api/artist-requests — admin xem tất cả
// ─────────────────────────────────────────────
router.get('/', verifyAdmin, async (req, res) => {
	try {
		const rows = await db.query(`
      SELECT ar.id, ar.artist_name, ar.bio, ar.reason, ar.status, ar.created_at,
             u.id AS user_id, u.username, u.email
      FROM artist_requests ar
      JOIN users u ON ar.user_id = u.id
      ORDER BY ar.status = 'pending' DESC, ar.created_at DESC
    `);
		res.json(rows);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// ─────────────────────────────────────────────
// PATCH /api/artist-requests/:id — admin approve/reject
// ─────────────────────────────────────────────
router.patch('/:id', verifyAdmin, async (req, res) => {
	try {
		const { action } = req.body; // 'approve' | 'reject'
		if (!['approve', 'reject'].includes(action))
			return res.status(400).json({ error: 'action phải là approve hoặc reject' });

		const rows = await db.query(
			'SELECT * FROM artist_requests WHERE id = ?', [req.params.id]
		);
		if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy request' });

		const request = rows[0];

		if (action === 'approve') {
			// 1. Tạo artist record
			const artistResult = await db.query(
				'INSERT INTO artists (name, bio, verified) VALUES (?, ?, 0)',
				[request.artist_name, request.bio || null]
			);
			const artistId = artistResult.insertId;

			// 2. Cập nhật user → role artist + artist_id
			await db.query(
				"UPDATE users SET role = 'artist', artist_id = ? WHERE id = ?",
				[artistId, request.user_id]
			);

			// 3. Cập nhật request status
			await db.query(
				"UPDATE artist_requests SET status = 'approved', reviewed_at = NOW() WHERE id = ?",
				[req.params.id]
			);

			res.json({ success: true, message: `Đã approve "${request.artist_name}"`, artist_id: artistId });

		} else {
			await db.query(
				"UPDATE artist_requests SET status = 'rejected', reviewed_at = NOW() WHERE id = ?",
				[req.params.id]
			);
			res.json({ success: true, message: 'Đã từ chối yêu cầu' });
		}
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;