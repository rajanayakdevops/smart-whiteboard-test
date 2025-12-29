// require("dotenv").config(); // Load .env variables

// const express = require("express");
// const cors = require("cors");
// const mongoose = require("mongoose");

// const app = express();
// app.use(cors());
// app.use(express.json());

// /* ------------------ MongoDB Connection ------------------ */
// mongoose
//   .connect(process.env.MONGO_URI)
//   .then(() => console.log("MongoDB connected ✅"))
//   .catch((err) => console.error("MongoDB connection error ❌", err));

// /* ------------------ Schema & Model ------------------ */
// const contactSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   email: { type: String, required: true },
//   message: { type: String, required: true },
//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },
// });

// const Contact = mongoose.model("Contact", contactSchema);

// /* ------------------ Routes ------------------ */

// // Test route
// app.get("/api/test", (req, res) => {
//   res.json({ message: "Backend working successfully 🚀" });
// });

// // Save contact (POST /api/contact)
// app.post("/api/contact", async (req, res) => {
//   try {
//     console.log("Incoming request body:", req.body);

//     const { name, email, message } = req.body;

//     if (!name || !email || !message) {
//       return res.status(400).json({ message: "All fields are required ❌" });
//     }

//     const newContact = new Contact({ name, email, message });

//     console.log("Before save");

//     const savedContact = await newContact.save(); // Save to MongoDB

//     console.log("Saved successfully:", savedContact);

//     res.json({ message: "Contact saved successfully ✅", contact: savedContact });
//   } catch (error) {
//     console.error("SAVE ERROR 👉", error);

//     res.status(500).json({
//       message: "Error saving contact ❌",
//       error: error.message,
//     });
//   }
// });

// // Get all contacts (GET /api/contact)
// app.get("/api/contact", async (req, res) => {
//   try {
//     const contacts = await Contact.find();
//     console.log("Contacts fetched:", contacts.length);
//     res.json({ contacts });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Error fetching contacts" });
//   }
// });


// /* ------------------ Server ------------------ */
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Backend running on port ${PORT}`);
// });

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const meetingRoutes = require("./routes/meetings");

const app = express();

app.use(cors());
app.use(express.json());

// API routes
app.use("/api/meetings", meetingRoutes);

// DB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

// Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
