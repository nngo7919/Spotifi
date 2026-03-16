const API = 'http://localhost:3000/api';
let adminToken = sessionStorage.getItem('adminToken') || '';

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────
async function checkAuth() {
	if (!adminToken) return;
	try {
		const res = await fetch(`${API}/albums`);
		if (res.ok) {
			document.getElementById('loginGate').style.display = 'none';
			initAdmin();
		} else {
			adminToken = '';
			sessionStorage.removeItem('adminToken');
		}
	} catch { }
}

async function adminLogin() {
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

		if (!res.ok) {
			errEl.textContent = data.error || 'Đăng nhập thất bại';
			errEl.style.display = 'block';
			return;
		}
		if (data.user.role !== 'admin') {
			errEl.textContent = 'Tài khoản này không có quyền admin';
			errEl.style.display = 'block';
			return;
		}

		adminToken = data.token;
		sessionStorage.setItem('adminToken', adminToken);
		document.getElementById('loginGate').style.display = 'none';
		initAdmin();

	} catch {
		errEl.textContent = 'Không thể kết nối server';
		errEl.style.display = 'block';
	}
}

document.getElementById('loginPassword').addEventListener('keydown', e => {
	if (e.key === 'Enter') adminLogin();
});

function authFetch(url, options = {}) {
	return fetch(url, {
		...options,
		headers: { ...(options.headers || {}), 'Authorization': `Bearer ${adminToken}` },
	});
}

