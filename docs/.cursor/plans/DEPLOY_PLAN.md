---
name: railway-deploy-server
overview: Deploy the Bun WebSocket server to a new Railway project using a Dockerfile, updating the server to honor the Railway-assigned PORT and documenting run steps.
todos:
  - id: update-port-env
    content: Update server to read PORT from env.
    status: completed
  - id: add-dockerfile
    content: Add Bun-based Dockerfile under server/.
    status: completed
  - id: doc-railway
    content: Document Railway deploy steps in server README.
    status: completed
isProject: false
---

# Railway Deploy Plan

## Context

- Server entry point is `server/src/index.ts` and currently binds to a fixed port 3000.
- No environment variables are referenced in code today (no `process.env` usage found).
- No `Dockerfile` exists in the repo; Railway needs one for Docker-based deploys.

## Proposed changes

- Update the server to read `PORT` from the environment with a fallback to 3000 so Railway can inject its port. This is a small change in `server/src/index.ts`.
- Add a `Dockerfile` under `server/` that installs Bun, installs dependencies, and runs `bun run src/index.ts` for production.
- Add minimal deployment notes to `server/README.md` (or a new short section) covering Railway steps and the WebSocket URL pattern.

## Railway steps

- Create a new Railway project.
- Add a new service from this repo, pointing at the `server/` directory and Dockerfile.
- Configure the service to expose the `PORT` Railway assigns (handled by the code change).
- Deploy and verify by connecting to `wss://<railway-domain>` and sending `join` / `answer` messages.

## Files to touch

- `/Users/huy.ly/personal/coding-challenges/server/src/index.ts` (read `PORT` from env, fallback to 3000)
- `/Users/huy.ly/personal/coding-challenges/server/Dockerfile` (new)
- `/Users/huy.ly/personal/coding-challenges/server/README.md` (add deployment notes)

## Notes/assumptions

- SQLite persistence is not required; ephemeral filesystem is OK.
- No additional env vars are needed beyond `PORT`.

## Todos

- update-port-env: Update server to read `PORT` from env.
- add-dockerfile: Add Bun-based Dockerfile in `server/`.
- doc-railway: Document Railway deploy steps in `server/README.md`.
