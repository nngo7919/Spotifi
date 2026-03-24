// =============================================
//  Src/ai.js (FIXED + OPTIMIZED)
// =============================================

const HF_API_URL =
	"https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2";

// ❗ KHÔNG hardcode token nữa
const HF_TOKEN = process.env.HF_TOKEN;
console.log("HF_TOKEN =", process.env.HF_TOKEN);

// ── Gọi HuggingFace để lấy embedding vector ──
async function getEmbedding(text) {
	if (!text || !text.trim()) return null;

	try {
		const res = await fetch(HF_API_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${HF_TOKEN}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				inputs: text.trim().slice(0, 512),

				// 🔥 ép model chạy đúng + tránh lỗi load
				options: {
					wait_for_model: true,
				},
			}),
		});

		if (!res.ok) {
			const err = await res.text();
			throw new Error(`HF API ${res.status}: ${err}`);
		}

		const data = await res.json();

		// 🔥 FIX: đảm bảo luôn trả về vector 1 chiều
		if (Array.isArray(data)) {
			// case: [[...]]
			if (Array.isArray(data[0])) return data[0];

			// case: [...]
			return data;
		}

		throw new Error("Invalid embedding format");
	} catch (err) {
		console.error("[EMBED ERROR]", err.message);
		return null; // ❗ fallback để không crash hệ thống
	}
}

// ── Tính cosine similarity giữa 2 vector ──
function cosineSimilarity(a, b) {
	if (!a || !b || a.length !== b.length) return 0;

	let dot = 0,
		normA = 0,
		normB = 0;

	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}

	if (normA === 0 || normB === 0) return 0;

	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Tạo text đại diện cho 1 bài hát ──
function buildSongText(song) {
	const parts = [
		song.title,
		song.artist_name,
		song.genres,
		song.mood,
		song.lyrics ? song.lyrics.slice(0, 200) : "",
	];

	return parts
		.filter(Boolean)
		.join(". ")
		.trim();
}

module.exports = {
	getEmbedding,
	cosineSimilarity,
	buildSongText,
};