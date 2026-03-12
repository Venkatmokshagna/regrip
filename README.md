# SyncDoc – AI-Powered Collaborative Workspace

A real-time, multi-user document editor with live chat, file sharing, and Gemini AI insights.

## Live Demo

| Service | URL |
|---|---|
| Frontend | _Deploy to Vercel — https://frontend-phi-brown-eeffo4dhl7.vercel.app/login |
| Backend API | _Deploy to Railway/Render — add link here_ |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, TypeScript, TailwindCSS, Tiptap |
| Backend | Node.js, Express, Socket.IO |
| Database | MySQL via Prisma ORM |
| Real-time Sync | Yjs (CRDT), y-socket.io |
| AI | Google Gemini 1.5 Flash (streaming) |
| File Storage | Cloudinary |

---

## Features

- 🔐 Auth (JWT) with Register / Login
- 📄 Create, rename, delete documents
- 👥 Share documents by email with role assignment (Owner / Editor / Viewer)
- ✏️ Real-time collaborative rich-text editor (Tiptap + Yjs)
- 🟢 Presence — see who is online in the document
- 💬 Live per-document chat sidebar
- 📎 File sharing (images, PDFs) via Cloudinary — inline image previews
- 🤖 Gemini AI — "Summarize Document" and "Fix Grammar & Tone" with token streaming
- 🚫 Strict backend RBAC — Viewers get `403 Forbidden` on any write API call

---

## Real-Time Concurrency

SyncDoc handles simultaneous edits using **Yjs**, a production-grade CRDT (Conflict-free Replicated Data Type) library.

### How it works

1. Every document has a shared **Y.Doc** instance on the server, managed by `YSocketIO` (the server-side Yjs adapter for Socket.IO).
2. Each client creates its own local `Y.Doc` and connects via `SocketIOProvider` (the client-side Yjs adapter).
3. When a user types, Yjs encodes only the **delta (change)** as a binary update and sends it over the Socket.IO connection.
4. All other connected clients receive the update and merge it into their local doc automatically.
5. **No central lock, no "last write wins"** — CRDT math guarantees that all clients converge to the same document state regardless of network order or timing.

### Conflict resolution

Yjs uses an **optimistic concurrency model**: every character insertion is tagged with a unique logical clock and author ID. If two users type at exactly the same position simultaneously:
- Both insertions are accepted.
- The merge algorithm deterministically orders them (by clock, then by author ID).
- The result is consistent across all peers without data loss.

This is the same algorithm used by Notion, Linear, and Figma for real-time collaboration.

---

## RBAC Database Schema

```
User ──────────────────────────────────────────────────────────────┐
│ id, name, email, password                                        │
└───────────────────────────────────────────────────────────────────

Document ──────────────────────────────────────────────────────────┐
│ id, title, content (LongText), ownerId → User                   │
└───────────────────────────────────────────────────────────────────

UserDocumentRole ───────────────────────────────────────────────────
│ userId  → User          (FK, cascade delete)                     │
│ documentId → Document   (FK, cascade delete)                     │
│ role    → OWNER | EDITOR | VIEWER                                │
│ @@unique([userId, documentId])   ← one role per user per doc     │
└───────────────────────────────────────────────────────────────────

ChatMessage ────────────────────────────────────────────────────────
│ documentId → Document                                            │
│ userId     → User                                                │
│ message    (optional text)                                       │
│ fileUrl    (optional Cloudinary URL)                             │
└───────────────────────────────────────────────────────────────────
```

### How enforcement works

- Every protected API route passes through `authenticateToken` (JWT check) then `requireRole(['EDITOR'])` or `requireRole(['EDITOR', 'VIEWER'])`.
- `requireRole` queries `UserDocumentRole` and checks if the authenticated user's role is in the allowed list.
- Owners always bypass the role check (they have implicit full access).
- The Socket.IO server performs the same check on connection — Viewers cannot emit `sync-update` or `send-message` events.

---

## Local Setup

### Prerequisites
- Node.js 18+
- MySQL running locally
- Cloudinary account (free)
- Google Gemini API key

### Backend

```bash
cd backend
npm install
```

Create `backend/.env`:
```env
DATABASE_URL="mysql://root:yourpassword@localhost:3306/syncdoc"
JWT_SECRET="your-secret"
PORT=5000
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
GEMINI_API_KEY="your_gemini_key"
```

```bash
npx prisma db push   # sync schema to MySQL
npm run dev          # start on http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # start on http://localhost:3000
```

---

## Project Structure

```
Regrip/
├── backend/
│   ├── prisma/schema.prisma      # DB schema
│   ├── src/
│   │   ├── index.ts              # Express app entry
│   │   ├── socket.ts             # Socket.IO + Yjs server
│   │   ├── middleware/
│   │   │   ├── auth.ts           # JWT verification
│   │   │   └── rbac.ts           # Role enforcement
│   │   └── routes/
│   │       ├── auth.ts           # /api/auth
│   │       ├── documents.ts      # /api/documents
│   │       ├── ai.ts             # /api/documents/:id/ai
│   │       └── upload.ts         # /api/upload (Cloudinary)
└── frontend/
    └── src/
        ├── app/
        │   ├── dashboard/        # Document list
        │   ├── doc/[id]/         # Document workspace
        │   ├── login/
        │   └── register/
        ├── components/
        │   ├── Editor.tsx        # Tiptap + Yjs editor
        │   ├── ChatPanel.tsx     # Live chat + file upload
        │   └── AIAssistant.tsx   # Gemini streaming panel
        └── lib/api.ts            # Axios + socket config
```
