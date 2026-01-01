import { useState, useEffect, useRef, useCallback } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useParams,
} from "react-router-dom";
import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

/* ---------------- LANDING ---------------- */
function Landing() {
  const navigate = useNavigate();
  return (
    <div style={{ padding: 40 }}>
      <h3>Welcome to Mini Google Meet</h3>
      <br />
      <button onClick={() => navigate("/create")}>Create Meeting</button>
      <br /><br />
      <button onClick={() => navigate("/join")}>Join Meeting</button>
    </div>
  );
}

/* ---------------- CREATE ---------------- */
function CreateMeeting() {
  const [username, setUsername] = useState("");
  const navigate = useNavigate();

  const createMeeting = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/meetings/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) throw new Error("Create failed");
      const data = await res.json();

      localStorage.setItem("username", username);
      localStorage.setItem("meetingId", data.meetingId);
      navigate(`/meeting/${data.meetingId}`);
    } catch (err) {
      console.error("Create meeting error:", err);
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h3>Create Meeting</h3>
      <input
        placeholder="Your name"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <br /><br />
      <button onClick={createMeeting}>Create</button>
    </div>
  );
}

/* ---------------- JOIN ---------------- */
function JoinMeeting() {
  const [username, setUsername] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const navigate = useNavigate();

  const joinMeeting = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/meetings/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, username }),
      });
      if (!res.ok) throw new Error("Join failed");
      
      localStorage.setItem("username", username);
      localStorage.setItem("meetingId", meetingId);
      navigate(`/meeting/${meetingId}`);
    } catch (err) {
      console.error("Join meeting error:", err);
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h3>Join Meeting</h3>
      <input
        placeholder="Your name"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <br /><br />
      <input
        placeholder="Meeting ID"
        value={meetingId}
        onChange={(e) => setMeetingId(e.target.value)}
      />
      <br /><br />
      <button onClick={joinMeeting}>Join</button>
    </div>
  );
}

