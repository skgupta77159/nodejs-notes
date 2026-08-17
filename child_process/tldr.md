# Child Process in Node.js — TL;DR + Easy Working Code

## 1. What is Child Process?

A child process is a **separate OS process** created by Node.js.

```text
Parent Process
├── Own V8
├── Own Heap
├── Own Event Loop
│
└── Child Process
    ├── Own V8
    ├── Own Heap
    └── Own Event Loop
```

### Key point

> Heavy/blocking work in the child does not directly block the parent's event loop.

---

# 2. Main APIs

```js
const {
  spawn,
  exec,
  execFile,
  fork
} = require("child_process");
```

| API          | Best Use                | Output    |
| ------------ | ----------------------- | --------- |
| `spawn()`    | Large/continuous output | Streaming |
| `exec()`     | Small shell commands    | Buffered  |
| `execFile()` | Run executable directly | Buffered  |
| `fork()`     | Another Node.js script  | IPC       |

---

# 3. `spawn()` — Large Output / Streaming

### parent.js

```js
const { spawn } = require("child_process");

const child = spawn("node", ["worker.js"]);

child.stdout.on("data", (data) => {
  console.log("Child:", data.toString());
});

child.on("close", (code) => {
  console.log("Child finished with code:", code);
});
```

### worker.js

```js
console.log("Step 1");

setTimeout(() => {
  console.log("Step 2");
}, 1000);

setTimeout(() => {
  console.log("Step 3");
}, 2000);
```

### Working

```text
Parent
  │
  ├── spawn()
  ▼
Child
  │
  ├── stdout → Parent receives chunks
  │
  └── close → Process finished
```

### Remember

> Use `spawn()` when output can be large or continuously generated.

🔥 **Tricky:** One `data` event is a **chunk**, not guaranteed to be one complete line/message.

---

# 4. `exec()` — Small Shell Commands

```js
const { exec } = require("child_process");

exec("node --version", (error, stdout, stderr) => {
  if (error) {
    console.error(error);
    return;
  }

  console.log("Version:", stdout);
});
```

### Working

```text
Command starts
     ↓
Output generated
     ↓
Stored in memory
     ↓
Command finishes
     ↓
Callback receives output
```

### Remember

> `exec()` buffers the complete output before giving it to you.

❌ Not ideal for huge output:

```js
exec("command-producing-huge-output");
```

Potentially hits the output buffer limit.

---

# 5. `exec()` Shell Injection

❌ Dangerous:

```js
exec(`ls ${userInput}`);
```

If `userInput` contains shell operators, the shell may interpret them.

✅ Prefer passing arguments separately:

```js
const { spawn } = require("child_process");

spawn("ls", [userInput]);
```

### Interview line

> Never directly interpolate untrusted user input into `exec()` commands because shell interpretation can cause command injection.

---

# 6. `execFile()` — Run Executable Directly

```js
const { execFile } = require("child_process");

execFile("node", ["--version"], (error, stdout) => {
  if (error) {
    console.error(error);
    return;
  }

  console.log(stdout);
});
```

### Difference

```text
exec()
Node → Shell → Command

execFile()
Node → Command
```

### Remember

> `execFile()` does not use a shell by default, but it still buffers output.

---

# 7. `fork()` — Node.js Process + IPC

## parent.js

```js
const { fork } = require("child_process");

const child = fork("./worker.js");

child.send({
  number: 10
});

child.on("message", (message) => {
  console.log("Result from child:", message);
});
```

## worker.js

```js
process.on("message", ({ number }) => {
  console.log("Child received:", number);

  process.send({
    result: number * 2
  });
});
```

### Output

```text
Child received: 10
Result from child: { result: 20 }
```

### Working

```text
Parent                         Child

child.send({ number: 10 })
       ───── IPC ───────────►

                           process.on("message")
                                   │
                                   ▼
                              Do work
                                   │
process.on("message") ◄──── process.send(result)
```

### Remember

> `fork()` is for starting another Node.js process with built-in IPC communication.

---

# 8. Is `child.send()` Synchronous?

No.

```js
child.send({ task: "calculate" });

console.log("Parent continues...");
```

The parent does not wait for the child to finish.

Also, this is important:

```js
child.send(message, callback);
```

The callback does **not mean the task is completed**.

The child should explicitly respond:

```js
// Child
process.send({ status: "completed" });
```

---

# 9. Heavy CPU Work with `fork()`

## parent.js

```js
const { fork } = require("child_process");

const child = fork("./worker.js");

console.log("Parent: starting work");

child.send({ limit: 1_000_000_000 });

console.log("Parent: I can continue working");

child.on("message", (result) => {
  console.log("Result:", result);
});
```

## worker.js

```js
process.on("message", ({ limit }) => {
  let sum = 0;

  for (let i = 0; i < limit; i++) {
    sum += i;
  }

  process.send(sum);
});
```

### Working

```text
Parent Event Loop                Child Event Loop

Send task ────────────────────► Start calculation
Continue working                 │
Handle other work                │
                                ▼
Receive result ◄───────────── process.send(result)
```

