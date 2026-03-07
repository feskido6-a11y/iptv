const express = require("express");
const router = express.Router();
const Channel = require("../models/Channel");

// GET /playlist.m3u — dynamic playlist from MongoDB
router.get("/playlist.m3u", async (req, res) => {
  try {
    const { group, country, search, limit = 20000 } = req.query;
    const query = {};
    if (search)  query.$text  = { $search: search };
    if (group)   query.group  = group;
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

// GET /api/channels
router.get("/", async (req, res) => {
  try {
    const { search, group, country, page = 1, limit = 50 } = req.query;
    const query = {};
    if (search)  query.$text  = { $search: search };
    if (group)   query.group  = group;
    if (country) query.country = country;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [channels, total] = await Promise.all([
      Channel.find(query).skip(skip).limit(parseInt(limit)).sort({ name: 1 }),
      Channel.countDocuments(query),
    ]);

    res.json({ channels, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/channels/groups
router.get("/groups", async (req, res) => {
  try {
    const groups = await Channel.distinct("group");
    res.json(groups.sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/channels/countries
router.get("/countries", async (req, res) => {
  try {
    const countries = await Channel.distinct("country");
    res.json(countries.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
