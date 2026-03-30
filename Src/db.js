// =============================================
//  SoundWave - db.js
//  Kết nối MySQL + tất cả hàm truy vấn
//  Cài đặt: npm install mysql2
// =============================================

const mysql = require('mysql2/promise');

// ─────────────────────────────────────────────
// KẾT NỐI DATABASE
// ─────────────────────────────────────────────
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'spotifi',
  waitForConnections: true,
  connectionLimit: 10,
});

// Helper: chạy query
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// ─────────────────────────────────────────────
// SONGS
// ─────────────────────────────────────────────

// Lấy tất cả bài hát
async function getAllSongs() {
  return query(`
    SELECT
      s.id, s.title, s.duration, s.plays_count,
      s.file_url, s.cover_url, s.is_explicit,
      a.id   AS artist_id,
      a.name AS artist_name,
      al.id        AS album_id,
      al.title     AS album_title,
      al.cover_url AS album_cover
    FROM songs s
    JOIN artists a       ON s.artist_id = a.id
    LEFT JOIN albums al  ON s.album_id  = al.id
    ORDER BY s.plays_count DESC
  `);
}

// Lấy 1 bài hát theo id
async function getSongById(songId) {
  const rows = await query(`
    SELECT
      s.id, s.title, s.duration, s.file_url,
      s.cover_url, s.plays_count, s.is_explicit,
      s.lyrics,
      a.id   AS artist_id,
      a.name AS artist_name,
      al.id        AS album_id,
      al.title     AS album_title,
      al.cover_url AS album_cover,
      GROUP_CONCAT(g.name SEPARATOR ', ') AS genres
    FROM songs s
    JOIN artists a       ON s.artist_id = a.id
    LEFT JOIN albums al  ON s.album_id  = al.id
    LEFT JOIN song_genres sg ON s.id    = sg.song_id
    LEFT JOIN genres g   ON sg.genre_id = g.id
    WHERE s.id = ?
    GROUP BY s.id
  `, [songId]);
  return rows[0] || null;
}

// Tăng lượt nghe
async function incrementPlays(songId) {
  return query(
    'UPDATE songs SET plays_count = plays_count + 1 WHERE id = ?',
    [songId]
  );
}

// Top 10 bài nghe nhiều nhất (kể cả plays_count = 0)
async function getTopSongs(limit = 10) {
  const safeLimit = parseInt(limit, 10) || 10; // đảm bảo luôn là integer
  return query(`
    SELECT
      s.id, s.title, s.duration,
      COALESCE(s.plays_count, 0) AS plays_count,
      a.id         AS artist_id,
      a.name       AS artist_name,
      a.avatar_url AS artist_avatar,
      al.id        AS album_id,
      al.title     AS album_title,
      al.cover_url AS album_cover
    FROM songs s
    JOIN artists a      ON s.artist_id = a.id
    LEFT JOIN albums al ON s.album_id  = al.id
    ORDER BY plays_count DESC, s.id ASC
    LIMIT ${safeLimit}
  `);
}

// Tìm kiếm bài hát / nghệ sĩ / album
async function search(keyword) {
  const kw = `%${keyword}%`;
  return query(`
    SELECT 'song' AS type, s.id, s.title AS name,
           a.name AS artist, al.cover_url AS image
    FROM songs s
    JOIN artists a ON s.artist_id = a.id
    LEFT JOIN albums al ON s.album_id = al.id
    WHERE s.title LIKE ?

    UNION ALL

    SELECT 'artist', a.id, a.name, '' AS artist, a.avatar_url
    FROM artists a
    WHERE a.name LIKE ?

    UNION ALL

    SELECT 'album', al.id, al.title, a.name, al.cover_url
    FROM albums al
    JOIN artists a ON al.artist_id = a.id
    WHERE al.title LIKE ?
  `, [kw, kw, kw]);
}

// ─────────────────────────────────────────────
// ALBUMS
// ─────────────────────────────────────────────

// Lấy tất cả album
async function getAllAlbums() {
  return query(`
    SELECT al.id, al.title, al.cover_url, al.release_date, al.type,
           a.id   AS artist_id,
           a.name AS artist_name
    FROM albums al
    JOIN artists a ON al.artist_id = a.id
    ORDER BY al.release_date DESC
  `);
}

// Lấy album theo id + danh sách bài hát
async function getAlbumById(albumId) {
  const album = await query(`
    SELECT al.*, a.id AS artist_id, a.name AS artist_name, a.avatar_url AS artist_avatar
    FROM albums al
    JOIN artists a ON al.artist_id = a.id
    WHERE al.id = ?
  `, [albumId]);

  const songs = await query(`
    SELECT s.id, s.title, s.duration,
           s.track_number, s.plays_count, s.file_url
    FROM songs s
    WHERE s.album_id = ?
    ORDER BY s.track_number
  `, [albumId]);

  return { ...album[0], songs };
}

// ─────────────────────────────────────────────
// ARTISTS
// ─────────────────────────────────────────────

