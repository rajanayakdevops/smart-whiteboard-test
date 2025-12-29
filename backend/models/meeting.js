const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema(
  {
    meetingId: { type: String, required: true, unique: true },
    createdBy: { type: String },
    participants: [String]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Meeting", meetingSchema);
