import { useState, useEffect, useRef } from "react";
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
    const res = await fetch(`${BACKEND_URL}/api/meetings/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();

    localStorage.setItem("username", username);
    localStorage.setItem("meetingId", data.meetingId);
    navigate(`/meeting/${data.meetingId}`);
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
    await fetch(`${BACKEND_URL}/api/meetings/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId, username }),
    });

    localStorage.setItem("username", username);
    localStorage.setItem("meetingId", meetingId);
    navigate(`/meeting/${meetingId}`);
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

/* ---------------- MEETING ROOM ---------------- */
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

  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // Store multiple peers

  useEffect(() => {
    if (!username || !storedMeetingId) {
      navigate("/");
      return;
    }

    const socket = io(BACKEND_URL);
    socketRef.current = socket;

    socket.emit("join", { meetingId: storedMeetingId, username });

    // Get camera & mic
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      });

    // Handle new user
    socket.on("all-users", (users) => {
      users.forEach((user) => {
        if (user === username) return;
        const peer = createPeer(user, socket, localStreamRef.current);
        peersRef.current[user] = peer;
      });
      setParticipants(users);
    });

    socket.on("user-joined", (user) => {
      setParticipants((prev) => [...prev, user]);
      setMessages((prev) => [...prev, { system: true, text: `${user} joined the meeting` }]);
    });

    socket.on("offer", async ({ from, offer }) => {
      const peer = createAnswerPeer(from, offer, socket, localStreamRef.current);
      peersRef.current[from] = peer;
    });

    socket.on("answer", async ({ from, answer }) => {
      const peer = peersRef.current[from];
      await peer.setRemoteDescription(answer);
    });

    socket.on("ice-candidate", async ({ from, candidate }) => {
      const peer = peersRef.current[from];
      if (peer) await peer.addIceCandidate(candidate);
    });

    socket.on("user-left", (user) => {
      setParticipants((prev) => prev.filter((p) => p !== user));
      setMessages((prev) => [...prev, { system: true, text: `${user} left the meeting` }]);
      // Remove remote video
      const video = document.getElementById(`video-${user}`);
      if (video) video.remove();
      delete peersRef.current[user];
    });

    socket.on("message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.emit("leave", { meetingId: storedMeetingId, username });
      socket.disconnect();
    };
  }, [navigate]);

  const createPeer = (userToSignal, socket, stream) => {
    const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

    // Add local tracks
    stream?.getTracks().forEach((track) => peer.addTrack(track, stream));

    // Handle remote stream
    peer.ontrack = (event) => addRemoteStream(userToSignal, event.streams[0]);

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("ice-candidate", { meetingId: storedMeetingId, to: userToSignal, candidate: e.candidate });
      }
    };

    peer.createOffer().then((offer) => peer.setLocalDescription(offer)).then(() => {
      socket.emit("offer", { meetingId: storedMeetingId, to: userToSignal, offer: peer.localDescription });
    });

    return peer;
  };

  const createAnswerPeer = (from, offer, socket, stream) => {
    const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

    stream?.getTracks().forEach((track) => peer.addTrack(track, stream));

    peer.ontrack = (event) => addRemoteStream(from, event.streams[0]);

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("ice-candidate", { meetingId: storedMeetingId, to: from, candidate: e.candidate });
      }
    };

    peer.setRemoteDescription(offer).then(() => peer.createAnswer()).then((answer) => peer.setLocalDescription(answer)).then(() => {
      socket.emit("answer", { meetingId: storedMeetingId, to: from, answer: peer.localDescription });
    });

    return peer;
  };

  const addRemoteStream = (user, stream) => {
    let video = document.getElementById(`video-${user}`);
    if (!video) {
      video = document.createElement("video");
      video.id = `video-${user}`;
      video.autoplay = true;
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.borderRadius = "12px";
      document.getElementById("videoContainer").appendChild(video);
    }
    video.srcObject = stream;
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    socketRef.current.emit("message", { meetingId: storedMeetingId, username, text: newMessage });
    setNewMessage("");
  };

  const leaveMeeting = async () => {
    await fetch(`${BACKEND_URL}/api/meetings/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId: storedMeetingId, username }),
    });
    localStorage.clear();
    navigate("/");
  };

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", background: "#202124", color: "#fff", overflow: "hidden" }}>
      <div style={{ height: 56, padding: "0 20px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#2b2c2f" }}>
        <strong>{username}</strong>
        <strong>Meeting ID: {meetingId}</strong>
      </div>

      <div style={{ flex: 1, display: "flex", padding: 12, gap: 12, overflow: "hidden" }}>
        <div
          id="videoContainer"
          style={{ flex: showChat || showMembers ? "0 0 60%" : 1, background: "#000", borderRadius: 12, display: "flex", justifyContent: "center", alignItems: "center", overflow: "hidden", flexWrap: "wrap", gap: 8 }}
        >
          <video ref={localVideoRef} autoPlay muted style={{ width: "48%", height: "48%", borderRadius: 12 }} />
        </div>

        {(showChat || showMembers) && (
          <div style={{ flex: "0 0 40%", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
            {showMembers && (
              <div style={{ background: "#303134", borderRadius: 12, padding: 16, flex: showChat ? "1 1 50%" : 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <h4>Members</h4>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  <ul>
                    {participants.map((p) => (
                      <li key={p}>
                        {p} {p === username && "(You)"}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {showChat && (
              <div style={{ background: "#303134", borderRadius: 12, padding: 16, flex: showMembers ? "1 1 50%" : 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <h4>Chat</h4>
                <div style={{ flex: 1, overflowY: "auto", paddingRight: 8 }}>
                  {messages.map((m, i) => (
                    <p key={i} style={{ color: m.system ? "gray" : "#fff" }}>
                      {m.system ? m.text : <><b>{m.username}:</b> {m.text}</>}
                    </p>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message" style={{ flex: 1, padding: 8 }} />
                  <button onClick={sendMessage}>Send</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ height: 72, display: "flex", justifyContent: "center", alignItems: "center", gap: 16, background: "#2b2c2f" }}>
        <button onClick={() => setShowMembers((p) => !p)}>Members</button>
        <button onClick={() => setShowChat((p) => !p)}>Chat</button>
        <button style={{ background: "red", color: "#fff", padding: "6px 16px" }} onClick={leaveMeeting}>Leave</button>
      </div>
    </div>
  );
}

/* ---------------- APP ---------------- */
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
