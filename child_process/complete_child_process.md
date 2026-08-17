# Child Process in Node.js — Interview Guide + Tricky Concepts

`child_process` is a Node.js module used to **create separate OS processes** from a Node.js application.

This is useful when you want to run:

* CPU-intensive work
* Shell commands
* External programs
* Separate Node.js scripts
* Isolated tasks

The important point is:

> **A child process has its own process, memory space, and V8 instance.**

So unlike normal async code, it can execute independently of the parent process's JavaScript event loop.

---

# 1. Why do we need Child Processes?

Consider:

```js
app.get("/heavy", (req, res) => {
  let sum = 0;

  for (let i = 0; i < 5_000_000_000; i++) {
    sum += i;
  }

  res.send(String(sum));
});
```

This runs on the Node.js main thread.

While this loop executes:

```text
Request A → /heavy
              ↓
         Event Loop blocked
              ↓
Request B ❌ waiting
Request C ❌ waiting
Request D ❌ waiting
```

We can move work to another process:

```text
Parent Node Process
│
├── Event Loop → handles requests
│
└── Child Process
       └── Heavy computation
```

Now the child does the work independently.

---

# 2. The Four Main APIs

```js
const { spawn, exec, fork, execFile } = require("child_process");
```

| Method       | Shell          | Output   | Best for                       |
| ------------ | -------------- | -------- | ------------------------------ |
| `spawn()`    | Optional       | Streamed | Large/continuous output        |
| `exec()`     | Yes by default | Buffered | Small shell commands           |
| `execFile()` | No by default  | Buffered | Running executable directly    |
| `fork()`     | No             | IPC      | Running another Node.js script |

---

# 3. `spawn()` — Best for Large Output

```js
const { spawn } = require("child_process");

const child = spawn("node", ["worker.js"]);

child.stdout.on("data", (data) => {
  console.log("Output:", data.toString());
});

child.stderr.on("data", (data) => {
  console.error("Error:", data.toString());
});

child.on("close", (code) => {
  console.log(`Child exited with code ${code}`);
});
```

Architecture:

```text
Parent
   │
   ├── spawn()
   │
   ▼
Child Process
   │
   ├── stdout ───────► Parent
   ├── stderr ───────► Parent
   │
   └── exit
```

### Why use `spawn`?

Output is received as a **stream**:

```js
child.stdout.on("data", ...)
```

So it is better when output is huge.

For example:

```js
spawn("python", ["large-processing.py"]);
```

or:

```js
spawn("ffmpeg", [...]);
```

or continuously running commands.

### Tricky point

This:

```js
child.stdout.on("data", (data) => {
  console.log(data.toString());
});
```

does **not guarantee one `data` event = one complete line/message**.

A chunk may contain:

```text
Hello
```

or:

```text
Hel
```

followed by:

```text
lo
```

Streams work with arbitrary chunks.

---

# 4. `exec()` — Buffers the Complete Output

```js
const { exec } = require("child_process");

exec("node --version", (error, stdout, stderr) => {
  if (error) {
    console.error(error);
    return;
  }

  console.log(stdout);
});
```

Conceptually:

```text
Command starts
     ↓
Output generated
     ↓
Output stored in memory
     ↓
Command completes
     ↓
Callback receives complete output
```

### Important difference

`exec()`:

```text
Output → Buffer in memory → Complete → Callback
```

`spawn()`:

```text
Output → Stream → Parent immediately
```

### Dangerous example

```js
exec("some-command-producing-10GB-output");
```

Potential problem: huge output is buffered in memory.

Also, `exec()` has a `maxBuffer` limit.

So for large output, prefer:

```js
spawn()
```

---

# 5. `exec()` and Shell Injection — Very Important Interview Point

Never do this:

```js
exec(`ls ${userInput}`);
```

Suppose:

```js
userInput = "folder && rm -rf something";
```

Because `exec()` runs through a shell, user-controlled input can potentially alter command execution.

Safer approach:

```js
spawn("ls", [userInput]);
```

Arguments are passed separately rather than constructing one shell command string.

**Interview answer:**

> Avoid passing untrusted input into `exec()` because shell interpretation can introduce command injection vulnerabilities. Prefer `spawn()` or `execFile()` with arguments passed separately.

---

# 6. `execFile()` — Run an Executable Directly

```js
const { execFile } = require("child_process");

execFile(
  "node",
  ["--version"],
  (error, stdout, stderr) => {
    console.log(stdout);
  }
);
```

