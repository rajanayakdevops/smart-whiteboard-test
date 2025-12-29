import { useState } from "react";

function App() {
  const [message, setMessage] = useState("");

  const callTestApi = () => {
    fetch(import.meta.env.VITE_BACKEND_URL + "/api/test")
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(err => console.error(err));
  };

  const callContactApi = () => {
    fetch(import.meta.env.VITE_BACKEND_URL + "/api/contact")
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(err => console.error(err));
  };

  return (
<div
  style={{
    // padding: "40px",
    backgroundColor: "red",
    // minHeight: "100v",
  }}
>
  <h1>Home Page ✅</h1>

  <button onClick={callTestApi} style={{ marginRight: "10px" }}>
    Test API
  </button>

  <button onClick={callContactApi}>
    Contact API
  </button>

  <hr />

  <h2>{message}</h2>
</div>

  );
}

export default App;
