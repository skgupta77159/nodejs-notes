Yes. The **threshold/time limit** is important because Docker/Kubernetes give your app only a limited time to shut down gracefully.

## When is graceful shutdown required?

You should implement it whenever your Node.js app has **active work or external resources**, especially in production:

* HTTP requests still being processed
* Database connections
* Redis connections
* Kafka/RabbitMQ consumers
* WebSockets/SSE connections
* Background jobs
* File uploads/downloads
* Payments or transactions
* Long-running requests

For a production API, the answer is generally: **always implement graceful shutdown**.

---

# Docker threshold

By default, on Linux:

```text
docker stop
    ↓
SIGTERM sent to Node.js
    ↓
Wait up to 10 seconds
    ↓
App exited? ── Yes → Done ✅
    │
    No
    ↓
SIGKILL 💀
```

Docker's default stop timeout for Linux containers is **10 seconds**. If the process hasn't stopped after that grace period, Docker forcibly sends `SIGKILL`. ([Docker Documentation][1])

### Example

```bash
docker stop my-node-app
```

Default behavior:

```text
0s        → SIGTERM
0-10s     → Your graceful shutdown code runs
10s       → SIGKILL if still alive
```

You can increase it:

```bash
docker stop -t 30 my-node-app
```

Or configure it when running:

```bash
docker run --stop-timeout 30 my-node-app
```

So if Docker gives you **30 seconds**, ideally your Node.js app should finish shutdown **before 30 seconds**—and preferably leave some buffer rather than waiting until the final second. ([Docker Documentation][1])

---

# Kubernetes threshold

Kubernetes has:

```yaml
terminationGracePeriodSeconds: 30
```

The default is **30 seconds**. ([Kubernetes][2])

Flow:

```text
Pod deletion / deployment update
          ↓
Kubernetes starts termination
          ↓
Pod marked as terminating
          ↓
Stop routing regular new traffic
          ↓
SIGTERM sent to application
          ↓
Wait up to terminationGracePeriodSeconds
          ↓
Still running?
          ↓
SIGKILL 💀
```

Kubernetes documents a default graceful termination period of **30 seconds**; when it expires, remaining processes can be forcibly terminated with `SIGKILL`. ([Kubernetes][2])

### Example

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: node-app
          image: my-node-app
```

This means:

```text
0s         SIGTERM
↓
0–30s      Graceful shutdown period
↓
30s        SIGKILL if app is still running
```

---

# What should your Node.js timeout be?

**Your application's internal timeout should be smaller than the infrastructure timeout.**

### Bad ❌

Kubernetes:

```yaml
terminationGracePeriodSeconds: 30
```

Node.js:

```js
setTimeout(() => {
  process.exit(1);
}, 30_000);
```

Problem:

```text
Kubernetes SIGKILL at 30s
         ⚔
Node.js timeout at 30s
```

Kubernetes may kill the process before your cleanup completes.

### Better ✅

```text
Kubernetes grace period: 30 seconds

Node.js internal timeout: 25 seconds
                           ↑
                    Leave safety buffer
```

```js
const shutdownTimeout = setTimeout(() => {
  console.error('Graceful shutdown timed out');
  process.exit(1);
}, 25_000);
```

A practical rule:

| Infrastructure grace period | Node.js internal shutdown timeout |
| --------------------------- | --------------------------------: |
| Docker 10s                  |                               ~8s |
| Docker 30s                  |                              ~25s |
| Kubernetes 30s              |                              ~25s |
| Kubernetes 60s              |                           ~50–55s |

The exact buffer depends on your infrastructure and cleanup requirements, but **don't set your app timeout equal to the orchestrator timeout**.

---

# Recommended Node.js pattern

```js
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;

  isShuttingDown = true;

  console.log(`${signal} received`);

  // Must be LOWER than Docker/Kubernetes grace period
  const forceExitTimeout = setTimeout(() => {
    console.error('Shutdown taking too long. Exiting...');
    process.exit(1);
  }, 25_000);

  // 1. Stop accepting new HTTP connections
  server.close(async () => {
    try {
      // 2. Close external resources
      await db.close();
      await redis.quit();

      clearTimeout(forceExitTimeout);

      console.log('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  });
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
```

---

## The important production relationship 🔥

```text
Kubernetes/Docker timeout
        >
Node.js graceful shutdown timeout
        >
Expected cleanup time
```

For example:

```text
Expected max cleanup:       15s
Node.js timeout:            25s
Kubernetes grace period:    30s
```

This is a good hierarchy.

### Interview answer

> Graceful shutdown is required when an application may have in-flight requests, open connections, or ongoing work. Docker and Kubernetes first give the process a graceful termination window by sending SIGTERM. Docker defaults to a 10-second stop timeout for Linux containers, while Kubernetes defaults `terminationGracePeriodSeconds` to 30 seconds. If the process does not exit in time, it can be force-killed with SIGKILL. Therefore, the application's own shutdown timeout should be slightly smaller than the infrastructure grace period, so cleanup finishes before SIGKILL. ([Docker Documentation][1])

[1]: https://docs.docker.com/reference/cli/docker/container/stop/?utm_source=chatgpt.com "docker container stop | Docker Docs"
[2]: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/?stream=top&utm_source=chatgpt.com "Pod Lifecycle | Kubernetes"