Conceptually:

```text
exec()
Node
 ↓
Shell
 ↓
Command

execFile()
Node
 ↓
Command directly
```

Generally, `execFile()` avoids shell parsing by default.

This can be:

* more efficient
* safer against shell metacharacter interpretation

But its output is still buffered, unlike `spawn()`.

---

# 7. `fork()` — Specially for Node.js Processes

This is one of the most commonly asked interview topics.

```js
const { fork } = require("child_process");

const child = fork("./worker.js");

child.send({
  task: "calculate",
  number: 100
});

child.on("message", (message) => {
  console.log("From child:", message);
});
```

### worker.js

```js
process.on("message", (message) => {
  console.log("Received:", message);

  process.send({
    result: message.number * 2
  });
});
```

Output:

```text
Received: { task: 'calculate', number: 100 }
From child: { result: 200 }
```

Architecture:

```text
             IPC
Parent ───────────────── Child
   │                       │
   │ child.send()           │
   ├───────────────────────►│ process.on("message")
   │                       │
   │ process.send()         │
   │◄───────────────────────┤
   │                       │
```

`fork()` is essentially designed to start another **Node.js process with an IPC communication channel**.

### Important distinction

```js
fork("./worker.js")
```

is not JavaScript's `Promise` or browser Web Worker mechanism.

It creates a **separate Node.js process**.

---

# 8. Is `child.send()` synchronous?

No. IPC communication is asynchronous.

```js
child.send({ task: "hello" });

console.log("This can execute immediately");
```

The message is sent through an IPC channel; the parent does not synchronously wait for the child to finish processing.

Also:

```js
child.send(message, callback);
```

The callback indicates sending status, **not that your child has finished the task**.

This is a tricky interview point.

To know when work is complete, the child should explicitly send a response:

```js
// Parent
child.send({ task: "work" });

child.on("message", (result) => {
  console.log("Task completed:", result);
});
```

---

# 9. Example: Heavy Computation Using `fork`

### parent.js

```js
const { fork } = require("child_process");

const child = fork("./heavy-worker.js");

console.log("Parent started");

child.send({ limit: 5_000_000_000 });

child.on("message", (result) => {
  console.log("Result:", result);
  child.disconnect();
});
```

### heavy-worker.js

```js
process.on("message", ({ limit }) => {
  let sum = 0;

  for (let i = 0; i < limit; i++) {
    sum += i;
  }

  process.send({ sum });
});
```

While the child calculates:

```text
Parent Process
├── Event Loop can continue
├── Can handle other work
└── Receives result later

Child Process
└── CPU-heavy calculation
```

---

# 10. Child Process vs Worker Threads

This is probably the **most important comparison**.

| Feature          | Child Process                | Worker Thread                       |
| ---------------- | ---------------------------- | ----------------------------------- |
| OS process       | Separate                     | Same process                        |
| Memory           | Separate memory              | Can share memory                    |
| V8 instance      | Separate                     | Separate isolate                    |
| Startup overhead | Higher                       | Lower                               |
| IPC              | Yes                          | Message passing                     |
| Shared memory    | Not directly by default      | `SharedArrayBuffer` possible        |
| Crash isolation  | Better                       | Process remains but worker can fail |
| Best for         | External processes/isolation | CPU-heavy JS                        |

### Child Process

```text
OS
├── Node Parent Process
│    └── Memory A
│
└── Node Child Process
     └── Memory B
```

### Worker Threads

```text
One Node Process
│
├── Main Thread
│
├── Worker Thread
│
└── Worker Thread
```

### Interview answer

> Use Worker Threads for CPU-intensive JavaScript when lower overhead and thread-based parallelism are desired. Use Child Processes when I need stronger process isolation, want to execute another program, or want a completely separate Node.js process.

---

# 11. Child Process vs Cluster

These are related because **Cluster internally uses child processes**.

But their purpose is different.

## Cluster

```text
                Load Balancer
                      │
                      ▼
                 Node Primary
                 /     |     \
                /      |      \
          Worker 1  Worker 2  Worker 3
```

Use Cluster for:

```text
Multiple CPU cores
        +
Multiple processes
        +
Handle more HTTP requests
```

Example:

```js
cluster.fork();
```

The main purpose is **request-level concurrency and scaling HTTP/server workloads**.

---

## Child Process

```text
Node Application
      │
      ├── Handle HTTP requests
      │
      └── Spawn Child
             │
             └── Run specific task
```

