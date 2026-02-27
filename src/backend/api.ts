import express from "express";
import Database from "better-sqlite3";
import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";

const router = express.Router();

// Use /tmp for SQLite in serverless environments
const dbPath = process.env.NETLIFY ? "/tmp/expenses.db" : "expenses.db";
let db: any;

try {
  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      notes TEXT
    )
  `);
} catch (e) {
  console.error("Database initialization failed:", e);
}

router.get("/expenses", (req, res) => {
  try {
    const expenses = db.prepare("SELECT * FROM expenses ORDER BY date DESC").all();
    res.json(expenses);
  } catch (e) {
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/expenses", (req, res) => {
  try {
    const { title, amount, category, date, notes } = req.body;
    const info = db.prepare(
      "INSERT INTO expenses (title, amount, category, date, notes) VALUES (?, ?, ?, ?, ?)"
    ).run(title, amount, category, date, notes);
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: "Database error" });
  }
});

router.delete("/expenses/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM expenses WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/send-report", async (req, res) => {
  const { email } = req.body;
  const targetEmail = email || process.env.REPORT_RECEIVER_EMAIL;

  if (!targetEmail) {
    return res.status(400).json({ error: "No receiver email provided" });
  }

  try {
    const expenses = db.prepare("SELECT * FROM expenses WHERE date >= date('now', 'start of month')").all();
    const total = expenses.reduce((sum: any, exp: any) => sum + exp.amount, 0);
    
    const smtpHost = process.env.SMTP_HOST;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const html = `<h1>Monthly Report</h1><p>Total: $${total.toFixed(2)}</p>`;

    await transporter.sendMail({
      from: `"SmartSpend" <${process.env.SMTP_USER}>`,
      to: targetEmail,
      subject: "Monthly Expense Report",
      html,
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
