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

	/* ── Init ── */
	updateProgressUI();
	updateVolumeUI();

	// Load danh sách nghệ sĩ lên trang chủ
	loadHomeArtists();

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

			const topSongs = await topRes.json();
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