Example:

```js
spawn("ffmpeg", [...]);
```

or:

```js
fork("./pdf-processor.js");
```

The main purpose is **running a separate task or program**.

### Best interview distinction

> Cluster uses multiple child processes primarily to scale a server across CPU cores. `child_process` is the lower-level mechanism used to create and manage independent processes for arbitrary work. Cluster is workload-oriented around server concurrency, while Child Process is general-purpose process creation.

---

# 12. Child Process vs libuv Thread Pool

This is another tricky distinction.

Consider:

```js
fs.readFile("large.txt", () => {
  console.log("Done");
});
```

Node may use asynchronous OS mechanisms and/or libuv facilities depending on the operation/platform. Some APIs such as async filesystem operations and certain crypto/DNS operations use the libuv worker pool.

You do **not manually create a child process** here.

### libuv worker pool

```text
JavaScript
    │
    ▼
Event Loop
    │
    ▼
libuv / OS async mechanisms
    │
    ├── Worker Pool Thread
    ├── Worker Pool Thread
    ├── Worker Pool Thread
    └── Worker Pool Thread
```

Important:

> The libuv thread pool is mainly for specific Node.js native asynchronous operations. It does not automatically move arbitrary JavaScript CPU loops off the main thread.

This still blocks:

```js
for (let i = 0; i < 5_000_000_000; i++) {
  sum += i;
}
```

Even if you wrap it inside:

```js
async function heavyTask() {
  // huge loop
}
```

`async` does not make CPU work run in another thread/process.

For arbitrary CPU-heavy JavaScript:

```text
Worker Thread
        OR
Child Process
```

---

# 13. Does a Child Process Have Its Own Event Loop?

**Yes.**

This is a very good interview question.

```text
Parent Process
├── V8
├── Event Loop
├── Heap
└── Native resources

Child Process
├── V8
├── Event Loop
├── Heap
└── Native resources
```

Therefore, blocking JavaScript in the child does not directly block the parent's JavaScript event loop.

But remember: both processes can still compete for the same machine CPU resources.

So this:

> "Child process means unlimited parallel performance"

is wrong.

If you create too many CPU-heavy processes:

```text
CPU cores: 8

Child processes: 100
```

the OS must context-switch between them, which can reduce performance.

---

# 14. `spawn()` Is Not the Same as `fork()`

A common misconception:

```js
fork()
```

and:

```js
spawn()
```

both create child processes, but:

### `spawn()`

Can run almost any executable:

```js
spawn("python", ["script.py"]);
spawn("node", ["script.js"]);
spawn("ffmpeg", ["-i", "input.mp4"]);
```

### `fork()`

Designed for another Node.js module and automatically establishes IPC.

```js
fork("./worker.js");
```

So:

> `fork()` is specialized for Node-to-Node process communication.

---

# 15. stdout, stderr and exit are Different Things

Consider:

```js
const child = spawn("node", ["script.js"]);

child.stdout.on("data", (data) => {
  console.log("STDOUT:", data.toString());
});

child.stderr.on("data", (data) => {
  console.error("STDERR:", data.toString());
});

child.on("error", (err) => {
  console.error("Failed to start:", err);
});

child.on("close", (code) => {
  console.log("Closed:", code);
});
```

These events mean different things.

### `stdout`

Normal program output.

### `stderr`

Error output written by the program.

**Tricky point:**

> Data on `stderr` does not necessarily mean the process failed.

Programs can write warnings or diagnostics to stderr and still exit successfully.

### `error`

Usually indicates a failure to start/manage the child process, such as:

```text
Executable not found
Permission problem
```

### `exit`

The child process has exited.

### `close`

The child and its stdio streams have closed.

For cleanup scenarios, `close` is often useful when you care about the stdio streams being finished.

---

# 16. What Happens if the Parent Process Crashes?

A common answer is incorrectly:

> "All child processes automatically die."

Not necessarily in every scenario/platform.

Process lifecycle and orphaning behavior depend on:

* operating system
* how the child was created
* whether it is detached
* process groups/sessions
* process supervision

For example:

```js
spawn("node", ["worker.js"], {
  detached: true
});
```

can intentionally create a more independent process relationship, with platform-specific behavior.

### Production lesson

Do not depend on assumptions such as:

> "If the parent dies, every child will definitely be cleaned up."

Manage child lifecycle explicitly.

---

# 17. What Happens if a Child Process Crashes?

Suppose:

