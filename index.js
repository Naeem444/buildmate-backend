// index.js
import express from "express";
import pg from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "*",
    credentials: false,
  })
);
app.use(express.json({ limit: "5mb" }));

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: { rejectUnauthorized: false },

  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: false,
});


(async () => {
  try {
    const r = await pool.query("select 1 as ok");
    console.log("DB ready:", r.rows[0]);
  } catch (e) {
    console.error("DB boot check failed:", e.message);
  }
})();

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET ;


app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/dbcheck", async (_req, res) => {
  try {
    const { rows } = await pool.query("select now() as ts");
    return res.json({ ok: true, ts: rows[0].ts });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/signup", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const dup = await pool.query("SELECT 1 FROM users WHERE email=$1", [email]);
    if (dup.rowCount)
      return res.status(400).json({ message: "Email already exists" });

    const hash = await bcrypt.hash(password, 10);
    await pool.query("INSERT INTO users (email, password) VALUES ($1, $2)", [
      email,
      hash,
    ]);
    return res.json({ message: "User registered" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
});


app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const { rows } = await pool.query(
      "SELECT id, email, password FROM users WHERE email=$1",
      [email]
    );
    if (!rows.length)
      return res.status(400).json({ message: "Invalid credentials" });
    const user = rows[0];

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });
    return res.json({ token });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
});

// Auth middleware
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "No token" });
  try {
    const token = header.split(" ")[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
}


app.get("/api/resume", auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM resumes WHERE user_id=$1",
      [req.user.id]
    );
    return res.json(rows[0] || {});
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
});
app.post("/api/resume", auth, async (req, res) => {
  try {
    const {
      full_name = "",
      title = "",
      summary = "",
      education = [],      
      experience = [],     
      skills = [],         
      photo_data = null,   
    } = req.body || {};


    const educationJson = JSON.stringify(Array.isArray(education) ? education : []);
    const experienceJson = JSON.stringify(Array.isArray(experience) ? experience : []);
    const skillsArr = Array.isArray(skills) ? skills : [];

    const { rows } = await pool.query("SELECT id FROM resumes WHERE user_id=$1", [req.user.id]);

    if (rows.length) {
      await pool.query(
        `UPDATE resumes
           SET full_name = $1,
               title = $2,
               summary = $3,
               education = $4::jsonb,
               experience = $5::jsonb,
               skills = $6::text[],
               photo_data = $7,
               updated_at = NOW()
         WHERE user_id = $8`,
        [full_name, title, summary, educationJson, experienceJson, skillsArr, photo_data, req.user.id]
      );
    } else {
      await pool.query(
        `INSERT INTO resumes
           (user_id, full_name, title, summary, education, experience, skills, photo_data)
         VALUES
           ($1,      $2,       $3,    $4,     $5::jsonb, $6::jsonb, $7::text[], $8)`,
        [req.user.id, full_name, title, summary, educationJson, experienceJson, skillsArr, photo_data]
      );
    }

    return res.json({ message: "Resume saved" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error", detail: e.message });
  }
});

app.listen(PORT, () =>
  console.log(`BuildMate API running on http://localhost:${PORT}`)
);
