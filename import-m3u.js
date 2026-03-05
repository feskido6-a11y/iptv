require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Channel = require("../models/Channel");

// ✅ ضع مسار ملف الـ M3U هنا
const M3U_FILE = process.argv[2] || path.join(__dirname, "../playlist-input.m3u");

function parseM3U(content) {
  const lines = content.split("\n").map((l) => l.trim());
  const channels = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("#EXTINF:")) {
      current = {};

      const nameMatch = line.match(/,(.+)$/);
      if (nameMatch) current.name = nameMatch[1].trim();

      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      if (logoMatch) current.logo = logoMatch[1];

      const groupMatch = line.match(/group-title="([^"]*)"/);
      current.group = groupMatch ? (groupMatch[1] || "Uncategorized") : "Uncategorized";

      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
      if (tvgIdMatch) current.tvgId = tvgIdMatch[1];

      const countryMatch = line.match(/tvg-country="([^"]*)"/);
      if (countryMatch) current.country = countryMatch[1];

      // استخرج الدولة من tvg-id  (مثال: 2GB.au → au)
      if (!current.country && current.tvgId) {
        const parts = current.tvgId.split(".");
        if (parts.length > 1) current.country = parts[parts.length - 1].toUpperCase();
      }

      const langMatch = line.match(/tvg-language="([^"]*)"/);
      if (langMatch) current.language = langMatch[1];

    } else if (line && !line.startsWith("#") && current) {
      current.url = line;
      if (current.name && current.url) channels.push(current);
      current = null;
    }
  }

  return channels;
}

async function importFile() {
  try {
    if (!fs.existsSync(M3U_FILE)) {
      console.error(`❌ File not found: ${M3U_FILE}`);
      console.log("Usage: node scripts/import-m3u.js /path/to/file.m3u");
      process.exit(1);
    }

    console.log(`📂 Reading: ${M3U_FILE}`);
    const content = fs.readFileSync(M3U_FILE, "utf8");

    console.log("🔄 Parsing channels...");
    const channels = parseM3U(content);
    console.log(`✅ Parsed: ${channels.length} channels`);

    // إحصائيات المجموعات
    const groups = {};
    channels.forEach(ch => { groups[ch.group] = (groups[ch.group] || 0) + 1; });
    console.log("\n📂 Groups:");
    Object.entries(groups).sort((a, b) => b[1] - a[1]).forEach(([g, c]) => {
      console.log(`   ${g.padEnd(20)} ${c} channels`);
    });

    console.log("\n🔗 Connecting to MongoDB Atlas...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected");

    const mode = process.argv[3] || "merge";

    if (mode === "replace") {
      console.log("🗑️  Clearing all existing channels...");
      await Channel.deleteMany({});
    }

    console.log(`\n💾 Inserting ${channels.length} channels (mode: ${mode})...`);
    const BATCH = 200;
    let inserted = 0, updated = 0, errors = 0;

    for (let i = 0; i < channels.length; i += BATCH) {
      const batch = channels.slice(i, i + BATCH);

      if (mode === "merge") {
        // Upsert: يضيف جديد ويحدّث الموجود بنفس الاسم
        for (const ch of batch) {
          try {
            const result = await Channel.updateOne(
              { name: ch.name, url: ch.url },
              { $set: ch },
              { upsert: true }
            );
            if (result.upsertedCount) inserted++;
            else updated++;
          } catch (e) { errors++; }
        }
      } else {
        // replace: insertMany مباشر
        try {
          await Channel.insertMany(batch, { ordered: false });
          inserted += batch.length;
        } catch (e) {
          inserted += e.insertedDocs?.length || 0;
          errors++;
        }
      }

      process.stdout.write(`\r   Progress: ${Math.min(i + BATCH, channels.length)}/${channels.length}`);
    }

    console.log(`\n\n✅ Import complete!`);
    console.log(`   ➕ Inserted : ${inserted}`);
    console.log(`   🔄 Updated  : ${updated}`);
    console.log(`   ❌ Errors   : ${errors}`);

    const total = await Channel.countDocuments();
    console.log(`\n📺 Total channels in MongoDB: ${total}`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

importFile();
