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
	let progress = 35; // percent
	let volume = 70; // percent
	let progressInterval;

	const playBtn = document.getElementById('playBtn');
	const playIcon = document.getElementById('playIcon');
	const bars = document.getElementById('playingBars');
	const progFill = document.getElementById('progressFill');
	const timeNow = document.getElementById('timeNow');
	const trackName = document.getElementById('trackName');
	const trackArtist = document.getElementById('trackArtist');
	const nowThumb = document.getElementById('nowThumb');

	/* Total track duration in seconds (mock) */
	const DURATION = 238;

	function secondsToMMSS(s) {
		const m = Math.floor(s / 60);
		const sec = Math.floor(s % 60);
		return `${m}:${sec.toString().padStart(2, '0')}`;
	}

	function updateProgressUI() {
		progFill.style.width = progress + '%';
		const elapsed = Math.floor((progress / 100) * DURATION);
		timeNow.textContent = secondsToMMSS(elapsed);
	}

	function startProgress() {
		clearInterval(progressInterval);
		progressInterval = setInterval(() => {
			if (playing) {
				progress = Math.min(100, progress + (100 / DURATION / 10));
				updateProgressUI();
				if (progress >= 100) { stopProgress(); }
			}
		}, 100);
	}

	function stopProgress() {
		clearInterval(progressInterval);
		playing = false;
		playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
		bars.style.opacity = '0.3';
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

	/* ── Progress bar click ── */
	document.getElementById('progressTrack').addEventListener('click', e => {
		const rect = e.currentTarget.getBoundingClientRect();
		progress = ((e.clientX - rect.left) / rect.width) * 100;
		progress = Math.max(0, Math.min(100, progress));
		updateProgressUI();
	});

	/* ── Volume bar click ── */
	document.getElementById('volTrack').addEventListener('click', e => {
		const rect = e.currentTarget.getBoundingClientRect();
		volume = ((e.clientX - rect.left) / rect.width) * 100;
		volume = Math.max(0, Math.min(100, volume));
		document.getElementById('volFill').style.width = volume + '%';
	});

	/* ── Click card to "play" that track ── */
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
			const name = el.dataset.track;
			const artist = el.dataset.artist || 'SoundWave';
			const emoji = el.dataset.emoji || '🎵';
			playTrack(name, artist, emoji);
		});
	});

	/* ── Skip buttons ── */
	document.getElementById('nextBtn').addEventListener('click', () => {
		progress = 0;
		updateProgressUI();
	});

	document.getElementById('prevBtn').addEventListener('click', () => {
		progress = 0;
		updateProgressUI();
	});

	/* ── Shuffle / Repeat button highlight ── */
	['shuffleBtn', 'repeatBtn'].forEach(id => {
		document.getElementById(id).addEventListener('click', () => {
			const btn = document.getElementById(id);
			const isActive = btn.style.color === 'rgb(29, 185, 84)';
			btn.style.color = isActive ? '' : '#1db954';
		});
	});

	/* ── Initial UI ── */
	updateProgressUI();
});