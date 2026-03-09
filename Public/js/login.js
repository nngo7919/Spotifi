/* =============================================
			SoundWave - login.js
			============================================= */

const API = 'http://localhost:3000/api';

// ── Elements ──────────────────────────────────
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const alertBox = document.getElementById('alertBox');

// Login fields
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');

// Register fields
const regUsername = document.getElementById('regUsername');
const regEmail = document.getElementById('regEmail');
const regPassword = document.getElementById('regPassword');
const regConfirm = document.getElementById('regConfirm');
const registerBtn = document.getElementById('registerBtn');

// Password strength
const strengthFill = document.getElementById('strengthFill');
const strengthLabel = document.getElementById('strengthLabel');

// ── Tab switching ──────────────────────────────
tabLogin.addEventListener('click', () => {
	tabLogin.classList.add('active');
	tabRegister.classList.remove('active');
	loginForm.classList.remove('d-none');
	registerForm.classList.add('d-none');
	hideAlert();
});

tabRegister.addEventListener('click', () => {
	tabRegister.classList.add('active');
	tabLogin.classList.remove('active');
	registerForm.classList.remove('d-none');
	loginForm.classList.add('d-none');
	hideAlert();
});

// ── Alert helpers ──────────────────────────────
function showAlert(message, type = 'error') {
	alertBox.textContent = message;
	alertBox.className = `sw-alert ${type}`;
	alertBox.classList.remove('d-none');
}

function hideAlert() {
	alertBox.classList.add('d-none');
}

// ── Loading button ─────────────────────────────
function setLoading(btn, loading) {
	const text = btn.querySelector('.btn-text');
	const spinner = btn.querySelector('.btn-spinner');
	btn.disabled = loading;
	text.classList.toggle('d-none', loading);
	spinner.classList.toggle('d-none', !loading);
}

// ── Show / hide password ───────────────────────
function togglePassword(inputEl, eyeBtn) {
	eyeBtn.addEventListener('click', () => {
		const isText = inputEl.type === 'text';
		inputEl.type = isText ? 'password' : 'text';
		// Đổi icon
		eyeBtn.querySelector('svg').style.opacity = isText ? '1' : '0.4';
	});
}

togglePassword(loginPassword, document.getElementById('eyeLogin'));
togglePassword(regPassword, document.getElementById('eyeReg'));

// ── Password strength ──────────────────────────
regPassword.addEventListener('input', () => {
	const val = regPassword.value;
	let score = 0;

	if (val.length >= 8) score++;
	if (/[A-Z]/.test(val)) score++;
	if (/[0-9]/.test(val)) score++;
	if (/[^A-Za-z0-9]/.test(val)) score++;

	const levels = [
		{ pct: 0, color: '', label: '' },
		{ pct: 25, color: '#e74c3c', label: '😟 Rất yếu' },
		{ pct: 50, color: '#f39c12', label: '😐 Yếu' },
		{ pct: 75, color: '#3498db', label: '🙂 Trung bình' },
		{ pct: 100, color: '#1db954', label: '💪 Mạnh' },
	];

	const lv = levels[score] || levels[0];
	strengthFill.style.width = lv.pct + '%';
	strengthFill.style.background = lv.color;
	strengthLabel.textContent = lv.label;
	strengthLabel.style.color = lv.color;
});

// ── Validate ───────────────────────────────────
function validateEmail(email) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function markError(input) {
	input.classList.add('error');
	input.addEventListener('input', () => input.classList.remove('error'), { once: true });
}

// ── LOGIN ──────────────────────────────────────
loginForm.addEventListener('submit', async (e) => {
	e.preventDefault();
	hideAlert();

	const email = loginEmail.value.trim();
	const password = loginPassword.value;

	// Validate
	if (!validateEmail(email)) {
		markError(loginEmail);
		return showAlert('Email không hợp lệ.');
	}
	if (password.length < 6) {
		markError(loginPassword);
		return showAlert('Mật khẩu phải có ít nhất 6 ký tự.');
	}

	setLoading(loginBtn, true);

	try {
		const res = await fetch(`${API}/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password }),
		});

		const data = await res.json();

		if (!res.ok) {
			showAlert(data.error || 'Đăng nhập thất bại.');
		} else {
			// Lưu token + user vào localStorage
			localStorage.setItem('sw_token', data.token);
			localStorage.setItem('sw_user', JSON.stringify(data.user));

			showAlert(`Chào mừng trở lại, ${data.user.username}! 🎵`, 'success');

			// Chuyển sang trang chính sau 1 giây
			setTimeout(() => {
				window.location.href = '/html/index.html';
			}, 1000);
		}
	} catch (err) {
		showAlert('Không thể kết nối đến server. Vui lòng thử lại.');
	} finally {
		setLoading(loginBtn, false);
	}
});

// ── REGISTER ───────────────────────────────────
registerForm.addEventListener('submit', async (e) => {
	e.preventDefault();
	hideAlert();

	const username = regUsername.value.trim();
	const email = regEmail.value.trim();
	const password = regPassword.value;
	const confirm = regConfirm.value;

	// Validate
	if (username.length < 3) {
		markError(regUsername);
		return showAlert('Tên người dùng phải có ít nhất 3 ký tự.');
	}
	if (!validateEmail(email)) {
		markError(regEmail);
		return showAlert('Email không hợp lệ.');
	}
	if (password.length < 6) {
		markError(regPassword);
		return showAlert('Mật khẩu phải có ít nhất 6 ký tự.');
	}
	if (password !== confirm) {
		markError(regConfirm);
		return showAlert('Mật khẩu xác nhận không khớp.');
	}

	setLoading(registerBtn, true);

	try {
		const res = await fetch(`${API}/auth/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username, email, password }),
		});

		const data = await res.json();

		if (!res.ok) {
			showAlert(data.error || 'Đăng ký thất bại.');
		} else {
			showAlert('Đăng ký thành công! Hãy đăng nhập. 🎉', 'success');

			// Tự động chuyển sang tab đăng nhập sau 1.5 giây
			setTimeout(() => {
				tabLogin.click();
				loginEmail.value = email;
			}, 1500);
		}
	} catch (err) {
		showAlert('Không thể kết nối đến server. Vui lòng thử lại.');
	} finally {
		setLoading(registerBtn, false);
	}
});

