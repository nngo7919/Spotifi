// =============================================
//  routes/auth.js
//  Cài thêm: npm install bcrypt jsonwebtoken
// =============================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'soundwave_secret';

// POST /api/auth/register — đăng ký
router.post('/register', async (req, res) => {
	try {
		const { username, email, password } = req.body;

		if (!username || !email || !password)
			return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });

		// Hash password
		const hashed = await bcrypt.hash(password, 10);

		// Tạo user
		const result = await db.query(
			'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
			[username, email, hashed]
		);

		// Tạo subscription free mặc định
		await db.query(
			'INSERT INTO subscriptions (user_id, plan) VALUES (?, ?)',
			[result.insertId, 'free']
		);

		res.status(201).json({ message: 'Đăng ký thành công!', userId: result.insertId });
	} catch (err) {
		if (err.code === 'ER_DUP_ENTRY')
			return res.status(409).json({ error: 'Email hoặc username đã tồn tại' });
		res.status(500).json({ error: err.message });
	}
});

// POST /api/auth/login — đăng nhập
router.post('/login', async (req, res) => {
	try {
		const { email, password } = req.body;

		if (!email || !password)
			return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });

		// Tìm user
		const rows = await db.query(
			'SELECT * FROM users WHERE email = ?',
			[email]
		);

		if (rows.length === 0)
			return res.status(401).json({ error: 'Email không tồn tại' });

		const user = rows[0];

		// Kiểm tra password
		const match = await bcrypt.compare(password, user.password);
		if (!match)
			return res.status(401).json({ error: 'Mật khẩu không đúng' });

		// Tạo JWT token — bao gồm role
		const token = jwt.sign(
			{ userId: user.id, username: user.username, role: user.role || 'user', artist_id: user.artist_id || null },
			JWT_SECRET,
			{ expiresIn: '7d' }
		);

		res.json({
			message: 'Đăng nhập thành công!',
			token,
			user: {
				id: user.id,
				username: user.username,
				email: user.email,
				avatar: user.avatar_url,
				role: user.role || 'user',
				artist_id: user.artist_id || null,
			}
		});
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// POST /api/auth/reset-password — đặt lại mật khẩu
router.post('/reset-password', async (req, res) => {
	try {
		const { email, newPassword } = req.body;

		if (!email || !newPassword)
			return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
		if (newPassword.length < 6)
			return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });

		// Kiểm tra email tồn tại
		const rows = await db.query(
			'SELECT id FROM users WHERE email = ?', [email]
		);
		if (rows.length === 0)
			return res.status(404).json({ error: 'Email không tồn tại trong hệ thống' });

		// Hash và cập nhật mật khẩu mới
		const hashed = await bcrypt.hash(newPassword, 10);
		await db.query(
			'UPDATE users SET password = ? WHERE email = ?', [hashed, email]
		);

		res.json({ message: 'Đặt lại mật khẩu thành công!' });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// GET /api/auth/me — lấy thông tin user hiện tại (dùng để sync role)
router.get('/me', async (req, res) => {
	try {
		const authHeader = req.headers['authorization'];
		const token = authHeader && authHeader.split(' ')[1];
		if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });

		const jwt = require('jsonwebtoken');
		const JWT_SECRET = process.env.JWT_SECRET || 'soundwave_secret';
		const decoded = jwt.verify(token, JWT_SECRET);

		const rows = await db.query(
			'SELECT id, username, email, role, artist_id, avatar_url FROM users WHERE id = ?',
			[decoded.userId]
		);
		if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy user' });

		const u = rows[0];
		res.json({
			id: u.id,
			username: u.username,
			email: u.email,
			role: u.role || 'user',
			artist_id: u.artist_id || null,
			avatar: u.avatar_url,
		});
	} catch (err) {
		res.status(403).json({ error: 'Token không hợp lệ' });
	}
});

module.exports = router;