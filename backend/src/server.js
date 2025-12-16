require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");

connectDB();

app.listen(process.env.PORT || 5000, () =>
  console.log("Server running")
);