```text
Parent
  │
  ├── Child 1 ❌ crashed
  │
  └── Parent continues
```

A child crash does not automatically mean the parent process must crash.

You can monitor:

```js
child.on("exit", (code, signal) => {
  console.log({
    code,
    signal
  });
});
```

Example:

```text
code = 1
```

could indicate an application failure.

Production systems may:

```text
Child crashes
    ↓
Log error
    ↓
Collect metrics
    ↓
Apply restart policy/backoff
    ↓
Alert if repeated
```

Avoid blindly doing:

```js
child.on("exit", () => {
  startChildAgain();
});
```

If the child immediately crashes, you can create a **restart loop**.

Use backoff.

---

# 18. `kill()` Does Not Always Mean "Immediately Kill"

```js
child.kill();
```

This sends a signal. By default, commonly:

```text
SIGTERM
```

The process may:

* handle the signal
* clean up
* terminate afterward

You can specify:

```js
child.kill("SIGTERM");
```

or, where supported:

```js
child.kill("SIGKILL");
```

### Tricky point

`SIGKILL` cannot be gracefully handled by the process.

So production shutdown often looks like:

```text
SIGTERM
   ↓
Stop new work
   ↓
Finish/cleanup
   ↓
Exit
```

If it exceeds a timeout:

```text
SIGKILL
```

---

# 19. IPC Messages Are Not a Database

With `fork()`:

```js
child.send({ userId: 123 });
```

Messages are IPC communication, but they are not durable.

If:

```text
Message sent
     ↓
Child crashes
```

you should not assume durable processing semantics.

For critical jobs:

```text
API
 ↓
Durable Queue
 ↓
Worker
```

For example, a production queue system is generally more appropriate when you need retries, persistence, acknowledgments, and distributed workers.

This is a good distinction from simply spawning a child process for every background task.

---

# 20. Don't Create Unlimited Child Processes Per Request

Bad:

```js
app.get("/process", (req, res) => {
  fork("./worker.js");
  res.send("Started");
});
```

Imagine:

```text
10,000 requests
       ↓
10,000 processes 😱
```

Each process has overhead, memory consumption, scheduling overhead, and resource limits.

Better architecture:

```text
Requests
    ↓
Concurrency control / Queue
    ↓
Fixed number of Workers
    ↓
Processing
```

For repeated jobs, consider:

* Worker Threads with a pool
* a controlled process pool
* a durable job queue for distributed/background jobs

---

# 21. Process Communication Has Serialization/Copying Cost

When you do:

```js
child.send({
  largeData: hugeObject
});
```

the data must be transferred through IPC.

Therefore:

```text
Parent data
   ↓
Serialize / transfer
   ↓
IPC channel
   ↓
Deserialize / reconstruct
   ↓
Child
```

Sending very large objects repeatedly can be expensive.

Better:

```text
Parent → Send file ID/path/job ID → Child
```

instead of:

```text
Parent → Send 2 GB data object → Child
```

The exact transfer mechanics depend on the IPC serialization mode and data type, but the key interview point is that **cross-process communication is not free**.

---

# 22. `process.send()` Only Exists When IPC Is Available

Inside:

```js
worker.js
```

this may work:

```js
process.send({ hello: "world" });
```

when launched using:

```js
fork("./worker.js");
```

But if you simply run:

```bash
node worker.js
```

there may be no IPC channel.

So production code can check:

```js
if (process.send) {
  process.send({ hello: "world" });
}
```

Similarly:

```js
process.connected
```

can help determine whether an IPC connection remains active.

---

# 23. `disconnect()` vs `kill()`

### `disconnect()`

```js
child.disconnect();
```

Closes the IPC channel.

It does **not necessarily mean**:

```text
Immediately terminate the child process
```

The child may continue if other event-loop handles keep it alive.

### `kill()`

```js
child.kill();
```

sends a signal requesting termination.

So:

```text
disconnect()
    = close communication channel

kill()
    = signal process termination
```

Very common interview question.

---

# 24. Production Example: Running FFmpeg

A realistic use case is video processing.

```js
const { spawn } = require("child_process");

function processVideo(input, output) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", [
      "-i",
      input,
      "-vf",
      "scale=1280:720",
      output
    ]);

    let errorOutput = "";

    child.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`FFmpeg failed with code ${code}: ${errorOutput}`)
        );
      }
    });
  });
}
```

Why `spawn()`?

Because FFmpeg can produce continuous and potentially substantial output, and streaming is more appropriate than buffering everything.

