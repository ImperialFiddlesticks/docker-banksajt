import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Generera engångslösenord
function generateOTP() {
  // Generera en sexsiffrig numerisk OTP
  const otp = Math.floor(100000 + Math.random() * 900000);
  return otp.toString();
}

app.post("/users", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, password],
    );
    const userId = result.insertId;

    await pool.query("INSERT INTO accounts (user_id, balance) VALUES (?, 0)", [
      userId,
    ]);

    res.status(201).json({ id: userId, username });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Username already taken" });
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/sessions", async (req, res) => {
  const { username, password } = req.body;

  const [rows] = await pool.query(
    "SELECT id FROM users WHERE username = ? AND password = ?",
    [username, password],
  );
  if (rows.length === 0) {
    return res.status(401).json({ error: "Incorrect username or password" });
  }

  const token = generateOTP();
  await pool.query("INSERT INTO sessions (token, user_id) VALUES (?, ?)", [
    token,
    rows[0].id,
  ]);
  res.status(200).json({ token });
});

app.post("/me/accounts", async (req, res) => {
  const { token } = req.body;

  const [sessionRows] = await pool.query(
    "SELECT user_id FROM sessions WHERE token = ?",
    [token],
  );
  if (sessionRows.length === 0) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const [accountRows] = await pool.query(
    "SELECT balance FROM accounts WHERE user_id = ?",
    [sessionRows[0].user_id],
  );
  if (accountRows.length === 0) {
    return res.status(404).json({ error: "Account not found" });
  }

  res.status(200).json({ amount: Number(accountRows[0].balance) });
});

app.post("/me/accounts/transactions", async (req, res) => {
  const { token, amount } = req.body;
  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  const [sessionRows] = await pool.query(
    "SELECT user_id FROM sessions WHERE token = ?",
    [token],
  );
  if (sessionRows.length === 0) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const [result] = await pool.query(
    "UPDATE accounts SET balance = balance + ? WHERE user_id = ?",
    [amount, sessionRows[0].user_id],
  );
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: "Account not found" });
  }

  const [accountRows] = await pool.query(
    "SELECT balance FROM accounts WHERE user_id = ?",
    [sessionRows[0].user_id],
  );
  res.status(200).json({ amount: Number(accountRows[0].balance) });
});

// Starta servern
app.listen(port, () => {
  console.log(`Bankens backend körs på http://localhost:${port}`);
});
