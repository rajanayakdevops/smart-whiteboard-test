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
app.use("/api/meetings", meetingRoutes);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const meetingsParticipants = {}; // { meetingId: [{username, socketId}, ...] }
const socketUserMap = {}; // { socketId: { meetingId, username } }

io.on("connection", (socket) => {
  console.log("New socket connected:", socket.id);

  socket.on("join", ({ meetingId, username }) => {
    console.log(`${username} joining ${meetingId}`);
    socket.join(meetingId);

    socketUserMap[socket.id] = { meetingId, username };

    if (!meetingsParticipants[meetingId]) {
      meetingsParticipants[meetingId] = [];
    }

    // Avoid duplicates
    if (!meetingsParticipants[meetingId].some(u => u.socketId === socket.id)) {
      meetingsParticipants[meetingId].push({ username, socketId: socket.id });
    }

    // Notify others of new joiner
    socket.to(meetingId).emit("user-joined", { 
      username, 
      socketId: socket.id 
    });

    // Send full participant list to ALL in room (including new joiner)
    io.to(meetingId).emit("participants", meetingsParticipants[meetingId]);
  });

  socket.on("message", ({ meetingId, username, text }) => {
    io.to(meetingId).emit("message", { username, text });
  });

  // WebRTC Signaling
  socket.on("offer", ({ offer, to }) => {
    console.log("Offer forwarded to:", to);
    io.to(to).emit("offer", { offer, from: socket.id });
  });

  socket.on("answer", ({ answer, to }) => {
    console.log("Answer forwarded to:", to);
    io.to(to).emit("answer", { answer, from: socket.id });
  });

  socket.on("ice-candidate", ({ candidate, to }) => {
    io.to(to).emit("ice-candidate", { candidate, from: socket.id });
  });

  socket.on("leave", ({ meetingId, username }) => {
    console.log(`${username} leaving ${meetingId}`);
    socket.leave(meetingId);

    if (meetingsParticipants[meetingId]) {
      meetingsParticipants[meetingId] = meetingsParticipants[meetingId].filter(
        (u) => u.socketId !== socket.id
      );
      socket.to(meetingId).emit("user-left", username);
      io.to(meetingId).emit("participants", meetingsParticipants[meetingId]);
    }
  });

  socket.on("disconnecting", () => {
    const userData = socketUserMap[socket.id];
    if (userData) {
      const { meetingId, username } = userData;
      console.log(`${username} disconnected from ${meetingId}`);

      if (meetingsParticipants[meetingId]) {
        meetingsParticipants[meetingId] = meetingsParticipants[meetingId].filter(
          (u) => u.socketId !== socket.id
        );
        socket.to(meetingId).emit("user-left", username);
        io.to(meetingId).emit("participants", meetingsParticipants[meetingId]);
      }
      delete socketUserMap[socket.id];
    }
  });
});


// this server running on port 5000 
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