---

# 25. When Should You Use What?

```text
Need to run shell command with small output?
        ↓
      exec()

Need to run executable with arguments and small buffered output?
        ↓
    execFile()

Need large/continuous output?
        ↓
      spawn()

Need another Node.js process with IPC?
        ↓
       fork()

Need CPU-heavy JavaScript with lower overhead?
        ↓
   Worker Threads

Need to scale HTTP server across cores/processes?
        ↓
      Cluster
```

---

# 26. The Most Important Comparison

## Child Process vs Worker Thread vs Cluster vs libuv

|                                         | Child Process               | Worker Thread                 | Cluster                             | libuv                          |
| --------------------------------------- | --------------------------- | ----------------------------- | ----------------------------------- | ------------------------------ |
| Creates OS process?                     | Yes                         | No                            | Yes                                 | No                             |
| Separate JS execution context?          | Yes                         | Yes                           | Yes                                 | N/A                            |
| Separate heap by default?               | Yes                         | Yes                           | Yes                                 | N/A                            |
| Can share memory directly?              | No                          | Yes, when using shared memory | No                                  | Internal mechanism             |
| Runs arbitrary JS CPU work in parallel? | Yes                         | Yes                           | Yes, via separate workers/processes | No, not arbitrary JS           |
| Run external program?                   | Yes                         | No                            | Not its purpose                     | No                             |
| HTTP scaling                            | Manually                    | Manually                      | Main purpose                        | Supports async internals       |
| IPC/message communication               | Yes                         | Yes                           | Yes                                 | Internal callbacks             |
| Startup overhead                        | High                        | Lower                         | High                                | No app-level creation          |
| Best use                                | Isolation/external programs | CPU-heavy JS                  | Multi-process server scaling        | Node internal async operations |

### The cleanest interview answer

> `child_process` creates independent OS processes with separate memory and event loops, making it useful for isolation and running external programs. Worker Threads provide parallel JavaScript execution inside the same process with lower overhead and optional shared memory. Cluster uses multiple Node.js processes mainly to scale server request handling across CPU cores. The libuv thread pool is an internal mechanism for certain Node APIs and does not automatically parallelize arbitrary synchronous JavaScript.

---

# 27. Tricky Interview Questions 🔥

### Q1. Does `async/await` make CPU-heavy code non-blocking?

**No.**

```js
async function calculate() {
  for (let i = 0; i < 5_000_000_000; i++) {}
}
```

Still blocks the JavaScript thread.

Use:

```text
Worker Thread / Child Process
```

---

### Q2. Does `fork()` create a thread?

**No.**

It creates a separate **process**.

---

### Q3. Does every `data` event from `stdout` contain one complete message?

**No.**

Streams provide chunks, not application-level messages.

---

### Q4. Is `stderr` always an error?

**No.**

A successful program can write diagnostics or warnings to stderr.

---

### Q5. What is the main difference between `spawn()` and `exec()`?

> `spawn()` streams output, while `exec()` buffers command output and invokes its callback when the command completes.

---

### Q6. Why can `exec()` be dangerous?

If untrusted data is interpolated into a shell command, it can introduce command injection risk.

---

### Q7. Is `child.send()` proof that the task completed?

**No.**

It only concerns message delivery to the IPC channel. Task completion should be confirmed by an explicit response from the child.

---

### Q8. Does `fork()` share variables with the parent?

```js
let count = 0;
```

No.

Parent:

```js
count = 10;
```

does not automatically change the child's:

```js
count
```

They have separate memory.

---

### Q9. If a child blocks its event loop, does the parent also block?

**No**, not directly. They are separate processes.

But excessive CPU consumption can still affect the entire machine due to CPU contention.

---

### Q10. Should you create one child process for every request?

Usually **no**.

Use bounded concurrency or a worker/process pool.

---

# TL;DR — Interview Answer

> Node.js `child_process` allows us to create separate OS processes. Each child has its own memory, V8 instance, and event loop, so CPU-heavy or blocking work in the child does not directly block the parent event loop. `spawn` is preferred for streaming large output, `exec` for small buffered shell command output, `execFile` for executing a program directly without shell parsing by default, and `fork` for running another Node.js process with built-in IPC. Compared with Worker Threads, child processes provide stronger isolation but have higher memory and startup overhead. Cluster is built around multiple processes for scaling server request handling, while the libuv thread pool handles certain native async operations and does not automatically move arbitrary JavaScript CPU loops off the main thread.
