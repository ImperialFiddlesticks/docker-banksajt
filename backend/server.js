import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

import mysql from "mysql2/promise";
import { validateAmount } from "./src/validateAmount.js";
import { validateWithdrawal } from "./src/validateWithdrawal.js";

const secret = process.env.JWT_SECRET;

if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
  throw new Error("JWT_SECRET must be set and at least 32 bytes long");
}
const frontendOrigin = process.env.FRONTEND_ORIGIN;

if (!frontendOrigin) {
  throw new Error("FRONTEND_ORIGIN must be set");
}

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
app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

function requireAuth(req, res, next) {
  const token = req.cookies.access_token;
  if (typeof token !== "string" || token === "") {
    return res.status(401).json({ error: "Not logged in" });
  }

  let payload;
  try {
    payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "banken",
      audience: "banken-api",
    });
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof payload.sub !== "string"
  ) {
    return res.status(401).json({ error: "Invalid token" });
  }
  const userId = Number(payload.sub);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return res.status(401).json({ error: "Invalid token" });
  }
  req.userId = userId;
  next();
}

app.post("/users", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }
  if (password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters long" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      "INSERT INTO users (username, password_hash) VALUES(?,?)",
      [username, passwordHash],
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

const cookieOptions = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: "lax",
  path: "/",
};

app.post("/sessions", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  const [rows] = await pool.query(
    "SELECT id, password_hash FROM users WHERE username = ?",
    [username],
  );
  const user = rows[0];
  if (!user) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  const passwordIsCorrect = await bcrypt.compare(password, user.password_hash);
  if (!passwordIsCorrect) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const token = jwt.sign({ sub: String(user.id) }, secret, {
    algorithm: "HS256",
    issuer: "banken",
    audience: "banken-api",
    expiresIn: "15m",
  });

  res.cookie("access_token", token, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000,
  });
  res.status(200).json({ message: "Login successful" });
});

app.post("/logout", (req, res) => {
  res.clearCookie("access_token", cookieOptions);
  res.status(200).json({ message: "Logged out" });
});
app.post("/me/accounts", requireAuth, async (req, res) => {
  const [accountRows] = await pool.query(
    "SELECT balance FROM accounts WHERE user_id = ?",
    [req.userId],
  );

  if (accountRows.length === 0) {
    return res.status(404).json({ error: "Account not found" });
  }

  res.status(200).json({ amount: Number(accountRows[0].balance) });
});

app.post("/me/accounts/transactions", requireAuth, async (req, res) => {
  const { amount } = req.body;
  if (!validateAmount(amount)) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [accountRows] = await conn.query(
      "SELECT id, balance FROM accounts WHERE user_id = ? FOR UPDATE",
      [req.userId],
    );
    if (accountRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Account not found" });
    }
    const account = accountRows[0];

    await conn.query("UPDATE accounts SET balance = balance + ? WHERE id = ?", [
      amount,
      account.id,
    ]);

    await conn.query(
      "INSERT INTO transactions (account_id, amount) VALUES (?, ?)",
      [account.id, amount],
    );
    await conn.commit();

    res.status(200).json({ amount: Number(account.balance) + amount });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  } finally {
    conn.release();
  }
});

app.post("/me/accounts/withdrawals", requireAuth, async (req, res) => {
  const { amount } = req.body;
  if (!validateAmount(amount)) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [accountRows] = await conn.query(
      "SELECT id, balance FROM accounts WHERE user_id = ? FOR UPDATE",
      [req.userId],
    );
    if (accountRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Account not found" });
    }
    const account = accountRows[0];
    const balance = Number(account.balance);

    const result = validateWithdrawal(amount, balance);
    if (!result.ok) {
      await conn.rollback();
      return res.status(400).json({ error: result.error });
    }

    await conn.query("UPDATE accounts SET balance = balance - ? WHERE id = ?", [
      amount,
      account.id,
    ]);

    await conn.query(
      "INSERT INTO transactions (account_id, amount) VALUES (?, ?)",
      [account.id, -amount],
    );
    await conn.commit();

    res.status(200).json({ amount: balance - amount });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  } finally {
    conn.release();
  }
});

app.get("/me/accounts/transactions", requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT t.id, t.amount, t.created_at
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE a.user_id = ?
    ORDER BY t.created_at DESC, t.id DESC`,
    [req.userId],
  );

  res.status(200).json(
    rows.map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      createdAt: row.created_at,
    })),
  );
});

// Starta servern
app.listen(port, () => {
  console.log(`Bankens backend körs på http://localhost:${port}`);
});
