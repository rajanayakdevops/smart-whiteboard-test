const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const meetingRoutes = require("./routes/meetings");

const app = express();

// ------------------ MIDDLEWARE ------------------
app.use(cors());
app.use(express.json());

// ------------------ API ROUTES ------------------
app.use("/api/meetings", meetingRoutes);

// ------------------ DB CONNECTION ------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

// ------------------ SERVER + SOCKET.IO ------------------
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// In-memory participants tracking
// meetingId -> [username1, username2]
const meetingsParticipants = {};

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // -------- JOIN MEETING --------
  socket.on("join", ({ meetingId, username }) => {
    socket.join(meetingId);

    if (!meetingsParticipants[meetingId]) {
      meetingsParticipants[meetingId] = [];
    }

    if (!meetingsParticipants[meetingId].includes(username)) {
      meetingsParticipants[meetingId].push(username);
    }

    // Notify others
    socket.to(meetingId).emit("user-joined", username);

    // Send participant list to joined user
    socket.emit("participants", meetingsParticipants[meetingId]);
  });

  // -------- CHAT MESSAGE --------
  socket.on("message", ({ meetingId, username, text }) => {
    io.to(meetingId).emit("message", { username, text });
  });

  // -------- WEBRTC SIGNALING --------
  socket.on("offer", ({ meetingId, offer }) => {
    socket.to(meetingId).emit("offer", offer);
  });

  socket.on("answer", ({ meetingId, answer }) => {
    socket.to(meetingId).emit("answer", answer);
  });

  socket.on("ice-candidate", ({ meetingId, candidate }) => {
    socket.to(meetingId).emit("ice-candidate", candidate);
  });

  // -------- LEAVE MEETING --------
  socket.on("leave", ({ meetingId, username }) => {
    socket.leave(meetingId);

    if (meetingsParticipants[meetingId]) {
      meetingsParticipants[meetingId] = meetingsParticipants[meetingId].filter(
        (u) => u !== username
      );
    }

    socket.to(meetingId).emit("user-left", username);
  });

  // -------- DISCONNECT --------
  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// ------------------ START SERVER ------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
