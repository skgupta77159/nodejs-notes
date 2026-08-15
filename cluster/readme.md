# Node.js Cluster, Load Testing, and PM2

## Overview

This project demonstrates:

* Node.js `cluster` module
* `cluster.setupPrimary()`
* Multiple worker processes
* Round-robin scheduling with `SCHED_RR`
* Handling CPU-intensive requests
* Load testing with `loadtest`
* Process management and clustering with PM2

---

## Project Structure

```text
cluster/
├── primary.js
├── index.js
├── package.json
└── README.md
```

---

# 1. Node.js Cluster

Node.js JavaScript execution is single-threaded per process.

If a machine has multiple CPU cores, we can use the `cluster` module to create multiple Node.js worker processes.

```text
                    Primary Process
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
       Worker 1        Worker 2        Worker 3
          │               │               │
       Event Loop      Event Loop      Event Loop
          │               │               │
        CPU Core        CPU Core        CPU Core
```

Each worker:

* Is a separate Node.js process
* Has its own memory
* Has its own event loop
* Can handle requests independently

---

# 2. `cluster.setupPrimary()`

`cluster.setupPrimary()` configures how worker processes are created.

Example:

```js
cluster.setupPrimary({
  exec: path.join(__dirname, "index.js"),
});
```

This means:

> Every time `cluster.fork()` is called, Node.js will start `index.js` as a worker process.

`setupPrimary()` does not create workers.

This:

```js
cluster.setupPrimary({
  exec: "./index.js",
});
```

only configures the worker.

Workers are actually created using:

```js
cluster.fork();
```

Flow:

```text
setupPrimary()
      │
      ▼
Configure worker settings
      │
      ▼
cluster.fork()
      │
      ▼
Create Worker 1
      │
      ▼
cluster.fork()
      │
      ▼
Create Worker 2
```

---

# 3. `primary.js`

The primary process is responsible for creating and managing workers.

```js
const cluster = require("node:cluster");
const os = require("node:os");
const path = require("node:path");

const numCPUs = os.availableParallelism();

console.log(`Primary process started: PID ${process.pid}`);
console.log(`Creating ${numCPUs} workers...`);

// Use Round Robin scheduling
cluster.schedulingPolicy = cluster.SCHED_RR;

// Configure workers to execute index.js
cluster.setupPrimary({
  exec: path.join(__dirname, "index.js"),
});

// Create workers
for (let i = 0; i < numCPUs; i++) {
  const worker = cluster.fork();

  console.log(
    `Created worker ${worker.id}, PID: ${worker.process.pid}`,
  );
}

// Worker started successfully
cluster.on("online", (worker) => {
  console.log(
    `Worker ${worker.id} is online, PID: ${worker.process.pid}`,
  );
});

// Restart worker if it crashes
cluster.on("exit", (worker, code, signal) => {
  console.log(
    `Worker ${worker.id} died. PID: ${worker.process.pid}`,
  );

  console.log("Creating replacement worker...");

  cluster.fork();
});
```

Run the application:

```bash
node primary.js
```

---

# 4. `index.js`

Each worker runs `index.js`.

```js
const http = require("node:http");
const cluster = require("node:cluster");

const server = http.createServer((req, res) => {
  console.log(
    `Request ${req.url} handled by worker ${cluster.worker.id}, PID: ${process.pid}`,
  );

  if (req.url === "/") {
    res.end(`Hello from worker ${cluster.worker.id}`);
    return;
  }

  if (req.url === "/heavy") {
    let sum = 0;

    for (let i = 0; i < 5_000_000_000; i++) {
      sum += i;
    }

    res.end(`Heavy task completed by worker ${cluster.worker.id}`);
    return;
  }

  res.statusCode = 404;
  res.end("Not Found");
});

server.listen(3000, () => {
  console.log(
    `Server running on port 3000 - Worker ${cluster.worker.id}, PID: ${process.pid}`,
  );
});
```

All workers share port `3000`.

```text
Primary
   │
   ├── Worker 1 → index.js → Port 3000
   ├── Worker 2 → index.js → Port 3000
   ├── Worker 3 → index.js → Port 3000
   └── Worker 4 → index.js → Port 3000
```

---

# 5. `cluster.SCHED_RR`

```js
cluster.schedulingPolicy = cluster.SCHED_RR;
```

`SCHED_RR` means **Round Robin scheduling**.

It distributes incoming connections approximately across workers in rotation.

Example with 4 workers:

```text
Connection 1 → Worker 1
Connection 2 → Worker 2
Connection 3 → Worker 3
Connection 4 → Worker 4
Connection 5 → Worker 1
Connection 6 → Worker 2
Connection 7 → Worker 3
Connection 8 → Worker 4
```

