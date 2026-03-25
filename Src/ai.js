// =============================================
//  Src/ai.js
//  HuggingFace Embedding + Cosine Similarity
//  Model: sentence-transformers/all-MiniLM-L6-v2
//  Cài: không cần cài thêm gì (dùng fetch có sẵn)
// =============================================

const HF_API_URL = 'https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction';
const HF_TOKEN = process.env.HF_TOKEN || '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'; // thêm vào .env: HF_TOKEN=hf_xxxx

// ── Gọi HuggingFace để lấy embedding vector ──
async function getEmbedding(text) {
	if (!text || !text.trim()) return null;

	const res = await fetch(HF_API_URL, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${HF_TOKEN}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ inputs: text.trim().slice(0, 512) }), // giới hạn 512 ký tự
	});

	if (!res.ok) {
		const err = await res.text();
		throw new Error(`HuggingFace API error: ${res.status} — ${err}`);
	}

	const data = await res.json();

	// Model trả về [[v1, v2, ...]] hoặc [v1, v2, ...]
	return Array.isArray(data[0]) ? data[0] : data;
}

// ── Tính cosine similarity giữa 2 vector ──
function cosineSimilarity(a, b) {
	if (!a || !b || a.length !== b.length) return 0;
	let dot = 0, normA = 0, normB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	if (normA === 0 || normB === 0) return 0;
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Tạo text đại diện cho 1 bài hát để embed ──
// Kết hợp title + artist + genres + lyrics (200 ký tự đầu)
function buildSongText(song) {
	const parts = [
		song.title || '',
		song.artist_name || '',
		song.genres || '',
		song.mood || '',
		(song.lyrics || '').slice(0, 200),
	];
	return parts.filter(Boolean).join('. ');
}

module.exports = { getEmbedding, cosineSimilarity, buildSongText };