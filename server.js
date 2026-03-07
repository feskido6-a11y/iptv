require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const Channel = require("./models/Channel");
const channelsRouter = require("./routes/channels");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// API
app.use("/api/channels", channelsRouter);

// /playlist.m3u — short URL
app.get("/playlist.m3u", async (req, res) => {
  try {
    const { group, country, search, limit = 20000 } = req.query;
    const query = {};
    if (search)  query.$text   = { $search: search };
    if (group)   query.group   = group;
    if (country) query.country = country;

    const channels = await Channel.find(query).limit(parseInt(limit)).sort({ group:1, name:1 });

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
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", db: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

// Frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
  })
  .catch(err => { console.error("❌ MongoDB error:", err.message); process.exit(1); });
