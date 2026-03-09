const mongoose = require("mongoose");
const fs = require("fs");

const MONGODB_URI = process.env.MONGODB_URI;
const M3U_FILE = process.argv[2] || "playlist.m3u";

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
  console.log("━".repeat(40));
  console.log("  📺  M3U → MongoDB Importer");
  console.log("━".repeat(40));

  if (!fs.existsSync(M3U_FILE)) {
    console.error(`❌ File not found: ${M3U_FILE}`);
    process.exit(1);
  }

  const channels = parseM3U(fs.readFileSync(M3U_FILE, "utf8"));
  console.log(`✅ Parsed: ${channels.length} channels`);

  console.log("🔗 Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
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
  process.exit(0);
}

run().catch(err => { console.error("❌", err.message); process.exit(1); });
