# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # First-time setup: install deps, generate Prisma client, run migrations
npm run dev          # Dev server with Turbopack
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest unit tests (run all)
npx vitest run src/components/chat/__tests__/ChatInterface.test.tsx  # Run a single test file
npm run db:reset     # Force reset database migrations
```

Environment: copy `.env` and add `ANTHROPIC_API_KEY`. Without it, the app uses a `MockLanguageModel` that returns deterministic responses.

## Architecture

UIGen is a **Next.js 15 App Router** app that lets users generate React components via AI chat, with live preview in an iframe.

### Request Flow

1. User sends a chat message → `POST /api/chat` (`src/app/api/chat/route.ts`)
2. The route initializes a `VirtualFileSystem` from serialized project data
3. It calls the Anthropic API (or mock) with an agentic loop (max 40 steps)
4. Claude calls tools (`str_replace_editor`, `file_manager`) to create/edit files in the VFS
5. The streaming response is returned; tool call results trigger React state updates
6. If authenticated, the project (messages + VFS data) is saved to SQLite via Prisma

### Virtual File System (`src/lib/file-system.ts`)

Central to the app — an in-memory `Map`-based file tree with no disk writes. Serializes to/from JSON for database persistence. Both the AI tools and the frontend preview share the same VFS state via `FileSystemContext` (`src/lib/file-system-context.tsx`).

### Preview System (`src/components/preview/PreviewFrame.tsx` + `src/lib/transform/jsx-transformer.ts`)

- Babel (`@babel/standalone`) transpiles JSX/TSX to vanilla JS in-browser
- Creates blob URLs for each file; generates an HTML document with an ES module import map
- Renders in a sandboxed `<iframe>`
- Auto-detects the entry point (`App.jsx`, `App.tsx`, `index.jsx`, etc.)

### AI Tools (`src/lib/tools/`)

- `str_replace_editor`: Creates or edits files via string replacement (Claude's primary tool)
- `file_manager`: Renames or deletes files

### State Management

- `FileSystemContext` (`src/lib/file-system-context.tsx`): VFS state + file operations + tool call handler
- `ChatContext` (`src/lib/chat-context.tsx`): wraps Vercel AI SDK's `useChat`, manages messages and triggers preview re-renders

### Auth (`src/lib/auth.ts`)

JWT in HTTP-only cookies (7-day expiry), bcrypt passwords. Server Actions in `src/actions/` handle sign-up/sign-in/sign-out. Projects are linked to users; anonymous sessions track work via `src/lib/anon-work-tracker.ts`.

### Database

Prisma + SQLite. Two models: `User` and `Project` (stores `messages` and `data` as JSON strings). Schema: `prisma/schema.prisma`.

### UI Layout (`src/app/main-content.tsx`)

Resizable panels (via `react-resizable-panels`): left = chat interface, right = toggle between live preview and Monaco code editor. shadcn/ui components under `src/components/ui/`.

### Path alias

`@/*` maps to `src/*`.
