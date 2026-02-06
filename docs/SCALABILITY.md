# Scalability Concerns

This document captures every scalability concern for the real-time quiz
system and the strategies to address them at each growth stage.

## Current Architecture (Single Instance)

```
┌───────────────────┐         ┌────────────────────────────┐         ┌─────────┐
│  Flutter Mobile   │◄─────►│  Bun WebSocket Server      │───────►│ SQLite  │
│  Client           │   WS    │  (single instance)         │  file   │ (local) │
└───────────────────┘         └────────────────────────────┘         └─────────┘
```

- One Bun process holds all WebSocket connections in memory.
- SQLite is an embedded file-based database inside the same process.
- Leaderboard broadcasts iterate over an in-memory connection set.

This is **correct and sufficient** for moderate load (~100–1,000 concurrent
users per quiz).

---

## Bottleneck Analysis

| Bottleneck                | Root Cause                               | Impact                                                          |
| ------------------------- | ---------------------------------------- | --------------------------------------------------------------- |
| Single server process     | All connections in one Bun process       | Bounded by one machine's CPU and memory                         |
| In-memory connection sets | Not shared across processes              | Server crash loses all connections; can't distribute            |
| SQLite single writer      | File-level write lock, even in WAL mode  | Only one write at a time; blocks under high concurrency         |
| SQLite no network access  | Embedded library, not a client-server DB | A second server instance cannot connect to the same DB remotely |
| Broadcast fan-out         | O(N) per quiz event                      | At 10K+ clients, serialization and send dominate CPU            |

---

## Scaling Stages

### Stage 1 — Single Instance (current)

- **What works:** in-memory connections, SQLite, direct broadcast.
- **Limits:** ~1,000 concurrent users, ~1,000–5,000 writes/sec (WAL mode).
- **Action:** no changes needed.

### Stage 2 — Vertical Scaling

- Upgrade the machine (more RAM, faster CPU, faster disk).
- Bun is single-threaded but event-driven; vertical scaling extends headroom.
- **Limits:** single machine ceiling, still a single point of failure.

### Stage 3 — Horizontal Scaling (multiple server instances)

This is where the architecture must change. Three problems need solving:

#### Problem 1: Shared State Across Instances

Each server instance holds its own in-memory connection set. When a player on
Server 1 answers, Server 2 doesn't know about it.

**Solution — Pub/Sub layer (Redis Pub/Sub or NATS):**

```
                                                  ┌─────────────────┐
┌──────────┐       ┌──────────┐                   │                 │
│ Client A │◄───►│ Server 1 │◄───────────────►│  Redis Pub/Sub  │
└──────────┘       └─────┬────┘                   │  (message bus)  │
                         │                        │                 │
┌──────────┐       ┌─────┴────┐                   │                 │
│ Client B │◄───►│ Server 2 │◄───────────────►│                 │
└──────────┘       └─────┬────┘                   └─────────────────┘
                         │
                   ┌─────┴────────┐
                   │  PostgreSQL  │
                   │  (shared DB) │
                   └──────────────┘
```

- On score change, the handling server **publishes** a notification to a
  channel (e.g., `quiz:<id>`).
- All other servers **subscribe** to that channel and broadcast to their
  local clients.
- The pub/sub layer carries lightweight signals, not full data.

#### Problem 2: SQLite Cannot Be Shared Over the Network

SQLite is a library linked into the process. It reads and writes a local file.
A second server on a different machine has no way to access it. Placing the
file on a network filesystem (NFS, EFS) risks corruption because SQLite's
locking protocol is unreliable over network mounts.

**Solution — Migrate to PostgreSQL (or MySQL):**

| Capability                              | SQLite               | PostgreSQL              |
| --------------------------------------- | -------------------- | ----------------------- |
| Multiple servers connect simultaneously | No                   | Yes (TCP)               |
| Concurrent writers                      | No (file-level lock) | Yes (row-level locking) |
| Connection pooling                      | N/A                  | Yes (PgBouncer)         |
| Read replicas                           | No                   | Yes                     |
| Built-in pub/sub                        | No                   | Yes (`LISTEN/NOTIFY`)   |

PostgreSQL is a server process that accepts connections over the network,
manages its own concurrency, and handles multiple writers safely.

**When to switch:** only when you need multiple server instances writing to the
same database. On a single instance, SQLite is simpler and faster.

#### Problem 3: WebSocket Load Balancing

Clients must maintain a persistent connection to one server. A round-robin
load balancer would break the WebSocket upgrade handshake on reconnect.

**Solution — Sticky sessions:**

- Configure the load balancer (e.g., nginx, AWS ALB) with session affinity so
  a client always routes to the same backend instance.
- On reconnect after a server failure, the client is assigned to a new
  instance and re-joins the quiz; the new instance loads state from the
  shared database.

