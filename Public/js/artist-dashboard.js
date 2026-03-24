const API = 'http://localhost:3000/api';

// Ưu tiên dùng token từ trang chính (localStorage), fallback sessionStorage
let artistToken = localStorage.getItem('sw_token')
	|| sessionStorage.getItem('artistToken')
	|| '';

let myAlbums = [];
let mySongsData = [];

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────
async function checkAuth() {
	if (!artistToken) return;
	try {
		const res = await authFetch(`${API}/artist-dashboard/me`);
		if (res.ok) {
			const data = await res.json();
			document.getElementById('loginGate').style.display = 'none';
			initDashboard(data);
		} else {
			// Token hết hạn hoặc không hợp lệ → hiện login gate
			artistToken = '';
			sessionStorage.removeItem('artistToken');
			if (res.status === 403) {
				const errEl = document.getElementById('loginError');
				errEl.textContent = 'Vui lòng đăng nhập lại.';
				errEl.style.display = 'block';
			}
		}
	} catch { }
}

async function artistLogin() {
	const email = document.getElementById('loginEmail').value.trim();
	const password = document.getElementById('loginPassword').value;
	const errEl = document.getElementById('loginError');
	errEl.style.display = 'none';

	if (!email || !password) {
		errEl.textContent = 'Vui lòng nhập email và mật khẩu';
		errEl.style.display = 'block';
		return;
	}

	try {
		const res = await fetch(`${API}/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password }),
		});
		const data = await res.json();

		if (!res.ok) { errEl.textContent = data.error || 'Đăng nhập thất bại'; errEl.style.display = 'block'; return; }
		if (data.user.role !== 'artist' && data.user.role !== 'admin') {
			errEl.textContent = 'Tài khoản này không phải nghệ sĩ'; errEl.style.display = 'block'; return;
		}
		if (!data.user.artist_id) {
			errEl.textContent = 'Tài khoản chưa được liên kết với hồ sơ nghệ sĩ'; errEl.style.display = 'block'; return;
		}

		artistToken = data.token;
		sessionStorage.setItem('artistToken', artistToken);
		// Cập nhật luôn localStorage để trang chính cũng dùng token mới
		localStorage.setItem('sw_token', data.token);
		localStorage.setItem('sw_user', JSON.stringify(data.user));
		document.getElementById('loginGate').style.display = 'none';

		const meRes = await authFetch(`${API}/artist-dashboard/me`);
		const meData = await meRes.json();
		initDashboard(meData);
	} catch {
		errEl.textContent = 'Không thể kết nối server'; errEl.style.display = 'block';
	}
}

document.getElementById('loginPassword').addEventListener('keydown', e => {
	if (e.key === 'Enter') artistLogin();
});

function authFetch(url, options = {}) {
	return fetch(url, {
		...options,
		headers: { ...(options.headers || {}), 'Authorization': `Bearer ${artistToken}` },
	});
}

function logout() {
	sessionStorage.removeItem('artistToken');
	localStorage.removeItem('sw_token');
	localStorage.removeItem('sw_user');
	window.location.href = '/html/login.html';
}

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
async function initDashboard(artist) {
	document.getElementById('sidebarArtistName').textContent = artist.name;
	document.getElementById('profileNameDisplay').textContent = artist.name;
	document.getElementById('profileVerified').textContent = artist.verified ? '✅ Verified' : '';

	if (artist.avatar_url) {
		const av = document.getElementById('profileAvatarPreview');
		av.innerHTML = `<img src="${artist.avatar_url}" alt="">`;
	}

	// Fill profile form
	document.getElementById('pfAvatar').value = artist.avatar_url || '';
	document.getElementById('pfBio').value = artist.bio || '';
	document.getElementById('pfCountry').value = artist.country || '';

	await loadMyAlbums();
	loadStats();
	loadMySongs();
	initDropZone('upMp3Zone', 'upFile', 'upFileName');
}

// ─────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────
function switchPage(name) {
	document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
	document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
	document.getElementById('page-' + name).classList.add('active');
	document.getElementById('nav-' + name).classList.add('active');
	if (name === 'stats') loadStats();
	if (name === 'manage') loadMySongs();
}

// ─────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────
function showToast(msg, type = 'success') {
	const t = document.getElementById('toast');
	t.textContent = (type === 'success' ? '✅ ' : '❌ ') + msg;
	t.className = 'show ' + type;
	setTimeout(() => t.className = '', 3500);
}

// ─────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────
async function loadStats() {
	try {
		const res = await authFetch(`${API}/artist-dashboard/stats`);
		const data = await res.json();
		if (!res.ok) return;

		document.getElementById('statSongs').textContent = data.total_songs;
		document.getElementById('statPlays').textContent = formatPlays(data.total_plays);
		document.getElementById('statAlbums').textContent = data.total_albums;
		document.getElementById('statFollowers').textContent = data.total_followers;

		const maxPlays = data.top10[0]?.plays_count || 1;
		document.getElementById('statsTop10').innerHTML = data.top10.length
			? data.top10.map((s, i) => `
          <tr>
            <td><span class="rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span></td>
            <td style="font-weight:700;">${s.title}</td>
            <td style="color:var(--text-dim);font-size:13px;">${s.album_title || 'Single'}</td>
            <td style="min-width:180px;">
              <div class="plays-bar-wrap">
                <div class="plays-bar-track">
                  <div class="plays-bar-fill" style="width:${Math.round((s.plays_count / maxPlays) * 100)}%"></div>
                </div>
                <span class="plays-num">${(s.plays_count || 0).toLocaleString()}</span>
              </div>
            </td>
          </tr>`).join('')
			: '<tr><td colspan="4" style="text-align:center;color:var(--text-dim);padding:32px;">Chưa có dữ liệu</td></tr>';
	} catch (e) { console.error('loadStats:', e); }
}

function formatPlays(n) {
	if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
	if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
	return (n || 0).toString();
}

// ─────────────────────────────────────────────
// Albums
// ─────────────────────────────────────────────
async function loadMyAlbums() {
	try {
		const res = await authFetch(`${API}/artist-dashboard/albums`);
		myAlbums = await res.json();
		const sel = document.getElementById('upAlbum');
		sel.innerHTML = '<option value="">— Tự động tạo Single —</option>' +
			myAlbums.map(a => `<option value="${a.id}">${a.title} (${a.type})</option>`).join('');
	} catch (e) { console.error('loadMyAlbums:', e); }
}

// ─────────────────────────────────────────────
// Manage songs
// ─────────────────────────────────────────────
async function loadMySongs() {
	try {
		const res = await authFetch(`${API}/artist-dashboard/songs`);
		mySongsData = await res.json();
		renderMySongs(mySongsData);
	} catch (e) { console.error('loadMySongs:', e); }
}

function renderMySongs(songs) {
	const tbody = document.getElementById('mySongsBody');
	document.getElementById('manageCount').textContent = `${songs.length} bài hát`;

	if (!songs.length) {
		tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:40px;">Chưa có bài hát nào</td></tr>';
		return;
	}
	tbody.innerHTML = songs.map(s => `
    <tr>
      <td style="color:var(--text-dim);font-size:13px;">#${s.id}</td>
      <td>
        <div class="song-row-title">${s.title}</div>
        <div class="song-row-sub">${s.album_type || 'Single'}</div>
      </td>
      <td style="color:var(--text-dim);">${s.album_title || '—'}</td>
      <td style="color:var(--text-dim);font-size:13px;">${formatDur(s.duration)}</td>
      <td><span class="plays-badge">${(s.plays_count || 0).toLocaleString()}</span></td>
      <td>
        <div class="action-btns">
          <button class="btn-icon edit" onclick="openEditModal(${s.id})" title="Sửa">✏️</button>
          <button class="btn-icon delete" onclick="deleteMySong(${s.id}, '${s.title.replace(/'/g, "\\'")}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

function formatDur(sec) {
	const m = Math.floor(sec / 60), s = sec % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}

document.getElementById('manageSearch').addEventListener('input', function () {
	const q = this.value.toLowerCase();
	renderMySongs(mySongsData.filter(s =>
		s.title.toLowerCase().includes(q) || (s.album_title || '').toLowerCase().includes(q)
	));
});

async function deleteMySong(id, title) {
	if (!confirm(`Xóa bài hát "${title}"?\nHành động này không thể hoàn tác!`)) return;
	try {
		const res = await authFetch(`${API}/artist-dashboard/songs/${id}`, { method: 'DELETE' });
		const data = await res.json();
		if (!res.ok) throw new Error(data.error);
		showToast(`Đã xóa "${title}"`);
		loadMySongs();
		loadStats();
	} catch (err) { showToast(err.message, 'error'); }
}

// Edit modal
function openEditModal(id) {
	const song = mySongsData.find(s => s.id === id);
	if (!song) return;
	document.getElementById('editSongId').value = song.id;
	document.getElementById('editTitle').value = song.title;
	document.getElementById('editDuration').value = song.duration;
	document.getElementById('editTrack').value = song.track_number || 1;
	document.getElementById('editExplicit').value = song.is_explicit ? '1' : '0';
	document.getElementById('editLyrics').value = song.lyrics || '';
	document.getElementById('editModal').classList.add('open');
}
function closeEditModal() { document.getElementById('editModal').classList.remove('open'); }
document.getElementById('editModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeEditModal(); });

async function saveEditSong() {
	const id = parseInt(document.getElementById('editSongId').value);
	const body = {
		title: document.getElementById('editTitle').value.trim(),
		duration: parseInt(document.getElementById('editDuration').value),
		track_number: parseInt(document.getElementById('editTrack').value),
		is_explicit: document.getElementById('editExplicit').value === '1',
		lyrics: document.getElementById('editLyrics').value,
	};
	try {
		const res = await authFetch(`${API}/artist-dashboard/songs/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error);
		showToast('Đã lưu thay đổi!');
		closeEditModal();
		loadMySongs();
	} catch (err) { showToast(err.message, 'error'); }
}

// ─────────────────────────────────────────────
// Upload song
// ─────────────────────────────────────────────
document.getElementById('uploadForm').addEventListener('submit', async e => {
	e.preventDefault();
	const btn = document.getElementById('upSubmitBtn');
	const prog = document.getElementById('upProgress');
	const fill = document.getElementById('upProgressFill');
	const label = document.getElementById('upProgressLabel');
	const file = document.getElementById('upFile').files[0];

	if (!file) { showToast('Vui lòng chọn file MP3!', 'error'); return; }

	const formData = new FormData();
	formData.append('title', document.getElementById('upTitle').value.trim());
	formData.append('duration', document.getElementById('upDuration').value);
	formData.append('album_id', document.getElementById('upAlbum').value);
	formData.append('track_number', document.getElementById('upTrack').value);
	formData.append('is_explicit', document.getElementById('upExplicit').value);
	formData.append('lyrics', document.getElementById('upLyrics').value);
	formData.append('audio', file);

	btn.disabled = true;
	prog.classList.add('show');
	fill.style.width = '10%';
	label.textContent = 'Đang upload...';

	try {
		let pct = 10;
		const iv = setInterval(() => { pct = Math.min(pct + 5, 85); fill.style.width = pct + '%'; }, 300);
		const res = await authFetch(`${API}/artist-dashboard/songs`, { method: 'POST', body: formData });
		clearInterval(iv);
		fill.style.width = '100%';
		label.textContent = 'Hoàn thành!';
		const data = await res.json();
		if (!res.ok) throw new Error(data.error);
		showToast(data.auto_single
			? `Đã upload "${document.getElementById('upTitle').value}" · Tạo Single tự động ✨`
			: `Đã upload "${document.getElementById('upTitle').value}" thành công!`
		);
		resetUploadForm();
		loadMyAlbums();
		loadMySongs();
		loadStats();
	} catch (err) {
		showToast(err.message, 'error');
	} finally {
		btn.disabled = false;
		setTimeout(() => { prog.classList.remove('show'); fill.style.width = '0%'; }, 1500);
	}
});

function resetUploadForm() {
	document.getElementById('uploadForm').reset();
	document.getElementById('upFileName').textContent = '';
}

// ─────────────────────────────────────────────
// Create album
// ─────────────────────────────────────────────
document.getElementById('albumForm').addEventListener('submit', async e => {
	e.preventDefault();
	const btn = document.getElementById('alSubmitBtn');
	btn.disabled = true;
	const body = {
		title: document.getElementById('alTitle').value.trim(),
		type: document.getElementById('alType').value,
		release_date: document.getElementById('alDate').value || null,
		cover_url: document.getElementById('alCover').value.trim() || null,
	};
	try {
		const res = await authFetch(`${API}/artist-dashboard/albums`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error);
		showToast(`Đã tạo album "${body.title}"!`);
		resetAlbumForm();
		loadMyAlbums();
		loadStats();
	} catch (err) { showToast(err.message, 'error'); }
	finally { btn.disabled = false; }
});

function resetAlbumForm() { document.getElementById('albumForm').reset(); }

// ─────────────────────────────────────────────
// Profile
// ─────────────────────────────────────────────
document.getElementById('profileForm').addEventListener('submit', async e => {
	e.preventDefault();
	const btn = document.getElementById('pfSubmitBtn');
	btn.disabled = true;
	const body = {
		bio: document.getElementById('pfBio').value.trim(),
		avatar_url: document.getElementById('pfAvatar').value.trim() || null,
		country: document.getElementById('pfCountry').value.trim() || null,
	};
	try {
		const res = await authFetch(`${API}/artist-dashboard/me`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error);
		showToast('Đã lưu hồ sơ!');
		updateAvatarPreview(body.avatar_url);
	} catch (err) { showToast(err.message, 'error'); }
	finally { btn.disabled = false; }
});

function updateAvatarPreview(url) {
	const el = document.getElementById('profileAvatarPreview');
	if (!url) { el.innerHTML = '🎤'; return; }
	const img = new Image();
	img.onload = () => { el.innerHTML = `<img src="${url}" alt="">`; };
	img.onerror = () => { el.innerHTML = '🎤'; };
	img.src = url;
}

// ─────────────────────────────────────────────
// Drop zone + cover preview (reuse từ admin.js logic)
// ─────────────────────────────────────────────
function initDropZone(zoneId, inputId, nameId) {
	const zone = document.getElementById(zoneId);
	const input = document.getElementById(inputId);
	const name = document.getElementById(nameId);
	input.addEventListener('change', () => {
		if (input.files[0]) {
			name.textContent = '📎 ' + input.files[0].name;
			// Tự động điền duration từ file
			const audio = new Audio(URL.createObjectURL(input.files[0]));
			audio.addEventListener('loadedmetadata', () => {
				const dur = document.getElementById('upDuration');
				if (!dur.value) dur.value = Math.round(audio.duration);
			});
		}
	});
	zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
	zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
	zone.addEventListener('drop', e => {
		e.preventDefault(); zone.classList.remove('drag-over');
		const file = e.dataTransfer.files[0];
		if (file) {
			const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
			name.textContent = '📎 ' + file.name;
		}
	});
}

let coverPreviewTimer = null;
function updateAlbumCoverPreview(url) {
	const wrap = document.getElementById('albumCoverPreviewWrap');
	const box = document.getElementById('albumCoverPreviewBox');
	const statusEl = document.getElementById('albumCoverPreviewStatus');
	const dimEl = document.getElementById('albumCoverPreviewDim');
	if (!url.trim()) { wrap.style.display = 'none'; box.innerHTML = '💿'; return; }
	wrap.style.display = 'block';
	statusEl.innerHTML = '<span style="color:var(--text-dim)">⏳ Đang tải...</span>';
	clearTimeout(coverPreviewTimer);
	coverPreviewTimer = setTimeout(() => {
		const img = new Image();
		img.onload = () => {
			box.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`;
			statusEl.innerHTML = '<span style="color:var(--accent)">✅ Hợp lệ</span>';
			dimEl.textContent = `${img.naturalWidth} × ${img.naturalHeight}px`;
		};
		img.onerror = () => {
			box.innerHTML = '❌';
			statusEl.innerHTML = '<span style="color:var(--danger)">❌ Không tải được ảnh</span>';
			dimEl.textContent = '';
		};
		img.src = url;
	}, 600);
}

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────
checkAuth();