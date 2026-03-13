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
				}));
				window.playCollection(songs, 0);
			};

			// ── Click song row → phát ──
			document.querySelectorAll('#artistTopSongs .song-row, #artistAllSongs .song-row').forEach(row => {
				row.addEventListener('click', () => {
					const idx = parseInt(row.dataset.idx);
					const songs = allSongs.map(s => ({
						id: s.id,
						title: s.title,
						artist: artist.name,
						emoji: '🎵',
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

}); // end DOMContentLoaded