> Parent JavaScript remains responsive while the child does the heavy calculation.

---

# 10. Child Process vs Worker Thread

|               | Child Process             | Worker Thread     |
| ------------- | ------------------------- | ----------------- |
| OS process    | Separate                  | Same process      |
| Memory        | Separate                  | Separate JS heap  |
| Shared memory | No by default             | Possible          |
| Startup cost  | Higher                    | Lower             |
| Isolation     | Stronger                  | Less than process |
| Best for      | External apps / isolation | CPU-heavy JS      |

### Visual

```text
CHILD PROCESS

OS
├── Node Parent Process → Memory A
│
└── Node Child Process  → Memory B
```

```text
WORKER THREAD

One Node Process
├── Main Thread
├── Worker Thread
└── Worker Thread
```

### Interview answer

> Use Worker Threads for CPU-heavy JavaScript with lower overhead. Use Child Processes for stronger isolation or when running external programs such as Python or FFmpeg.

---

# 11. Child Process vs Cluster

## Cluster

```text
                 Requests
                    │
                    ▼
              Primary Process
              /      |      \
             ▼       ▼       ▼
         Worker 1 Worker 2 Worker 3
```

Purpose:

> Scale server request handling across multiple CPU cores.

## Child Process

```text
Node Server
    │
    ├── Handle Requests
    │
    └── Child Process
           └── Specific Task
```

Purpose:

> Run a separate process for arbitrary work.

### Important

> Cluster uses multiple child processes, but Cluster's main goal is server/request scaling.

---

# 12. Child Process vs libuv Thread Pool

Example:

```js
const fs = require("fs");

fs.readFile("large.txt", () => {
  console.log("Done");
});
```

Some Node.js async APIs use the libuv worker pool.

But this:

```js
for (let i = 0; i < 5_000_000_000; i++) {
  // heavy JavaScript
}
```

still blocks the main JavaScript thread.

Even this:

```js
async function heavyTask() {
  for (let i = 0; i < 5_000_000_000; i++) {}
}
```

still blocks.

### Remember

> `async/await` does NOT automatically move synchronous CPU-heavy JavaScript to another thread.

For arbitrary CPU-heavy JS:

```text
Worker Thread
OR
Child Process
```

---

# 13. Every Child Has Its Own Event Loop

```text
Parent Process
├── Event Loop
├── V8
└── Heap

Child Process
├── Event Loop
├── V8
└── Heap
```

So:

```js
// Child
while (true) {
  // blocks CHILD
}
```

does not directly block the parent's event loop.

⚠️ But both still use the same machine CPU.

Creating too many CPU-heavy children causes:

```text
Too many processes
       ↓
Context switching
       ↓
CPU contention
       ↓
Performance degradation
```

---

# 14. `spawn()` vs `fork()`

### `spawn()`

Runs any executable:

```js
spawn("node", ["script.js"]);
spawn("python", ["script.py"]);
spawn("ffmpeg", ["-version"]);
```

### `fork()`

Runs a Node.js script with IPC:

```js
fork("./worker.js");
```

### Interview answer

> `spawn()` can start arbitrary executables. `fork()` is specialized for starting another Node.js process and provides an IPC communication channel.

---

# 15. `stdout`, `stderr`, `error`, `exit`, `close`

```js
const { spawn } = require("child_process");

const child = spawn("node", ["script.js"]);

child.stdout.on("data", (data) => {
  console.log("stdout:", data.toString());
});

child.stderr.on("data", (data) => {
  console.log("stderr:", data.toString());
});

child.on("error", (error) => {
  console.log("Could not start process:", error.message);
});

child.on("exit", (code, signal) => {
  console.log("Process exited:", code, signal);
});

child.on("close", (code) => {
  console.log("Process and stdio closed:", code);
});
```

### Quick difference

```text
stdout → Normal output
stderr → Diagnostic/error stream
error  → Process could not start/manage
exit   → Process exited
close  → Process + stdio streams closed
```

🔥 **Tricky:**

> `stderr` does not always mean the process failed.

A process can write warnings to stderr and still exit with:

```text
code = 0
```

---

# 16. `disconnect()` vs `kill()`

### `disconnect()`

```js
child.disconnect();
```

Closes IPC communication.

```text
Parent ─── IPC ─── Child

disconnect()

Parent    X    Child
```

The child may still continue running.

---

### `kill()`

```js
child.kill("SIGTERM");
```

Sends a termination signal.

Typical graceful shutdown:

```text
SIGTERM
   ↓
Stop accepting work
   ↓
Cleanup
   ↓
Exit
```

If absolutely necessary after timeout:

```js
child.kill("SIGKILL");
```

🔥 **Tricky:**

> `kill()` means "send a signal"; it is not always equivalent to an instant, graceful cleanup.

---

# 17. Parent Crash ≠ Always Child Dies

Don't assume:

```text
Parent crashes
    ↓
Child definitely dies
```

Process behavior can depend on OS and process configuration.

For example:

```js
spawn("node", ["worker.js"], {
  detached: true
});
```

