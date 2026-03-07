const mongoose = require("mongoose");

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

module.exports = mongoose.model("Channel", channelSchema);
