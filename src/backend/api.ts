import express from "express";
import nodemailer from "nodemailer";

const router = express.Router();

// In-memory fallback store for serverless environments where SQLite fails
let memoryExpenses: any[] = [];

// Use /tmp for SQLite in serverless environments
const isServerless = process.env.NETLIFY || process.env.VERCEL;
const dbPath = isServerless ? "/tmp/expenses.db" : "expenses.db";
let db: any = null;
let useMemoryFallback = false;

async function getDb() {
  if (db) return db;
  if (useMemoryFallback) return null;

  try {
    // Dynamic import to prevent top-level crash if binary is missing
    const { default: Database } = await import("better-sqlite3");
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
    console.log("Database initialized successfully at", dbPath);
    return db;
  } catch (e: any) {
    console.error("Database initialization failed, falling back to in-memory store:", e.message);
    useMemoryFallback = true;
    return null;
  }
}

router.get("/expenses", async (req, res) => {
  try {
    const database = await getDb();
    if (database) {
      const expenses = database.prepare("SELECT * FROM expenses ORDER BY date DESC").all();
      return res.json(expenses);
    }
    // Fallback to memory
    res.json([...memoryExpenses].sort((a, b) => b.date.localeCompare(a.date)));
  } catch (e: any) {
    console.error("GET /expenses error:", e.message);
    res.status(500).json({ error: "API Error: " + e.message });
  }
});

router.post("/expenses", async (req, res) => {
  try {
    const { title, amount, category, date, notes } = req.body;
    const database = await getDb();
    
    if (database) {
      const info = database.prepare(
        "INSERT INTO expenses (title, amount, category, date, notes) VALUES (?, ?, ?, ?, ?)"
      ).run(title, amount, category, date, notes);
      return res.json({ id: info.lastInsertRowid });
    }

    // Fallback to memory
    const newExpense = {
      id: Date.now(),
      title,
      amount,
      category,
      date,
      notes
    };
    memoryExpenses.push(newExpense);
    res.json({ id: newExpense.id, warning: "Using temporary in-memory storage" });
  } catch (e: any) {
    console.error("POST /expenses error:", e.message);
    res.status(500).json({ error: "API Error: " + e.message });
  }
});

router.delete("/expenses/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const database = await getDb();
    
    if (database) {
      database.prepare("DELETE FROM expenses WHERE id = ?").run(id);
      return res.json({ success: true });
    }

    // Fallback to memory
    memoryExpenses = memoryExpenses.filter(exp => exp.id.toString() !== id.toString());
    res.json({ success: true });
  } catch (e: any) {
    console.error("DELETE /expenses error:", e.message);
    res.status(500).json({ error: "API Error: " + e.message });
  }
});

router.post("/send-report", async (req, res) => {
  const { email } = req.body;
  const targetEmail = email || process.env.REPORT_RECEIVER_EMAIL;

  if (!targetEmail) {
    return res.status(400).json({ error: "No receiver email provided" });
  }

  try {
    const database = await getDb();
    let expenses = [];
    
    if (database) {
      expenses = database.prepare("SELECT * FROM expenses WHERE date >= date('now', 'start of month')").all();
    } else {
      expenses = memoryExpenses.filter(exp => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        return exp.date >= startOfMonth;
      });
    }

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
      subject: "Your Monthly Expense Report",
      html,
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Email error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;