can make process lifecycle more independent.

### Production rule

> Explicitly manage child process lifecycle. Don't rely on assumptions about automatic cleanup.

---

# 18. Child Crash Handling

```js
child.on("exit", (code, signal) => {
  console.log({
    code,
    signal
  });
});
```

Bad:

```js
child.on("exit", () => {
  startChildAgain(); // infinite crash/restart loop possible
});
```

Better:

```text
Child crashes
    ↓
Log
    ↓
Monitor
    ↓
Restart with backoff
    ↓
Alert if repeatedly failing
```

---

# 19. IPC Is Not a Durable Queue

```js
child.send({
  job: "send-email"
});
```

This does **not** provide the guarantees of a durable job queue.

If:

```text
Parent sends job
      ↓
Child crashes
```

you may need your own retry/recovery logic.

For important background jobs:

```text
API
 ↓
Durable Queue
 ↓
Worker
 ↓
Acknowledgment
```

Use the appropriate queue architecture when persistence, retries, and distributed processing are required.

---

# 20. Don't Create Unlimited Processes

❌ Bad:

```js
app.get("/heavy", (req, res) => {
  fork("./worker.js");

  res.send("Started");
});
```

```text
10,000 Requests
      ↓
10,000 Child Processes 😱
```

Problems:

* High memory
* High startup overhead
* CPU contention
* Too much context switching
* OS process limits

Better:

```text
Requests
   ↓
Queue / Pool
   ↓
Fixed number of workers
   ↓
Processing
```

---

# 21. IPC Has Communication Cost

Avoid repeatedly sending huge data:

```js
child.send({
  hugeData: massiveObject
});
```

There is communication and serialization/transfer overhead.

Prefer sending a reference when possible:

```js
child.send({
  jobId: "123",
  filePath: "/tmp/video.mp4"
});
```

Child:

```js
process.on("message", ({ filePath }) => {
  // Read/process the file independently
});
```

### Remember

> Cross-process communication is not free.

---

# 22. `process.send()` Requires IPC

This works when started using:

```js
fork("./worker.js");
```

Inside the worker:

```js
if (process.send) {
  process.send({ status: "done" });
}
```

But:

```bash
node worker.js
```

does not necessarily create an IPC channel.

Useful check:

```js
console.log(process.connected);
```

---

# 23. Production Example — FFmpeg

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

    child.stderr.on("data", (data) => {
      console.log("FFmpeg:", data.toString());
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve("Video processed successfully");
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
  });
}
```

Why `spawn()`?

> FFmpeg can generate continuous output, so streaming is better than buffering all output.

---

# 24. When to Use What?

```text
Small shell command?
        ↓
      exec()

Executable + arguments + small output?
        ↓
    execFile()

Large / continuous output?
        ↓
      spawn()

Another Node.js process + IPC?
        ↓
       fork()

CPU-heavy JavaScript?
        ↓
   Worker Threads
   (usually preferred)

Need strong isolation / external program?
        ↓
   Child Process

Scale HTTP requests across processes/cores?
        ↓
      Cluster
```

---

# Final Comparison Table 🔥

| Feature                     | Child Process            | Worker Thread         | Cluster                    | libuv Thread Pool       |
| --------------------------- | ------------------------ | --------------------- | -------------------------- | ----------------------- |
| Separate OS process         | ✅                        | ❌                     | ✅                          | ❌                       |
| Separate memory             | ✅                        | Separate JS heap      | ✅                          | Internal                |
| Own Event Loop              | ✅                        | Own execution context | ✅                          | N/A for your JS         |
| Shared memory               | ❌ by default             | ✅ Possible            | ❌                          | Internal                |
| Runs arbitrary CPU-heavy JS | ✅                        | ✅                     | Indirectly through workers | ❌                       |
| Runs external programs      | ✅                        | ❌                     | ❌                          | ❌                       |
| IPC/messages                | ✅                        | ✅                     | Internal IPC               | N/A                     |
| Startup overhead            | High                     | Lower                 | High                       | N/A                     |
| Main purpose                | Isolation/external tasks | CPU-heavy JS          | Server scaling             | Native async operations |

---

# 🚀 Ultimate Interview TL;DR

> **Child Process creates a completely separate OS process with its own memory, V8 instance, and event loop. It is useful for process isolation, running external programs, and executing work independently from the main Node.js process. `spawn()` streams output and is suitable for large output, `exec()` runs commands through a shell and buffers output, `execFile()` runs an executable directly without a shell by default, and `fork()` starts another Node.js process with IPC communication.**
>
> **Compared with Worker Threads, Child Processes have stronger isolation but higher memory and startup overhead. Worker Threads are generally better for CPU-heavy JavaScript. Cluster uses multiple processes mainly for scaling HTTP/server workloads across CPU cores. libuv's thread pool handles certain native async operations and does not automatically make arbitrary JavaScript loops non-blocking.**
>
> **In production, don't create unlimited child processes per request, manage crashes and signals properly, use bounded pools or queues, don't treat IPC as a durable queue, and avoid sending huge objects unnecessarily between processes.**
