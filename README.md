# Solve Intelligence Engineering Challenge

## Objective

You have received a mock-up of a patent reviewing application from a junior colleague. It is incomplete and needs work. Your job is to extend and improve it to a standard you'd be comfortable shipping to production. This means:

- Clean code that is production quality
- Unit tests
- No bugs

After completing the tasks below, add a couple of sentences to the end of this file briefly outlining what improvements you made.

## Docker

Make sure you create a .env file (see .env.example) with the OpenAI API key we have provided.

To build and run the application using Docker, execute the following command:

```
docker-compose up --build
```

## Task 1: Implement Document Versioning

Currently, the user can save a document, but there is no concept of **versioning**. Paying customers have expressed an interest in this and have requested the following:

1. The ability to create new versions
2. The ability to switch between existing versions
3. The ability to make changes to any of the existing versions and save those changes (without creating a new version)

You will need to modify the database model (`app/models.py`), add some API routes (`app/__main__.py`), and update the client-side code accordingly.

## Task 2: Choose One of the Following

Complete **one** of the two options below.

### Option A: AI-Powered Document Editing

Implement a chat interface that allows users to edit the patent document using natural language instructions.

Minimal Requirements:

1. A chat-style UI panel where users can type editing instructions
2. The AI should interpret the instruction and modify the document HTML accordingly
3. Changes should be applied to the editor and visible immediately
4. Support drag-and-drop .txt file upload to the chat to provide additional context for the AI

Example instructions your solution should handle:

- "Make claim 1 bold"
- "Delete claim 3"
- "Add a new dependent claim after claim 2 that specifies the material is glass"
- "Write a background section based on the prior art file I have uploaded"

### Option B: Live Collaboration

Implement real-time collaborative editing so multiple users can work on the same document simultaneously.

Minimal Requirements:

1. Multiple users should be able to view and edit the same document at the same time
2. Changes made by one user should appear in real-time for all other users
3. Show presence indicators (e.g., cursors, user avatars) to indicate where other users are editing
4. Handle conflict resolution gracefully when multiple users edit the same section

## Note

You may use AI (and the API key we have provided) to assist with coding on this task. When we review submissions we will stress test your solution across a range of inputs and common user behaviours, so do consider this when designing your solution. 

If your submission passes our review, the next stage will involve pair programming without AI assistance.

Good luck!

---

## Improvements

**Task 1 — Document versioning:** Implemented full version control for each document: users can create versions, switch between them, and save edits to any version without creating a new one.

**Task 2 Option A — AI-powered editing:** Added a chat panel for natural-language editing instructions (including drag-and-drop `.txt` context). AI suggestions are staged for review—users apply or discard before changes land in the editor. Each document version keeps its own chat history and pending AI edits; switching versions restores the correct sidebar state. The save button indicates when the editor content differs from the last saved state for the active version.

## Future Development

### Option B: Live Collaboration

If I were to tackle Option B alongside the existing AI editor, I would use **Y.js + TipTap Collaboration + a Hocuspocus WebSocket server**. 

[https://tiptap.dev/docs/hocuspocus/getting-started/overview](https://tiptap.dev/docs/hocuspocus/getting-started/overview)

[https://tiptap.dev/docs/collaboration/getting-started/overview](https://tiptap.dev/docs/collaboration/getting-started/overview)

**Architecture**

- Add a small Node `collab-server` service (Hocuspocus) to `docker-compose.yml`, separate from the FastAPI REST API.
- Map each collaborative session to a room keyed by document and version: `doc-{documentId}-v-{versionId}`. This aligns with the existing versioning session keys and API routes. Switching versions tears down one room and connects to another.
- On room load, Hocuspocus would seed the Y.js document from the existing `GET /document/{id}/versions/{versionId}` endpoint.

**Client changes**

- Add `@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-cursor`, `yjs`, and `@hocuspocus/provider`.
- Create a `useCollaboration` hook to handle connections and disconnections to the rooms.

