require("dotenv").config(); // Load .env variables

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

/* ------------------ MongoDB Connection ------------------ */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected ✅"))
  .catch((err) => console.error("MongoDB connection error ❌", err));

/* ------------------ Schema & Model ------------------ */
const contactSchema = new mongoose.Schema({
  name: String,
  email: String,
  message: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Contact = mongoose.model("Contact", contactSchema);

/* ------------------ Routes ------------------ */

// Test route
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend working successfully 🚀" });
});

// Save contact (FROM FRONTEND)
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    const newContact = new Contact({
      name,
      email,
      message,
    });

    await newContact.save();

    res.json({ message: "Contact saved successfully ✅" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error saving contact ❌" });
  }
});

// Get all contacts (optional but useful)
app.get("/api/contact", async (req, res) => {
  const contacts = await Contact.find();
  res.json(contacts);
});

/* ------------------ Server ------------------ */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
