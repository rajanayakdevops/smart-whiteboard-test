import { useState } from "react";
import { saveUser } from "../api/meetingApi";

const Home = () => {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  const handleSubmit = async () => {
    if (!name) return alert("Enter name");

    const data = await saveUser(name);
    setMsg(`Stored in DB with ID: ${data._id}`);
  };

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1>Smart Whiteboard</h1>

      <input
        placeholder="Enter your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <br /><br />

      <button onClick={handleSubmit}>Continue</button>

      <p>{msg}</p>
    </div>
  );
};

export default Home;
