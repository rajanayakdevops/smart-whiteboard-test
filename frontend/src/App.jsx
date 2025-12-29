import { useState } from "react";

function App() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [responseMessage, setResponseMessage] = useState("");

  // Function to save contact
  const saveContact = () => {
    if (!name || !email || !message) {
      alert("Please fill all fields");
      return;
    }

    fetch(import.meta.env.VITE_BACKEND_URL + "/api/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, message }),
    })
      .then((res) => res.json())
      .then((data) => {
        setResponseMessage(data.message);
        // Clear form after saving
        setName("");
        setEmail("");
        setMessage("");
      })
      .catch((err) => console.error(err));
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        padding: "20px",
      }}
    >
      <h1>Save Contact Info</h1>

      <div style={{ marginBottom: "10px" }}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: "8px", width: "300px", marginRight: "10px" }}
        />
      </div>

      <div style={{ marginBottom: "10px" }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: "8px", width: "300px", marginRight: "10px" }}
        />
      </div>

      <div style={{ marginBottom: "10px" }}>
        <textarea
          placeholder="Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ padding: "8px", width: "300px", height: "100px" }}
        />
      </div>

      <button onClick={saveContact} style={{ padding: "10px 20px" }}>
        Save Contact
      </button>

      <hr style={{ margin: "20px 0" }} />

      {responseMessage && <h2>{responseMessage}</h2>}
    </div>
  );
}

export default App;