// ─────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────
function switchPage(name) {
	document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
	document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
	document.getElementById('page-' + name).classList.add('active');
	document.getElementById('nav-' + name).classList.add('active');
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
// Data loaders
// ─────────────────────────────────────────────
let allArtists = [];
let allAlbums = [];

async function loadArtists() {
	try {
		const res = await fetch(`${API}/artists`);
		allArtists = await res.json();
	} catch (e) { console.error('loadArtists:', e); }
}

async function loadAlbums() {
	try {
		const res = await fetch(`${API}/albums`);
		allAlbums = await res.json();
	} catch (e) { console.error('loadAlbums:', e); }
}

async function loadRecentSongs() {
	try {
		const res = await fetch(`${API}/songs`);
		const songs = await res.json();
		const el = document.getElementById('recentSongs');
		if (!songs.length) { el.innerHTML = ''; return; }
		el.innerHTML = `<h2>Bài hát hiện có (${songs.length})</h2>` +
			songs.slice(0, 10).map(s => `
        <div class="upload-item">
          <div class="upload-item-icon">🎵</div>
          <div class="upload-item-info">
            <div class="upload-item-title">${s.title}</div>
            <div class="upload-item-sub">${s.artist_name} · ${s.album_title || 'No album'} · ${s.duration}s</div>
          </div>
          <div class="upload-item-badge">#${s.id}</div>
        </div>`).join('');
	} catch (e) { }
}

async function loadRecentAlbums() {
	try {
		const res = await fetch(`${API}/albums`);
		const albums = await res.json();
		const el = document.getElementById('recentAlbums');
		if (!albums.length) { el.innerHTML = ''; return; }
		el.innerHTML = `<h2>Album hiện có (${albums.length})</h2>` +
			albums.map(a => `
        <div class="upload-item">
          <div class="upload-item-icon">💿</div>
          <div class="upload-item-info">
            <div class="upload-item-title">${a.title}</div>
            <div class="upload-item-sub">${a.artist_name} · ${a.release_date ? a.release_date.substring(0, 10) : 'Chưa có ngày'}</div>
          </div>
          <div class="upload-item-badge">${a.type || 'album'}</div>
        </div>`).join('');
	} catch (e) { }
}

// ─────────────────────────────────────────────
// Drop zone
// ─────────────────────────────────────────────
function initDropZone(zoneId, inputId, nameId) {
	const zone = document.getElementById(zoneId);
	const input = document.getElementById(inputId);
	const name = document.getElementById(nameId);

	input.addEventListener('change', () => {
		if (input.files[0]) name.textContent = '📎 ' + input.files[0].name;
	});
	zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
	zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
	zone.addEventListener('drop', e => {
		e.preventDefault();
		zone.classList.remove('drag-over');
		const file = e.dataTransfer.files[0];
		if (file) {
			const dt = new DataTransfer();
			dt.items.add(file);
			input.files = dt.files;
			name.textContent = '📎 ' + file.name;
		}
	});
}

// ─────────────────────────────────────────────
// Artist autocomplete
// ─────────────────────────────────────────────
function initArtistAutocomplete(inputId, hiddenId, dropdownId, hintId) {
	const input = document.getElementById(inputId);
	const hidden = document.getElementById(hiddenId);
	const dropdown = document.getElementById(dropdownId);
	const hint = document.getElementById(hintId);
	let selected = null;

	function renderDropdown(query) {
		const q = query.trim().toLowerCase();
		if (!q) { dropdown.classList.remove('open'); return; }

		const matched = allArtists.filter(a => a.name.toLowerCase().includes(q));
		const exactMatch = allArtists.find(a => a.name.toLowerCase() === q);

		let html = matched.slice(0, 6).map(a => `
      <div class="artist-option" data-id="${a.id}" data-name="${a.name}">
        <div class="artist-option-avatar">
          ${a.avatar_url ? `<img src="${a.avatar_url}">` : '🎤'}
        </div>
        <div>
          <div class="artist-option-name">${a.name}</div>
          <div class="artist-option-sub">ID #${a.id}</div>
        </div>
      </div>`).join('');

		if (!exactMatch && query.trim()) {
			html += `
        <div class="artist-option new-artist" data-id="NEW" data-name="${query.trim()}">
          <div class="artist-option-avatar">➕</div>
          <div>
            <div class="artist-option-name">Tạo mới: "${query.trim()}"</div>
            <div class="artist-option-sub">Thêm nghệ sĩ vào database</div>
          </div>
        </div>`;
		}

		dropdown.innerHTML = html;
		dropdown.classList.toggle('open', html !== '');

		dropdown.querySelectorAll('.artist-option').forEach(opt => {
			opt.addEventListener('click', () => selectArtist(opt.dataset.id, opt.dataset.name));
		});
	}

	function selectArtist(id, name) {
		selected = { id, name, isNew: id === 'NEW' };
		input.value = name;
		hidden.value = id === 'NEW' ? '' : id;
		dropdown.classList.remove('open');
		hint.innerHTML = id === 'NEW'
			? `<span style="color:var(--accent)">✨ Sẽ tạo nghệ sĩ mới "<strong>${name}</strong>" khi upload</span>`
			: `<span style="color:rgba(255,255,255,0.5)">✅ Nghệ sĩ hiện có · ID #${id}</span>`;
	}

	input.addEventListener('input', () => { selected = null; hidden.value = ''; hint.innerHTML = ''; renderDropdown(input.value); });
	input.addEventListener('focus', () => { if (input.value) renderDropdown(input.value); });
	document.addEventListener('click', e => {
		if (!input.closest('.artist-input-wrap').contains(e.target))
			dropdown.classList.remove('open');
	});

	return {
		getSelected: () => selected,
		clear: () => { input.value = ''; hidden.value = ''; hint.innerHTML = ''; selected = null; dropdown.classList.remove('open'); },
	};
}

// ─────────────────────────────────────────────
// Album autocomplete
// ─────────────────────────────────────────────
function initAlbumAutocomplete() {
	const input = document.getElementById('songAlbumInput');
	const hidden = document.getElementById('songAlbumId');
	const dropdown = document.getElementById('songAlbumDropdown');
	const hint = document.getElementById('songAlbumHint');
	let selected = null;

	function renderDropdown(query) {
		const q = query.trim().toLowerCase();
		const artistId = songArtistAC?.getSelected()?.id;

		// Lọc theo artist nếu đã chọn
		let pool = allAlbums;
		if (artistId && artistId !== 'NEW') {
			pool = allAlbums.filter(a => String(a.artist_id) === String(artistId));
		}

		const matched = q ? pool.filter(a => a.title.toLowerCase().includes(q)) : pool;

		if (!matched.length && !q) { dropdown.classList.remove('open'); return; }

		const html = matched.slice(0, 8).map(a => {
			const year = a.release_date ? a.release_date.substring(0, 4) : '';
			const type = a.type === 'single' ? 'Single' : a.type === 'ep' ? 'EP' : 'Album';
			return `
        <div class="artist-option" data-id="${a.id}" data-name="${a.title}">
          <div class="artist-option-avatar">
            ${a.cover_url ? `<img src="${a.cover_url}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">` : '💿'}
          </div>
          <div>
            <div class="artist-option-name">${a.title}</div>
            <div class="artist-option-sub">${type}${year ? ' · ' + year : ''} · ${a.artist_name}</div>
          </div>
        </div>`;
		}).join('') || '<div class="artist-option" style="color:rgba(255,255,255,0.3);cursor:default;">Không tìm thấy album</div>';

		dropdown.innerHTML = html;
		dropdown.classList.add('open');

		dropdown.querySelectorAll('.artist-option[data-id]').forEach(opt => {
			opt.addEventListener('click', () => {
				selected = { id: opt.dataset.id, name: opt.dataset.name };
				input.value = opt.dataset.name;
				hidden.value = opt.dataset.id;
				hint.innerHTML = `<span style="color:rgba(255,255,255,0.5)">✅ Album ID #${opt.dataset.id}</span>`;
				dropdown.classList.remove('open');
			});
		});
	}

	input.addEventListener('input', () => { selected = null; hidden.value = ''; renderDropdown(input.value); });
	input.addEventListener('focus', () => {
		renderDropdown(input.value);
		const sel = songArtistAC?.getSelected();
		if (sel && !sel.isNew) {
			hint.innerHTML = `<span style="color:rgba(255,255,255,0.4)">Lọc theo: <strong style="color:#fff">${sel.name}</strong></span>`;
		}
	});
	document.addEventListener('click', e => {
		if (!input.closest('.artist-input-wrap').contains(e.target))
			dropdown.classList.remove('open');
	});

	return {
		getSelected: () => selected,
		clear: () => { input.value = ''; hidden.value = ''; hint.innerHTML = 'Chọn nghệ sĩ trước để lọc album của họ'; selected = null; dropdown.classList.remove('open'); },
	};
}

// ─────────────────────────────────────────────
// Resolve artist (tạo mới nếu cần)
// ─────────────────────────────────────────────
async function resolveArtistId(ac) {
	const sel = ac.getSelected();
	if (!sel) return null;
	if (!sel.isNew) return parseInt(sel.id);

	const res = await authFetch(`${API}/admin/artists`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: sel.name }),
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data.error || 'Không thể tạo nghệ sĩ');

	allArtists.push({ id: data.id, name: sel.name });
	return data.id;
}