// Lấy nghệ sĩ theo id + tất cả bài hát
async function getArtistById(artistId) {
  const artist = await query(
    'SELECT id, name, bio, avatar_url, country, verified FROM artists WHERE id = ?',
    [artistId]
  );

  const songs = await query(`
    SELECT s.id, s.title, s.duration, s.plays_count,
           s.file_url,
           a.name       AS artist_name,
           al.title     AS album_title,
           al.cover_url AS album_cover
    FROM songs s
    JOIN artists a      ON s.artist_id = a.id
    LEFT JOIN albums al ON s.album_id  = al.id
    WHERE s.artist_id = ?
    ORDER BY al.release_date DESC, s.track_number
  `, [artistId]);

  const albums = await query(`
    SELECT id, title, cover_url, release_date, type
    FROM albums
    WHERE artist_id = ?
    ORDER BY release_date DESC
  `, [artistId]);

  return { ...artist[0], songs, albums };
}

// ─────────────────────────────────────────────
// PLAYLISTS
// ─────────────────────────────────────────────

// Lấy tất cả playlist của user
async function getUserPlaylists(userId) {
  return query(`
    SELECT
      p.id, p.name, p.cover_url, p.is_public, p.created_at,
      COUNT(ps.song_id) AS total_songs
    FROM playlists p
    LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  `, [userId]);
}

// Lấy 1 playlist + danh sách bài hát
async function getPlaylistById(playlistId) {
  const playlist = await query(
    'SELECT * FROM playlists WHERE id = ?',
    [playlistId]
  );

  const songs = await query(`
    SELECT
      s.id, s.title, s.duration, s.file_url,
      a.name       AS artist_name,
      al.cover_url AS album_cover,
      ps.position, ps.added_at
    FROM playlist_songs ps
    JOIN songs   s  ON ps.song_id  = s.id
    JOIN artists a  ON s.artist_id = a.id
    LEFT JOIN albums al ON s.album_id = al.id
    WHERE ps.playlist_id = ?
    ORDER BY ps.position
  `, [playlistId]);

  return { ...playlist[0], songs };
}

// Tạo playlist mới
async function createPlaylist(userId, name, isPublic = true) {
  const result = await query(
    'INSERT INTO playlists (user_id, name, is_public) VALUES (?, ?, ?)',
    [userId, name, isPublic]
  );
  return result.insertId;
}

// Thêm bài hát vào playlist
async function addSongToPlaylist(playlistId, songId) {
  // Tìm position tiếp theo
  const rows = await query(
    'SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM playlist_songs WHERE playlist_id = ?',
    [playlistId]
  );
  const position = rows[0].next_pos;

  return query(
    'INSERT IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)',
    [playlistId, songId, position]
  );
}

// Xóa bài hát khỏi playlist
async function removeSongFromPlaylist(playlistId, songId) {
  return query(
    'DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?',
    [playlistId, songId]
  );
}

// ─────────────────────────────────────────────
// LIKED SONGS
// ─────────────────────────────────────────────

// Lấy bài hát đã thích của user
async function getLikedSongs(userId) {
  return query(`
    SELECT
      s.id, s.title, s.duration, s.file_url,
      a.name       AS artist_name,
      al.cover_url AS album_cover,
      ls.liked_at
    FROM liked_songs ls
    JOIN songs   s  ON ls.song_id  = s.id
    JOIN artists a  ON s.artist_id = a.id
    LEFT JOIN albums al ON s.album_id = al.id
    WHERE ls.user_id = ?
    ORDER BY ls.liked_at DESC
  `, [userId]);
}

// Thích / bỏ thích bài hát
async function toggleLikeSong(userId, songId) {
  const exists = await query(
    'SELECT 1 FROM liked_songs WHERE user_id = ? AND song_id = ?',
    [userId, songId]
  );

  if (exists.length > 0) {
    await query(
      'DELETE FROM liked_songs WHERE user_id = ? AND song_id = ?',
      [userId, songId]
    );
    return { liked: false };
  } else {
    await query(
      'INSERT INTO liked_songs (user_id, song_id) VALUES (?, ?)',
      [userId, songId]
    );
    return { liked: true };
  }
}

// Kiểm tra user đã thích bài chưa
async function isSongLiked(userId, songId) {
  const rows = await query(
    'SELECT 1 FROM liked_songs WHERE user_id = ? AND song_id = ?',
    [userId, songId]
  );
  return rows.length > 0;
}

// ─────────────────────────────────────────────
// PLAY HISTORY
// ─────────────────────────────────────────────

// Lấy lịch sử nghe của user
async function getPlayHistory(userId, limit = 20) {
  const safeLimit = parseInt(limit, 10) || 20;
  return query(`
    SELECT
      ph.id, ph.played_at,
      s.id    AS song_id,
      s.title AS song_title,
      s.duration,
      a.name  AS artist_name,
      al.cover_url AS album_cover
    FROM play_history ph
    JOIN songs   s  ON ph.song_id  = s.id
    JOIN artists a  ON s.artist_id = a.id
    LEFT JOIN albums al ON s.album_id = al.id
    WHERE ph.user_id = ?
    ORDER BY ph.played_at DESC
    LIMIT ${safeLimit}
  `, [userId]);
}

