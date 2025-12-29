import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Landing Page
function Landing() {
  const navigate = useNavigate();
  return (
    <div>
      <h3>Welcome to Mini Google Meet</h3>
      <button onClick={() => navigate("/create")}>Create Meeting</button>
      <br /><br />
      <button onClick={() => navigate("/join")}>Join Meeting</button>
    </div>
  );
}

// Create Meeting Page
function CreateMeeting() {
  const [username, setUsername] = useState("");
  const navigate = useNavigate();

  const createMeeting = async () => {
    if (!username.trim()) {
      alert("Please enter your name");
      return;
    }

    const res = await fetch(`${BACKEND_URL}/api/meetings/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    });
    const data = await res.json();

    // Save username and meetingId in localStorage
    localStorage.setItem("username", username);
    localStorage.setItem("meetingId", data.meetingId);

    navigate(`/meeting/${data.meetingId}`);
  };

  return (
    <div>
      <h3>Create a Meeting</h3>
      <input
        placeholder="Your name"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <br /><br />
      <button onClick={createMeeting}>Create Meeting</button>
      <br /><br />
      <button onClick={() => navigate("/")}>Back</button>
    </div>
  );
}

// Join Meeting Page
function JoinMeeting() {
  const [username, setUsername] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const navigate = useNavigate();

  const joinMeeting = async () => {
    if (!username.trim() || !meetingId.trim()) {
      alert("Please enter your name and meeting ID");
      return;
    }

    const res = await fetch(`${BACKEND_URL}/api/meetings/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId, username })
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Failed to join meeting");
      return;
    }

    // Save username and meetingId in localStorage
    localStorage.setItem("username", username);
    localStorage.setItem("meetingId", meetingId);

    navigate(`/meeting/${meetingId}`);
  };

  return (
    <div>
      <h3>Join a Meeting</h3>
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
      <button onClick={joinMeeting}>Join Meeting</button>
      <br /><br />
      <button onClick={() => navigate("/")}>Back</button>
    </div>
  );
}

// Meeting Room Page with Socket.IO + Chat
function MeetingRoom() {
  const { meetingId } = useParams();
  const [meeting, setMeeting] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const navigate = useNavigate();

  const username = localStorage.getItem("username");
  const storedMeetingId = localStorage.getItem("meetingId");

  // Initialize Socket.IO
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!username || !storedMeetingId) {
      navigate("/");
      return;
    }

    const joinExistingMeeting = async () => {
      const res = await fetch(`${BACKEND_URL}/api/meetings/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: storedMeetingId, username })
      });
      const data = await res.json();
      setMeeting(data);
      setParticipants(data.participants || []);
    };

    joinExistingMeeting();

    // Setup Socket.IO
    const s = io(BACKEND_URL);
    setSocket(s);

    s.emit("join", { meetingId: storedMeetingId, username });

    s.on("user-joined", (user) => {
      setParticipants(prev => [...prev, user]);
      setMessages(prev => [...prev, { system: true, text: `${user} joined the meeting` }]);
    });

    s.on("user-left", (user) => {
      setParticipants(prev => prev.filter(u => u !== user));
      setMessages(prev => [...prev, { system: true, text: `${user} left the meeting` }]);
    });

    s.on("message", (msg) => {
      // if (msg.senderSocketId === socket.id) return;
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      s.emit("leave", { meetingId: storedMeetingId, username });
      s.disconnect();
    };
  }, [navigate]);

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    const msg = { username, text: newMessage };
    socket.emit("message", { meetingId: storedMeetingId, username, text: newMessage });
    // setMessages(prev => [...prev, msg]);
    setNewMessage("");
  };

  const leaveMeeting = async () => {
    await fetch(`${BACKEND_URL}/api/meetings/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId: storedMeetingId, username })
    });
    localStorage.removeItem("username");
    localStorage.removeItem("meetingId");
    navigate("/");
  };

  if (!meeting) return <p>Loading meeting...</p>;

  return (
    <div style={{ display: "flex", gap: "20px" }}>
      {/* Participants List */}
      <div style={{ flex: 1 }}>
        <h3>Meeting ID: {meeting.meetingId}</h3>
        <h4>Participants</h4>
        <ul>
          {participants.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <button onClick={leaveMeeting}>Leave Meeting</button>
      </div>

      {/* Chat Box */}
      <div style={{ flex: 1 }}>
        <h4>Chat</h4>
        <div style={{ height: "300px", overflowY: "scroll", border: "1px solid #ccc", padding: "5px" }}>
          {messages.map((m, i) => (
            <p key={i} style={{ color: m.system ? "gray" : "black" }}>
              {m.system ? m.text : <><b>{m.username}:</b> {m.text}</>}
            </p>
          ))}
        </div>
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message"
          style={{ width: "80%", padding: "5px", marginTop: "5px" }}
        />
        <button onClick={sendMessage} style={{ padding: "5px 10px", marginLeft: "5px" }}>Send</button>
      </div>
    </div>
  );
}

// Main App
function App() {
  return (
    <Router>
      <div style={{ padding: 20 }}>
        <h2>Mini Google Meet (Step 2 - Real-time Chat)</h2>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/create" element={<CreateMeeting />} />
          <Route path="/join" element={<JoinMeeting />} />
          <Route path="/meeting/:meetingId" element={<MeetingRoom />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
