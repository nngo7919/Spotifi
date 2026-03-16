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

// ─────────────────────────────────────────────
// MANAGE SONGS
// ─────────────────────────────────────────────
let allSongsData = [];
let editArtistAC = null;

async function loadManageSongs() {
	try {
		const res = await authFetch(`${API}/admin/manage/songs`);
		allSongsData = await res.json();
		renderSongsTable(allSongsData);
	} catch (e) { console.error('loadManageSongs:', e); }
}

function renderSongsTable(songs) {
	const tbody = document.getElementById('songsTableBody');
	const count = document.getElementById('manageCount');
	count.textContent = `${songs.length} bài hát`;

	if (!songs.length) {
		tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:40px;">Chưa có bài hát nào</td></tr>';
		return;
	}

	tbody.innerHTML = songs.map(s => `
    <tr>
      <td style="color:var(--text-dim);font-size:13px;">#${s.id}</td>
      <td>
        <div class="song-row-title">${s.title}</div>
        <div class="song-row-sub">${s.album_title || 'No album'} · ${s.album_type || ''}</div>
      </td>
      <td style="color:var(--text-dim);">${s.artist_name}</td>
      <td style="color:var(--text-dim);font-size:13px;">${s.album_title || '—'}</td>
      <td style="color:var(--text-dim);font-size:13px;">${formatDuration(s.duration)}</td>
      <td><span class="plays-badge">${(s.plays_count || 0).toLocaleString()}</span></td>
      <td>
        <div class="action-btns">
          <button class="btn-icon edit" title="Sửa" onclick="openEditModal(${s.id})">✏️</button>
          <button class="btn-icon delete" title="Xóa" onclick="deleteSong(${s.id}, '${s.title.replace(/'/g, "\\'")}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

function formatDuration(sec) {
	const m = Math.floor(sec / 60);
	const s = sec % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}

// Search filter
document.getElementById('manageSearch').addEventListener('input', function () {
	const q = this.value.toLowerCase();
	const filtered = allSongsData.filter(s =>
		s.title.toLowerCase().includes(q) ||
		s.artist_name.toLowerCase().includes(q) ||
		(s.album_title || '').toLowerCase().includes(q)
	);
	renderSongsTable(filtered);
});

// Delete
async function deleteSong(id, title) {
	if (!confirm(`Xóa bài hát "${title}"?\n\nHành động này không thể hoàn tác!`)) return;
	try {
		const res = await authFetch(`${API}/admin/manage/songs/${id}`, { method: 'DELETE' });
		const data = await res.json();
		if (!res.ok) throw new Error(data.error);
		showToast(`Đã xóa "${title}"`);
		loadManageSongs();
		loadRecentSongs();
	} catch (err) {
		showToast(err.message, 'error');
	}
}

// Edit modal
function openEditModal(id) {
	const song = allSongsData.find(s => s.id === id);
	if (!song) return;

	document.getElementById('editSongId').value = song.id;
	document.getElementById('editTitle').value = song.title;
	document.getElementById('editDuration').value = song.duration;
	document.getElementById('editTrack').value = song.track_number || 1;
	document.getElementById('editExplicit').value = song.is_explicit ? '1' : '0';
	document.getElementById('editLyrics').value = song.lyrics || '';

	// Init artist autocomplete cho modal nếu chưa có
	if (!editArtistAC) {
		editArtistAC = initArtistAutocomplete('editArtistInput', 'editArtistId', 'editArtistDropdown', 'editArtistHint');
	}
	// Set giá trị hiện tại
	document.getElementById('editArtistInput').value = song.artist_name;
	document.getElementById('editArtistId').value = song.artist_id;
	document.getElementById('editArtistHint').innerHTML =
		`<span style="color:rgba(255,255,255,0.5)">✅ Nghệ sĩ hiện có · ID #${song.artist_id}</span>`;

	document.getElementById('editModal').classList.add('open');
}

function closeEditModal() {
	document.getElementById('editModal').classList.remove('open');
}

// Đóng modal khi click overlay
document.getElementById('editModal').addEventListener('click', function (e) {
	if (e.target === this) closeEditModal();
});

async function saveEditSong() {
	const id = parseInt(document.getElementById('editSongId').value);

	// Resolve artist
	let artistId;
	try {
		if (editArtistAC?.getSelected()) {
			artistId = await resolveArtistId(editArtistAC);
		} else {
			artistId = parseInt(document.getElementById('editArtistId').value);
		}
	} catch (err) {
		showToast(err.message, 'error');
		return;
	}

	const body = {
		title: document.getElementById('editTitle').value.trim(),
		duration: parseInt(document.getElementById('editDuration').value),
		artist_id: artistId,
		track_number: parseInt(document.getElementById('editTrack').value),
		is_explicit: document.getElementById('editExplicit').value === '1',
		lyrics: document.getElementById('editLyrics').value,
	};

	try {
		const res = await authFetch(`${API}/admin/manage/songs/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error);
		showToast('Đã lưu thay đổi!');
		closeEditModal();
		loadManageSongs();
	} catch (err) {
		showToast(err.message, 'error');
	}
}

// ─────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────
async function loadAnalytics() {
	try {
		const res = await authFetch(`${API}/admin/analytics`);
		const data = await res.json();
		if (!res.ok) throw new Error(data.error);

		document.getElementById('statSongs').textContent = data.total_songs.toLocaleString();
		document.getElementById('statPlays').textContent = formatPlays(data.total_plays);
		document.getElementById('statAlbums').textContent = data.total_albums.toLocaleString();
		document.getElementById('statArtists').textContent = data.total_artists.toLocaleString();

		const maxPlays = data.top10[0]?.plays_count || 1;
		document.getElementById('top10Body').innerHTML = data.top10.map((s, i) => `
      <tr>
        <td><span class="rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span></td>
        <td>
          <div style="font-weight:700;">${s.title}</div>
          <div style="font-size:12px;color:var(--text-dim);">${s.album_title || 'Single'}</div>
        </td>
        <td style="color:var(--text-dim);">${s.artist_name}</td>
        <td style="min-width:180px;">
          <div class="plays-bar-wrap">
            <div class="plays-bar-track">
              <div class="plays-bar-fill" style="width:${Math.round((s.plays_count / maxPlays) * 100)}%"></div>
            </div>
            <span class="plays-num">${(s.plays_count || 0).toLocaleString()}</span>
          </div>
        </td>
      </tr>`).join('');
	} catch (err) {
		console.error('loadAnalytics:', err);
	}
}

function formatPlays(n) {
	if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
	if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
	return (n || 0).toString();
}

// Override switchPage để load data khi vào trang
const _switchPage = switchPage;
window.switchPage = function (name) {
	_switchPage(name);
	if (name === 'manage') loadManageSongs();
	if (name === 'analytics') loadAnalytics();
};

// ─────────────────────────────────────────────
// PREVIEW MODAL
// ─────────────────────────────────────────────
let previewAudio = null;

function openPreviewModal() {
	const file = document.getElementById('songFile').files[0];
	const title = document.getElementById('songTitle').value.trim();
	const artistSel = songArtistAC?.getSelected();
	const albumSel = songAlbumAC?.getSelected();
	const lyrics = document.getElementById('songLyrics').value.trim();
	const duration = document.getElementById('songDuration').value;

	// ── Kiểm tra sơ bộ ──
	const checks = [];

	// Title
	if (title) checks.push({ ok: true, label: '✅ Có tên bài hát' });
	else checks.push({ ok: false, label: '❌ Chưa nhập tên' });

	// Artist
	if (artistSel) checks.push({ ok: true, label: `✅ Nghệ sĩ: ${artistSel.name}` });
	else checks.push({ ok: false, label: '❌ Chưa chọn nghệ sĩ' });

	// File
	if (file) checks.push({ ok: true, label: `✅ ${file.name}` });
	else checks.push({ ok: false, label: '❌ Chưa chọn file MP3' });

	// Album
	if (albumSel) checks.push({ ok: true, label: `✅ Album: ${albumSel.name}` });
	else checks.push({ ok: 'warn', label: '⚠️ Sẽ tạo Single tự động' });

	// ── Fill info ──
	document.getElementById('previewTitle').textContent = title || '(Chưa nhập tên)';
	document.getElementById('previewArtist').textContent = artistSel?.name || '(Chưa chọn nghệ sĩ)';
	document.getElementById('previewMeta').textContent =
		(albumSel?.name || 'Single') + (duration ? ` · ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : '');

	// ── Cover từ album đã chọn hoặc URL ──
	const coverEl = document.getElementById('previewCover');
	const coverErrEl = document.getElementById('previewCoverError');
	coverEl.innerHTML = '💿';
	coverErrEl.innerHTML = '';

	// Tìm cover từ album đã chọn trong allAlbums
	const albumData = albumSel ? allAlbums.find(a => String(a.id) === String(albumSel.id)) : null;
	const coverUrl = albumData?.cover_url || null;

	if (coverUrl) {
		const img = document.createElement('img');
		img.src = coverUrl;
		img.onerror = () => {
			coverEl.innerHTML = '💿';
			coverErrEl.innerHTML = '<div class="preview-cover-error">⚠️ Không load được ảnh bìa</div>';
			checks.push({ ok: 'warn', label: '⚠️ Ảnh bìa lỗi' });
			renderChecklist(checks);
		};
		img.onload = () => {
			coverEl.innerHTML = '';
			coverEl.appendChild(img);
		};
	} else {
		coverErrEl.innerHTML = '<div style="font-size:11px;color:var(--text-dim);margin-top:6px;text-align:center;">Không có ảnh bìa</div>';
	}

	// ── Checklist ──
	renderChecklist(checks);

	// ── Audio player ──
	setupPreviewAudio(file);

	// ── Lyrics ──
	renderPreviewLyrics(lyrics);

	document.getElementById('previewModal').classList.add('open');
}

function renderChecklist(checks) {
	document.getElementById('previewChecklist').innerHTML = checks.map(c =>
		`<span class="check-item ${c.ok === true ? 'ok' : c.ok === 'warn' ? 'warn' : 'bad'}">${c.label}</span>`
	).join('');
}

function closePreviewModal() {
	document.getElementById('previewModal').classList.remove('open');
	if (previewAudio) {
		previewAudio.pause();
		previewAudio.src = '';
	}
}

document.getElementById('previewModal').addEventListener('click', function (e) {
	if (e.target === this) closePreviewModal();
});

// ── Audio ──
function setupPreviewAudio(file) {
	const statusEl = document.getElementById('previewAudioStatus');
	const playBtn = document.getElementById('previewPlayBtn');
	const fillEl = document.getElementById('previewProgressFill');
	const curEl = document.getElementById('previewTimeCurrent');
	const durEl = document.getElementById('previewTimeDuration');

	// Reset
	playBtn.textContent = '▶';
	fillEl.style.width = '0%';
	curEl.textContent = '0:00';
	durEl.textContent = '0:00';
	statusEl.className = 'preview-status';
	statusEl.textContent = '';

	if (!file) {
		statusEl.className = 'preview-status error';
		statusEl.textContent = '❌ Chưa chọn file MP3';
		return;
	}

	if (previewAudio) { previewAudio.pause(); previewAudio.src = ''; }
	previewAudio = new Audio();
	previewAudio.src = URL.createObjectURL(file);

	previewAudio.addEventListener('loadedmetadata', () => {
		durEl.textContent = formatSec(previewAudio.duration);
		statusEl.className = 'preview-status ok';
		statusEl.textContent = `✅ File hợp lệ · ${(file.size / 1024 / 1024).toFixed(2)} MB · ${formatSec(previewAudio.duration)}`;

		// Cập nhật duration vào form nếu chưa nhập
		const durInput = document.getElementById('songDuration');
		if (!durInput.value) durInput.value = Math.round(previewAudio.duration);
	});

	previewAudio.addEventListener('error', () => {
		statusEl.className = 'preview-status error';
		statusEl.textContent = '❌ File MP3 bị lỗi hoặc không đọc được';
		playBtn.textContent = '✕';
	});

	previewAudio.addEventListener('timeupdate', () => {
		if (!previewAudio.duration) return;
		const pct = (previewAudio.currentTime / previewAudio.duration) * 100;
		fillEl.style.width = pct + '%';
		curEl.textContent = formatSec(previewAudio.currentTime);
	});

	previewAudio.addEventListener('ended', () => {
		playBtn.textContent = '▶';
		fillEl.style.width = '0%';
		curEl.textContent = '0:00';
	});
}

function togglePreviewPlay() {
	if (!previewAudio) return;
	const btn = document.getElementById('previewPlayBtn');
	if (previewAudio.paused) {
		previewAudio.play();
		btn.textContent = '⏸';
	} else {
		previewAudio.pause();
		btn.textContent = '▶';
	}
}

function seekPreview(e) {
	if (!previewAudio || !previewAudio.duration) return;
	const rect = e.currentTarget.getBoundingClientRect();
	const pct = (e.clientX - rect.left) / rect.width;
	previewAudio.currentTime = pct * previewAudio.duration;
}

function formatSec(s) {
	if (!s || isNaN(s)) return '0:00';
	const m = Math.floor(s / 60);
	const sec = Math.floor(s % 60);
	return `${m}:${String(sec).padStart(2, '0')}`;
}

// ── Lyrics ──
function renderPreviewLyrics(raw) {
	const el = document.getElementById('previewLyrics');
	const typeEl = document.getElementById('previewLyricsType');

	if (!raw) {
		el.innerHTML = '<div class="lyrics-empty">Không có lời bài hát</div>';
		typeEl.textContent = '';
		return;
	}

	// Kiểm tra có phải LRC không
	const lrcLines = raw.match(/\[\d{2}:\d{2}[.:]\d{2}\].+/g);
	if (lrcLines && lrcLines.length > 0) {
		typeEl.innerHTML = '<span style="color:var(--accent)">LRC · ' + lrcLines.length + ' dòng</span>';
		el.innerHTML = lrcLines.map(line => {
			const match = line.match(/\[(\d{2}:\d{2}[.:]\d{2})\](.*)/);
			if (!match) return '';
			return `<div class="lyrics-line">
        <span class="lyrics-timestamp">${match[1]}</span>
        <span class="lyrics-text">${match[2].trim()}</span>
      </div>`;
		}).join('');
	} else {
		// Plain text
		const lines = raw.split('\n').filter(l => l.trim());
		typeEl.innerHTML = '<span style="color:var(--text-dim)">Plain text · ' + lines.length + ' dòng</span>';
		el.innerHTML = lines.map(l =>
			`<div class="lyrics-line"><span class="lyrics-text">${l}</span></div>`
		).join('');
	}
}

// ─────────────────────────────────────────────
// ALBUM COVER PREVIEW (inline)
// ─────────────────────────────────────────────
let coverPreviewTimer = null;

function updateAlbumCoverPreview(url) {
	const wrap = document.getElementById('albumCoverPreviewWrap');
	const box = document.getElementById('albumCoverPreviewBox');
	const statusEl = document.getElementById('albumCoverPreviewStatus');
	const dimEl = document.getElementById('albumCoverPreviewDim');

	if (!url.trim()) {
		wrap.style.display = 'none';
		box.innerHTML = '💿';
		return;
	}

	wrap.style.display = 'block';
	statusEl.innerHTML = '<span style="color:var(--text-dim)">⏳ Đang tải...</span>';
	dimEl.textContent = '';

	// Debounce 600ms khi đang gõ
	clearTimeout(coverPreviewTimer);
	coverPreviewTimer = setTimeout(() => {
		const img = new Image();
		img.onload = () => {
			box.innerHTML = '';
			const imgEl = document.createElement('img');
			imgEl.src = url;
			imgEl.style.cssText = 'width:100%;height:100%;object-fit:cover;';
			box.appendChild(imgEl);
			statusEl.innerHTML = '<span style="color:var(--accent)">✅ Ảnh bìa hợp lệ</span>';
			dimEl.textContent = `${img.naturalWidth} × ${img.naturalHeight}px`;
		};
		img.onerror = () => {
			box.innerHTML = '❌';
			statusEl.innerHTML = '<span style="color:var(--danger)">❌ Không tải được ảnh — kiểm tra lại URL</span>';
			dimEl.textContent = '';
		};
		img.src = url;
	}, 600);
}