require("dotenv").config();
const fs = require("fs");
const mongoose = require("mongoose");
const Channel = require("../models/Channel");

const M3U_FILE = process.argv[2] || "playlist.m3u";

function parseM3U(content) {
  const lines = content.split("\n").map(l => l.trim());
  const channels = [];
  let cur = null;

  for (const line of lines) {
    if (line.startsWith("#EXTINF:")) {
      cur = {};
      const name    = line.match(/,(.+)$/);
      const logo    = line.match(/tvg-logo="([^"]*)"/);
      const group   = line.match(/group-title="([^"]*)"/);
      const tvgId   = line.match(/tvg-id="([^"]*)"/);
      const country = line.match(/tvg-country="([^"]*)"/);
      const lang    = line.match(/tvg-language="([^"]*)"/);

      cur.name     = name  ? name[1].trim()  : "Unknown";
      cur.logo     = logo  ? logo[1]         : "";
      cur.group    = group ? (group[1].split(";")[0] || "Uncategorized") : "Uncategorized";
      cur.tvgId    = tvgId ? tvgId[1]        : "";
      cur.language = lang  ? lang[1]         : "";
      cur.country  = country ? country[1]    : (cur.tvgId.includes(".") ? cur.tvgId.split(".").pop().toUpperCase() : "");
    } else if (line && !line.startsWith("#") && cur) {
      cur.url = line;
      if (cur.name && cur.url) channels.push(cur);
      cur = null;
    }
  }
  return channels;
}

async function run() {
  console.log("━".repeat(45));
  console.log("  📺  M3U → MongoDB Importer");
  console.log("━".repeat(45));

  if (!fs.existsSync(M3U_FILE)) {
    console.error(`❌ File not found: ${M3U_FILE}`); process.exit(1);
  }

  const channels = parseM3U(fs.readFileSync(M3U_FILE, "utf8"));
  console.log(`✅ Parsed: ${channels.length} channels`);

  const groups = {};
  channels.forEach(ch => { groups[ch.group] = (groups[ch.group] || 0) + 1; });
  console.log("\n📂 Top Groups:");
  Object.entries(groups).sort((a,b) => b[1]-a[1]).slice(0,8)
    .forEach(([g,c]) => console.log(`   ${String(c).padStart(5)}  ${g}`));

  console.log("\n🔗 Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected!\n");

  await Channel.deleteMany({});
  console.log(`💾 Inserting ${channels.length} channels...`);

  const BATCH = 300;
  for (let i = 0; i < channels.length; i += BATCH) {
    await Channel.insertMany(channels.slice(i, i + BATCH), { ordered: false });
    process.stdout.write(`\r   ${Math.min(i+BATCH, channels.length)}/${channels.length}`);
  }

  const total = await Channel.countDocuments();
  console.log(`\n\n✅ Done! ${total} channels in MongoDB`);
  console.log(`🔗 Playlist: https://YOUR-APP.railway.app/playlist.m3u\n`);
  process.exit(0);
}

run().catch(err => { console.error("❌", err.message); process.exit(1); });
