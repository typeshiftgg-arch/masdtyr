import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
import serverless from "serverless-http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use /tmp for SQLite in serverless environments (ephemeral but allowed)
const dbPath = process.env.NETLIFY ? "/tmp/expenses.db" : "expenses.db";
const db = new Database(dbPath);

// Initialize Database
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

const app = express();
app.use(express.json({ limit: '10mb' }));

// API Routes
const router = express.Router();

router.get("/expenses", (req, res) => {
  const expenses = db.prepare("SELECT * FROM expenses ORDER BY date DESC").all();
  res.json(expenses);
});

router.post("/expenses", (req, res) => {
  const { title, amount, category, date, notes } = req.body;
  const info = db.prepare(
    "INSERT INTO expenses (title, amount, category, date, notes) VALUES (?, ?, ?, ?, ?)"
  ).run(title, amount, category, date, notes);
  res.json({ id: info.lastInsertRowid });
});

router.delete("/expenses/:id", (req, res) => {
  db.prepare("DELETE FROM expenses WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

router.post("/send-report", async (req, res) => {
  const { email } = req.body;
  const targetEmail = email || process.env.REPORT_RECEIVER_EMAIL;

  if (!targetEmail) {
    return res.status(400).json({ error: "No receiver email provided" });
  }

  const expenses = db.prepare("SELECT * FROM expenses WHERE date >= date('now', 'start of month')").all();
  const total = expenses.reduce((sum: any, exp: any) => sum + exp.amount, 0);
  
  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost && smtpHost.includes('@')) {
    return res.status(400).json({ 
      error: "Invalid SMTP_HOST. It should be a server address (e.g., smtp.gmail.com), not an email address." 
    });
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const html = `
    <h1>Monthly Expense Report</h1>
    <p>Total Expenses this month: <strong>$${total.toFixed(2)}</strong></p>
    <table border="1" style="border-collapse: collapse; width: 100%;">
      <thead>
        <tr>
          <th>Date</th>
          <th>Title</th>
          <th>Category</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${expenses.map((exp: any) => `
          <tr>
            <td>${exp.date}</td>
            <td>${exp.title}</td>
            <td>${exp.category}</td>
            <td>$${exp.amount.toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  try {
    if (!smtpHost || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error("Missing SMTP configuration in secrets.");
    }
    await transporter.sendMail({
      from: `"SmartSpend Tracker" <${process.env.SMTP_USER}>`,
      to: targetEmail,
      subject: "Your Monthly Expense Report",
      html,
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Email error:", error);
    res.status(500).json({ error: error.message || "Failed to send email. Check SMTP settings." });
  }
});

app.use("/api", router);

// Export for Netlify
export const handler = serverless(app);

// Local development server
if (process.env.NODE_ENV !== "production" && !process.env.NETLIFY) {
  async function startDevServer() {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
  startDevServer();
}