Conceptually:

```text
                    Primary Process
                          │
                          ▼
                  Round Robin Scheduler
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
        Worker 1       Worker 2       Worker 3
            │
        Worker 4
```

This provides more predictable request distribution.

Set it before creating workers:

```js
cluster.schedulingPolicy = cluster.SCHED_RR;

cluster.setupPrimary({
  exec: path.join(__dirname, "index.js"),
});

cluster.fork();
```

---

# 6. `SCHED_RR` vs `SCHED_NONE`

## `SCHED_RR`

```js
cluster.schedulingPolicy = cluster.SCHED_RR;
```

Node.js primary process participates in distributing incoming connections.

```text
New Connection
      │
      ▼
Primary Process
      │
      ├── Worker 1
      ├── Worker 2
      ├── Worker 3
      └── Worker 4
```

Distribution is approximately round-robin.

---

## `SCHED_NONE`

```js
cluster.schedulingPolicy = cluster.SCHED_NONE;
```

Workers rely more directly on the operating system for connection distribution.

```text
New Connection
      │
      ▼
Operating System
      │
      ├── Worker 1
      ├── Worker 2
      ├── Worker 3
      └── Worker 4
```

Distribution may be less predictable depending on the operating system and environment.

---

# 7. CPU-Intensive Operations

The `/heavy` endpoint contains a CPU-intensive operation:

```js
let sum = 0;

for (let i = 0; i < 5_000_000_000; i++) {
  sum += i;
}
```

This blocks the event loop of the worker handling that request.

Example:

```text
Request A
   │
   ▼
Worker 1
   │
   ▼
Heavy JavaScript Loop
   │
   ▼
Worker 1 Event Loop Blocked
```

However, other workers can still handle requests:

```text
Request A → Worker 1 → BLOCKED 🔥
Request B → Worker 2 → Available ✅
Request C → Worker 3 → Available ✅
Request D → Worker 4 → Available ✅
```

---

## What if there are 5 heavy requests and 5 workers?

```text
Request 1 → Worker 1 → Heavy Task 🔥
Request 2 → Worker 2 → Heavy Task 🔥
Request 3 → Worker 3 → Heavy Task 🔥
Request 4 → Worker 4 → Heavy Task 🔥
Request 5 → Worker 5 → Heavy Task 🔥
```

Now all workers are busy.

Any additional request:

```text
Request 6
   │
   ▼
No available worker
   │
   ▼
Wait until a worker becomes available
```

---

# 8. Cluster Does Not Split One Heavy Task

Cluster can distribute multiple requests across multiple processes.

For example:

```text
Request 1 → Worker 1
Request 2 → Worker 2
Request 3 → Worker 3
```

But this:

```text
One Request
    │
    ▼
Heavy Task: 5 billion iterations
```

will not automatically become:

```text
Worker 1 → 1 billion iterations
Worker 2 → 1 billion iterations
Worker 3 → 1 billion iterations
Worker 4 → 1 billion iterations
Worker 5 → 1 billion iterations
```

The entire task runs inside the worker that receives the request.

For splitting a CPU-intensive task into parallel work, use:

```text
worker_threads
```

Simple rule:

```text
cluster
    ↓
Multiple Node.js processes
    ↓
Better request throughput and CPU utilization


worker_threads
    ↓
Multiple threads
    ↓
Parallel CPU-intensive work
```

---

# 9. Testing Worker Distribution

Start the application:

```bash
node primary.js
```

Test a single request:

```bash
curl http://localhost:3000/
```

To send 20 concurrent requests:

```bash
for i in {1..20}; do
  curl http://localhost:3000/ &
done

wait
```

With 8 workers and `SCHED_RR`, the output should be approximately distributed:

```text
Hello from worker 1
Hello from worker 2
Hello from worker 3
Hello from worker 4
Hello from worker 5
Hello from worker 6
Hello from worker 7
Hello from worker 8
...
```

Exact ordering may vary because the requests are concurrent.

---

# 10. What is `loadtest`?

`loadtest` is an HTTP load-testing tool.

It sends many requests to your server and helps test how your application performs under load.

Install:

```bash
npm install -g loadtest
```

Example:

```bash
loadtest -n 1000 -c 50 http://localhost:3000/
```

Where:

```text
-n 1000
```

means:

```text
Total number of requests = 1000
```

And:

```text
-c 50
```

means:

```text
50 concurrent requests
```

Conceptually:

```text
                    loadtest
                        │
            ┌───────────┼───────────┐
            ▼           ▼           ▼
         Request     Request     Request
            │           │           │
            └───────────┼───────────┘
                        ▼
                   Node.js Server
                        │
                        ▼
                 Cluster Scheduler
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
      Worker 1       Worker 2       Worker 3
         │              │              │
      Worker 4       Worker 5       Worker 6
```

`loadtest` can help you observe:

* Response time
* Throughput
* Requests per second
* Errors
* Server behavior under concurrent traffic

---

# 11. What is PM2?

PM2 is a process manager for Node.js applications.

Instead of running:

```bash
node index.js
```

you can run:

```bash
pm2 start index.js
```

PM2 helps manage your application process.

Install PM2:

```bash
npm install -g pm2
```

---

## PM2 Features

### Automatically restart crashed applications

Without PM2:

```text
Node.js Application
       │
       ▼
     Crash ❌
       │
       ▼
Server Stops
```

With PM2:

```text
Node.js Application
       │
       ▼
     Crash ❌
       │
       ▼
PM2 Detects Crash
       │
       ▼
Restarts Application 🔄
```

---

# 12. PM2 Cluster Mode

PM2 can automatically create multiple application instances.

```bash
pm2 start index.js -i max
```

`-i max` means:

> Create application instances based on the available CPU cores.

Example:

```text
                       PM2
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
      Instance 1    Instance 2    Instance 3
          │             │             │
       CPU Core 1    CPU Core 2    CPU Core 3
```

You can also specify the number of instances:

```bash
pm2 start index.js -i 4
```

This creates 4 application instances.

---

# 13. Manual Cluster vs PM2

## Manual Cluster

```text
primary.js
    │
    ▼
cluster.setupPrimary()
    │
    ▼
cluster.fork()
    │
    ├── Worker 1
    ├── Worker 2
    ├── Worker 3
    └── Worker 4
```

You manually manage:

```js
cluster.fork();

cluster.on("exit", () => {
  cluster.fork();
});
```

Start:

```bash
node primary.js
```

---

## PM2 Cluster Mode

PM2 handles the multiple processes:

```bash
pm2 start index.js -i max
```

```text
PM2
 │
 ├── Instance 1
 ├── Instance 2
 ├── Instance 3
 └── Instance 4
```

PM2 manages:

* Multiple instances
* Restarting processes
* Monitoring
* Logs
* Process lifecycle

---

# 14. Do Not Normally Use Both Cluster Modes Together

Avoid:

```bash
pm2 start primary.js -i max
```

if `primary.js` itself does:

```js
cluster.fork();
```

For example, on an 8-core machine:

```text
PM2 creates 8 instances
```

and each instance creates:

```text
8 cluster workers
```

Result:

```text
8 × 8 = 64 Node.js processes
```

This can unnecessarily consume system resources.

Instead, choose one approach.

## Option 1: Manual Cluster

```bash
node primary.js
```

Use:

```js
cluster.setupPrimary();
cluster.fork();
```

## Option 2: PM2 Cluster Mode

```bash
pm2 start index.js -i max
```

Let PM2 manage the processes.

---

# 15. Quick Comparison

| Feature                   | Node.js Cluster        | `worker_threads` | `loadtest`     | PM2 |
| ------------------------- | ---------------------- | ---------------- | -------------- | --- |
| Multiple processes        | Yes                    | No               | No             | Yes |
| Multiple threads          | No                     | Yes              | No             | No  |
| Uses multiple CPU cores   | Yes                    | Yes              | No             | Yes |
| Handles multiple requests | Yes                    | Indirectly       | Sends requests | Yes |
| Parallel CPU-heavy work   | Not for one task       | Yes              | No             | No  |
| Load testing              | No                     | No               | Yes            | No  |
| Process management        | Basic                  | No               | No             | Yes |
| Auto restart              | Can implement manually | No               | No             | Yes |

---

# Key Takeaways

```text
cluster.fork()
    → Creates multiple Node.js worker processes

cluster.setupPrimary()
    → Configures how workers are created

cluster.SCHED_RR
    → Primary distributes connections approximately round-robin

cluster.SCHED_NONE
    → Connection distribution relies more on OS-level handling

worker_threads
    → Best for parallel CPU-intensive operations

loadtest
    → Sends many HTTP requests to test server performance

PM2
    → Manages Node.js processes in production

PM2 -i max
    → Runs multiple application instances using available CPU cores
```

## Simple Memory Trick

```text
Cluster → Handle more requests using multiple processes

Worker Threads → Split CPU-heavy work

Loadtest → Test how much traffic your server can handle

PM2 → Keep your Node.js application running and managed
```
