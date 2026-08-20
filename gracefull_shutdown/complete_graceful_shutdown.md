# Graceful Shutdown in Node.js — SIGINT, SIGTERM & SIGKILL

## 1. What is Graceful Shutdown?

Graceful shutdown means:

> **Stop accepting new requests → finish ongoing requests → close DB/connections → exit safely.**

Without graceful shutdown:

```text
Client Request
     ↓
Node.js App
     ↓
Process killed ❌
     ↓
Request interrupted / DB connection lost / data may be inconsistent
```

With graceful shutdown:

```text
SIGTERM / SIGINT
       ↓
Stop accepting new requests
       ↓
Finish active requests
       ↓
Close DB / Redis / queues
       ↓
Exit process safely
```

---

# 2. SIGINT

`SIGINT` = **Interrupt Signal**

Usually sent when you press:

```bash
Ctrl + C
```

Example:

```js
process.on('SIGINT', () => {
  console.log('Received SIGINT');

  // Cleanup resources
  process.exit(0);
});
```

### Common usage

Mostly during:

* Local development
* Manual application shutdown
* Terminal interruption

```text
Ctrl + C
   ↓
SIGINT
   ↓
Node.js cleanup
   ↓
Exit
```

---

# 3. SIGTERM

`SIGTERM` = **Terminate Signal**

This is the most important signal for **production graceful shutdown**.

It asks the application:

> "Please terminate yourself gracefully."

Commonly sent by:

* Docker
* Kubernetes
* PM2
* Systemd
* Cloud platforms
* Load balancers/process managers

Example:

```js
process.on('SIGTERM', () => {
  console.log('Received SIGTERM');

  // Graceful cleanup
  process.exit(0);
});
```

### Production flow

```text
Docker / Kubernetes
        ↓
     SIGTERM
        ↓
Node.js receives signal
        ↓
Stop accepting traffic
        ↓
Finish active requests
        ↓
Close resources
        ↓
process.exit(0)
```

---

# 4. SIGKILL

`SIGKILL` = **Force Kill**

This immediately terminates the process.

```text
SIGKILL
   ↓
💀 Process immediately dies
```

Example:

```bash
kill -9 <PID>
```

⚠️ **You cannot handle SIGKILL in Node.js.**

This will NOT work:

```js
process.on('SIGKILL', () => {
  console.log('This will never run');
});
```

There is no opportunity for:

* Closing database connections
* Completing requests
* Cleaning up files
* Running cleanup code

### Important difference

| Signal    | Can Node.js Handle? | Graceful? |
| --------- | ------------------- | --------- |
| `SIGINT`  | ✅ Yes               | ✅ Yes     |
| `SIGTERM` | ✅ Yes               | ✅ Yes     |
| `SIGKILL` | ❌ No                | ❌ No      |

---

# 5. Production Graceful Shutdown Example

```js
import express from 'express';

const app = express();

app.get('/', async (req, res) => {
  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 3000));

  res.send('Request completed');
});

const server = app.listen(3000, () => {
  console.log('Server running on port 3000');
});


async function shutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // 1. Stop accepting new connections
  server.close(async () => {
    console.log('HTTP server closed');

    try {
      // 2. Close resources
      // await db.close();
      // await redis.quit();
      // await queue.close();

      console.log('Resources closed');

      // 3. Exit successfully
      process.exit(0);
    } catch (error) {
      console.error('Shutdown failed:', error);
      process.exit(1);
    }
  });
}


process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

---

# 6. How `server.close()` Works

This is a commonly misunderstood point.

```js
server.close();
```

does **not immediately kill all active requests**.

Instead:

```text
Before shutdown:

New Request ────────► Server
Existing Request ───► Server ──► Processing
```

After:

```js
server.close();
```

```text
New Request ────────► ❌ Not accepted

Existing Request ───► ✅ Allowed to finish
                              ↓
                         Response sent
                              ↓
                       Server finally closes
```

So this is the core of graceful HTTP shutdown.

---

# 7. Add a Shutdown Timeout ⚠️

A request might hang forever.

Example:

```text
SIGTERM
   ↓
Waiting for requests...
   ↓
Request never finishes 😱
   ↓
