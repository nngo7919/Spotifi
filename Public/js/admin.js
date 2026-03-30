// =============================================
//  SoundWave Admin - admin.js (rewrite clean)
// =============================================

const API = 'http://localhost:3000/api';
let adminToken = sessionStorage.getItem('adminToken') || '';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function authFetch(url, opts = {}) {
	return fetch(url, {
		...opts,
		headers: { ...(opts.headers || {}), 'Authorization': `Bearer ${adminToken}` },
	});
}

function showToast(msg, type = 'success') {
	const t = document.getElementById('toast');
	t.textContent = (type === 'success' ? '✅ ' : '❌ ') + msg;
	t.className = 'show ' + type;
	clearTimeout(t._timer);
	t._timer = setTimeout(() => { t.className = ''; }, 3500);
}

function formatDur(sec) {
	return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
function formatPlays(n) {
	if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
	if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
	return (n || 0).toString();
}
function fmtSec(s) {
	if (!s || isNaN(s)) return '0:00';
	return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────
async function checkAuth() {
	if (!adminToken) return;
	try {
		const res = await authFetch(`${API}/artists`);
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
		if (!res.ok) { errEl.textContent = data.error || 'Đăng nhập thất bại'; errEl.style.display = 'block'; return; }
		if (data.user.role !== 'admin') { errEl.textContent = 'Tài khoản không có quyền admin'; errEl.style.display = 'block'; return; }

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

// ─────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────
function switchPage(name) {
	document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
	document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
	document.getElementById('page-' + name).classList.add('active');
	document.getElementById('nav-' + name).classList.add('active');
	if (name === 'manage') loadManageSongs();
	if (name === 'analytics') loadAnalytics();
	if (name === 'requests') loadRequests();
}

// ─────────────────────────────────────────────
// Data cache
// ─────────────────────────────────────────────
let allArtists = [];
let allAlbums = [];

async function loadArtists() {
	try { const res = await fetch(`${API}/artists`); allArtists = await res.json(); } catch { }
}
async function loadAlbums() {
	try { const res = await fetch(`${API}/albums`); allAlbums = await res.json(); } catch { }
}

async function loadRecentSongs() {
	try {
		const res = await fetch(`${API}/songs`);
		const songs = await res.json();
		const el = document.getElementById('recentSongs');
		if (!songs.length) { el.innerHTML = ''; return; }
		el.innerHTML = `<h2 style="font-size:16px;font-weight:700;margin-bottom:16px;">Bài hát hiện có (${songs.length})</h2>` +
			songs.slice(0, 10).map(s => `
        <div class="upload-item">
          <div class="upload-item-icon">🎵</div>
          <div class="upload-item-info">
            <div class="upload-item-title">${s.title}</div>
            <div class="upload-item-sub">${s.artist_name} · ${s.album_title || 'No album'} · ${s.duration}s</div>
          </div>
          <div class="upload-item-badge">#${s.id}</div>
        </div>`).join('');
	} catch { }
}

async function loadRecentAlbums() {
	try {
		const res = await fetch(`${API}/albums`);
		const albums = await res.json();
		const el = document.getElementById('recentAlbums');
		if (!albums.length) { el.innerHTML = ''; return; }
		el.innerHTML = `<h2 style="font-size:16px;font-weight:700;margin-bottom:16px;">Album hiện có (${albums.length})</h2>` +
			albums.map(a => `
        <div class="upload-item">
          <div class="upload-item-icon">💿</div>
          <div class="upload-item-info">
            <div class="upload-item-title">${a.title}</div>
            <div class="upload-item-sub">${a.artist_name} · ${a.release_date ? a.release_date.substring(0, 10) : 'Chưa có ngày'}</div>
          </div>
          <div class="upload-item-badge">${a.type || 'album'}</div>
        </div>`).join('');
	} catch { }
}

// ─────────────────────────────────────────────
// Drop zone
// ─────────────────────────────────────────────
function initDropZone(zoneId, inputId, nameId) {
	const zone = document.getElementById(zoneId);
	const input = document.getElementById(inputId);
	const nameEl = document.getElementById(nameId);

	input.addEventListener('change', () => {
		if (!input.files[0]) return;
		nameEl.textContent = '📎 ' + input.files[0].name;
		const audio = new Audio(URL.createObjectURL(input.files[0]));
		audio.addEventListener('loadedmetadata', () => {
			const dur = document.getElementById('songDuration');
			if (!dur.value) dur.value = Math.round(audio.duration);
		});
	});
	zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
	zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
	zone.addEventListener('drop', e => {
		e.preventDefault(); zone.classList.remove('drag-over');
		const file = e.dataTransfer.files[0];
		if (!file) return;
		const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
		nameEl.textContent = '📎 ' + file.name;
		input.dispatchEvent(new Event('change'));
	});
}

// ─────────────────────────────────────────────
// Artist autocomplete
// ─────────────────────────────────────────────
function initArtistAC(inputId, dropdownId, hintId) {
	const input = document.getElementById(inputId);
	const dropdown = document.getElementById(dropdownId);
	const hint = document.getElementById(hintId);
	let selected = null;

	function render(q) {
		q = (q || '').trim().toLowerCase();
		if (!q) { dropdown.classList.remove('open'); return; }

		const matched = allArtists.filter(a => a.name.toLowerCase().includes(q));
		const exactMatch = allArtists.find(a => a.name.toLowerCase() === q);
		let html = matched.slice(0, 6).map(a => `
      <div class="artist-option" data-id="${a.id}" data-name="${a.name}">
        <div class="artist-option-avatar">${a.avatar_url ? `<img src="${a.avatar_url}">` : '🎤'}</div>
        <div>
          <div class="artist-option-name">${a.name}</div>
          <div class="artist-option-sub">ID #${a.id}</div>
        </div>
      </div>`).join('');

		if (!exactMatch && input.value.trim()) {
			html += `
        <div class="artist-option new-artist" data-id="NEW" data-name="${input.value.trim()}">
          <div class="artist-option-avatar">➕</div>
          <div>
            <div class="artist-option-name">Tạo mới: "${input.value.trim()}"</div>
            <div class="artist-option-sub">Thêm vào database</div>
          </div>
        </div>`;
		}

		dropdown.innerHTML = html;
		dropdown.classList.toggle('open', !!html);

		dropdown.querySelectorAll('.artist-option').forEach(opt => {
			opt.addEventListener('mousedown', e => {
				e.preventDefault();
				select(opt.dataset.id, opt.dataset.name);
			});
		});
	}

	function select(id, name) {
		selected = { id, name, isNew: id === 'NEW' };
		input.value = name;
		dropdown.classList.remove('open');
		hint.innerHTML = id === 'NEW'
			? `<span style="color:var(--accent)">✨ Sẽ tạo "<strong>${name}</strong>" khi upload</span>`
			: `<span style="color:rgba(255,255,255,0.5)">✅ ID #${id}</span>`;
	}

	input.addEventListener('input', () => { selected = null; hint.innerHTML = ''; render(input.value); });
	input.addEventListener('focus', () => { if (input.value) render(input.value); });
	input.addEventListener('blur', () => setTimeout(() => dropdown.classList.remove('open'), 150));

	return {
		getSelected: () => selected,
		getValue: () => input.value.trim(),
		clear: () => { input.value = ''; hint.innerHTML = ''; selected = null; dropdown.classList.remove('open'); },
		set: (id, name) => select(id, name),
	};
}

// ─────────────────────────────────────────────
// Album autocomplete
// ─────────────────────────────────────────────
function initAlbumAC(inputId, dropdownId, hintId, getArtistAC) {
	const input = document.getElementById(inputId);
	const dropdown = document.getElementById(dropdownId);
	const hint = document.getElementById(hintId);
	let selected = null;

	function render(q) {
		q = (q || '').trim().toLowerCase();
		const artistSel = getArtistAC?.()?.getSelected();
		let pool = allAlbums;
		if (artistSel && !artistSel.isNew)
			pool = allAlbums.filter(a => String(a.artist_id) === String(artistSel.id));

		const matched = q ? pool.filter(a => a.title.toLowerCase().includes(q)) : pool;
		if (!matched.length && !q) { dropdown.classList.remove('open'); return; }

		dropdown.innerHTML = matched.slice(0, 8).map(a => {
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
		}).join('') || `<div style="padding:12px 14px;font-size:13px;color:rgba(255,255,255,0.3);">Không tìm thấy</div>`;

		dropdown.classList.add('open');

		dropdown.querySelectorAll('.artist-option[data-id]').forEach(opt => {
			opt.addEventListener('mousedown', e => {
				e.preventDefault();
				selected = { id: opt.dataset.id, name: opt.dataset.name };
				input.value = opt.dataset.name;
				hint.innerHTML = `<span style="color:rgba(255,255,255,0.5)">✅ Album ID #${opt.dataset.id}</span>`;
				dropdown.classList.remove('open');
			});
		});
	}

	input.addEventListener('input', () => { selected = null; hint.innerHTML = ''; render(input.value); });
	input.addEventListener('focus', () => render(input.value));
	input.addEventListener('blur', () => setTimeout(() => dropdown.classList.remove('open'), 150));

	return {
		getSelected: () => selected,
		clear: () => { input.value = ''; hint.innerHTML = 'Chọn nghệ sĩ trước để lọc album'; selected = null; dropdown.classList.remove('open'); },
	};
}

// ─────────────────────────────────────────────
// Resolve artist
// ─────────────────────────────────────────────
async function resolveArtist(ac) {
	const sel = ac.getSelected();
	const name = sel ? sel.name : (ac.getValue?.() || '');
	if (!name) return null;

	if (sel && !sel.isNew) return parseInt(sel.id);

	// Tìm trong cache
	const found = allArtists.find(a => a.name.toLowerCase() === name.toLowerCase());
	if (found) return parseInt(found.id);

	// Tạo mới
	const res = await authFetch(`${API}/admin/artists`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: name.trim() }),
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data.error || 'Không thể tạo nghệ sĩ');
	allArtists.push({ id: data.id, name: name.trim() });
	return data.id;
}

// ─────────────────────────────────────────────
// Cover preview (album form)
// ─────────────────────────────────────────────
let _coverTimer = null;
function updateAlbumCoverPreview(url) {
	const wrap = document.getElementById('albumCoverPreviewWrap');
	const box = document.getElementById('albumCoverPreviewBox');
	const stat = document.getElementById('albumCoverPreviewStatus');
	const dim = document.getElementById('albumCoverPreviewDim');
	if (!url.trim()) { wrap.style.display = 'none'; box.innerHTML = '💿'; return; }
	wrap.style.display = 'block';
	stat.innerHTML = '<span style="color:var(--text-dim)">⏳ Đang tải...</span>';
	clearTimeout(_coverTimer);
	_coverTimer = setTimeout(() => {
		const img = new Image();
		img.onload = () => { box.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`; stat.innerHTML = '<span style="color:var(--accent)">✅ Hợp lệ</span>'; dim.textContent = `${img.naturalWidth}×${img.naturalHeight}px`; };
		img.onerror = () => { box.innerHTML = '❌'; stat.innerHTML = '<span style="color:var(--danger)">❌ Lỗi ảnh</span>'; };
		img.src = url;
	}, 600);
}

// ─────────────────────────────────────────────
// Preview Modal
// ─────────────────────────────────────────────
let _previewAudio = null;

function openPreviewModal() {
	const file = document.getElementById('songFile').files[0];
	const title = document.getElementById('songTitle').value.trim();
	const artistSel = songArtistAC?.getSelected();
	const albumSel = songAlbumAC?.getSelected();
	const lyrics = document.getElementById('songLyrics').value.trim();
	const duration = document.getElementById('songDuration').value;

	const checks = [
		title ? { ok: true, l: '✅ Tên bài hát' } : { ok: false, l: '❌ Chưa nhập tên' },
		artistSel ? { ok: true, l: `✅ ${artistSel.name}` } : { ok: false, l: '❌ Chưa chọn nghệ sĩ' },
		file ? { ok: true, l: `✅ ${file.name}` } : { ok: false, l: '❌ Chưa chọn MP3' },
		albumSel ? { ok: true, l: `✅ ${albumSel.name}` } : { ok: 'warn', l: '⚠️ Sẽ tạo Single tự động' },
	];

	document.getElementById('previewTitle').textContent = title || '(Chưa nhập)';
	document.getElementById('previewArtist').textContent = artistSel?.name || '(Chưa chọn)';
	document.getElementById('previewMeta').textContent = (albumSel?.name || 'Single') + (duration ? ` · ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : '');
	document.getElementById('previewChecklist').innerHTML = checks.map(c => `<span class="check-item ${c.ok === true ? 'ok' : c.ok === 'warn' ? 'warn' : 'bad'}">${c.l}</span>`).join('');

	// Cover
	const coverEl = document.getElementById('previewCover');
	const albumData = albumSel ? allAlbums.find(a => String(a.id) === String(albumSel.id)) : null;
	if (albumData?.cover_url) {
		const img = document.createElement('img');
		img.onload = () => { coverEl.innerHTML = ''; coverEl.appendChild(img); };
		img.onerror = () => { coverEl.innerHTML = '💿'; };
		img.src = albumData.cover_url;
	} else {
		coverEl.innerHTML = '💿';
	}

	// Audio
	const statusEl = document.getElementById('previewAudioStatus');
	const playBtn = document.getElementById('previewPlayBtn');
	const fillEl = document.getElementById('previewProgressFill');
	const curEl = document.getElementById('previewTimeCurrent');
	const durEl = document.getElementById('previewTimeDuration');
	playBtn.textContent = '▶'; fillEl.style.width = '0%'; curEl.textContent = '0:00'; durEl.textContent = '0:00'; statusEl.className = 'preview-status';

	if (!file) {
		statusEl.className = 'preview-status error'; statusEl.textContent = '❌ Chưa chọn file MP3';
	} else {
		if (_previewAudio) { _previewAudio.pause(); _previewAudio.src = ''; }
		_previewAudio = new Audio(URL.createObjectURL(file));
		_previewAudio.addEventListener('loadedmetadata', () => {
			durEl.textContent = fmtSec(_previewAudio.duration);
			statusEl.className = 'preview-status ok';
			statusEl.textContent = `✅ ${(file.size / 1024 / 1024).toFixed(2)} MB · ${fmtSec(_previewAudio.duration)}`;
			if (!document.getElementById('songDuration').value)
				document.getElementById('songDuration').value = Math.round(_previewAudio.duration);
		});
		_previewAudio.addEventListener('error', () => { statusEl.className = 'preview-status error'; statusEl.textContent = '❌ File MP3 bị lỗi'; });
		_previewAudio.addEventListener('timeupdate', () => {
			if (!_previewAudio.duration) return;
			fillEl.style.width = (_previewAudio.currentTime / _previewAudio.duration * 100) + '%';
			curEl.textContent = fmtSec(_previewAudio.currentTime);
		});
		_previewAudio.addEventListener('ended', () => { playBtn.textContent = '▶'; fillEl.style.width = '0%'; });
	}

	// Lyrics
	const lyricsEl = document.getElementById('previewLyrics');
	const typeEl = document.getElementById('previewLyricsType');
	if (!lyrics) {
		lyricsEl.innerHTML = '<div class="lyrics-empty">Không có lời</div>'; typeEl.textContent = '';
	} else {
		const lrcLines = lyrics.match(/\[\d{2}:\d{2}[.:]\d{2}\].+/g);
		if (lrcLines?.length) {
			typeEl.innerHTML = `<span style="color:var(--accent)">LRC · ${lrcLines.length} dòng</span>`;
			lyricsEl.innerHTML = lrcLines.map(l => { const m = l.match(/\[(\d{2}:\d{2}[.:]\d{2})\](.*)/); return m ? `<div class="lyrics-line"><span class="lyrics-timestamp">${m[1]}</span><span class="lyrics-text">${m[2].trim()}</span></div>` : '' }).join('');
		} else {
			const lines = lyrics.split('\n').filter(l => l.trim());
			typeEl.innerHTML = `<span style="color:var(--text-dim)">Plain · ${lines.length} dòng</span>`;
			lyricsEl.innerHTML = lines.map(l => `<div class="lyrics-line"><span class="lyrics-text">${l}</span></div>`).join('');
		}
	}

	document.getElementById('previewModal').classList.add('open');
}

function closePreviewModal() {
	document.getElementById('previewModal').classList.remove('open');
	if (_previewAudio) { _previewAudio.pause(); _previewAudio.src = ''; }
}

function togglePreviewPlay() {
	if (!_previewAudio) return;
	const btn = document.getElementById('previewPlayBtn');
	if (_previewAudio.paused) { _previewAudio.play(); btn.textContent = '⏸'; }
	else { _previewAudio.pause(); btn.textContent = '▶'; }
}

function seekPreview(e) {
	if (!_previewAudio?.duration) return;
	const rect = e.currentTarget.getBoundingClientRect();
	_previewAudio.currentTime = ((e.clientX - rect.left) / rect.width) * _previewAudio.duration;
}

document.getElementById('previewModal').addEventListener('click', e => { if (e.target === e.currentTarget) closePreviewModal(); });

// ─────────────────────────────────────────────
// Manage Songs
// ─────────────────────────────────────────────
let allSongsData = [];

async function loadManageSongs() {
	try {
		const res = await authFetch(`${API}/admin/manage/songs`);
		allSongsData = await res.json();
		renderSongsTable(allSongsData);
	} catch { }
}

function renderSongsTable(songs) {
	document.getElementById('manageCount').textContent = `${songs.length} bài hát`;
	const tbody = document.getElementById('songsTableBody');
	if (!songs.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:40px;">Chưa có bài hát</td></tr>'; return; }
	tbody.innerHTML = songs.map(s => `
    <tr>
      <td style="color:var(--text-dim);font-size:13px;">#${s.id}</td>
      <td><div class="song-row-title">${s.title}</div><div class="song-row-sub">${s.album_title || 'No album'}</div></td>
      <td style="color:var(--text-dim);">${s.artist_name}</td>
      <td style="color:var(--text-dim);font-size:13px;">${s.album_title || '—'}</td>
      <td style="color:var(--text-dim);font-size:13px;">${formatDur(s.duration)}</td>
      <td><span class="plays-badge">${(s.plays_count || 0).toLocaleString()}</span></td>
      <td>
        <div class="action-btns">
          <button class="btn-icon edit"   onclick="openEditModal(${s.id})">✏️</button>
          <button class="btn-icon delete" onclick="deleteSong(${s.id},'${s.title.replace(/'/g, "\\'")}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

document.getElementById('manageSearch').addEventListener('input', function () {
	const q = this.value.toLowerCase();
	renderSongsTable(allSongsData.filter(s =>
		s.title.toLowerCase().includes(q) ||
		s.artist_name.toLowerCase().includes(q) ||
		(s.album_title || '').toLowerCase().includes(q)
	));
});

async function deleteSong(id, title) {
	if (!confirm(`Xóa "${title}"?\nKhông thể hoàn tác!`)) return;
	try {
		const res = await authFetch(`${API}/admin/manage/songs/${id}`, { method: 'DELETE' });
		const d = await res.json();
		if (!res.ok) throw new Error(d.error);
		showToast(`Đã xóa "${title}"`);
		loadManageSongs();
	} catch (err) { showToast(err.message, 'error'); }
}

let editArtistAC = null;

function openEditModal(id) {
	const s = allSongsData.find(x => x.id === id);
	if (!s) return;
	document.getElementById('editSongId').value = s.id;
	document.getElementById('editTitle').value = s.title;
	document.getElementById('editDuration').value = s.duration;
	document.getElementById('editTrack').value = s.track_number || 1;
	document.getElementById('editExplicit').value = s.is_explicit ? '1' : '0';
	document.getElementById('editLyrics').value = s.lyrics || '';
	if (!editArtistAC) editArtistAC = initArtistAC('editArtistInput', 'editArtistDropdown', 'editArtistHint');
	editArtistAC.set(s.artist_id, s.artist_name);
	document.getElementById('editModal').classList.add('open');
}

function closeEditModal() { document.getElementById('editModal').classList.remove('open'); }
document.getElementById('editModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeEditModal(); });

async function saveEditSong() {
	const id = parseInt(document.getElementById('editSongId').value);
	let artistId;
	try { artistId = await resolveArtist(editArtistAC); } catch (err) { showToast(err.message, 'error'); return; }
	const body = {
		title: document.getElementById('editTitle').value.trim(),
		duration: parseInt(document.getElementById('editDuration').value),
		artist_id: artistId,
		track_number: parseInt(document.getElementById('editTrack').value),
		is_explicit: document.getElementById('editExplicit').value === '1',
		lyrics: document.getElementById('editLyrics').value,
	};
	try {
		const res = await authFetch(`${API}/admin/manage/songs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
		const d = await res.json();
		if (!res.ok) throw new Error(d.error);
		showToast('Đã lưu!');
		closeEditModal();
		loadManageSongs();
	} catch (err) { showToast(err.message, 'error'); }
}

// ─────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────
async function loadAnalytics() {
	try {
		const res = await authFetch(`${API}/admin/analytics`);
		const d = await res.json();
		document.getElementById('statSongs').textContent = d.total_songs;
		document.getElementById('statPlays').textContent = formatPlays(d.total_plays);
		document.getElementById('statAlbums').textContent = d.total_albums;
		document.getElementById('statArtists').textContent = d.total_artists;
		const max = d.top10[0]?.plays_count || 1;
		document.getElementById('top10Body').innerHTML = d.top10.length
			? d.top10.map((s, i) => `
          <tr>
            <td><span class="rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</span></td>
            <td><div style="font-weight:700;">${s.title}</div><div style="font-size:12px;color:var(--text-dim);">${s.album_title || 'Single'}</div></td>
            <td style="color:var(--text-dim);">${s.artist_name}</td>
            <td style="min-width:180px;"><div class="plays-bar-wrap"><div class="plays-bar-track"><div class="plays-bar-fill" style="width:${Math.round(s.plays_count / max * 100)}%"></div></div><span class="plays-num">${(s.plays_count || 0).toLocaleString()}</span></div></td>
          </tr>`).join('')
			: '<tr><td colspan="4" style="text-align:center;color:var(--text-dim);padding:32px;">Chưa có dữ liệu</td></tr>';
	} catch { }
}

// ─────────────────────────────────────────────
// Artist Requests
// ─────────────────────────────────────────────
async function loadRequests() {
	try {
		const res = await authFetch(`${API}/artist-requests`);
		const list = await res.json();
		const pend = list.filter(r => r.status === 'pending').length;
		const badge = document.getElementById('navRequestsBadge');
		badge.textContent = pend; badge.style.display = pend > 0 ? 'inline' : 'none';
		document.getElementById('requestsCount').textContent = `${list.length} yêu cầu · ${pend} đang chờ`;
		const el = document.getElementById('requestsList');
		if (!list.length) { el.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:60px;">Chưa có yêu cầu</div>'; return; }
		el.innerHTML = list.map(r => `
      <div class="request-card ${r.status}">
        <div class="request-avatar">${r.username[0].toUpperCase()}</div>
        <div class="request-info">
          <div class="request-artist-name">🎤 ${r.artist_name}</div>
          <div class="request-user">${r.username} · ${r.email}</div>
          ${r.bio ? `<div class="request-bio">📝 ${r.bio}</div>` : ''}
          ${r.reason ? `<div class="request-reason">"${r.reason}"</div>` : ''}
          <div class="request-date">${new Date(r.created_at).toLocaleString('vi-VN')}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;">
          <span class="request-status status-${r.status}">${r.status === 'pending' ? '⏳ Chờ duyệt' : r.status === 'approved' ? '✅ Đã duyệt' : '❌ Từ chối'}</span>
          ${r.status === 'pending' ? `<div class="request-actions"><button class="btn-approve" onclick="reviewRequest(${r.id},'approve')">✅ Approve</button><button class="btn-reject" onclick="reviewRequest(${r.id},'reject')">❌ Reject</button></div>` : ''}
        </div>
      </div>`).join('');
	} catch { }
}

async function reviewRequest(id, action) {
	if (!confirm(`Xác nhận ${action === 'approve' ? 'duyệt' : 'từ chối'}?`)) return;
	try {
		const res = await authFetch(`${API}/artist-requests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
		const d = await res.json();
		if (!res.ok) throw new Error(d.error);
		showToast(d.message);
		loadRequests();
	} catch (err) { showToast(err.message, 'error'); }
}

// ─────────────────────────────────────────────
// Reset forms
// ─────────────────────────────────────────────
function resetSongForm() {
	document.getElementById('songForm').reset();
	document.getElementById('mp3Name').textContent = '';
	songArtistAC?.clear();
	songAlbumAC?.clear();
}
function resetAlbumForm() {
	document.getElementById('albumForm').reset();
	albumArtistAC?.clear();
}

// ─────────────────────────────────────────────
// INIT — tất cả logic chạy SAU khi login
// ─────────────────────────────────────────────
let songArtistAC = null;
let albumArtistAC = null;
let songAlbumAC = null;

function initAdmin() {
	// 1. Drop zone
	initDropZone('mp3Zone', 'songFile', 'mp3Name');

	// 2. Load data
	Promise.all([loadArtists(), loadAlbums()]).then(() => {
		loadRecentSongs();
		loadRecentAlbums();

		// 3. Init autocomplete SAU khi có data
		songArtistAC = initArtistAC('songArtistInput', 'songArtistDropdown', 'songArtistHint');
		albumArtistAC = initArtistAC('albumArtistInput', 'albumArtistDropdown', 'albumArtistHint');
		songAlbumAC = initAlbumAC('songAlbumInput', 'songAlbumDropdown', 'songAlbumHint', () => songArtistAC);

		document.getElementById('songArtistInput').addEventListener('input', () => songAlbumAC?.clear());

		// 4. Submit: Upload Song
		document.getElementById('songForm').addEventListener('submit', async e => {
			e.preventDefault();
			const btn = document.getElementById('songSubmitBtn');
			const prog = document.getElementById('songProgress');
			const fill = document.getElementById('songProgressFill');
			const lbl = document.getElementById('songProgressLabel');

			const file = document.getElementById('songFile').files[0];
			if (!file) { showToast('Vui lòng chọn file MP3!', 'error'); return; }

			let artistId;
			try { artistId = await resolveArtist(songArtistAC); }
			catch (err) { showToast(err.message, 'error'); return; }
			if (!artistId) { showToast('Vui lòng nhập tên nghệ sĩ!', 'error'); return; }

			const fd = new FormData();
			fd.append('title', document.getElementById('songTitle').value.trim());
			fd.append('duration', document.getElementById('songDuration').value);
			fd.append('artist_id', artistId);
			fd.append('album_id', songAlbumAC?.getSelected()?.id || '');
			fd.append('track_number', document.getElementById('songTrack').value || '1');
			fd.append('is_explicit', document.getElementById('songExplicit').value);
			fd.append('lyrics', document.getElementById('songLyrics').value);
			fd.append('audio', file);

			btn.disabled = true; prog.classList.add('show'); fill.style.width = '10%'; lbl.textContent = 'Đang upload...';
			try {
				let pct = 10;
				const iv = setInterval(() => { pct = Math.min(pct + 5, 85); fill.style.width = pct + '%'; }, 300);
				const res = await authFetch(`${API}/admin/songs`, { method: 'POST', body: fd });
				clearInterval(iv); fill.style.width = '100%'; lbl.textContent = 'Hoàn thành!';
				const d = await res.json();
				if (!res.ok) throw new Error(d.error || 'Upload thất bại');
				const title = document.getElementById('songTitle').value;
				showToast(d.auto_single ? `Đã upload "${title}" · Tạo Single ✨` : `Đã upload "${title}"!`);
				resetSongForm(); loadRecentSongs(); await loadAlbums();
			} catch (err) { showToast(err.message, 'error'); }
			finally { btn.disabled = false; setTimeout(() => { prog.classList.remove('show'); fill.style.width = '0%'; }, 1500); }
		});

		// 5. Submit: Create Album
		document.getElementById('albumForm').addEventListener('submit', async e => {
			e.preventDefault();
			const btn = document.getElementById('albumSubmitBtn');
			btn.disabled = true;

			let artistId;
			try { artistId = await resolveArtist(albumArtistAC); }
			catch (err) { showToast(err.message, 'error'); btn.disabled = false; return; }
			if (!artistId) { showToast('Vui lòng nhập tên nghệ sĩ!', 'error'); btn.disabled = false; return; }

			const body = {
				title: document.getElementById('albumTitle').value.trim(),
				artist_id: artistId,
				type: document.getElementById('albumType').value,
				release_date: document.getElementById('albumDate').value || null,
				cover_url: document.getElementById('albumCover').value.trim() || null,
			};
			try {
				const res = await authFetch(`${API}/admin/albums`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
				const d = await res.json();
				if (!res.ok) throw new Error(d.error);
				showToast(`Đã tạo album "${body.title}"! (ID: ${d.id})`);
				resetAlbumForm(); await loadAlbums(); loadRecentAlbums();
			} catch (err) { showToast(err.message, 'error'); }
			finally { btn.disabled = false; }
		});
	});

	// Badge requests
	loadRequests();
}

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────
checkAuth();