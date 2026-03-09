const mongoose = require("mongoose");
const fs = require("fs");

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not set!");
  process.exit(1);
}

const channelSchema = new mongoose.Schema({
  name:     String,
  url:      String,
  logo:     { type: String, default: "" },
  group:    { type: String, default: "Uncategorized" },
  country:  { type: String, default: "" },
  language: { type: String, default: "" },
  tvgId:    { type: String, default: "" },
});

const Channel = mongoose.model("Channel", channelSchema);

async function run() {
  console.log("🔗 Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected!");

  const channels = await Channel.find({}).sort({ group: 1, name: 1 });
  console.log(`📺 Found ${channels.length} channels`);

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

  fs.writeFileSync("playlist.m3u", m3u, "utf8");
  const size = (Buffer.byteLength(m3u) / 1024).toFixed(1);
  console.log(`✅ playlist.m3u generated! (${channels.length} channels, ${size} KB)`);
  process.exit(0);
}

run().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