App never exits
```

Therefore, production applications usually add a timeout:

```js
function shutdown(signal) {
  console.log(`${signal} received`);

  // Force exit after 10 seconds
  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out. Force exiting...');
    process.exit(1);
  }, 10_000);

  server.close(async () => {
    try {
      await closeResources();

      clearTimeout(forceExit);

      console.log('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      clearTimeout(forceExit);
      console.error(error);
      process.exit(1);
    }
  });
}

async function closeResources() {
  // await db.close();
  // await redis.quit();
  // await queue.close();
}
```

---

# 8. Prevent Multiple Shutdown Calls

You may receive more than one signal:

```text
SIGTERM
SIGTERM again
Ctrl + C
```

Use a flag:

```js
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) {
    console.log('Shutdown already in progress');
    return;
  }

  isShuttingDown = true;

  console.log(`${signal} received`);
  
  server.close(async () => {
    await closeResources();
    process.exit(0);
  });
}
```

---

# 9. Complete Production Pattern

```js
import express from 'express';

const app = express();

let isShuttingDown = false;

app.get('/health', (req, res) => {
  if (isShuttingDown) {
    return res.status(503).send('Shutting down');
  }

  res.send('Healthy');
});

const server = app.listen(3000);


async function closeResources() {
  console.log('Closing resources...');

  // await mongoose.connection.close();
  // await prisma.$disconnect();
  // await redis.quit();
  // await kafka.disconnect();
  // await queue.close();
}


async function gracefulShutdown(signal) {
  if (isShuttingDown) return;

  isShuttingDown = true;

  console.log(`${signal} received. Shutting down...`);

  // Safety timeout
  const timeout = setTimeout(() => {
    console.error('Shutdown timeout reached');
    process.exit(1);
  }, 10_000);

  try {
    // Stop accepting new HTTP connections
    server.close(async () => {
      try {
        // Close DB, Redis, queues, etc.
        await closeResources();

        clearTimeout(timeout);

        console.log('Shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('Shutdown error:', error);
    process.exit(1);
  }
}


process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.once('SIGINT', () => gracefulShutdown('SIGINT'));
```

### Why `process.once()`?

We want each signal handler to execute only once:

```js
process.once('SIGTERM', handler);
```

Better than accidentally running cleanup multiple times.

---

# 10. Docker / Kubernetes Flow

In production, the flow is typically:

```text
Container is asked to stop
          ↓
       SIGTERM
          ↓
Node.js starts graceful shutdown
          ↓
Remove / stop routing new traffic
          ↓
server.close()
          ↓
Finish active requests
          ↓
Close DB / Redis / Queue
          ↓
process exits
          ↓
Container stops
```

If the application does not exit within the configured grace period:

```text
SIGTERM
   ↓
Wait for grace period
   ↓
Still running?
   ↓ YES
SIGKILL 💀
```

This is why **your graceful shutdown must finish before the orchestrator's timeout**.

---

# 11. SIGINT vs SIGTERM vs SIGKILL — Interview Table

| Signal    | Meaning              | Common Source                 | Can Handle? | Graceful Shutdown |
| --------- | -------------------- | ----------------------------- | ----------- | ----------------- |
| `SIGINT`  | Interrupt            | `Ctrl + C`                    | ✅           | ✅                 |
| `SIGTERM` | Request termination  | Docker/K8s/PM2/System         | ✅           | ✅                 |
| `SIGKILL` | Immediate force kill | `kill -9`, timeout escalation | ❌           | ❌                 |

---

# 🎯 Interview TL;DR

> **SIGINT and SIGTERM can be intercepted by Node.js to perform graceful shutdown. On receiving them, we stop accepting new traffic, allow in-flight requests to complete, close resources such as database, Redis, queues and consumers, and then exit. SIGTERM is the typical production shutdown signal, while SIGINT commonly comes from Ctrl+C. SIGKILL cannot be caught or handled—it immediately terminates the process, so cleanup code will not run. In production, we also use a shutdown timeout because if graceful cleanup takes too long, the process may eventually be force-killed.**

### One important interview trick 🔥

**Don't just say:**

```js
process.on('SIGTERM', () => {
  process.exit();
});
```

This is **not really graceful** because it can immediately terminate the process.

Instead:

```text
SIGTERM
  → stop accepting new requests
  → drain in-flight requests
  → close external resources
  → exit
```

That is a proper production graceful shutdown pattern.