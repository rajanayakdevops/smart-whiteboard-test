import { useState } from "react";

function App() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [responseMessage, setResponseMessage] = useState("");
  const [contacts, setContacts] = useState([]); // store all contacts

  const backendURL = import.meta.env.VITE_BACKEND_URL;

  // Function to save contact
  const saveContact = () => {
    if (!name || !email || !message) {
      alert("Please fill all fields");
      return;
    }

    fetch(`${backendURL}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message }),
    })
      .then((res) => res.json())
      .then((data) => {
        setResponseMessage(data.message);
        setName("");
        setEmail("");
        setMessage("");
      })
      .catch((err) => console.error(err));
  };

  // Function to get all contacts
const getAllContacts = () => {
  fetch(`${backendURL}/api/contact`)
    .then((res) => res.json())
    .then((data) => {
      console.log("API response:", data); // DEBUG
      setContacts(data.contacts); // ✅ IMPORTANT FIX
    })
    .catch((err) => console.error(err));
};

  return (
    <div style={{ minHeight: "100vh", width: "100vw", padding: "20px" }}>
      <h1>Contact Info</h1>

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

      <div style={{ marginBottom: "20px" }}>
        <button onClick={saveContact} style={{ padding: "10px 20px", marginRight: "10px" }}>
          Add Contact
        </button>
        <button onClick={getAllContacts} style={{ padding: "10px 20px" }}>
          Get All Contacts
        </button>
      </div>

      {responseMessage && <h2>{responseMessage}</h2>}

      <hr style={{ margin: "20px 0" }} />

      {contacts.length > 0 && (
        <div>
          <h2>All Contacts:</h2>
          <ul>
            {contacts.map((contact) => (
              <li key={contact._id}>
                <strong>Name:</strong> {contact.name} | <strong>Email:</strong> {contact.email} |{" "}
                <strong>Message:</strong> {contact.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
