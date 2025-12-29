// import { useState } from "react";
// function App() {
//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [message, setMessage] = useState("");
//   const [responseMessage, setResponseMessage] = useState("");
//   const [contacts, setContacts] = useState([]); // store all contacts

//   const backendURL = import.meta.env.VITE_BACKEND_URL;

//   // Function to save contact
//   const saveContact = () => {
//     if (!name || !email || !message) {
//       alert("Please fill all fields");
//       return;
//     }

//     fetch(`${backendURL}/api/contact`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ name, email, message }),
//     })
//       .then((res) => res.json())
//       .then((data) => {
//         setResponseMessage(data.message);
//         setName("");
//         setEmail("");
//         setMessage("");
//       })
//       .catch((err) => console.error(err));
//   };

//   // Function to get all contacts
// const getAllContacts = () => {
//   fetch(`${backendURL}/api/contact`)
//     .then((res) => res.json())
//     .then((data) => {
//       console.log("API response:", data); // DEBUG
//       setContacts(data.contacts); // ✅ IMPORTANT FIX
//     })
//     .catch((err) => console.error(err));
// };

//   return (
//     <div style={{ minHeight: "100vh", width: "100vw", padding: "20px" }}>
//       <h1>Contact Info</h1>

//       <div style={{ marginBottom: "10px" }}>
//         <input
//           type="text"
//           placeholder="Name"
//           value={name}
//           onChange={(e) => setName(e.target.value)}
//           style={{ padding: "8px", width: "300px", marginRight: "10px" }}
//         />
//       </div>

//       <div style={{ marginBottom: "10px" }}>
//         <input
//           type="email"
//           placeholder="Email"
//           value={email}
//           onChange={(e) => setEmail(e.target.value)}
//           style={{ padding: "8px", width: "300px", marginRight: "10px" }}
//         />
//       </div>

//       <div style={{ marginBottom: "10px" }}>
//         <textarea
//           placeholder="Message"
//           value={message}
//           onChange={(e) => setMessage(e.target.value)}
//           style={{ padding: "8px", width: "300px", height: "100px" }}
//         />
//       </div>

//       <div style={{ marginBottom: "20px" }}>
//         <button onClick={saveContact} style={{ padding: "10px 20px", marginRight: "10px" }}>
//           Add Contact
//         </button>
//         <button onClick={getAllContacts} style={{ padding: "10px 20px" }}>
//           Get All Contacts
//         </button>
//       </div>

//       {responseMessage && <h2>{responseMessage}</h2>}

//       <hr style={{ margin: "20px 0" }} />

//       {contacts.length > 0 && (
//         <div>
//           <h2>All Contacts:</h2>
//           <ul>
//             {contacts.map((contact) => (
//               <li key={contact._id}>
//                 <strong>Name:</strong> {contact.name} | <strong>Email:</strong> {contact.email} |{" "}
//                 <strong>Message:</strong> {contact.message}
//               </li>
//             ))}
//           </ul>
//         </div>
//       )}
//     </div>
//   );
// }

// export default App;


import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from "react-router-dom";

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

// Meeting Room Page
function MeetingRoom() {
  const { meetingId } = useParams();
  const [meeting, setMeeting] = useState(null);
  const navigate = useNavigate();

  const username = localStorage.getItem("username");
  const storedMeetingId = localStorage.getItem("meetingId");

  useEffect(() => {
    if (!username || !storedMeetingId) {
      // If no info, redirect to landing
      navigate("/");
      return;
    }

    const joinExistingMeeting = async () => {
      // Always use data from localStorage to auto-join
      const res = await fetch(`${BACKEND_URL}/api/meetings/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: storedMeetingId, username })
      });
      const data = await res.json();
      setMeeting(data);
    };

    joinExistingMeeting();
  }, [navigate]); // Removed dependency on meetingId to always rejoin on forward/back

  const leaveMeeting = async () => {
    const username = localStorage.getItem("username");
    const meetingId = localStorage.getItem("meetingId");
    await fetch(`${BACKEND_URL}/api/meetings/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId, username })
    });
    localStorage.removeItem("username");
    localStorage.removeItem("meetingId");
    navigate("/");
  };

  if (!meeting) return <p>Loading meeting...</p>;

  return (
    <div>
      <h3>Meeting ID: {meeting.meetingId}</h3>
      <h4>Participants</h4>
      <ul>
        {meeting.participants.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <button onClick={leaveMeeting}>Leave Meeting</button>
    </div>
  );
}

// Main App
function App() {
  return (
    <Router>
      <div style={{ padding: 20 }}>
        <h2>Mini Google Meet (Step 1)</h2>
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
