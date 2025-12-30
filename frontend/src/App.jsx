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

  useEffect(() => {
    if (!username || !storedMeetingId) {
      navigate("/");
      return;
    }

    const joinExistingMeeting = async () => {
      const res = await fetch(`${BACKEND_URL}/api/meetings/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: storedMeetingId, username }),
      });
      const data = await res.json();
      setParticipants(data.participants || []);
    };

    joinExistingMeeting();

    const socket = io(BACKEND_URL);
    socketRef.current = socket;

    socket.emit("join", { meetingId: storedMeetingId, username });

    socket.on("user-joined", (user) => {
      setParticipants((prev) => [...new Set([...prev, user])]);
      setMessages((prev) => [
        ...prev,
        { system: true, text: `${user} joined the meeting` },
      ]);
    });

    socket.on("user-left", (user) => {
      setParticipants((prev) => prev.filter((u) => u !== user));
      setMessages((prev) => [
        ...prev,
        { system: true, text: `${user} left the meeting` },
      ]);
    });

    socket.on("message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.emit("leave", { meetingId: storedMeetingId, username });
      socket.disconnect();
    };
  }, [navigate]);

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
    await fetch(`${BACKEND_URL}/api/meetings/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId: storedMeetingId, username }),
    });
    localStorage.clear();
    navigate("/");
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden", // 🔥 FIX: lock page scroll
        display: "flex",
        flexDirection: "column",
        background: "#202124",
        color: "#fff",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          height: 56,
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#2b2c2f",
        }}
      >
        <strong>{username}</strong>
        <strong>Meeting ID: {meetingId}</strong>
      </div>

      {/* MAIN */}
      <div
        style={{
          flex: 1,
          display: "flex",
          padding: 12,
          gap: 12,
          overflow: "hidden", // 🔥 FIX: prevent main expansion
        }}
      >
        {/* VIDEO */}
        <div
          style={{
            flex: showChat || showMembers ? "0 0 60%" : 1,
            background: "#000",
            borderRadius: 12,
          }}
        />

        {(showChat || showMembers) && (
          <div
            style={{
              flex: "0 0 40%",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              overflow: "hidden", // 🔥 FIX: lock right side
            }}
          >
            {/* MEMBERS */}
            {showMembers && (
              <div
                style={{
                  background: "#303134",
                  borderRadius: 12,
                  padding: 16,
                  flex: showChat && showMembers ? "1 1 50%" : 1,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
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

            {/* CHAT */}
            {showChat && (
              <div
                style={{
                  background: "#303134",
                  borderRadius: 12,
                  padding: 16,
                  flex: showChat && showMembers ? "1 1 50%" : 1,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <h4>Chat</h4>

                {/* ONLY SCROLLABLE AREA */}
                <div
                  style={{
                    flex: 1,
                    overflowY: "auto", // ✅ correct scrolling
                    paddingRight: 8,
                  }}
                >
                  {messages.map((m, i) => (
                    <p key={i} style={{ color: m.system ? "gray" : "#fff" }}>
                      {m.system ? (
                        m.text
                      ) : (
                        <>
                          <b>{m.username}:</b> {m.text}
                        </>
                      )}
                    </p>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message"
                    style={{ flex: 1, padding: 8 }}
                  />
                  <button onClick={sendMessage}>Send</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div
        style={{
          height: 72,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 16,
          background: "#2b2c2f",
        }}
      >
        <button onClick={() => setShowMembers((p) => !p)}>Members</button>
        <button onClick={() => setShowChat((p) => !p)}>Chat</button>
        <button
          style={{ background: "red", color: "#fff", padding: "6px 16px" }}
          onClick={leaveMeeting}
        >
          Leave
        </button>
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