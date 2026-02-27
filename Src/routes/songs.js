const express = require("express");
const router = express.Router();
const db = require("../db");

// GET all songs
router.get("/", (req, res) => {
	db.query("SELECT * FROM songs", (err, results) => {
		if (err) return res.status(500).json(err);
		res.json(results);
	});
});

// POST new song
router.post("/", (req, res) => {
	const { title, artist, file_url, cover_url } = req.body;

	const sql = "INSERT INTO songs (title, artist, file_url, cover_url) VALUES (?, ?, ?, ?)";

	db.query(sql, [title, artist, file_url, cover_url], (err, result) => {
		if (err) return res.status(500).json(err);
		res.json({ message: "Song added" });
	});
});

module.exports = router;