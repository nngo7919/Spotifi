
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'soundwave_secret';

// ── Bắt buộc phải có token (dùng cho route cần login) ──
function verifyToken(req, res, next) {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

	if (!token) {
		return res.status(401).json({ error: 'Bạn chưa đăng nhập.' });
	}

	try {
		const decoded = jwt.verify(token, JWT_SECRET);
		req.user = decoded; // { userId, username }
		next();
	} catch (err) {
		return res.status(403).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
	}
}

// ── Tuỳ chọn (không bắt buộc, dùng cho route public nhưng cần biết user) ──
function optionalToken(req, res, next) {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];

	if (token) {
		try {
			req.user = jwt.verify(token, JWT_SECRET);
		} catch {
			req.user = null;
		}
	} else {
		req.user = null;
	}
	next();
}

module.exports = { verifyToken, optionalToken };