### Stage 4 — High Scale (10K+ concurrent per quiz)

| Concern             | Strategy                                                                           |
| ------------------- | ---------------------------------------------------------------------------------- |
| Write throughput    | Batch score writes; use write-ahead queuing                                        |
| Read throughput     | PostgreSQL read replicas for leaderboard queries                                   |
| Leaderboard latency | Cache the sorted leaderboard in Redis with a 1–2 s TTL; invalidate on score change |
| Quiz sharding       | Partition quizzes across server groups (quiz 1–1000 → cluster A)                   |
| Message broker      | Replace Redis Pub/Sub with NATS or Kafka for stronger delivery guarantees          |
| Broadcast cost      | Delta updates (send only changed ranks) instead of full leaderboard                |

```
                  ┌──────────────────┐
                  │  Load Balancer   │
                  │ (sticky sessions)│
                  └──┬──────┬──────┬─┘
                     │      │      │
                    ▼     ▼     ▼
                  ┌────┐ ┌────┐ ┌────┐
                  │ S1 │ │ S2 │ │ SN │
                  └──┬─┘ └──┬─┘ └──┬─┘
                     │      │      │
  ┌──────────────────┴──────┴──────┴──────────────┐
  │            Redis / NATS (pub/sub)             │
  └──────────────────────┬────────────────────────┘
                         │
            ┌────────────┴────────────┐
            │                         │
            ▼                         ▼
  ┌──────────────────┐    ┌───────────────────┐
  │ PostgreSQL       │    │ Redis Cache       │
  │ Primary (writes) │    │ (leaderboard,     │
  └────────┬─────────┘    │  TTL: 1-2s)       │
           │              └───────────────────┘
           │ replication
           ▼
  ┌──────────────────┐
  │ PostgreSQL       │
  │ Replica (reads)  │
  └──────────────────┘
```

---

## Connection Limits (rough estimates)

| Resource                   | Per-instance limit       |
| -------------------------- | ------------------------ |
| WebSocket connections      | ~50K–100K (memory-bound) |
| SQLite writes (WAL)        | ~1,000–5,000/sec         |
| PostgreSQL writes (pooled) | ~10K–50K/sec             |
| Redis Pub/Sub throughput   | ~500K messages/sec       |

---

## Pub/Sub Implementation Sketch (Bun + Redis)

```typescript
// Publisher side — after handling an answer
await db.run("INSERT INTO answers ...");
const leaderboard = await db.all("SELECT ... ORDER BY score DESC");
broadcastToLocalClients(quizId, leaderboard);
redisPublisher.publish(
  `quiz:${quizId}`,
  JSON.stringify({ event: "leaderboard-updated" }),
);
```

```typescript
// Subscriber side — every instance on startup
redisSubscriber.subscribe(`quiz:${quizId}`);
redisSubscriber.on("message", async (channel, msg) => {
  const quizId = channel.split(":")[1];
  const leaderboard = await db.all("SELECT ... ORDER BY score DESC");
  broadcastToLocalClients(quizId, leaderboard);
});
```

Redis carries only the **signal** that something changed. Each server reads
the fresh leaderboard from the shared database, keeping data consistent.

---

## Graceful Degradation

| Failure               | Behavior                                     | Mitigation                                                                             |
| --------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| Pub/sub layer down    | Other instances stop receiving notifications | Fall back to local-only broadcast; users on other instances see stale data temporarily |
| Database slow         | Writes queue up, leaderboard lags            | Queue writes, return optimistic scores to the client                                   |
| Server instance crash | Connected clients disconnect                 | Client reconnect logic re-joins on a new instance; state is in the shared DB           |

---

## Decision Checklist

Use this to decide what level of scaling your deployment needs:

- [ ] **Single instance is sufficient** → keep SQLite + in-memory connections.
- [ ] **Need multiple instances** → add Redis Pub/Sub + migrate to PostgreSQL.
- [ ] **Need high throughput** → add caching, read replicas, and sharding.
- [ ] **Need strong delivery guarantees** → replace Redis Pub/Sub with NATS or Kafka.

---

## Interview Talking Points

1. **Name the bottleneck before the solution.** Show you understand _why_
   something doesn't scale.
2. **Scale incrementally.** Single instance → vertical → horizontal → sharded.
   Don't jump to Kubernetes on day one.
3. **SQLite is the right choice at small scale.** Migrate to PostgreSQL only
   when multiple instances need shared write access.
4. **Pub/sub solves cross-instance communication**, not data storage. The
   database remains the source of truth.
5. **Back-of-envelope numbers matter.** Know rough connection limits, write
   throughput, and message rates.
6. **Trade-offs are the real answer.** Every scaling decision trades simplicity
   for capacity. Acknowledge this explicitly.