// ─────────────────────────────────────────────
// Upload song
// ─────────────────────────────────────────────
document.getElementById('songForm').addEventListener('submit', async e => {
	e.preventDefault();
	const btn = document.getElementById('songSubmitBtn');
	const progress = document.getElementById('songProgress');
	const fill = document.getElementById('songProgressFill');
	const label = document.getElementById('songProgressLabel');

	const file = document.getElementById('songFile').files[0];
	if (!file) { showToast('Vui lòng chọn file MP3!', 'error'); return; }

	let artistId;
	try {
		artistId = await resolveArtistId(songArtistAC);
	} catch (err) {
		showToast(err.message, 'error');
		return;
	}
	if (!artistId) { showToast('Vui lòng chọn hoặc nhập tên nghệ sĩ!', 'error'); return; }

	const formData = new FormData();
	formData.append('title', document.getElementById('songTitle').value.trim());
	formData.append('duration', document.getElementById('songDuration').value);
	formData.append('artist_id', artistId);
	formData.append('album_id', songAlbumAC?.getSelected()?.id || '');
	formData.append('track_number', document.getElementById('songTrack').value);
	formData.append('is_explicit', document.getElementById('songExplicit').value);
	formData.append('lyrics', document.getElementById('songLyrics').value);
	formData.append('audio', file);

	btn.disabled = true;
	progress.classList.add('show');
	fill.style.width = '10%';
	label.textContent = 'Đang upload file MP3...';

	try {
		let pct = 10;
		const interval = setInterval(() => {
			pct = Math.min(pct + 5, 85);
			fill.style.width = pct + '%';
		}, 300);

		const res = await authFetch(`${API}/admin/songs`, { method: 'POST', body: formData });
		clearInterval(interval);
		fill.style.width = '100%';
		label.textContent = 'Hoàn thành!';

		const data = await res.json();
		if (!res.ok) throw new Error(data.error || 'Upload thất bại');

		const title = document.getElementById('songTitle').value;
		showToast(data.auto_single
			? `Đã upload "${title}" · Tự động tạo Single cùng tên ✨`
			: `Đã upload "${title}" thành công!`
		);
		resetSongForm();
		loadRecentSongs();
		await loadAlbums();
	} catch (err) {
		showToast(err.message, 'error');
	} finally {
		btn.disabled = false;
		setTimeout(() => { progress.classList.remove('show'); fill.style.width = '0%'; }, 1500);
	}
});

