const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const db = require("./db");

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const songRoutes = require("./routes/songs");
app.use("/api/songs", songRoutes);

app.listen(process.env.PORT, () => {
	console.log("Server running on port " + process.env.PORT);
});