// ── Kiểm tra đã đăng nhập chưa ────────────────
// Nếu đã có token thì chuyển thẳng vào app
(function checkAuth() {
	const token = localStorage.getItem('sw_token');
	if (token) {
		window.location.href = '/html/index.html';
	}
})();

// ── FORGOT PASSWORD ────────────────────────────
const forgotForm = document.getElementById('forgotForm');
const forgotLink = document.getElementById('forgotLink');
const backToLogin = document.getElementById('backToLogin');
const forgotEmail = document.getElementById('forgotEmail');
const forgotNewPassword = document.getElementById('forgotNewPassword');
const forgotConfirm = document.getElementById('forgotConfirm');
const forgotBtn = document.getElementById('forgotBtn');
const forgotStrengthFill = document.getElementById('forgotStrengthFill');
const forgotStrengthLabel = document.getElementById('forgotStrengthLabel');

// Các form hiện tại
const allForms = [loginForm, registerForm, forgotForm];

function showForm(formToShow) {
	allForms.forEach(f => f.classList.add('d-none'));
	formToShow.classList.remove('d-none');
	hideAlert();
}

// Click "Quên mật khẩu?" → hiện forgot form
forgotLink.addEventListener('click', (e) => {
	e.preventDefault();
	// Prefill email nếu đã nhập
	if (loginEmail.value) forgotEmail.value = loginEmail.value;
	// Ẩn tabs khi vào forgot
	document.querySelector('.form-tabs').style.opacity = '0.3';
	document.querySelector('.form-tabs').style.pointerEvents = 'none';
	showForm(forgotForm);
});

// Nút ← quay lại login
backToLogin.addEventListener('click', () => {
	document.querySelector('.form-tabs').style.opacity = '';
	document.querySelector('.form-tabs').style.pointerEvents = '';
	showForm(loginForm);
	tabLogin.classList.add('active');
	tabRegister.classList.remove('active');
});

// Password strength cho forgot form
forgotNewPassword.addEventListener('input', () => {
	const val = forgotNewPassword.value;
	let score = 0;
	if (val.length >= 8) score++;
	if (/[A-Z]/.test(val)) score++;
	if (/[0-9]/.test(val)) score++;
	if (/[^A-Za-z0-9]/.test(val)) score++;

	const levels = [
		{ pct: 0, color: '', label: '' },
		{ pct: 25, color: '#e74c3c', label: '😟 Rất yếu' },
		{ pct: 50, color: '#f39c12', label: '😐 Yếu' },
		{ pct: 75, color: '#3498db', label: '🙂 Trung bình' },
		{ pct: 100, color: '#1db954', label: '💪 Mạnh' },
	];
	const lv = levels[score] || levels[0];
	forgotStrengthFill.style.width = lv.pct + '%';
	forgotStrengthFill.style.background = lv.color;
	forgotStrengthLabel.textContent = lv.label;
	forgotStrengthLabel.style.color = lv.color;
});

togglePassword(forgotNewPassword, document.getElementById('eyeForgotNew'));

// Submit forgot form
forgotForm.addEventListener('submit', async (e) => {
	e.preventDefault();
	hideAlert();

	const email = forgotEmail.value.trim();
	const newPassword = forgotNewPassword.value;
	const confirm = forgotConfirm.value;

	if (!validateEmail(email)) {
		markError(forgotEmail);
		return showAlert('Email không hợp lệ.');
	}
	if (newPassword.length < 6) {
		markError(forgotNewPassword);
		return showAlert('Mật khẩu mới phải có ít nhất 6 ký tự.');
	}
	if (newPassword !== confirm) {
		markError(forgotConfirm);
		return showAlert('Mật khẩu xác nhận không khớp.');
	}

	setLoading(forgotBtn, true);

	try {
		const res = await fetch(`${API}/auth/reset-password`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, newPassword }),
		});
		const data = await res.json();

		if (!res.ok) {
			showAlert(data.error || 'Đặt lại mật khẩu thất bại.');
		} else {
			showAlert('Đặt lại mật khẩu thành công! Đang chuyển đến đăng nhập...', 'success');
			setTimeout(() => {
				// Quay về login, prefill email
				backToLogin.click();
				loginEmail.value = email;
				loginPassword.focus();
			}, 1500);
		}
	} catch {
		showAlert('Không thể kết nối đến server. Vui lòng thử lại.');
	} finally {
		setLoading(forgotBtn, false);
	}
});