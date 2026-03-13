// =============================================
//  middleware/auth.js
// =============================================

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'soundwave_secret';

// ── Bắt buộc phải có token ──
function verifyToken(req, res, next) {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];

	if (!token)
		return res.status(401).json({ error: 'Bạn chưa đăng nhập.' });

	try {
		req.user = jwt.verify(token, JWT_SECRET); // { userId, username, role }
		next();
	} catch {
		return res.status(403).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
	}
}

// ── Tuỳ chọn ──
function optionalToken(req, res, next) {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];
	if (token) {
		try { req.user = jwt.verify(token, JWT_SECRET); }
		catch { req.user = null; }
	} else {
		req.user = null;
	}
	next();
}

// ── Chỉ admin ──
function verifyAdmin(req, res, next) {
	verifyToken(req, res, () => {
		if (req.user.role !== 'admin')
			return res.status(403).json({ error: 'Bạn không có quyền admin.' });
		next();
	});
}

module.exports = { verifyToken, optionalToken, verifyAdmin };