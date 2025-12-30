const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const meetingRoutes = require("./routes/meetings");

const app = express();

app.use(cors());
app.use(express.json());

// API routes (keep all your existing routes intact)
app.use("/api/meetings", meetingRoutes);

// DB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

// ------------------ SOCKET.IO SETUP ------------------
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// Keep track of participants in memory (meetingId -> participants array)
const meetingsParticipants = {};

io.on("connection", (socket) => {
  console.log("New socket connected:", socket.id);

  // When a user joins a meeting
  socket.on("join", ({ meetingId, username }) => {
    socket.join(meetingId);

    // Add user to participants list
    if (!meetingsParticipants[meetingId]) meetingsParticipants[meetingId] = [];
    if (!meetingsParticipants[meetingId].includes(username)) {
      meetingsParticipants[meetingId].push(username);
    }

    // Notify other participants
    socket.to(meetingId).emit("user-joined", username);

    // Optionally send current participants to new user
    io.to(socket.id).emit("participants", meetingsParticipants[meetingId]);
  });

  // Chat messages
  socket.on("message", ({ meetingId, username, text }) => {
    io.to(meetingId).emit("message", { username, text });
  });

  // When a user leaves
  socket.on("leave", ({ meetingId, username }) => {
    socket.leave(meetingId);

    if (meetingsParticipants[meetingId]) {
      meetingsParticipants[meetingId] = meetingsParticipants[meetingId].filter(
        (u) => u !== username
      );
    }

    socket.to(meetingId).emit("user-left", username);
  });

  socket.on("disconnecting", () => {
    // Handle user disconnecting from all rooms
    const rooms = [...socket.rooms];
    rooms.forEach((meetingId) => {
      if (meetingsParticipants[meetingId]) {
        // We can't get username from socket directly here, so optional: skip
        // In frontend, we handle leave manually before disconnect
      }
    });
  });
});

// ------------------ SERVER ------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