// Ghi lại lượt nghe
async function recordPlay(userId, songId) {
  await query(
    'INSERT INTO play_history (user_id, song_id) VALUES (?, ?)',
    [userId, songId]
  );
  await incrementPlays(songId);
}

// ─────────────────────────────────────────────
// FOLLOWED ARTISTS
// ─────────────────────────────────────────────

// Lấy nghệ sĩ đang follow
async function getFollowedArtists(userId) {
  return query(`
    SELECT
      a.id, a.name, a.avatar_url, a.verified,
      fa.followed_at
    FROM followed_artists fa
    JOIN artists a ON fa.artist_id = a.id
    WHERE fa.user_id = ?
    ORDER BY fa.followed_at DESC
  `, [userId]);
}

// Follow / unfollow nghệ sĩ
async function toggleFollowArtist(userId, artistId) {
  const exists = await query(
    'SELECT 1 FROM followed_artists WHERE user_id = ? AND artist_id = ?',
    [userId, artistId]
  );

  if (exists.length > 0) {
    await query(
      'DELETE FROM followed_artists WHERE user_id = ? AND artist_id = ?',
      [userId, artistId]
    );
    return { following: false };
  } else {
    await query(
      'INSERT INTO followed_artists (user_id, artist_id) VALUES (?, ?)',
      [userId, artistId]
    );
    return { following: true };
  }
}

// ─────────────────────────────────────────────
// GỢI Ý BÀI HÁT
// ─────────────────────────────────────────────

// Đề xuất dựa trên thể loại hay nghe
async function getRecommendations(userId, limit = 20) {
  const safeLimit = parseInt(limit, 10) || 20;
  return query(`
    SELECT DISTINCT
      s.id, s.title, s.duration,
      a.name       AS artist_name,
      al.cover_url AS album_cover,
      s.plays_count
    FROM songs s
    JOIN artists     a  ON s.artist_id  = a.id
    JOIN song_genres sg ON s.id         = sg.song_id
    LEFT JOIN albums al ON s.album_id   = al.id
    WHERE sg.genre_id IN (
      SELECT sg2.genre_id
      FROM play_history ph
      JOIN song_genres sg2 ON ph.song_id = sg2.song_id
      WHERE ph.user_id = ?
      GROUP BY sg2.genre_id
      ORDER BY COUNT(*) DESC
      LIMIT 3
    )
    AND s.id NOT IN (
      SELECT song_id FROM play_history WHERE user_id = ?
    )
    ORDER BY s.plays_count DESC
    LIMIT ${safeLimit}
  `, [userId, userId]);
}

// ─────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────

// Lấy thông tin user + subscription
async function getUserById(userId) {
  const rows = await query(`
    SELECT
      u.id, u.username, u.email,
      u.avatar_url, u.country, u.birthday,
      s.plan, s.expires_at,
      CASE
        WHEN s.plan = 'free' OR s.expires_at IS NULL THEN 'free'
        WHEN s.expires_at > NOW() THEN 'active'
        ELSE 'expired'
      END AS subscription_status
    FROM users u
    LEFT JOIN subscriptions s ON u.id = s.user_id
    WHERE u.id = ?
  `, [userId]);
  return rows[0] || null;
}

// ─────────────────────────────────────────────
// GENRES
// ─────────────────────────────────────────────

// Lấy bài hát theo thể loại
async function getSongsByGenre(genreName, limit = 50) {
  const safeLimit = parseInt(limit, 10) || 50;
  return query(`
    SELECT
      s.id, s.title, s.duration, s.plays_count,
      a.name       AS artist_name,
      al.cover_url AS album_cover,
      g.name       AS genre
    FROM songs s
    JOIN artists     a  ON s.artist_id  = a.id
    JOIN song_genres sg ON s.id         = sg.song_id
    JOIN genres      g  ON sg.genre_id  = g.id
    LEFT JOIN albums al ON s.album_id   = al.id
    WHERE g.name = ?
    ORDER BY s.plays_count DESC
    LIMIT ${safeLimit}
  `, [genreName]);
}

// ─────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────
module.exports = {
  // Songs
  getAllSongs,
  getSongById,
  incrementPlays,
  getTopSongs,
  search,

  // Albums
  getAllAlbums,
  getAlbumById,

  // Artists
  getArtistById,

  // Playlists
  getUserPlaylists,
  getPlaylistById,
  createPlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,

  // Liked songs
  getLikedSongs,
  toggleLikeSong,
  isSongLiked,

  // Play history
  getPlayHistory,
  recordPlay,

  // Followed artists
  getFollowedArtists,
  toggleFollowArtist,

  // Recommendations
  getRecommendations,

  // Users
  getUserById,

  // Genres
  getSongsByGenre,

  // Raw query (dùng cho auth)
  query,
};