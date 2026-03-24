/* =============================================
			SoundWave - script.js
			Playing System đầy đủ
			============================================= */

const API = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {

	/* ══════════════════════════════════════════
				AUTH
				══════════════════════════════════════════ */
	const token = localStorage.getItem('sw_token');
	const user = JSON.parse(localStorage.getItem('sw_user') || 'null');

	if (!token || !user) {
		window.location.href = '/html/login.html';
		return;
	}

	document.getElementById('userInitial').textContent = user.username[0].toUpperCase();
	document.getElementById('udName').textContent = user.username;
	document.getElementById('udEmail').textContent = user.email;

	// Sync role từ server — phòng trường hợp bị approve/thay đổi role sau khi login
	(async () => {
		try {
			const res = await fetch(`${API}/auth/me`, {
				headers: { 'Authorization': `Bearer ${token}` }
			});
			if (res.ok) {
				const fresh = await res.json();
				if (fresh.role !== user.role || fresh.artist_id !== user.artist_id) {
					// Role đã thay đổi → cập nhật localStorage
					const updated = { ...user, role: fresh.role, artist_id: fresh.artist_id };
					localStorage.setItem('sw_user', JSON.stringify(updated));
					// Reload để áp dụng UI mới
					window.location.reload();
				}
			}
		} catch { }
	})();

	/* ── Hiển thị UI theo role ── */
	const roleBadge = document.getElementById('udRoleBadge');
	const artistDashLink = document.getElementById('udArtistDashboard');
	const becomeArtistBtn = document.getElementById('udBecomeArtistBtn');
	const requestStatusEl = document.getElementById('udRequestStatus');

	if (user.role === 'artist') {
		roleBadge.style.display = 'block';
		artistDashLink.style.display = 'block';
	} else if (user.role === 'admin') {
		roleBadge.textContent = '🛡️ Admin';
		roleBadge.style.display = 'block';
		artistDashLink.style.display = 'block';
	} else {
		// User thường → kiểm tra có request pending không
		becomeArtistBtn.style.display = 'block';
		checkArtistRequestStatus();
	}

	becomeArtistBtn.addEventListener('click', () => {
		document.getElementById('userDropdown').classList.remove('show');
		openBecomeArtistModal();
	});

	async function checkArtistRequestStatus() {
		try {
			const res = await fetch(`${API}/artist-requests/me`, {
				headers: { 'Authorization': `Bearer ${token}` }
			});
			const req = await res.json();
			if (!req) return;

			if (req.status === 'pending') {
				becomeArtistBtn.style.display = 'none';
				requestStatusEl.style.display = 'block';
				requestStatusEl.innerHTML = '⏳ Yêu cầu đang chờ duyệt';
			} else if (req.status === 'rejected') {
				requestStatusEl.style.display = 'block';
				requestStatusEl.innerHTML = '❌ Yêu cầu bị từ chối · <span style="color:#1db954;cursor:pointer;" onclick="openBecomeArtistModal()">Gửi lại</span>';
			}
		} catch { }
	}

	/* ── Become Artist Modal ── */
	window.openBecomeArtistModal = function () {
		document.getElementById('reqArtistName').value = '';
		document.getElementById('reqBio').value = '';
		document.getElementById('reqReason').value = '';
		document.getElementById('reqError').style.display = 'none';
		document.getElementById('becomeArtistModal').style.display = 'flex';
	};

	window.closeBecomeArtistModal = function () {
		document.getElementById('becomeArtistModal').style.display = 'none';
	};

	// Đóng khi click overlay
	document.getElementById('becomeArtistModal').addEventListener('click', function (e) {
		if (e.target === this) window.closeBecomeArtistModal();
	});

	window.submitArtistRequest = async function () {
		const name = document.getElementById('reqArtistName').value.trim();
		const bio = document.getElementById('reqBio').value.trim();
		const reason = document.getElementById('reqReason').value.trim();
		const errEl = document.getElementById('reqError');
		const btn = document.getElementById('reqSubmitBtn');

		if (!name) {
			errEl.textContent = 'Vui lòng nhập tên nghệ sĩ';
			errEl.style.display = 'block';
			return;
		}
		errEl.style.display = 'none';
		btn.disabled = true;
		btn.textContent = 'Đang gửi...';

		try {
			const res = await fetch(`${API}/artist-requests`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
				body: JSON.stringify({ artist_name: name, bio, reason }),
			});
			const data = await res.json();

			if (!res.ok) {
				errEl.textContent = data.error;
				errEl.style.display = 'block';
				return;
			}

			window.closeBecomeArtistModal();
			// Cập nhật status
			becomeArtistBtn.style.display = 'none';
			requestStatusEl.style.display = 'block';
			requestStatusEl.innerHTML = '⏳ Yêu cầu đang chờ duyệt';

		} catch {
			errEl.textContent = 'Lỗi kết nối server';
			errEl.style.display = 'block';
		} finally {
			btn.disabled = false;
			btn.textContent = 'Gửi yêu cầu';
		}
	};

	/* ══════════════════════════════════════════
				QUEUE SYSTEM
				Trái tim của playing system
				══════════════════════════════════════════ */
	const Queue = {
		list: [],   // [{id, title, artist, emoji, cover}]
		index: -1,   // bài đang phát
		shuffle: false,
		repeat: false,  // repeat 1 bài

		get current() { return this.list[this.index] || null; },
		get hasNext() { return this.index < this.list.length - 1; },
		get hasPrev() { return this.index > 0; },

		// Load 1 bài đơn
		playSingle(song) {
			this.list = [song];
			this.index = 0;
		},

		// Load cả album/playlist
		playCollection(songs, startIndex = 0) {
			this.list = [...songs];
			this.index = startIndex;
		},

		next() {
			if (this.repeat) return; // repeat 1 bài → không next
			if (this.shuffle) {
				// Random bài khác bài hiện tại
				if (this.list.length > 1) {
					let rand;
					do { rand = Math.floor(Math.random() * this.list.length); }
					while (rand === this.index);
					this.index = rand;
				}
			} else if (this.hasNext) {
				this.index++;
			}
		},

		prev() {
			if (this.hasPrev) this.index--;
		},
	};

	/* ══════════════════════════════════════════
				PLAYER ELEMENTS
				══════════════════════════════════════════ */
	const audioPlayer = document.getElementById('audioPlayer');
	const playBtn = document.getElementById('playBtn');
	const playIcon = document.getElementById('playIcon');
	const bars = document.getElementById('playingBars');
	const progFill = document.getElementById('progressFill');
	const progHandle = document.querySelector('.progress-handle');
	const progressTrack = document.getElementById('progressTrack');
	const timeNow = document.getElementById('timeNow');
	const timeEnd = document.getElementById('timeEnd');
	const trackName = document.getElementById('trackName');
	const trackArtist = document.getElementById('trackArtist');
	const nowThumb = document.getElementById('nowThumb');
	const volTrack = document.getElementById('volTrack');
	const volFill = document.getElementById('volFill');
	const nextBtn = document.getElementById('nextBtn');
	const prevBtn = document.getElementById('prevBtn');
	const shuffleBtn = document.getElementById('shuffleBtn');
	const repeatBtn = document.getElementById('repeatBtn');

	let playing = false;
	let progress = 0;
	let volume = 70;
	let isDraggingProg = false;
	let isDraggingVol = false;
	let playCountSent = false;

	function secondsToMMSS(s) {
		if (!s || isNaN(s)) return '0:00';
		const m = Math.floor(s / 60);
		return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
	}

	function updateProgressUI() {
		const pct = Math.max(0, Math.min(100, progress));
		progFill.style.width = pct + '%';
		if (progHandle) progHandle.style.left = pct + '%';
		timeNow.textContent = secondsToMMSS(Math.floor((pct / 100) * (audioPlayer.duration || 0)));
	}

	function updateVolumeUI() {
		volFill.style.width = Math.max(0, Math.min(100, volume)) + '%';
		audioPlayer.volume = volume / 100;
		// Kéo volume lên → tự thoát mute
		if (volume > 0 && isMuted) isMuted = false;
		if (typeof updateVolIcon === 'function') updateVolIcon();
	}

	/* ══════════════════════════════════════════
				HIGHLIGHT bài đang phát
				══════════════════════════════════════════ */
	function updateHighlight() {
		// Xóa highlight cũ
		document.querySelectorAll('[data-song-id].playing').forEach(el => {
			el.classList.remove('playing');
		});
		// Thêm highlight mới
		const song = Queue.current;
		if (song) {
			document.querySelectorAll(`[data-song-id="${song.id}"]`).forEach(el => {
				el.classList.add('playing');
			});
		}
	}

	/* ══════════════════════════════════════════
				LOAD & PLAY BÀI
				══════════════════════════════════════════ */
	function loadAndPlay(song) {
		if (!song) return;

		// Cập nhật UI footer
		trackName.textContent = song.title;
		trackArtist.textContent = song.artist;
		nowThumb.textContent = song.emoji || '🎵';

		// Lưu album_id và artist_id để click navigate
		trackName.dataset.albumId = song.album_id || '';
		trackArtist.dataset.artistId = song.artist_id || '';

		// Reset
		progress = 0;
		playCountSent = false;
		playing = true;
		updateProgressUI();

		// Load stream
		audioPlayer.src = `${API}/stream/${song.id}`;
		audioPlayer.load();
		audioPlayer.play().catch(() => { });

		// UI controls
		playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
		bars.style.opacity = '1';

		// Highlight
		updateHighlight();

		// Lưu trạng thái vào sessionStorage (không reset khi đổi trang SPA)
		sessionStorage.setItem('sw_queue', JSON.stringify(Queue.list));
		sessionStorage.setItem('sw_qindex', Queue.index);
		sessionStorage.setItem('sw_playing', '1');
	}

	/* ══════════════════════════════════════════
				PUBLIC: playTrack (gọi từ search, card...)
				══════════════════════════════════════════ */
	window.playTrack = function (song) {
		Queue.playSingle(song);
		loadAndPlay(Queue.current);
	};

	/* ══════════════════════════════════════════
				PUBLIC: playCollection (album / playlist)
				══════════════════════════════════════════ */
	window.playCollection = function (songs, startIndex = 0) {
		Queue.playCollection(songs, startIndex);
		loadAndPlay(Queue.current);
	};

	/* ══════════════════════════════════════════
				AUDIO EVENTS
				══════════════════════════════════════════ */
	// Metadata load → cập nhật thời gian
	audioPlayer.addEventListener('loadedmetadata', () => {
		timeEnd.textContent = secondsToMMSS(Math.floor(audioPlayer.duration));
	});

	// Timeupdate → cập nhật progress + kiểm tra plays_count
	audioPlayer.addEventListener('timeupdate', () => {
		if (!isDraggingProg && audioPlayer.duration) {
			progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
			progFill.style.width = progress + '%';
			if (progHandle) progHandle.style.left = progress + '%';
			timeNow.textContent = secondsToMMSS(Math.floor(audioPlayer.currentTime));

			// Ghi lượt nghe sau 30s hoặc 50%
			if (!playCountSent && Queue.current) {
				if (audioPlayer.currentTime >= 30 || progress >= 50) {
					playCountSent = true;
					sendPlayCount(Queue.current.id);
				}
			}
		}
	});

	// AUTO NEXT khi hết bài
	audioPlayer.addEventListener('ended', () => {
		if (Queue.repeat) {
			// Repeat 1 bài → phát lại
			audioPlayer.currentTime = 0;
			audioPlayer.play().catch(() => { });
			return;
		}

		if (Queue.hasNext || Queue.shuffle) {
			Queue.next();
			loadAndPlay(Queue.current);
		} else {
			// Hết queue → dừng
			playing = false;
			progress = 0;
			updateProgressUI();
			playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
			bars.style.opacity = '0.3';
		}
	});

	/* ══════════════════════════════════════════
				PLAY / PAUSE BUTTON
				══════════════════════════════════════════ */
	playBtn.addEventListener('click', () => {
		if (!Queue.current) return;
		playing = !playing;
		if (playing) {
			audioPlayer.play().catch(() => { });
			playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
			bars.style.opacity = '1';
		} else {
			audioPlayer.pause();
			playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
			bars.style.opacity = '0.3';
		}
	});

	/* ══════════════════════════════════════════
				NEXT / PREV BUTTONS
				══════════════════════════════════════════ */
	nextBtn.addEventListener('click', () => {
		if (Queue.hasNext || Queue.shuffle) {
			Queue.next();
			loadAndPlay(Queue.current);
		}
	});

	prevBtn.addEventListener('click', () => {
		// Nếu đang phát > 3 giây → tua về đầu, không prev
		if (audioPlayer.currentTime > 3) {
			audioPlayer.currentTime = 0;
			return;
		}
		if (Queue.hasPrev) {
			Queue.prev();
			loadAndPlay(Queue.current);
		}
	});

	/* ══════════════════════════════════════════
				SHUFFLE / REPEAT
				══════════════════════════════════════════ */
	shuffleBtn.addEventListener('click', () => {
		Queue.shuffle = !Queue.shuffle;
		shuffleBtn.style.color = Queue.shuffle ? '#1db954' : '';
		shuffleBtn.setAttribute('data-active', Queue.shuffle ? '1' : '0');
	});

	repeatBtn.addEventListener('click', () => {
		Queue.repeat = !Queue.repeat;
		repeatBtn.style.color = Queue.repeat ? '#1db954' : '';
		repeatBtn.setAttribute('data-active', Queue.repeat ? '1' : '0');
	});

	/* ══════════════════════════════════════════
				PROGRESS BAR
				══════════════════════════════════════════ */
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
		if (audioPlayer.duration) {
			audioPlayer.currentTime = (progress / 100) * audioPlayer.duration;
		}
	});

	progressTrack.addEventListener('wheel', e => {
		e.preventDefault();
		progress = Math.max(0, Math.min(100, progress - e.deltaY * 0.3));
		updateProgressUI();
		if (audioPlayer.duration) {
			audioPlayer.currentTime = (progress / 100) * audioPlayer.duration;
		}
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

	document.addEventListener('touchend', () => {
		if (!isDraggingProg) return;
		isDraggingProg = false;
		if (audioPlayer.duration) {
			audioPlayer.currentTime = (progress / 100) * audioPlayer.duration;
		}
	});

	/* ══════════════════════════════════════════
				VOLUME BAR
				══════════════════════════════════════════ */
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

	/* ══════════════════════════════════════════
				PLAYS COUNT
				══════════════════════════════════════════ */
	async function sendPlayCount(songId) {
		try {
			await fetch(`${API}/songs/${songId}/play`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				}
			});
		} catch { /* bỏ qua lỗi mạng */ }
	}

	/* ══════════════════════════════════════════
				CLICK CARD → PLAY
				══════════════════════════════════════════ */
	document.querySelectorAll('[data-song-id]').forEach(el => {
		el.addEventListener('click', () => {
			const song = {
				id: el.dataset.songId,
				title: el.dataset.track || el.dataset.title || 'Unknown',
				artist: el.dataset.artist || 'SoundWave',
				emoji: el.dataset.emoji || '🎵',
			};

			// Nếu card có data-collection-id → phát cả album/playlist
			const collectionId = el.dataset.collectionId;
			const collectionType = el.dataset.collectionType; // 'album' | 'playlist'

			if (collectionId && collectionType) {
				loadCollection(collectionId, collectionType, song.id);
			} else {
				window.playTrack(song);
			}
		});
	});

	// Load album hoặc playlist rồi phát
	async function loadCollection(id, type, startSongId) {
		try {
			const url = type === 'album'
				? `${API}/albums/${id}`
				: `${API}/playlists/${id}`;

			const res = await fetch(url, {
				headers: { 'Authorization': `Bearer ${token}` }
			});
			const data = await res.json();
			const songs = (data.songs || []).map(s => ({
				id: s.id,
				title: s.title,
				artist: s.artist_name || data.artist_name || 'Unknown',
				emoji: '🎵',
			}));

			if (!songs.length) return;

			const startIndex = songs.findIndex(s => s.id == startSongId);
			window.playCollection(songs, startIndex >= 0 ? startIndex : 0);
		} catch (err) {
			console.error('loadCollection error:', err);
		}
	}

	/* ══════════════════════════════════════════
				SPA - Không reset khi đổi "trang"
				Khôi phục queue từ sessionStorage
				══════════════════════════════════════════ */
	function restoreSession() {
		try {
			const savedQueue = sessionStorage.getItem('sw_queue');
			const savedIndex = sessionStorage.getItem('sw_qindex');
			if (!savedQueue || savedIndex === null) return;

			Queue.list = JSON.parse(savedQueue);
			Queue.index = parseInt(savedIndex);

			const song = Queue.current;
			if (!song) return;

			// Khôi phục UI footer (không autoplay lại)
			trackName.textContent = song.title;
			trackArtist.textContent = song.artist;
			nowThumb.textContent = song.emoji || '🎵';
			updateHighlight();
		} catch { /* bỏ qua lỗi parse */ }
	}

	restoreSession();

	/* ══════════════════════════════════════════
				USER DROPDOWN
				══════════════════════════════════════════ */
	const userAvatarBtn = document.getElementById('userAvatarBtn');
	const userDropdown = document.getElementById('userDropdown');

	userAvatarBtn.addEventListener('click', e => {
		e.stopPropagation();
		userDropdown.classList.toggle('open');
	});

	document.getElementById('logoutBtn').addEventListener('click', () => {
		sessionStorage.removeItem('sw_queue');
		sessionStorage.removeItem('sw_qindex');
		localStorage.removeItem('sw_token');
		localStorage.removeItem('sw_user');
		window.location.href = '/html/login.html';
	});

	/* ══════════════════════════════════════════
				SEARCH
				══════════════════════════════════════════ */
	const searchInput = document.getElementById('searchInput');
	const searchResults = document.getElementById('searchResults');
	let searchTimeout = null;

	const typeLabel = { song: '🎵 Bài hát', artist: '🎤 Nghệ sĩ', album: '💿 Album' };
	const typeEmoji = { song: '🎵', artist: '🎤', album: '💿' };

	function renderResults(data) {
		if (!data.length) {
			searchResults.innerHTML = `<div class="search-empty">Không tìm thấy kết quả nào.</div>`;
			return;
		}
		const groups = { song: [], artist: [], album: [] };
		data.forEach(item => { if (groups[item.type]) groups[item.type].push(item); });

		let html = '';
		for (const [type, items] of Object.entries(groups)) {
			if (!items.length) continue;
			html += `<div class="search-section-label">${typeLabel[type]}</div>`;
			items.slice(0, 4).forEach(item => {
				html += `
          <div class="search-item"
            data-song-id="${item.id || ''}"
            data-track="${item.name}"
            data-artist="${item.artist || ''}"
            data-emoji="${typeEmoji[type]}">
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

		searchResults.querySelectorAll('.search-item').forEach(el => {
			el.addEventListener('click', () => {
				if (el.dataset.songId) {
					window.playTrack({
						id: el.dataset.songId,
						title: el.dataset.track,
						artist: el.dataset.artist,
						emoji: el.dataset.emoji,
					});
				}
				searchInput.value = el.dataset.track;
				searchResults.classList.remove('open');
			});
		});
	}

	async function doSearch(keyword) {
		searchResults.innerHTML = `<div class="search-loading"><div class="search-spinner"></div> Đang tìm...</div>`;
		searchResults.classList.add('open');
		try {
			const res = await fetch(`${API}/songs/search?q=${encodeURIComponent(keyword)}`);
			const data = await res.json();
			renderResults(data);
		} catch {
			searchResults.innerHTML = `<div class="search-empty">Lỗi kết nối server.</div>`;
		}
	}

	searchInput.addEventListener('input', () => {
		const kw = searchInput.value.trim();
		clearTimeout(searchTimeout);
		if (!kw) { searchResults.classList.remove('open'); return; }
		searchTimeout = setTimeout(() => doSearch(kw), 400);
	});

	searchInput.addEventListener('focus', () => {
		if (searchInput.value.trim()) searchResults.classList.add('open');
	});

	searchInput.addEventListener('keydown', e => {
		if (e.key === 'Escape') { searchResults.classList.remove('open'); searchInput.blur(); }
	});

	/* ══════════════════════════════════════════
				TABS / NAV
				══════════════════════════════════════════ */
	document.querySelectorAll('.filter-tab').forEach(tab => {
		tab.addEventListener('click', () => {
			document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
			tab.classList.add('active');
		});
	});

	document.querySelectorAll('.nav-link-item').forEach(link => {
		link.addEventListener('click', e => {
			e.preventDefault();
			document.querySelectorAll('.nav-link-item').forEach(l => l.classList.remove('active'));
			link.classList.add('active');
		});
	});

	// Click ra ngoài → đóng tất cả dropdown
	document.addEventListener('click', e => {
		if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
			searchResults.classList.remove('open');
		}
		if (!userAvatarBtn.contains(e.target)) {
			userDropdown.classList.remove('open');
		}
	});

	/* ══════════════════════════════════════════
				ARTIST PAGE
				══════════════════════════════════════════ */
	const homePage = document.querySelector('.px-4.py-3');
	const artistPage = document.getElementById('artistPage');
	let currentArtistId = null;
	let isFollowing = false;

	// Ẩn/hiện trang
	function showArtistPage() {
		homePage.style.display = 'none';
		artistPage.style.display = 'block';
		document.getElementById('mainContent').scrollTop = 0;
	}
	function showHomePage() {
		artistPage.style.display = 'none';
		homePage.style.display = 'block';
	}

	// Format số followers
	function formatNum(n) {
		if (!n) return '0';
		if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
		if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
		return n.toString();
	}

	// Format giây → mm:ss
	function fmtDuration(sec) {
		if (!sec) return '--:--';
		return secondsToMMSS(sec);
	}

	// Render 1 song row
	function renderSongRow(song, index, allSongs) {
		const isPlaying = Queue.current && Queue.current.id == song.id;
		const cover = song.album_cover
			? `<img src="${song.album_cover}" alt="">`
			: '🎵';

		return `
      <div class="song-row ${isPlaying ? 'playing' : ''}"
        data-song-id="${song.id}"
        data-idx="${index}">
        <div class="song-row-num">${isPlaying
				? '<svg viewBox="0 0 24 24" fill="#1db954" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>'
				: index + 1}</div>
        <div class="song-row-thumb">${cover}</div>
        <div class="song-row-info">
          <div class="song-row-title">${song.title}</div>
          <div class="song-row-artist">${song.artist_name || ''}</div>
        </div>
        <div class="song-row-duration">${fmtDuration(song.duration)}</div>
        <button class="add-to-pl-btn" data-song-id="${song.id}" data-song-title="${song.title}"
          title="Thêm vào playlist"
          style="opacity:0;background:none;border:none;color:var(--text-dim);
          cursor:pointer;font-size:18px;padding:4px 8px;border-radius:4px;transition:all 0.15s;"
          onclick="event.stopPropagation(); showAddToPlMenu(event, ${song.id}, '${song.title.replace(/'/g, "\\'")}')">＋</button>
      </div>`;
	}

	// Load và hiện artist page
	async function openArtistPage(artistId) {
		currentArtistId = artistId;
		showArtistPage();

		// Reset UI
		document.getElementById('artistName').textContent = 'Đang tải...';
		document.getElementById('artistFollowers').textContent = '';
		document.getElementById('artistTopSongs').innerHTML = '<div style="color:var(--text-dim);padding:20px">Đang tải...</div>';
		document.getElementById('artistAlbums').innerHTML = '';
		document.getElementById('artistAllSongs').innerHTML = '';

		try {
			const res = await fetch(`${API}/artists/${artistId}`, {
				headers: { 'Authorization': `Bearer ${token}` }
			});
			const artist = await res.json();

			// ── Hero ──
			const avatar = document.getElementById('artistAvatar');
			const heroEl = document.getElementById('artistHero');

			if (artist.avatar_url) {
				avatar.innerHTML = `<img src="${artist.avatar_url}" alt="${artist.name}">`;
				heroEl.style.background = `linear-gradient(135deg, #1a2a1a, #0a0a0a)`;
				// Thêm bg blur từ ảnh
				const bgDiv = document.createElement('div');
				bgDiv.className = 'artist-hero-bg';
				bgDiv.style.backgroundImage = `url(${artist.avatar_url})`;
				heroEl.prepend(bgDiv);
			} else {
				avatar.textContent = artist.name ? artist.name[0].toUpperCase() : '🎤';
			}

			document.getElementById('artistName').textContent = artist.name;
			document.getElementById('artistFollowers').textContent =
				artist.followers ? `${formatNum(artist.followers)} người theo dõi` : '';

			if (artist.verified) {
				document.getElementById('artistVerified').style.display = 'flex';
			}

			// ── Kiểm tra đang follow chưa ──
			try {
				const fRes = await fetch(`${API}/artists/${artistId}/followed?userId=${user.id}`, {
					headers: { 'Authorization': `Bearer ${token}` }
				});
				const fData = await fRes.json();
				isFollowing = fData.following;
				updateFollowBtn();
			} catch { isFollowing = false; updateFollowBtn(); }

			// ── Top 5 bài nổi bật ──
			const allSongs = artist.songs || [];
			const top5 = [...allSongs]
				.sort((a, b) => (b.plays_count || 0) - (a.plays_count || 0))
				.slice(0, 5);

			document.getElementById('artistTopSongs').innerHTML =
				top5.length
					? top5.map((s, i) => renderSongRow(s, i, top5)).join('')
					: '<div style="color:var(--text-dim);padding:12px">Chưa có bài hát.</div>';

			// ── Albums ──
			const albums = artist.albums || [];
			document.getElementById('artistAlbums').innerHTML =
				albums.length
					? albums.map(al => `
              <div class="col">
                <div class="album-card" data-album-id="${al.id}">
                  <div class="album-card-thumb">
                    ${al.cover_url
							? `<img src="${al.cover_url}" alt="${al.title}">`
							: '💿'}
                  </div>
                  <div class="album-card-title">${al.title}</div>
                  <div class="album-card-year">
                    ${al.type || 'Album'} · ${al.release_date ? al.release_date.substring(0, 4) : ''}
                  </div>
                </div>
              </div>`).join('')
					: '<div class="col-12" style="color:var(--text-dim)">Chưa có album.</div>';

			// ── Tất cả bài hát ──
			document.getElementById('artistAllSongs').innerHTML =
				allSongs.length
					? allSongs.map((s, i) => renderSongRow(s, i, allSongs)).join('')
					: '<div style="color:var(--text-dim);padding:12px">Chưa có bài hát.</div>';

			// ── Play All ──
			document.getElementById('artistPlayAllBtn').onclick = () => {
				if (!allSongs.length) return;
				const songs = allSongs.map(s => ({
					id: s.id,
					title: s.title,
					artist: artist.name,
					emoji: '🎵',
					album_id: s.album_id || '',
					artist_id: artist.id || '',
				}));
				window.playCollection(songs, 0);
			};

			// ── Click song row → phát ──
			// Top 5: tìm đúng vị trí bài trong allSongs theo id
			document.querySelectorAll('#artistTopSongs .song-row').forEach(row => {
				row.addEventListener('click', () => {
					const songId = parseInt(row.dataset.songId || row.dataset.idx);
					const songs = allSongs.map(s => ({
						id: s.id,
						title: s.title,
						artist: artist.name,
						emoji: '🎵',
						album_id: s.album_id || '',
						artist_id: artist.id || '',
					}));
					// Tìm index thực trong allSongs theo id
					const realIdx = allSongs.findIndex(s => s.id === songId);
					window.playCollection(songs, realIdx >= 0 ? realIdx : 0);
				});
			});

			// All songs: idx đã đúng với allSongs
			document.querySelectorAll('#artistAllSongs .song-row').forEach(row => {
				row.addEventListener('click', () => {
					const idx = parseInt(row.dataset.idx);
					const songs = allSongs.map(s => ({
						id: s.id,
						title: s.title,
						artist: artist.name,
						emoji: '🎵',
						album_id: s.album_id || '',
						artist_id: artist.id || '',
					}));
					window.playCollection(songs, idx);
				});
			});

			// ── Click album ──
			document.querySelectorAll('#artistAlbums .album-card').forEach(card => {
				card.addEventListener('click', () => {
					// Gọi playCollection với bài đầu của album
					const albumId = card.dataset.albumId;
					loadCollection(albumId, 'album', null);
				});
			});

		} catch (err) {
			document.getElementById('artistName').textContent = 'Lỗi tải dữ liệu';
			console.error('openArtistPage error:', err);
		}
	}

	function updateFollowBtn() {
		const btn = document.getElementById('artistFollowBtn');
		if (isFollowing) {
			btn.textContent = 'Đang theo dõi';
			btn.classList.add('following');
		} else {
			btn.textContent = 'Theo dõi';
			btn.classList.remove('following');
		}
	}

	document.getElementById('artistFollowBtn').addEventListener('click', async () => {
		try {
			const res = await fetch(`${API}/artists/${currentArtistId}/follow`, {
				method: 'POST',
				headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
			});
			const data = await res.json();
			isFollowing = data.following;
			updateFollowBtn();
		} catch (err) { console.error(err); }
	});

	// Mở artist page khi click vào artist name / avatar
	document.addEventListener('click', e => {
		const artistLink = e.target.closest('[data-artist-id]');
		if (artistLink) {
			e.preventDefault();
			openArtistPage(artistLink.dataset.artistId);
		}
	});

	// Nút Back trên topbar
	document.querySelectorAll('.btn-nav').forEach((btn, i) => {
		if (i === 0) { // nút quay lại
			btn.addEventListener('click', () => {
				if (artistPage.style.display !== 'none') showHomePage();
			});
		}
	});

	/* ══════════════════════════════════════════
				ALBUM PAGE
				══════════════════════════════════════════ */
	const albumPage = document.getElementById('albumPage');

	function showAlbumPage() {
		homePage.style.display = 'none';
		artistPage.style.display = 'none';
		albumPage.style.display = 'block';
		document.getElementById('mainContent').scrollTop = 0;
	}
	function hideAlbumPage() {
		albumPage.style.display = 'none';
	}

	// Format tổng giây → "X giờ Y phút" hoặc "Y phút Z giây"
	function formatTotalDuration(totalSec) {
		const h = Math.floor(totalSec / 3600);
		const m = Math.floor((totalSec % 3600) / 60);
		const s = totalSec % 60;
		if (h > 0) return `${h} giờ ${m} phút`;
		if (m > 0) return `${m} phút ${s} giây`;
		return `${s} giây`;
	}

	async function openAlbumPage(albumId) {
		showAlbumPage();

		// Reset
		document.getElementById('albumTitle').textContent = 'Đang tải...';
		document.getElementById('albumSongList').innerHTML = '';
		document.getElementById('albumFooter').innerHTML = '';
		document.getElementById('albumStats').innerHTML = '';

		try {
			const res = await fetch(`${API}/albums/${albumId}`, {
				headers: { 'Authorization': `Bearer ${token}` }
			});
			const album = await res.json();
			if (!album || !album.id) throw new Error('Không tìm thấy album');

			// ── Hero ──
			const cover = document.getElementById('albumCover');
			const heroBg = document.getElementById('albumHeroBg');

			if (album.cover_url) {
				cover.innerHTML = `<img src="${album.cover_url}" alt="${album.title}">`;
				heroBg.style.backgroundImage = `url(${album.cover_url})`;
			} else {
				cover.textContent = '💿';
				heroBg.style.background = 'linear-gradient(135deg,#1a1a2e,#0a0a0a)';
			}

			document.getElementById('albumType').textContent =
				album.type === 'single' ? 'Single' : album.type === 'ep' ? 'EP' : 'Album';
			document.getElementById('albumTitle').textContent = album.title;

			// Artist
			const artistNameEl = document.getElementById('albumArtistName');
			const artistAvaEl = document.getElementById('albumArtistAvatar');
			artistNameEl.textContent = album.artist_name || '';
			artistNameEl.dataset.artistId = album.artist_id || '';
			if (album.artist_avatar) {
				artistAvaEl.innerHTML = `<img src="${album.artist_avatar}" alt="">`;
			} else {
				artistAvaEl.textContent = '🎤';
			}

			// Stats: năm · số bài
			const year = album.release_date ? album.release_date.substring(0, 4) : '';
			const songCount = (album.songs || []).length;
			document.getElementById('albumStats').innerHTML =
				`<span>${year}</span><span>${songCount} bài hát</span>`;

			// ── Song list ──
			const songs = album.songs || [];
			const totalSec = songs.reduce((sum, s) => sum + (s.duration || 0), 0);

			document.getElementById('albumSongList').innerHTML = songs.map((s, i) => {
				const isPlaying = Queue.current && Queue.current.id == s.id;
				return `
				<div class="album-song-row ${isPlaying ? 'playing' : ''}" data-idx="${i}">
					<div class="album-song-num">
						${isPlaying
						? `<svg viewBox="0 0 24 24" fill="#1db954" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>`
						: i + 1}
					</div>
					<div>
						<div class="album-song-title">${s.title}</div>
						<div class="album-song-artist">${album.artist_name || ''}</div>
					</div>
					<div class="album-song-plays">${formatPlays(s.plays_count)}</div>
					<div class="album-song-dur">${secondsToMMSS(s.duration)}</div>
				</div>`;
			}).join('');

			// Footer
			document.getElementById('albumFooter').innerHTML =
				`<strong>${year}</strong> · ${songCount} bài hát, <strong>${formatTotalDuration(totalSec)}</strong>`;

			// ── Play All ──
			document.getElementById('albumPlayAllBtn').onclick = () => {
				const list = songs.map(s => ({
					id: s.id,
					title: s.title,
					artist: album.artist_name || '',
					emoji: '🎵',
					album_id: album.id || '',
					artist_id: album.artist_id || '',
				}));
				window.playCollection(list, 0);
			};

			// ── Click từng bài ──
			document.querySelectorAll('#albumSongList .album-song-row').forEach(row => {
				row.addEventListener('click', () => {
					const idx = parseInt(row.dataset.idx);
					const list = songs.map(s => ({
						id: s.id,
						title: s.title,
						artist: album.artist_name || '',
						emoji: '🎵',
						album_id: album.id || '',
						artist_id: album.artist_id || '',
					}));
					window.playCollection(list, idx);
				});
			});

			// ── Click tên artist → mở artist page ──
			document.getElementById('albumArtistRow').addEventListener('click', () => {
				if (album.artist_id) openArtistPage(album.artist_id);
			});

		} catch (err) {
			document.getElementById('albumTitle').textContent = 'Lỗi tải album';
			console.error('openAlbumPage error:', err);
		}
	}

	// Mở album page khi click vào card album (data-album-id)
	document.addEventListener('click', e => {
		const albumLink = e.target.closest('[data-album-id]');
		if (albumLink) {
			e.preventDefault();
			openAlbumPage(albumLink.dataset.albumId);
		}
	});

	// ── Click tên bài hát ở player footer → mở album page ──
	trackName.addEventListener('click', () => {
		const albumId = trackName.dataset.albumId;
		if (albumId) openAlbumPage(albumId);
	});

	// ── Click tên artist ở player footer → mở artist page ──
	trackArtist.addEventListener('click', () => {
		const artistId = trackArtist.dataset.artistId;
		if (artistId) openArtistPage(artistId);
	});

	// Nút Back từ album page → quay về trang trước
	// (dùng lại btn-nav đã có, thêm xử lý albumPage)
	document.querySelectorAll('.btn-nav').forEach((btn, i) => {
		if (i === 0) {
			btn.addEventListener('click', () => {
				if (albumPage.style.display !== 'none') {
					hideAlbumPage();
					// Nếu từ artist page → quay lại artist page
					// Nếu từ home → quay lại home
					if (artistPage.style.display === 'none' && homePage.style.display === 'none') {
						showHomePage();
					}
				}
			});
		}
	});

	/* ══════════════════════════════════════════
				LYRICS PAGE  (LRC sync)
				══════════════════════════════════════════ */
	const lyricsPage = document.getElementById('lyricsPage');
	const lyricsBtn = document.getElementById('lyricsBtn');
	let lyricsActive = false;
	let lyricsCurrentSongId = null;
	let lrcLines = [];   // [{time, text}]
	let lyricsIsLRC = false;
	let lastHighlightIdx = -1;

	// ── Parse LRC format ──
	// [mm:ss.xx] hoặc [mm:ss]
	function parseLRC(raw) {
		const lines = raw.split('\n');
		const result = [];
		const re = /\[(\d{2}):(\d{2})(?:[.:](\d+))?\](.*)/;
		for (const line of lines) {
			const m = line.match(re);
			if (m) {
				const min = parseInt(m[1]);
				const sec = parseInt(m[2]);
				const ms = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3)) : 0;
				const time = min * 60 + sec + ms / 1000;
				const text = m[4].trim();
				result.push({ time, text });
			}
		}
		return result.sort((a, b) => a.time - b.time);
	}

	// ── Render LRC lines ──
	function renderLRC(lines) {
		const textEl = document.getElementById('lyricsText');
		textEl.innerHTML = lines.map((l, i) =>
			`<div class="lrc-line" data-idx="${i}">${l.text || '　'}</div>`
		).join('');
	}

	// ── Render plain text lyrics ──
	function renderPlainLyrics(text) {
		const textEl = document.getElementById('lyricsText');
		const escaped = text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
		textEl.innerHTML = `<div class="plain-lyrics">${escaped}</div>`;
	}

	// ── Highlight dòng hiện tại ──
	function highlightLRC(currentTime) {
		if (!lyricsIsLRC || !lrcLines.length) return;

		let idx = 0;
		for (let i = 0; i < lrcLines.length; i++) {
			if (currentTime >= lrcLines[i].time) idx = i;
			else break;
		}

		if (idx === lastHighlightIdx) return;
		lastHighlightIdx = idx;

		const textEl = document.getElementById('lyricsText');
		textEl.querySelectorAll('.lrc-line').forEach((el, i) => {
			el.classList.toggle('lrc-active', i === idx);
			el.classList.toggle('lrc-past', i < idx);
			el.classList.toggle('lrc-upcoming', i > idx);
		});

		// Scroll mainContent để dòng active nằm giữa vùng nhìn thấy
		const activeEl = textEl.querySelector('.lrc-active');
		if (activeEl) {
			const scroller = document.getElementById('mainContent');
			if (scroller) {
				// offsetTop của activeEl tính từ đầu lyricsText,
				// cộng thêm offsetTop của lyricsText trong mainContent
				let offsetInScroller = activeEl.offsetTop;
				let el = activeEl.offsetParent;
				while (el && el !== scroller) {
					offsetInScroller += el.offsetTop;
					el = el.offsetParent;
				}
				const target = offsetInScroller - scroller.clientHeight / 2 + activeEl.clientHeight / 2;
				scroller.scrollTo({ top: target, behavior: 'smooth' });
			}
		}
	}

	function showLyricsPage() {
		homePage.style.display = 'none';
		artistPage.style.display = 'none';
		albumPage.style.display = 'none';
		lyricsPage.style.display = 'block';
		lyricsActive = true;
		lyricsBtn.style.color = 'var(--accent)';
		document.getElementById('mainContent').scrollTop = 0;
	}
	function hideLyricsPage() {
		lyricsPage.style.display = 'none';
		lyricsActive = false;
		lastHighlightIdx = -1;
		lyricsBtn.style.color = '';
	}

	function syncLyricsMeta() {
		const thumbEl = document.getElementById('nowThumb');
		const coverEl = document.getElementById('lyricsCover');
		const img = thumbEl.querySelector('img');
		if (img) {
			coverEl.innerHTML = `<img src="${img.src}" alt="">`;
		} else {
			coverEl.textContent = thumbEl.textContent || '🎵';
		}
		document.getElementById('lyricsSongTitle').textContent = document.getElementById('trackName').textContent || '--';
		document.getElementById('lyricsSongArtist').textContent = document.getElementById('trackArtist').textContent || '--';
	}

	async function loadLyrics(songId) {
		if (!songId) return;
		const textEl = document.getElementById('lyricsText');
		textEl.innerHTML = '<div class="lyrics-loading">Đang tải lời bài hát...</div>';
		lrcLines = [];
		lyricsIsLRC = false;
		lastHighlightIdx = -1;

		try {
			const res = await fetch(`${API}/songs/${songId}/lyrics`);
			const data = await res.json();

			if (!data.lyrics) {
				textEl.innerHTML = '<div class="lyrics-empty">Chưa có lời bài hát cho bài này.</div>';
				return;
			}

			// Detect LRC: có ít nhất 1 dòng [mm:ss...]
			const isLRC = /\[\d{2}:\d{2}/.test(data.lyrics);

			if (isLRC) {
				lrcLines = parseLRC(data.lyrics);
				lyricsIsLRC = true;
				renderLRC(lrcLines);
				// Highlight ngay tại vị trí hiện tại
				highlightLRC(audioPlayer.currentTime || 0);
			} else {
				renderPlainLyrics(data.lyrics);
			}

		} catch (err) {
			textEl.innerHTML = '<div class="lyrics-empty">Không thể tải lời bài hát.</div>';
		}
	}

	// ── Mở / đóng lyrics page ──
	lyricsBtn.addEventListener('click', () => {
		if (lyricsActive) {
			hideLyricsPage();
			showHomePage();
			return;
		}
		showLyricsPage();
		syncLyricsMeta();
		const songId = Queue.current?.id;
		if (songId && songId !== lyricsCurrentSongId) {
			lyricsCurrentSongId = songId;
			loadLyrics(songId);
		}
	});

	// ── Mini progress bar ──
	const lyricsProgressTrack = document.getElementById('lyricsProgressTrack');
	lyricsProgressTrack.addEventListener('click', e => {
		const rect = lyricsProgressTrack.getBoundingClientRect();
		const ratio = (e.clientX - rect.left) / rect.width;
		audioPlayer.currentTime = ratio * (audioPlayer.duration || 0);
	});

	// ── Mini controls ──
	document.getElementById('lyricsPrevBtn').addEventListener('click', () => prevTrack());
	document.getElementById('lyricsNextBtn').addEventListener('click', () => nextTrack());
	document.getElementById('lyricsPlayBtn').addEventListener('click', () => togglePlay());

	// ── Sync progress + LRC highlight theo timeupdate ──
	audioPlayer.addEventListener('timeupdate', () => {
		if (!lyricsActive) return;
		const cur = audioPlayer.currentTime || 0;
		const dur = audioPlayer.duration || 0;
		const pct = dur > 0 ? (cur / dur * 100) : 0;
		document.getElementById('lyricsProgressFill').style.width = pct + '%';
		document.getElementById('lyricsTimeNow').textContent = secondsToMMSS(Math.floor(cur));
		document.getElementById('lyricsTimeEnd').textContent = secondsToMMSS(Math.floor(dur));
		// LRC sync
		if (lyricsIsLRC) highlightLRC(cur);
	});

	// ── Sync play/pause icon ──
	audioPlayer.addEventListener('play', () => {
		if (!lyricsActive) return;
		document.getElementById('lyricsPlayIcon').innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
	});
	audioPlayer.addEventListener('pause', () => {
		if (!lyricsActive) return;
		document.getElementById('lyricsPlayIcon').innerHTML = '<path d="M8 5v14l11-7z"/>';
	});

	/* ══════════════════════════════════════════
				HELPER: togglePlay / prevTrack / nextTrack
				(dùng cho lyrics page controls)
				══════════════════════════════════════════ */
	function togglePlay() {
		if (!Queue.current) return;
		playing = !playing;
		if (playing) {
			audioPlayer.play().catch(() => { });
			playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
			bars.style.opacity = '1';
		} else {
			audioPlayer.pause();
			playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
			bars.style.opacity = '0.3';
		}
	}

	function nextTrack() {
		if (Queue.hasNext || Queue.shuffle) {
			Queue.next();
			loadAndPlay(Queue.current);
			if (lyricsActive) {
				syncLyricsMeta();
				lyricsCurrentSongId = Queue.current?.id;
				loadLyrics(lyricsCurrentSongId);
			}
		}
	}

	function prevTrack() {
		if (audioPlayer.currentTime > 3) {
			audioPlayer.currentTime = 0;
			return;
		}
		if (Queue.hasPrev) {
			Queue.prev();
			loadAndPlay(Queue.current);
			if (lyricsActive) {
				syncLyricsMeta();
				lyricsCurrentSongId = Queue.current?.id;
				loadLyrics(lyricsCurrentSongId);
			}
		}
	}

	/* ── MUTE BUTTON ── */
	const VOL_ICONS = {
		high: `<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>`,
		low: `<path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>`,
		mute: `<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>`,
	};

	const muteBtn = document.getElementById('muteBtn');
	const volIcon = document.getElementById('volIcon');
	let isMuted = false;
	let volumeBeforeMute = 70;

	function updateVolIcon() {
		if (isMuted || volume === 0) {
			volIcon.innerHTML = VOL_ICONS.mute;
			muteBtn.style.color = 'var(--text-dim)';
		} else if (volume < 50) {
			volIcon.innerHTML = VOL_ICONS.low;
			muteBtn.style.color = '';
		} else {
			volIcon.innerHTML = VOL_ICONS.high;
			muteBtn.style.color = '';
		}
	}

	muteBtn.addEventListener('click', () => {
		isMuted = !isMuted;
		if (isMuted) {
			volumeBeforeMute = volume;
			audioPlayer.volume = 0;
			volFill.style.width = '0%';
		} else {
			volume = volumeBeforeMute || 70;
			audioPlayer.volume = volume / 100;
			volFill.style.width = volume + '%';
		}
		updateVolIcon();
	});

	/* ── Init ── */
	updateProgressUI();
	updateVolumeUI();
	updateVolIcon();

	// Load top 10 + danh sách nghệ sĩ lên trang chủ
	loadTop10();
	loadHomeArtists();
	loadRecentAlbums();

	async function loadRecentAlbums() {
		const grid = document.getElementById('recentAlbumsGrid');
		try {
			const res = await fetch(`${API}/albums`);
			const albums = await res.json();

			if (!Array.isArray(albums) || !albums.length) {
				grid.innerHTML = '<div class="col-12" style="color:var(--text-dim);font-size:13px;">Chưa có album.</div>';
				return;
			}

			const gradients = ['grad-1', 'grad-3', 'grad-5', 'grad-6', 'grad-7', 'grad-8', 'grad-9', 'grad-11', 'grad-13', 'grad-14'];

			grid.innerHTML = albums.slice(0, 8).map((al, i) => {
				const grad = gradients[i % gradients.length];
				const year = al.release_date ? al.release_date.substring(0, 4) : '';
				const type = al.type === 'single' ? 'Single' : al.type === 'ep' ? 'EP' : 'Album';

				return `
				<div class="col">
					<div class="music-card" data-album-id="${al.id}">
						<div class="card-thumb-wrap ${grad}">
							${al.cover_url
						? `<img src="${al.cover_url}" alt="${al.title}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`
						: `<div class="card-emoji">💿</div>`}
							<button class="play-btn-overlay">
								<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
							</button>
						</div>
						<div class="card-title">${al.title}</div>
						<div class="card-sub">${type} · ${al.artist_name}${year ? ' · ' + year : ''}</div>
					</div>
				</div>`;
			}).join('');

		} catch (err) {
			console.error('loadRecentAlbums error:', err);
			grid.innerHTML = '<div class="col-12" style="color:var(--text-dim);font-size:13px;">Không thể tải album.</div>';
		}
	}

	async function loadTop10() {
		const list = document.getElementById('top10List');
		try {
			const res = await fetch(`${API}/songs/top?limit=10`);

			// Debug: xem server trả về gì
			console.log('Top10 status:', res.status);
			const songs = await res.json();
			console.log('Top10 data:', songs);

			if (!Array.isArray(songs) || !songs.length) {
				list.innerHTML = '<div style="color:var(--text-dim);padding:12px;">Chưa có dữ liệu. (API trả về rỗng)</div>';
				return;
			}

			const maxPlays = Math.max(...songs.map(s => s.plays_count || 0), 1);

			list.innerHTML = songs.map((s, i) => {
				const isTop3 = i < 3;
				const barWidth = Math.max(10, Math.round((s.plays_count || 0) / maxPlays * 100));
				const rankColor = i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'var(--text-dim)';

				return `
          <div class="top10-row"
            data-song-id="${s.id}"
            data-track="${s.title}"
            data-artist="${s.artist_name || ''}"
            data-emoji="🎵">
            <!-- Rank -->
            <div class="top10-rank" style="color:${rankColor}">
              ${isTop3
						? `<svg viewBox="0 0 24 24" fill="${rankColor}" width="14" height="14" style="margin-bottom:1px"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>`
						: i + 1}
            </div>

            <!-- Thumb -->
            <div class="top10-thumb">
              ${s.album_cover
						? `<img src="${s.album_cover}" alt="" onerror="this.parentElement.textContent='🎵'">`
						: '🎵'}
            </div>

            <!-- Info -->
            <div class="top10-info">
              <div class="top10-title">${s.title}</div>
              <div class="top10-artist">${s.artist_name || ''}</div>
              <!-- Plays bar -->
              <div class="top10-bar-wrap">
                <div class="top10-bar-fill" style="width:${barWidth}%"></div>
              </div>
            </div>

            <!-- Stats -->
            <div class="top10-stats">
              <div class="top10-plays">${formatPlays(s.plays_count)}</div>
              <div class="top10-duration">${secondsToMMSS(s.duration)}</div>
            </div>

            <!-- Play overlay -->
            <div class="top10-play-overlay">
              <svg viewBox="0 0 24 24" fill="#000"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>`;
			}).join('');

			// Click row → phát nhạc
			list.querySelectorAll('.top10-row').forEach((row, i) => {
				row.addEventListener('click', () => {
					const allSongs = songs.map(s => ({
						id: s.id,
						title: s.title,
						artist: s.artist_name || '',
						emoji: '🎵',
					}));
					window.playCollection(allSongs, i);
				});
			});

		} catch (err) {
			list.innerHTML = '<div style="color:var(--text-dim);padding:12px;">Không thể tải dữ liệu.</div>';
			console.error('loadTop10 error:', err);
		}
	}

	function formatPlays(n) {
		if (!n) return '0 lượt';
		if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M lượt';
		if (n >= 1000) return (n / 1000).toFixed(1) + 'K lượt';
		return n + ' lượt';
	}

	async function loadHomeArtists() {
		const grid = document.getElementById('artistsGrid');
		try {
			// Gọi song song cả 2 API
			const [topRes, followRes] = await Promise.all([
				fetch(`${API}/songs/top?limit=10`),
				fetch(`${API}/users/${user.id}/following`, {
					headers: { 'Authorization': `Bearer ${token}` }
				})
			]);

			const topJson = await topRes.json();
			const topSongs = Array.isArray(topJson) ? topJson : [];
			const followedRaw = followRes.ok ? await followRes.json() : [];

			// Map followed artists
			const followedArtists = followedRaw.map(a => ({
				id: a.id,
				name: a.name,
				avatar: a.avatar_url,
				followed: true,
			}));

			// Lấy unique artist từ top 10 songs
			const seen = new Set(followedArtists.map(a => String(a.id)));
			const topArtists = [];
			topSongs.forEach(s => {
				if (!seen.has(String(s.artist_id))) {
					seen.add(String(s.artist_id));
					topArtists.push({
						id: s.artist_id,
						name: s.artist_name,
						avatar: s.artist_avatar,
						followed: false,
					});
				}
			});

			// Merge: followed trước, top sau
			const artists = [...followedArtists, ...topArtists];

			if (!artists.length) {
				grid.innerHTML = '<div class="col-12" style="color:var(--text-dim);font-size:13px;text-align:center;">Chưa có nghệ sĩ.</div>';
				return;
			}

			grid.innerHTML = artists.slice(0, 12).map(a => `
        <div class="col">
          <div class="artist-card" data-artist-id="${a.id}">
            <div class="artist-card-avatar">
              ${a.avatar
					? `<img src="${a.avatar}" alt="${a.name}" onerror="this.parentElement.textContent='🎤'">`
					: '🎤'}
            </div>
            <div class="artist-card-name">${a.name}</div>
            <div class="artist-card-label" style="${a.followed ? 'color:var(--accent)' : ''}">
              ${a.followed ? '✓ Đang theo dõi' : 'Nghệ sĩ'}
            </div>
          </div>
        </div>`).join('');

		} catch (err) {
			console.error('loadHomeArtists error:', err);
			grid.innerHTML = '<div class="col-12" style="color:var(--text-dim);font-size:13px;text-align:center;">Không thể tải nghệ sĩ.</div>';
		}
	}

	/* ══════════════════════════════════════════
				PLAYLIST SYSTEM
				══════════════════════════════════════════ */

	const playlistPage = document.getElementById('playlistPage');
	let currentPlaylists = [];
	let currentPlaylistId = null;

	// ── Show/hide page ──
	function showPlaylistPage() {
		homePage.style.display = 'none';
		artistPage.style.display = 'none';
		albumPage.style.display = 'none';
		lyricsPage.style.display = 'none';
		playlistPage.style.display = 'block';
		document.getElementById('mainContent').scrollTop = 0;
	}
	function hidePlaylistPage() {
		playlistPage.style.display = 'none';
	}

	// ── Load danh sách playlist vào sidebar ──
	async function loadLibrary() {
		try {
			const res = await fetch(`${API}/playlists/user/${user.id}`, {
				headers: { 'Authorization': `Bearer ${token}` }
			});
			currentPlaylists = await res.json();
			renderLibrary();
		} catch { }
	}

	function renderLibrary() {
		const el = document.getElementById('libraryList');
		if (!currentPlaylists.length) {
			el.innerHTML = `
				<div style="padding:16px;font-size:13px;color:var(--text-dim);text-align:center;">
					Chưa có playlist nào.<br>
					<span style="color:var(--accent);cursor:pointer;" onclick="openPlModal()">Tạo playlist mới</span>
				</div>`;
			return;
		}
		el.innerHTML = currentPlaylists.map(pl => `
			<div class="lib-item" data-playlist-id="${pl.id}">
				<div class="lib-thumb" style="background:#282828;border-radius:6px;overflow:hidden;">
					${pl.cover_url
				? `<img src="${pl.cover_url}" style="width:100%;height:100%;object-fit:cover;">`
				: '🎵'}
				</div>
				<div class="overflow-hidden">
					<div class="lib-name">${pl.name}</div>
					<div class="lib-meta">Danh sách phát · ${pl.total_songs || 0} bài</div>
				</div>
			</div>`).join('');

		// Click vào playlist trong sidebar
		el.querySelectorAll('.lib-item[data-playlist-id]').forEach(item => {
			item.addEventListener('click', () => {
				openPlaylistPage(item.dataset.playlistId);
			});
		});
	}

	// ── Mở playlist page ──
	async function openPlaylistPage(playlistId) {
		currentPlaylistId = playlistId;
		showPlaylistPage();

		document.getElementById('plTitle').textContent = 'Đang tải...';
		document.getElementById('plSongList').innerHTML = '';

		try {
			const res = await fetch(`${API}/playlists/${playlistId}`, {
				headers: { 'Authorization': `Bearer ${token}` }
			});
			const pl = await res.json();
			if (!pl || !pl.id) throw new Error('Không tìm thấy playlist');

			// Hero
			const coverEl = document.getElementById('plCover');
			const heroBgEl = document.getElementById('plHeroBg');
			if (pl.cover_url) {
				coverEl.innerHTML = `<img class="pl-cover-img" src="${pl.cover_url}">`;
				heroBgEl.style.backgroundImage = `url(${pl.cover_url})`;
			} else {
				coverEl.textContent = '🎵';
				heroBgEl.style.background = 'linear-gradient(135deg,#1a1a2e,#0a0a0a)';
			}

			document.getElementById('plTitle').textContent = pl.name;
			document.getElementById('plUserName').textContent = user.username;

			const songs = pl.songs || [];
			const totalSec = songs.reduce((s, x) => s + (x.duration || 0), 0);
			document.getElementById('plStats').innerHTML =
				`<span>${songs.length} bài hát</span><span>${formatTotalDuration(totalSec)}</span>`;

			// Song list
			document.getElementById('plSongList').innerHTML = songs.length
				? songs.map((s, i) => {
					const isPlaying = Queue.current && Queue.current.id == s.id;
					const added = s.added_at ? new Date(s.added_at).toLocaleDateString('vi-VN') : '';
					return `
						<div class="pl-song-row ${isPlaying ? 'playing' : ''}" data-idx="${i}" data-song-id="${s.id}">
							<div class="album-song-num">
								${isPlaying
							? '<svg viewBox="0 0 24 24" fill="#1db954" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>'
							: i + 1}
							</div>
							<div class="album-song-thumb" style="width:40px;height:40px;border-radius:4px;overflow:hidden;background:#282828;display:flex;align-items:center;justify-content:center;font-size:18px;">
								${s.album_cover ? `<img src="${s.album_cover}" style="width:100%;height:100%;object-fit:cover;">` : '🎵'}
							</div>
							<div>
								<div class="album-song-title">${s.title}</div>
								<div class="album-song-artist">${s.artist_name || ''}</div>
							</div>
							<div class="album-song-plays" style="font-size:12px;color:var(--text-dim);">${added}</div>
							<div class="album-song-dur">${secondsToMMSS(s.duration)}</div>
							<button class="pl-remove-btn" title="Xóa khỏi playlist"
								onclick="event.stopPropagation(); removeFromPlaylist(${playlistId}, ${s.id})">✕</button>
						</div>`;
				}).join('')
				: '<div style="padding:40px;text-align:center;color:var(--text-dim);">Chưa có bài hát. Tìm và thêm bài vào playlist!</div>';

			document.getElementById('plFooter').innerHTML =
				songs.length ? `${songs.length} bài hát · <strong>${formatTotalDuration(totalSec)}</strong>` : '';

			// Play All
			document.getElementById('plPlayAllBtn').onclick = () => {
				if (!songs.length) return;
				const list = songs.map(s => ({
					id: s.id, title: s.title, artist: s.artist_name || '',
					emoji: '🎵', album_id: s.album_id || '', artist_id: s.artist_id || '',
				}));
				window.playCollection(list, 0);
			};

			// Click từng bài
			document.querySelectorAll('#plSongList .pl-song-row').forEach(row => {
				row.addEventListener('click', () => {
					const idx = parseInt(row.dataset.idx);
					const list = songs.map(s => ({
						id: s.id, title: s.title, artist: s.artist_name || '',
						emoji: '🎵', album_id: s.album_id || '', artist_id: s.artist_id || '',
					}));
					window.playCollection(list, idx);
				});
			});

			// Sửa playlist
			document.getElementById('plEditBtn').onclick = () => openPlModal(pl);

			// Xóa playlist
			document.getElementById('plDeleteBtn').onclick = async () => {
				if (!confirm(`Xóa playlist "${pl.name}"?`)) return;
				try {
					await fetch(`${API}/playlists/${playlistId}`, {
						method: 'DELETE',
						headers: { 'Authorization': `Bearer ${token}` }
					});
					hidePlaylistPage();
					showHomePage();
					loadLibrary();
				} catch { }
			};

		} catch (err) {
			document.getElementById('plTitle').textContent = 'Lỗi tải playlist';
			console.error('openPlaylistPage:', err);
		}
	}

	// Click sidebar playlist
	document.addEventListener('click', e => {
		const plLink = e.target.closest('[data-playlist-id]');
		if (plLink && !e.target.closest('#addToPlMenu')) {
			e.preventDefault();
			openPlaylistPage(plLink.dataset.playlistId);
		}
	});

	// Back button cho playlist page
	document.querySelectorAll('.btn-nav').forEach((btn, i) => {
		if (i === 0) {
			btn.addEventListener('click', () => {
				if (playlistPage.style.display !== 'none') {
					hidePlaylistPage();
					showHomePage();
				}
			});
		}
	});

	// ── Xóa bài khỏi playlist ──
	async function removeFromPlaylist(playlistId, songId) {
		try {
			await fetch(`${API}/playlists/${playlistId}/songs/${songId}`, {
				method: 'DELETE',
				headers: { 'Authorization': `Bearer ${token}` }
			});
			openPlaylistPage(playlistId); // reload
			loadLibrary();
		} catch { }
	}

	// ── Create/Edit Modal ──
	let plModalMode = 'create'; // 'create' | 'edit'
	let plModalEditId = null;
	let plCoverTimer = null;

	window.openPlModal = function (pl = null) {
		plModalMode = pl ? 'edit' : 'create';
		plModalEditId = pl ? pl.id : null;

		document.getElementById('plModalTitle').textContent = pl ? 'Sửa playlist' : 'Tạo playlist mới';
		document.getElementById('plModalName').value = pl?.name || '';
		document.getElementById('plModalCover').value = pl?.cover_url || '';

		// Reset cover preview
		document.getElementById('plModalCoverPreview').innerHTML = '🎵';
		document.getElementById('plModalCoverStatus').textContent = '';
		if (pl?.cover_url) updatePlModalCover(pl.cover_url);

		document.getElementById('plModal').style.display = 'flex';
		setTimeout(() => document.getElementById('plModalName').focus(), 100);
	};

	window.closePlModal = function () {
		document.getElementById('plModal').style.display = 'none';
	};

	document.getElementById('plModal').addEventListener('click', e => {
		if (e.target === e.currentTarget) window.closePlModal();
	});
	document.getElementById('plModalName').addEventListener('keydown', e => {
		if (e.key === 'Enter') window.savePlModal();
	});

	window.updatePlModalCover = function (url) {
		const preview = document.getElementById('plModalCoverPreview');
		const statusEl = document.getElementById('plModalCoverStatus');
		if (!url.trim()) { preview.innerHTML = '🎵'; statusEl.textContent = ''; return; }
		clearTimeout(plCoverTimer);
		plCoverTimer = setTimeout(() => {
			const img = new Image();
			img.onload = () => {
				preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;
				statusEl.innerHTML = '<span style="color:#1db954;font-size:12px;">✅ Ảnh hợp lệ</span>';
			};
			img.onerror = () => {
				preview.innerHTML = '❌';
				statusEl.innerHTML = '<span style="color:#e53935;font-size:12px;">❌ Không tải được ảnh</span>';
			};
			img.src = url;
		}, 500);
	};

	window.savePlModal = async function () {
		const name = document.getElementById('plModalName').value.trim();
		const cover_url = document.getElementById('plModalCover').value.trim() || null;
		if (!name) { document.getElementById('plModalName').focus(); return; }

		const btn = document.getElementById('plModalSaveBtn');
		btn.disabled = true;

		try {
			if (plModalMode === 'create') {
				const res = await fetch(`${API}/playlists`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
					body: JSON.stringify({ name, cover_url, isPublic: true }),
				});
				const data = await res.json();
				if (res.ok) {
					window.closePlModal();
					await loadLibrary();
					openPlaylistPage(data.id);
				}
			} else {
				await fetch(`${API}/playlists/${plModalEditId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
					body: JSON.stringify({ name, cover_url }),
				});
				window.closePlModal();
				await loadLibrary();
				openPlaylistPage(plModalEditId);
			}
		} catch { }
		finally { btn.disabled = false; }
	};

	// ── Nút + tạo playlist trong sidebar ──
	document.getElementById('createPlaylistBtn').addEventListener('click', () => {
		window.openPlModal();
	});

	// ── Add to Playlist context menu ──
	const addToPlMenu = document.getElementById('addToPlMenu');
	let addToPlSongId = null;

	window.showAddToPlMenu = function (e, songId, songTitle) {
		addToPlSongId = songId;
		e.stopPropagation();

		// Build menu
		const list = document.getElementById('addToPlList');
		if (!currentPlaylists.length) {
			list.innerHTML = `
				<div class="add-to-pl-item" onclick="openPlModal(); hideAddToPlMenu();">
					<span>＋</span> Tạo playlist mới
				</div>`;
		} else {
			list.innerHTML = currentPlaylists.map(pl => `
				<div class="add-to-pl-item" onclick="addSongToPlaylist(${pl.id}, ${songId}); hideAddToPlMenu();">
					<div class="add-to-pl-item-thumb">
						${pl.cover_url ? `<img src="${pl.cover_url}">` : '🎵'}
					</div>
					${pl.name}
				</div>`).join('') + `
				<div class="add-to-pl-item" style="border-top:1px solid #3a3a3a;margin-top:4px;"
					onclick="openPlModal(); hideAddToPlMenu();">
					<span>＋</span> Tạo playlist mới
				</div>`;
		}

		// Position
		const rect = document.getElementById('mainContent').getBoundingClientRect();
		addToPlMenu.style.display = 'block';
		let top = e.clientY;
		let left = e.clientX;
		if (left + 240 > window.innerWidth) left = window.innerWidth - 250;
		if (top + 300 > window.innerHeight) top = top - 200;
		addToPlMenu.style.top = top + 'px';
		addToPlMenu.style.left = left + 'px';
	};

	window.hideAddToPlMenu = function () {
		addToPlMenu.style.display = 'none';
	};

	document.addEventListener('click', e => {
		if (!addToPlMenu.contains(e.target)) hideAddToPlMenu();
	});

	async function addSongToPlaylist(playlistId, songId) {
		try {
			const res = await fetch(`${API}/playlists/${playlistId}/songs`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
				body: JSON.stringify({ songId }),
			});
			const data = await res.json();
			if (res.ok) {
				// Flash thông báo nhỏ
				const pl = currentPlaylists.find(p => p.id == playlistId);
				showMiniToast(`✅ Đã thêm vào "${pl?.name || 'playlist'}"`);
				loadLibrary();
				// Nếu đang xem playlist đó thì reload
				if (currentPlaylistId == playlistId) openPlaylistPage(playlistId);
			} else {
				showMiniToast('❌ ' + (data.error || 'Lỗi'));
			}
		} catch { }
	}

	// Mini toast (nhỏ gọn, không che giao diện)
	function showMiniToast(msg) {
		let el = document.getElementById('miniToast');
		if (!el) {
			el = document.createElement('div');
			el.id = 'miniToast';
			el.style.cssText = `position:fixed;bottom:110px;left:50%;transform:translateX(-50%);
				background:#282828;border:1px solid #3a3a3a;border-radius:50px;
				padding:10px 20px;font-size:13px;font-weight:700;color:#fff;
				z-index:9999;opacity:0;transition:opacity 0.2s;pointer-events:none;
				font-family:'Nunito',sans-serif;`;
			document.body.appendChild(el);
		}
		el.textContent = msg;
		el.style.opacity = '1';
		clearTimeout(el._timer);
		el._timer = setTimeout(() => { el.style.opacity = '0'; }, 2500);
	}

	// Load library khi khởi động
	loadLibrary();

}); // end DOMContentLoaded