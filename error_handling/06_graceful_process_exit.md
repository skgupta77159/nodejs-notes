# 6. Graceful Process Exit

This is a very important production topic.

Imagine your Node.js server receives:

```text
SIGTERM
```

This commonly happens when:

* Docker container is stopped
* Kubernetes terminates a Pod
* Deployment replaces an instance
* Process manager shuts down the app

A bad implementation is:

```js
process.on("SIGTERM", () => {
  process.exit(0);
});
```

Why is this bad?

Suppose there are active requests:

```text
Client
   ↓
Request processing...
   ↓
Database query...
   ↓
Response not completed
```

Then:

```js
process.exit(0);
```

immediately kills the process.

The client may get:

```text
Connection reset
```

or:

```text
502 / 503
```

unnecessarily.

---

## Better: graceful shutdown

```js
const server = app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

Create a shutdown function:

```js
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`Received ${signal}. Starting graceful shutdown...`);

  try {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          return reject(error);
        }

        resolve();
      });
    });

    console.log("HTTP server closed");

    // Close database connections here
    // await db.close();

    // Close Redis
    // await redis.quit();

    // Stop queue consumers
    // await worker.close();

    console.log("Graceful shutdown complete");

    process.exit(0);
  } catch (error) {
    console.error("Graceful shutdown failed", error);

    process.exit(1);
  }
}
```

Listen for shutdown signals:

```js
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

---

## What does `server.close()` do?

This is a common interview question.

```js
server.close()
```

generally means:

> Stop accepting **new connections/requests** and allow existing work to finish before completing shutdown.

Conceptually:

```text
Before SIGTERM

Client A ──────► Active request
Client B ──────► Active request
Client C ──────► New request

SIGTERM received
       ↓
Stop accepting new requests
       ↓
Client A ──────► Finish
Client B ──────► Finish
Client C ──────► Rejected/routed elsewhere
       ↓
Close DB/Redis/Queues
       ↓
Exit
```

For production, you should also have a timeout so the process cannot wait forever:

```js
const FORCE_EXIT_TIMEOUT = 30_000;

const forceExitTimer = setTimeout(() => {
  console.error("Forced shutdown after timeout");
  process.exit(1);
}, FORCE_EXIT_TIMEOUT);

forceExitTimer.unref();
```

Then your shutdown can be:

```js
async function shutdown(signal) {
  if (isShuttingDown) return;

  isShuttingDown = true;

  console.log(`Received ${signal}`);

  const forceExitTimer = setTimeout(() => {
    console.error("Shutdown timeout exceeded");
    process.exit(1);
  }, 30_000);

  forceExitTimer.unref();

  try {
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // await db.close();
    // await redis.quit();
    // await queue.close();

    process.exit(0);
  } catch (error) {
    console.error("Shutdown failed", error);
    process.exit(1);
  }
}
```

---