function MeetingRoom() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const username = localStorage.getItem("username");
  const storedMeetingId = localStorage.getItem("meetingId");

  const [showChat, setShowChat] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [remoteStreams, setRemoteStreams] = useState({});

  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const remoteVideoRefs = useRef({});

  const createPeerConnection = useCallback((socketId, socket, remoteUsername) => {
    console.log(`Creating PC for ${socketId}`);
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) =>
        pc.addTrack(track, localStreamRef.current)
      );
    }

    pc.ontrack = (event) => {
      console.log("✅ ontrack fired for", socketId);
      setRemoteStreams((prev) => ({ ...prev, [socketId]: event.streams[0] }));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { candidate: event.candidate, to: socketId });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`PC ${socketId} state:`, pc.connectionState);
    };

    peersRef.current[socketId] = { pc, username: remoteUsername };
    return pc;
  }, []);

  useEffect(() => {
    if (!username || !storedMeetingId || meetingId !== storedMeetingId) {
      navigate("/");
      return;
    }

    // NO duplicate joinExistingMeeting() call here!

    const socket = io(BACKEND_URL);
    socketRef.current = socket;

    const initLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        const localVideo = document.getElementById("localVideo");
        if (localVideo) localVideo.srcObject = stream;
      } catch (err) {
        console.error("Media error:", err);
      }
    };
    initLocalStream();

    // SINGLE join emission
    console.log("🔌 Emitting join for", username);
    socket.emit("join", { meetingId: storedMeetingId, username });

    socket.on("participants", (list) => {
      console.log("📋 Participants:", list.map(p => p.username));
      setParticipants(list);
    });

    socket.on("user-joined", ({ username: joinedUser, socketId }) => {
      console.log("👤 User joined:", joinedUser, socketId);
      setParticipants((prev) => {
        if (!prev.some(p => p.socketId === socketId)) {
          return [...prev, { username: joinedUser, socketId }];
        }
        return prev;
      });

      if (socketId !== socket.id && !peersRef.current[socketId]) {
        const pc = createPeerConnection(socketId, socket, joinedUser);
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            console.log("📤 Sending offer to", socketId);
            socket.emit("offer", { offer: pc.localDescription, to: socketId });
          })
          .catch(console.error);
      }
    });

    socket.on("user-left", (leftUsername) => {
      console.log("👋 User left:", leftUsername);
      setParticipants((prev) => prev.filter((u) => u.username !== leftUsername));
      setMessages((prev) => [...prev, { system: true, text: `${leftUsername} left` }]);

      const leavingSocketId = Object.keys(peersRef.current).find(
        (id) => peersRef.current[id]?.username === leftUsername
      );
      if (leavingSocketId) {
        peersRef.current[leavingSocketId].pc.close();
        delete peersRef.current[leavingSocketId];
        setRemoteStreams((prev) => {
          const updated = { ...prev };
          delete updated[leavingSocketId];
          delete remoteVideoRefs.current[leavingSocketId];
          return updated;
        });
      }
    });

    socket.on("message", (msg) => setMessages((prev) => [...prev, msg]));

    socket.on("offer", async ({ offer, from }) => {
      console.log("📥 Offer received from", from);
      if (!peersRef.current[from]) {
        createPeerConnection(from, socket, "");
      }
      const pc = peersRef.current[from].pc;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log("📤 Sending answer to", from);
        socket.emit("answer", { answer: pc.localDescription, to: from });
      } catch (err) {
        console.error("Offer error:", err);
      }
    });

    socket.on("answer", async ({ answer, from }) => {
      console.log("📥 Answer received from", from);
      const pc = peersRef.current[from]?.pc;
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error("Answer error:", err);
        }
      }
    });

    socket.on("ice-candidate", async ({ candidate, from }) => {
      const pc = peersRef.current[from]?.pc;
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          if (err.name !== 'InvalidStateError') console.error(err);
        }
      }
    });

    return () => {
      console.log("🧹 Cleanup");
      socket.emit("leave", { meetingId: storedMeetingId, username });
      Object.values(peersRef.current).forEach(({ pc }) => pc?.close());
      socket.disconnect();
      localStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [navigate, storedMeetingId, username, meetingId, createPeerConnection]);

  useEffect(() => {
    Object.entries(remoteStreams).forEach(([socketId, stream]) => {
      const videoRef = remoteVideoRefs.current[socketId];
      if (videoRef?.current && stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.log("Play error:", e));
      }
    });
  }, [remoteStreams]);

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    socketRef.current.emit("message", {
      meetingId: storedMeetingId,
      username,
      text: newMessage,
    });
    setNewMessage("");
  };

  const leaveMeeting = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/meetings/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: storedMeetingId, username }),
      });
    } catch (err) {
      console.error("Leave error:", err);
    }
    localStorage.clear();
    navigate("/");
  };

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", background: "#202124", color: "#fff" }}>
      <div style={{ height: 56, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#2b2c2f" }}>
        <strong>{username}</strong>
        <strong>Meeting ID: {meetingId}</strong>
      </div>

      <div style={{ flex: 1, display: "flex", padding: 12, gap: 12, overflow: "hidden" }}>
        <div style={{ flex: showChat || showMembers ? "0 0 60%" : 1, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 8, borderRadius: 12, background: "#000", padding: 8 }}>
          <div style={{ position: "relative" }}>
            <video id="localVideo" autoPlay muted playsInline style={{ width: "100%", borderRadius: 8 }} />
            <div style={{ position: "absolute", bottom: 4, left: 4, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "2px 4px", borderRadius: 4, fontSize: 12 }}>
              {username} (You)
            </div>
          </div>

          {Object.entries(remoteStreams).map(([socketId]) => {
            const videoRef = remoteVideoRefs.current[socketId] ?? (remoteVideoRefs.current[socketId] = { current: null });
            const remoteUsername = peersRef.current[socketId]?.username || "Connecting...";
            return (
              <div key={socketId} style={{ position: "relative" }}>
                <video ref={videoRef} autoPlay playsInline style={{ width: "100%", borderRadius: 8 }} />
                <div style={{ position: "absolute", bottom: 4, left: 4, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "2px 4px", borderRadius: 4, fontSize: 12 }}>
                  {remoteUsername}
                </div>
              </div>
            );
          })}
        </div>

        {(showChat || showMembers) && (
          <div style={{ flex: "0 0 40%", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
            {showMembers && (
              <div style={{ background: "#303134", borderRadius: 12, padding: 16, flex: showChat && showMembers ? "1 1 50%" : 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <h4>Members ({participants.length})</h4>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  <ul style={{ listStyle: "none", padding: 0 }}>
                    {participants.map((p) => (
                      <li key={p.socketId} style={{ padding: "4px 0" }}>
                        {p.username} {p.username === username && "(You)"}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {showChat && (
              <div style={{ background: "#303134", borderRadius: 12, padding: 16, flex: showChat && showMembers ? "1 1 50%" : 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <h4>Chat</h4>
                <div style={{ flex: 1, overflowY: "auto", paddingRight: 8 }}>
                  {messages.map((m, i) => (
                    <p key={i} style={{ color: m.system ? "gray" : "#fff", margin: "4px 0" }}>
                      {m.system ? m.text : <><b>{m.username}:</b> {m.text}</>}
                    </p>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message"
                    style={{ flex: 1, padding: 8 }}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <button onClick={sendMessage}>Send</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ height: 72, display: "flex", justifyContent: "center", alignItems: "center", gap: 16, background: "#2b2c2f" }}>
        <button onClick={() => setShowMembers(p => !p)}>{showMembers ? "Hide" : "Members"}</button>
        <button onClick={() => setShowChat(p => !p)}>{showChat ? "Hide" : "Chat"}</button>
        <button style={{ background: "red", color: "#fff", padding: "6px 16px" }} onClick={leaveMeeting}>Leave</button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/create" element={<CreateMeeting />} />
        <Route path="/join" element={<JoinMeeting />} />
        <Route path="/meeting/:meetingId" element={<MeetingRoom />} />
      </Routes>
    </Router>
  );
}
