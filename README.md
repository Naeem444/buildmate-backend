# BuildMate: Backend (Node + Express + PostgreSQL)

A minimal, production-ready API for the **BuildMate** resume/portfolio app.

- **Auth:** Email + password with JWT 
- **DB:** PostgreSQL (Supabase friendly)
- **Data:** Store only user/resume data (no PDF files). Optional base64 `photo_data` stored as text.
- **Endpoints:** `/api/signup`, `/api/login`, `/api/resume (GET/POST)`

---

## Tech

- **Node.js**, **Express**
- **pg / pg-pool**
- **bcryptjs**, **jsonwebtoken**
- **cors**, **helmet**
- Works great with **Supabase** 

