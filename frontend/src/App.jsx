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
  const [isMuted, setIsMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // for multiple peers
  const remoteVideosRef = useRef({}); // track remote video elements

  useEffect(() => {
    if (!username || !storedMeetingId) {
      navigate("/");
      return;
    }

    const socket = io(BACKEND_URL);
    socketRef.current = socket;

    socket.emit("join", { meetingId: storedMeetingId, username });

    // Receive participant list
    socket.on("participants", (list) => {
      setParticipants(list);
    });

    // Camera + Mic
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    });

    // WebRTC signaling
    socket.on("offer", async ({ from, offer }) => {
      const peer = createPeer();
      peersRef.current[from] = peer;
      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("answer", { to: from, answer });
    });

    socket.on("answer", async ({ from, answer }) => {
      const peer = peersRef.current[from];
      if (peer) await peer.setRemoteDescription(answer);
    });

    socket.on("ice-candidate", ({ from, candidate }) => {
      const peer = peersRef.current[from];
      if (peer) peer.addIceCandidate(candidate);
    });

    // New user joined
    socket.on("user-joined", (newUser) => {
      setParticipants((p) => [...new Set([...p, newUser])]);
      const peer = createPeer(newUser, true); // initiator
      peersRef.current[newUser] = peer;
    });

    // User left
    socket.on("user-left", (user) => {
      setParticipants((p) => p.filter((u) => u !== user));
      setMessages((p) => [...p, { system: true, text: `${user} left the meeting` }]);
      if (remoteVideosRef.current[user]) {
        remoteVideosRef.current[user].remove();
        delete remoteVideosRef.current[user];
      }
      if (peersRef.current[user]) delete peersRef.current[user];
    });

    // Chat
    socket.on("message", (msg) => setMessages((p) => [...p, msg]));

    return () => {
      socket.emit("leave", { meetingId: storedMeetingId, username });
      socket.disconnect();
    };
  }, [navigate]);

  const createPeer = (user = null, initiator = false) => {
    const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

    // Add local tracks
    localStreamRef.current?.getTracks().forEach((track) => peer.addTrack(track, localStreamRef.current));

    // Handle remote track
    peer.ontrack = (event) => {
      if (!user) user = "remote-" + Math.random();
      let videoEl = remoteVideosRef.current[user];
      if (!videoEl) {
        videoEl = document.createElement("video");
        videoEl.autoplay = true;
        videoEl.style.width = "100%";
        videoEl.style.height = "100%";
        videoEl.style.borderRadius = "12px";
        document.getElementById("videoContainer").appendChild(videoEl);
        remoteVideosRef.current[user] = videoEl;
      }
      videoEl.srcObject = event.streams[0];
    };

    // ICE candidates
    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current.emit("ice-candidate", { meetingId: storedMeetingId, candidate: e.candidate, to: user });
      }
    };

    // If initiator, create offer
    if (initiator) {
      peer.createOffer().then((offer) => peer.setLocalDescription(offer)).then(() => {
        socketRef.current.emit("offer", { meetingId: storedMeetingId, offer: peer.localDescription, to: user });
      });
    }

    return peer;
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

  const toggleMute = () => {
    const enabled = !isMuted;
    localStreamRef.current.getAudioTracks()[0].enabled = enabled;
    setIsMuted(enabled);
  };

  const toggleVideo = () => {
    const enabled = !videoOff;
    localStreamRef.current.getVideoTracks()[0].enabled = enabled;
    setVideoOff(enabled);
  };

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", background: "#202124", color: "#fff", overflow: "hidden" }}>
      {/* HEADER */}
      <div style={{ height: 56, padding: "0 20px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#2b2c2f" }}>
        <strong>{username}</strong>
        <strong>Meeting ID: {meetingId}</strong>
      </div>

      {/* MAIN BODY */}
      <div style={{ flex: 1, display: "flex", padding: 12, gap: 12, overflow: "hidden" }}>
        {/* VIDEO */}
        <div
          id="videoContainer"
          style={{ flex: showChat || showMembers ? "0 0 60%" : 1, background: "#000", borderRadius: 12, display: "flex", justifyContent: "center", alignItems: "center", overflow: "hidden", position: "relative" }}
        >
          <video ref={localVideoRef} autoPlay muted style={{ width: "100%", height: "100%", borderRadius: 12 }} />
        </div>

        {/* RIGHT PANEL */}
        {(showChat || showMembers) && (
          <div style={{ flex: "0 0 40%", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
            {showMembers && (
              <div style={{ background: "#303134", borderRadius: 12, padding: 16, flex: showChat ? "1 1 50%" : 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <h4>Members</h4>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  <ul>
                    {participants.map((p) => (
                      <li key={p}>{p} {p === username && "(You)"}</li>
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

      {/* FOOTER */}
      <div style={{ height: 72, display: "flex", justifyContent: "center", alignItems: "center", gap: 16, background: "#2b2c2f" }}>
        <button onClick={() => setShowMembers((p) => !p)}>Members</button>
        <button onClick={() => setShowChat((p) => !p)}>Chat</button>
        <button onClick={toggleMute}>{isMuted ? "Unmute" : "Mute"}</button>
        <button onClick={toggleVideo}>{videoOff ? "Video On" : "Video Off"}</button>
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
