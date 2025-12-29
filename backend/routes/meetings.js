const express = require("express");
const { v4: uuidv4 } = require("uuid");
const Meeting = require("../models/meeting");

const router = express.Router();

/**
 * CREATE MEETING
 */
router.post("/create", async (req, res) => {
  const { username } = req.body;
  const meetingId = uuidv4().slice(0, 8);

  const meeting = new Meeting({
    meetingId,
    createdBy: username,
    participants: [username]
  });

  await meeting.save();

  res.json(meeting);
});

/**
 * JOIN MEETING
 */
router.post("/join", async (req, res) => {
  const { meetingId, username } = req.body;

  const meeting = await Meeting.findOne({ meetingId });
  if (!meeting) {
    return res.status(404).json({ message: "Meeting not found" });
  }

  if (!meeting.participants.includes(username)) {
    meeting.participants.push(username);
    await meeting.save();
  }

  res.json(meeting);
});

/**
 * LEAVE MEETING
 */
router.post("/leave", async (req, res) => {
  const { meetingId, username } = req.body;

  const meeting = await Meeting.findOne({ meetingId });
  if (!meeting) return res.status(404).json({});

  meeting.participants = meeting.participants.filter(
    (p) => p !== username
  );

  await meeting.save();

  res.json(meeting);
});

/**
 * GET MEETING INFO
 */
router.get("/:meetingId", async (req, res) => {
  const meeting = await Meeting.findOne({
    meetingId: req.params.meetingId
  });

  if (!meeting) {
    return res.status(404).json({ message: "Meeting not found" });
  }

  res.json(meeting);
});

module.exports = router;
