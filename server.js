require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Schema مباشرة في server.js ──────────────
const channelSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  url:      { type: String, required: true },
  logo:     { type: String, default: "" },
  group:    { type: String, default: "Uncategorized", index: true },
  country:  { type: String, default: "" },
  language: { type: String, default: "" },
  tvgId:    { type: String, default: "" },
}, { timestamps: true });

channelSchema.index({ name: "text", group: "text" });
const Channel = mongoose.model("Channel", channelSchema);

// ── Middleware ───────────────────────────────
app.use(cors());
app.use(express.json());

// ── /playlist.m3u ────────────────────────────
async function sendPlaylist(req, res) {
  try {
    const { group, country, search, limit = 20000 } = req.query;
    const query = {};
    if (search)  query.$text   = { $search: search };
    if (group)   query.group   = group;
    if (country) query.country = country;

    const channels = await Channel.find(query)
      .limit(parseInt(limit))
      .sort({ group: 1, name: 1 });

    let m3u = "#EXTM3U\n";
    for (const ch of channels) {
      const attrs = [
        ch.tvgId    ? `tvg-id="${ch.tvgId}"`         : "",
        ch.name     ? `tvg-name="${ch.name}"`         : "",
        ch.logo     ? `tvg-logo="${ch.logo}"`         : "",
        ch.country  ? `tvg-country="${ch.country}"`   : "",
        ch.language ? `tvg-language="${ch.language}"` : "",
        `group-title="${ch.group || "Uncategorized"}"`,
      ].filter(Boolean).join(" ");
      m3u += `#EXTINF:-1 ${attrs},${ch.name}\n${ch.url}\n`;
    }

    res.setHeader("Content-Type", "application/x-mpegURL; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="playlist.m3u"');
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(m3u);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

app.get("/playlist.m3u", sendPlaylist);

// ── API /api/channels ────────────────────────
app.get("/api/channels/groups", async (req, res) => {
  try {
    const groups = await Channel.distinct("group");
    res.json(groups.sort());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/channels/countries", async (req, res) => {
  try {
    const countries = await Channel.distinct("country");
    res.json(countries.filter(Boolean).sort());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/channels", async (req, res) => {
  try {
    const { search, group, country, page = 1, limit = 50 } = req.query;
    const query = {};
    if (search)  query.$text   = { $search: search };
    if (group)   query.group   = group;
    if (country) query.country = country;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [channels, total] = await Promise.all([
      Channel.find(query).skip(skip).limit(parseInt(limit)).sort({ name: 1 }),
      Channel.countDocuments(query),
    ]);
    res.json({ channels, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Health check ─────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", channels: "ready", db: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

// ── Frontend (index.html) ────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ── Start ────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error("❌ MongoDB error:", err.message);
    process.exit(1);
  });
