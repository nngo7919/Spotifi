// =============================================
//  routes/stream.js
// =============================================

const express = require('express');
const router = express.Router();
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const db = require('../db');
const { optionalToken } = require('../middleware/auth');

const AUDIO_DIR = path.join(__dirname, '../../Public/audio');

// GET /api/stream/:songId
router.get('/:songId', optionalToken, async (req, res) => {
	try {
		// 1. Lấy thông tin bài hát từ DB
		const song = await db.getSongById(req.params.songId);
		if (!song) {
			return res.status(404).json({ error: 'Không tìm thấy bài hát' });
		}

		// 2. Đường dẫn file
		const fileName = path.basename(song.file_url);
		const filePath = path.join(AUDIO_DIR, fileName);

		// 3. Kiểm tra file tồn tại — async
		try {
			await fsp.access(filePath, fs.constants.R_OK);
		} catch {
			return res.status(404).json({ error: 'File nhạc không tồn tại' });
		}

		// 4. Lấy kích thước file — async
		const stat = await fsp.stat(filePath);
		const fileSize = stat.size;

		// 5. Set header chung cho cả 2 trường hợp
		res.setHeader('Content-Type', 'audio/mpeg');
		res.setHeader('Accept-Ranges', 'bytes');
		res.setHeader('Cache-Control', 'no-cache');

		// 6. Xử lý Range Request
		const range = req.headers.range;

		if (range) {
			const parts = range.replace(/bytes=/, '').split('-');
			const start = parseInt(parts[0], 10);
			const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

			// Range không hợp lệ
			if (isNaN(start) || isNaN(end) || start > end || end >= fileSize) {
				res.setHeader('Content-Range', `bytes */${fileSize}`);
				return res.status(416).end();
			}

			const chunkSize = end - start + 1;

			res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
			res.setHeader('Content-Length', chunkSize);
			res.status(206);

			const fileStream = fs.createReadStream(filePath, { start, end });
			fileStream.on('error', (err) => {
				console.error('Stream error:', err);
				if (!res.headersSent) res.status(500).end();
			});
			fileStream.pipe(res);

		} else {
			// Không có Range → gửi toàn bộ
			res.setHeader('Content-Length', fileSize);
			res.status(200);

			const fileStream = fs.createReadStream(filePath);
			fileStream.on('error', (err) => {
				console.error('Stream error:', err);
				if (!res.headersSent) res.status(500).end();
			});
			fileStream.pipe(res);
		}

		// 7. Ghi lượt nghe do frontend xử lý (POST /api/songs/:id/play)

	} catch (err) {
		console.error('Stream route error:', err);
		if (!res.headersSent) {
			res.status(500).json({ error: err.message });
		}
	}
});

module.exports = router;