// ─────────────────────────────────────────────
// Create album
// ─────────────────────────────────────────────
document.getElementById('albumForm').addEventListener('submit', async e => {
	e.preventDefault();
	const btn = document.getElementById('albumSubmitBtn');
	btn.disabled = true;

	let artistId;
	try {
		artistId = await resolveArtistId(albumArtistAC);
	} catch (err) {
		showToast(err.message, 'error');
		btn.disabled = false;
		return;
	}
	if (!artistId) { showToast('Vui lòng chọn hoặc nhập tên nghệ sĩ!', 'error'); btn.disabled = false; return; }

	const body = {
		title: document.getElementById('albumTitle').value.trim(),
		artist_id: artistId,
		type: document.getElementById('albumType').value,
		release_date: document.getElementById('albumDate').value || null,
		cover_url: document.getElementById('albumCover').value.trim() || null,
	};

	try {
		const res = await authFetch(`${API}/admin/albums`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error || 'Tạo album thất bại');

		showToast(`Đã tạo album "${body.title}" thành công! (ID: ${data.id})`);
		resetAlbumForm();
		await loadAlbums();
		loadRecentAlbums();
	} catch (err) {
		showToast(err.message, 'error');
	} finally {
		btn.disabled = false;
	}
});

// ─────────────────────────────────────────────
// Reset forms
// ─────────────────────────────────────────────
function resetSongForm() {
	document.getElementById('songForm').reset();
	document.getElementById('mp3Name').textContent = '';
	if (songArtistAC) songArtistAC.clear();
	if (songAlbumAC) songAlbumAC.clear();
}
function resetAlbumForm() {
	document.getElementById('albumForm').reset();
	if (albumArtistAC) albumArtistAC.clear();
}

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
let songArtistAC, albumArtistAC, songAlbumAC;

function initAdmin() {
	initDropZone('mp3Zone', 'songFile', 'mp3Name');
	loadArtists();
	loadAlbums();
	loadRecentSongs();
	loadRecentAlbums();

	songArtistAC = initArtistAutocomplete('songArtistInput', 'songArtistId', 'songArtistDropdown', 'songArtistHint');
	albumArtistAC = initArtistAutocomplete('albumArtistInput', 'albumArtistId', 'albumArtistDropdown', 'albumArtistHint');
	songAlbumAC = initAlbumAutocomplete();

	document.getElementById('songArtistInput').addEventListener('input', () => {
		songAlbumAC.clear();
		document.getElementById('songAlbumHint').textContent = 'Đang lọc album theo nghệ sĩ...';
	});
}

checkAuth();