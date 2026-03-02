/* =============================
			SoundWave - script.js
			============================= */

document.addEventListener('DOMContentLoaded', () => {

	/* ── Tabs ── */
	document.querySelectorAll('.filter-tab').forEach(tab => {
		tab.addEventListener('click', () => {
			document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
			tab.classList.add('active');
		});
	});

	/* ── Nav links ── */
	document.querySelectorAll('.nav-link-item').forEach(link => {
		link.addEventListener('click', e => {
			e.preventDefault();
			document.querySelectorAll('.nav-link-item').forEach(l => l.classList.remove('active'));
			link.classList.add('active');
		});
	});

	/* ── Player State ── */
	let playing = true;
	let progress = 35;
	let volume = 70;
	let progressInterval;

	const playBtn = document.getElementById('playBtn');
	const playIcon = document.getElementById('playIcon');
	const bars = document.getElementById('playingBars');
	const progFill = document.getElementById('progressFill');
	const progHandle = document.querySelector('.progress-handle');
	const progressTrack = document.getElementById('progressTrack');
	const timeNow = document.getElementById('timeNow');
	const trackName = document.getElementById('trackName');
	const trackArtist = document.getElementById('trackArtist');
	const nowThumb = document.getElementById('nowThumb');
	const volTrack = document.getElementById('volTrack');
	const volFill = document.getElementById('volFill');

	const DURATION = 238;

	function secondsToMMSS(s) {
		const m = Math.floor(s / 60);
		const sec = Math.floor(s % 60);
		return `${m}:${sec.toString().padStart(2, '0')}`;
	}

	function updateProgressUI() {
		const pct = Math.max(0, Math.min(100, progress));
		progFill.style.width = pct + '%';
		if (progHandle) progHandle.style.left = pct + '%';
		timeNow.textContent = secondsToMMSS(Math.floor((pct / 100) * DURATION));
	}

	function updateVolumeUI() {
		volFill.style.width = Math.max(0, Math.min(100, volume)) + '%';
	}

	let isDraggingProg = false;

	function startProgress() {
		clearInterval(progressInterval);
		progressInterval = setInterval(() => {
			if (playing && !isDraggingProg) {
				progress = Math.min(100, progress + (100 / DURATION / 10));
				updateProgressUI();
				if (progress >= 100) {
					playing = false;
					playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
					bars.style.opacity = '0.3';
				}
			}
		}, 100);
	}

	startProgress();

	/* ── Play / Pause ── */
	playBtn.addEventListener('click', () => {
		playing = !playing;
		if (playing) {
			playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
			bars.style.opacity = '1';
			startProgress();
		} else {
			playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
			bars.style.opacity = '0.3';
		}
	});

	/* ══════════════════════════════
				PROGRESS BAR
				══════════════════════════════ */
	function calcProgress(clientX) {
		const rect = progressTrack.getBoundingClientRect();
		return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
	}

	progressTrack.addEventListener('mousedown', e => {
		isDraggingProg = true;
		progressTrack.classList.add('dragging');
		progress = calcProgress(e.clientX);
		updateProgressUI();
		e.preventDefault();
	});

	document.addEventListener('mousemove', e => {
		if (!isDraggingProg) return;
		progress = calcProgress(e.clientX);
		updateProgressUI();
	});

	document.addEventListener('mouseup', () => {
		if (!isDraggingProg) return;
		isDraggingProg = false;
		progressTrack.classList.remove('dragging');
	});

	progressTrack.addEventListener('wheel', e => {
		e.preventDefault();
		progress = Math.max(0, Math.min(100, progress - e.deltaY * 0.3));
		updateProgressUI();
	}, { passive: false });

	progressTrack.addEventListener('touchstart', e => {
		isDraggingProg = true;
		progress = calcProgress(e.touches[0].clientX);
		updateProgressUI();
		e.preventDefault();
	}, { passive: false });

	document.addEventListener('touchmove', e => {
		if (!isDraggingProg) return;
		progress = calcProgress(e.touches[0].clientX);
		updateProgressUI();
	}, { passive: false });

	document.addEventListener('touchend', () => { isDraggingProg = false; });

	/* ══════════════════════════════
				VOLUME BAR
				══════════════════════════════ */
	let isDraggingVol = false;

	function calcVolume(clientX) {
		const rect = volTrack.getBoundingClientRect();
		return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
	}

	volTrack.addEventListener('mousedown', e => {
		isDraggingVol = true;
		volume = calcVolume(e.clientX);
		updateVolumeUI();
		e.preventDefault();
	});

	document.addEventListener('mousemove', e => {
		if (!isDraggingVol) return;
		volume = calcVolume(e.clientX);
		updateVolumeUI();
	});

	document.addEventListener('mouseup', () => { isDraggingVol = false; });

	volTrack.addEventListener('wheel', e => {
		e.preventDefault();
		volume = Math.max(0, Math.min(100, volume - e.deltaY * 0.2));
		updateVolumeUI();
	}, { passive: false });

	volTrack.addEventListener('touchstart', e => {
		isDraggingVol = true;
		volume = calcVolume(e.touches[0].clientX);
		updateVolumeUI();
		e.preventDefault();
	}, { passive: false });

	document.addEventListener('touchmove', e => {
		if (!isDraggingVol) return;
		volume = calcVolume(e.touches[0].clientX);
		updateVolumeUI();
	}, { passive: false });

	document.addEventListener('touchend', () => { isDraggingVol = false; });

	/* ── Click card → play track ── */
	function playTrack(name, artist, emoji) {
		trackName.textContent = name;
		trackArtist.textContent = artist;
		nowThumb.textContent = emoji;
		progress = 0;
		playing = true;
		playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
		bars.style.opacity = '1';
		startProgress();
	}

	document.querySelectorAll('[data-track]').forEach(el => {
		el.addEventListener('click', () => {
			playTrack(el.dataset.track, el.dataset.artist || 'SoundWave', el.dataset.emoji || '🎵');
		});
	});

	/* ── Skip ── */
	document.getElementById('nextBtn').addEventListener('click', () => { progress = 0; updateProgressUI(); });
	document.getElementById('prevBtn').addEventListener('click', () => { progress = 0; updateProgressUI(); });

	/* ── Shuffle / Repeat ── */
	['shuffleBtn', 'repeatBtn'].forEach(id => {
		const btn = document.getElementById(id);
		btn.addEventListener('click', () => {
			const on = btn.getAttribute('data-active') === '1';
			btn.setAttribute('data-active', on ? '0' : '1');
			btn.style.color = on ? '' : '#1db954';
		});
	});

	/* ══════════════════════════════
				AUTH - Kiểm tra đăng nhập
				══════════════════════════════ */
	const token = localStorage.getItem('sw_token');
	const user = JSON.parse(localStorage.getItem('sw_user') || 'null');

	// Nếu chưa đăng nhập → về trang login
	if (!token || !user) {
		window.location.href = '/html/login.html';
	} else {
		// Hiển thị chữ cái đầu của username lên avatar
		const initial = user.username ? user.username[0].toUpperCase() : '?';
		document.getElementById('userInitial').textContent = initial;
		document.getElementById('udName').textContent = user.username;
		document.getElementById('udEmail').textContent = user.email;
	}

	/* ── User dropdown toggle ── */
	const userAvatarBtn = document.getElementById('userAvatarBtn');
	const userDropdown = document.getElementById('userDropdown');

	// Click ra ngoài → đóng dropdown (xử lý chung ở phần search bên dưới)
	userAvatarBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		userDropdown.classList.toggle('open');
	});

	/* ── Đăng xuất ── */
	document.getElementById('logoutBtn').addEventListener('click', () => {
		localStorage.removeItem('sw_token');
		localStorage.removeItem('sw_user');
		window.location.href = '/html/login.html';
	});

	/* ══════════════════════════════
				SEARCH
				══════════════════════════════ */
	const searchInput = document.getElementById('searchInput');
	const searchResults = document.getElementById('searchResults');
	const API = 'http://localhost:3000/api';

	let searchTimeout = null;

	const typeLabel = { song: '🎵 Bài hát', artist: '🎤 Nghệ sĩ', album: '💿 Album' };
	const typeEmoji = { song: '🎵', artist: '🎤', album: '💿' };

	function renderResults(data) {
		if (!data.length) {
			searchResults.innerHTML = `<div class="search-empty">Không tìm thấy kết quả nào.</div>`;
			return;
		}

		// Nhóm theo type
		const groups = { song: [], artist: [], album: [] };
		data.forEach(item => {
			if (groups[item.type]) groups[item.type].push(item);
		});

		let html = '';
		for (const [type, items] of Object.entries(groups)) {
			if (!items.length) continue;
			html += `<div class="search-section-label">${typeLabel[type]}</div>`;
			items.slice(0, 4).forEach(item => {
				html += `
          <div class="search-item" data-track="${item.name}" data-artist="${item.artist || ''}" data-emoji="${typeEmoji[type]}">
            <div class="search-item-thumb ${type === 'artist' ? 'artist' : ''}">
              ${item.image
						? `<img src="${item.image}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" onerror="this.parentElement.textContent='${typeEmoji[type]}'">`
						: typeEmoji[type]}
            </div>
            <div class="search-item-info">
              <div class="search-item-name">${item.name}</div>
              <div class="search-item-sub">${item.artist || ''}</div>
            </div>
            <div class="search-item-type">${type}</div>
          </div>`;
			});
		}

		searchResults.innerHTML = html;

		// Click item → phát nhạc
		searchResults.querySelectorAll('.search-item').forEach(el => {
			el.addEventListener('click', () => {
				playTrack(
					el.dataset.track,
					el.dataset.artist || 'SoundWave',
					el.dataset.emoji || '🎵'
				);
				searchInput.value = el.dataset.track;
				searchResults.classList.remove('open');
			});
		});
	}

	async function doSearch(keyword) {
		searchResults.innerHTML = `
      <div class="search-loading">
        <div class="search-spinner"></div> Đang tìm...
      </div>`;
		searchResults.classList.add('open');

		try {
			const res = await fetch(`${API}/songs/search?q=${encodeURIComponent(keyword)}`);
			const data = await res.json();
			renderResults(data);
		} catch {
			searchResults.innerHTML = `<div class="search-empty">Lỗi kết nối server.</div>`;
		}
	}

	// Gõ → debounce 400ms rồi mới search
	searchInput.addEventListener('input', () => {
		const keyword = searchInput.value.trim();
		clearTimeout(searchTimeout);

		if (!keyword) {
			searchResults.classList.remove('open');
			return;
		}

		searchTimeout = setTimeout(() => doSearch(keyword), 400);
	});

	// Focus → mở lại nếu có kết quả cũ
	searchInput.addEventListener('focus', () => {
		if (searchInput.value.trim() && searchResults.innerHTML) {
			searchResults.classList.add('open');
		}
	});

	// Click ra ngoài → đóng search
	document.addEventListener('click', (e) => {
		if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
			searchResults.classList.remove('open');
		}
		// Đóng cả user dropdown
		userDropdown.classList.remove('open');
	});

	// Phím ESC → đóng search
	searchInput.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			searchResults.classList.remove('open');
			searchInput.blur();
		}
	});


	/* ── Init ── */
	updateProgressUI();
	updateVolumeUI();

});