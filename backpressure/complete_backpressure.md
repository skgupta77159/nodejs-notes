# Node.js Backpressure — Complete Notes 🚰

## 1. What is Backpressure?

**Backpressure happens when data is produced faster than the consumer can process it.**

Think of a pipeline:

```text
Fast Producer  ───────>  Buffer  ───────>  Slow Consumer
     🚀                    📦                    🐢
```

Example:

```text
File Read Stream → Transform Stream → HTTP Response
```

If the file is read at **100 MB/s**, but the network can send only **10 MB/s**, data starts accumulating in memory.

Without backpressure:

```text
Producer → → → → → → Buffer grows → Memory grows → 💥 OOM
```

With backpressure:

```text
Producer → "Consumer is full, wait!" → pauses
Consumer → processes/drains data
Producer → resumes
```

### Core definition for interviews

> **Backpressure is a flow-control mechanism that prevents a fast producer from overwhelming a slower consumer by slowing, pausing, buffering, or otherwise controlling the producer.**

---

# 2. Real-World Example: Water Tank

Imagine:

```text
Water Tap (Producer)
       ↓ 100 L/min
    ┌─────────┐
    │  Tank   │ ← Buffer
    └─────────┘
       ↓ 10 L/min
Drain (Consumer)
```

The tank fills faster than it drains.

Eventually:

```text
💥 Tank overflows
```

Backpressure means the tank tells the tap:

> "Stop. I'm full."

The tap:

```text
PAUSES
```

When water drains:

```text
Tank has space
       ↓
Tap RESUMES
```

Exactly the same concept applies to Node.js streams.

---

# 3. Why Is Backpressure Important in Node.js?

Node.js often processes:

* Large files
* HTTP uploads
* HTTP downloads
* Database data
* Video streaming
* Compression
* Encryption
* Network sockets
* Message queues

Example:

```text
100 GB File
    ↓
fs.createReadStream()
    ↓
gzip
    ↓
HTTP Response
```

You **cannot safely assume every part processes data at the same speed**.

Different stages may look like:

```text
Disk        = 500 MB/s
CPU gzip    = 100 MB/s
Network     = 10 MB/s
```

The slowest component is:

```text
Network = 10 MB/s
```

Without flow control, Node could keep reading data and storing pending chunks.

```text
Memory:
10 MB
50 MB
500 MB
2 GB
💥 JavaScript heap / process memory problem
```

---

# 4. The Main Node.js Backpressure Signal: `write()`

The most important API:

```js
const canContinue = writable.write(chunk);
```

It returns:

```js
true
```

or:

```js
false
```

### Meaning

```js
true
```

➡️ Consumer currently accepts more data.

```js
false
```

➡️ Internal writable buffer has reached its threshold.

**Important:** `false` does NOT mean the data was rejected.

The chunk was generally accepted into the writable stream's internal buffering, but Node is telling you:

> "Do not send me more data right now."

---

## Example

```js
const fs = require("fs");

const writable = fs.createWriteStream("output.txt");

const result = writable.write("Hello");

console.log(result);
```

If:

```js
result === true
```

Continue writing.

If:

```js
result === false
```

Stop producing temporarily and wait for:

```js
"drain"
```

---

# 5. `highWaterMark` — The Buffer Threshold

Every stream has a buffering threshold called:

```js
highWaterMark
```

Example:

```js
const fs = require("fs");

const stream = fs.createWriteStream("output.txt", {
  highWaterMark: 16 * 1024
});
```

Here:

```text
16 KB
```

is the configured threshold.

Conceptually:

```text
Producer
   ↓
Writable Buffer
   │
   ├── 4 KB   → keep going
   ├── 8 KB   → keep going
   ├── 12 KB  → keep going
   └── 16 KB  → write() may return false
                    ↓
                 PAUSE
```

Once buffered data reduces sufficiently, Node emits:

```js
writable.on("drain", () => {
  // Safe to resume writing
});
```

### Critical interview fact ⚠️

`highWaterMark` is **NOT a hard maximum buffer size**.

It is mainly a **threshold/signal for flow control**.

A writable stream may temporarily buffer more than its `highWaterMark`.

So don't say:

> "Node will never buffer more than highWaterMark."

That's incorrect.

Better answer:

> "`highWaterMark` is a buffering threshold that influences when a stream signals backpressure; it is not necessarily a strict maximum amount of memory the stream can ever hold."

---

# 6. Automatic Backpressure

Node.js provides automatic backpressure when you connect streams using:

```js
.pipe()
```

Example:

```js
const fs = require("fs");

const readStream = fs.createReadStream("large-file.txt");

const writeStream = fs.createWriteStream("copy.txt");

readStream.pipe(writeStream);
```

Conceptually:

```text
Readable
   │
   │ chunk
   ▼
Writable.write(chunk)
   │
   ├── true  → Readable continues
   │
   └── false → Readable pauses
                    │
                    ▼
              Buffer drains
                    │
                    ▼
                "drain"
                    │
                    ▼
             Readable resumes
```

You usually don't manually need:

```js
readStream.pause();
```

because `.pipe()` coordinates this automatically.

### This is the recommended approach

```js
readStream.pipe(transformStream).pipe(writeStream);
```

Or modern Node.js:

```js
const { pipeline } = require("stream/promises");

await pipeline(
  readStream,
  transformStream,
  writeStream
);
```

---

# 7. Manual Backpressure Handling

Suppose you manually consume a readable stream and write somewhere else.

❌ Bad:

```js
readStream.on("data", (chunk) => {
  writeStream.write(chunk);
});
```

Why?

You completely ignore:

```js
writeStream.write()
```

return value.

Even if the writable says:

```text
I'm full!
```

you keep pushing data.

---

## Correct Manual Implementation

```js
readStream.on("data", (chunk) => {
  const canContinue = writeStream.write(chunk);

  if (!canContinue) {
    console.log("Backpressure detected. Pausing producer...");
    readStream.pause();

    writeStream.once("drain", () => {
      console.log("Consumer drained. Resuming producer...");
      readStream.resume();
    });
  }
});

readStream.on("end", () => {
  writeStream.end();
});
```

### Flow

```text
1. Read chunk
       ↓
2. write(chunk)
       ↓
3. write() returns?
       │
       ├── true
       │      ↓
       │   Continue reading
       │
       └── false
              ↓
       readable.pause()
              ↓
       Wait for "drain"
              ↓
       readable.resume()
```

This is **manual backpressure management**.

---

# 8. Auto vs Manual Backpressure

| Feature         | Automatic                 | Manual                         |
| --------------- | ------------------------- | ------------------------------ |
| Typical API     | `.pipe()` / `pipeline()`  | `write()`                      |
| Pause producer  | Node handles it           | You handle it                  |
| Resume producer | Node handles it           | Listen for `drain`             |
| Code complexity | Low                       | Higher                         |
| Error handling  | `pipeline()` is strongest | You must handle carefully      |
| Use case        | Stream → Stream           | Custom producer/consumer logic |

### Recommended production choice

```js
await pipeline(
  source,
  transform,
  destination
);
```

Use manual control when:

* Producer isn't a normal stream
* Consumer isn't a normal stream
* You need custom pause/resume logic
* You implement a custom queue
* You need custom overload policies

---

# 9. Three Important Backpressure Strategies

You mentioned:

1. **Control**
2. **Buffer**
3. **Drop**
4. **Ignore**

A useful way to remember them:

```text
Fast Producer
      ↓
What do we do when consumer is slow?

CONTROL → Slow down producer
BUFFER  → Store temporarily
DROP    → Discard some data
IGNORE  → Do nothing
```

Let's examine each.

---

# Strategy 1: CONTROL the Producer

This is usually the best strategy when every piece of data matters.

```text
Producer → Consumer is full
              ↓
        STOP / PAUSE
              ↓
       Consumer catches up
              ↓
         RESUME
```

Example:

```js
readable.on("data", (chunk) => {
  if (!writable.write(chunk)) {
    readable.pause();

    writable.once("drain", () => {
      readable.resume();
    });
  }
});
```

### Best for

* File copying
* File uploads
* Database migrations
* Payment events
* Important messages
* Video/file processing

You don't want:

```text
Payment #101 ❌ dropped
Payment #102 ❌ dropped
```

So you control the producer instead.

---

# Strategy 2: BUFFER the Data

Instead of immediately slowing the producer, temporarily queue the data.

```text
Producer 🚀
    ↓
┌─────────────────┐
│     BUFFER      │
│                 │
│ chunk1          │
│ chunk2          │
│ chunk3          │
│ chunk4          │
└─────────────────┘
    ↓
Consumer 🐢
```

Example conceptual queue:

```js
const queue = [];

function produce(data) {
  queue.push(data);
}

async function consume() {
  while (true) {
    const item = queue.shift();

    if (item) {
      await processItem(item);
    }
  }
}
```

### Problem 🚨

If producer rate is:

```text
10,000 events/sec
```

Consumer rate:

```text
1,000 events/sec
```

The backlog grows:

```text
9,000 events/sec
```

After one minute:

```text
540,000 pending events
```

Memory keeps growing.

Therefore:

> **Buffering alone is not a complete backpressure strategy unless the buffer is bounded or the producer is eventually controlled.**

---

## Bounded Buffer

Better:

```js
const MAX_QUEUE_SIZE = 1000;
const queue = [];

function produce(data) {
  if (queue.length >= MAX_QUEUE_SIZE) {
    return false;
  }

  queue.push(data);
  return true;
}
```

Now you must decide:

```text
Buffer full → What next?
```

Options:

```text
Control producer
Drop newest
Drop oldest
Reject request
Return HTTP 429
Persist externally
```

---

# Strategy 3: DROP Data

Sometimes data is less important than keeping the system alive.

Example:

```text
Mouse movement events
```

Suppose:

```text
1000 mouse events/sec
```

But the consumer can process:

```text
100/sec
```

You don't need every historical mouse position.

Instead:

```text
Old: x=100
Old: x=101
Old: x=102
Old: x=103
Latest: x=500 ← most useful
```

You can drop intermediate data.

---

## Example: Drop When Queue Is Full

```js
const MAX_QUEUE_SIZE = 100;

const queue = [];

function addEvent(event) {
  if (queue.length >= MAX_QUEUE_SIZE) {
    console.log("Queue full. Dropping event.");

    return;
  }

  queue.push(event);
}
```

### Policies

#### Drop newest

```text
Queue: [A, B, C]
New event: D
Full

Result:
[A, B, C]

D ❌ dropped
```

Good when older events matter.

---

#### Drop oldest

```text
Queue: [A, B, C]
New event: D
Full

Result:
[B, C, D]

A ❌ dropped
```

Good for:

* Live metrics
* Latest stock display
* GPS tracking
* Real-time cursor positions
* Latest sensor readings

---

#### Coalescing

Instead of storing every update:

```text
temperature = 20
temperature = 21
temperature = 22
temperature = 23
```

Keep only:

```text
temperature = 23
```

Example:

```js
let latestTemperature = null;

function receiveTemperature(value) {
  latestTemperature = value;
}

async function consume() {
  while (true) {
    if (latestTemperature !== null) {
      const value = latestTemperature;

      latestTemperature = null;

      await save(value);
    }
  }
}
```

This is often better than blindly buffering.

---

# Strategy 4: IGNORE Backpressure ❌

Example:

```js
readable.on("data", (chunk) => {
  writable.write(chunk);
});
```

You ignore:

```js
writable.write()
```

result.

Suppose:

```js
write() === false
```

But you continue:

```js
writable.write(chunk1);
writable.write(chunk2);
writable.write(chunk3);
writable.write(chunk4);
writable.write(chunk5);
```

The internal queue grows.

Potential result:

```text
Memory usage ↑
GC pressure ↑
Latency ↑
Event loop delays ↑
OOM risk ↑
Process crash 💥
```

### Important nuance

Ignoring backpressure does **not necessarily immediately lose data**.

Instead, it often means:

> "Keep accepting and buffering more data than the consumer can currently handle."

This causes unbounded memory growth if the producer stays faster.

---

# 10. A Complete Comparison

```text
                 Consumer becomes slow
                         │
         ┌───────────────┼───────────────┐
         │               │               │
       CONTROL         BUFFER           DROP
         │               │               │
      Pause source    Store data      Discard data
         │               │               │
      No data loss    More memory      Data loss
         │               │               │
      More latency    Need limits      System survives
```

And:

```text
IGNORE
   │
Keep producing anyway
   │
Buffer grows
   │
Potential memory problem 💥
```

---

# 11. `drain` Event — Very Common Interview Question

Question:

> What is the purpose of the `drain` event?

Answer:

> When `writable.write()` returns `false`, the writable stream has reached its backpressure threshold. The producer should stop writing and wait for the `drain` event before continuing.

Example:

```js
function writeChunks(stream, chunks) {
  let index = 0;

  function writeNext() {
    while (index < chunks.length) {
      const canContinue = stream.write(chunks[index]);

      index++;

      if (!canContinue) {
        stream.once("drain", writeNext);
        return;
      }
    }

    stream.end();
  }

  writeNext();
}
```

### Important

Don't do:

```js
stream.on("drain", writeNext);
```

for this one pause point unless you intentionally manage listener lifecycle.

Prefer:

```js
stream.once("drain", writeNext);
```

Otherwise repeated backpressure cycles may accidentally create unnecessary listeners depending on implementation.

---

# 12. Why `write()` Returning `false` Is Not an Error

A tricky interview question:

```js
const result = writable.write(chunk);
```

What does:

```js
false
```

mean?

❌ Wrong:

> The write failed.

❌ Wrong:

> Data was rejected.

❌ Wrong:

> The consumer disconnected.

### Correct

> The stream accepted the write but is signaling that its internal buffer is at/above its flow-control threshold, so the producer should stop writing temporarily and wait for `drain`.

Actual errors come through mechanisms such as:

```js
stream.on("error", handler);
```

or `pipeline()` rejection.

---

# 13. Backpressure with `pipeline()` — Production Recommended

Instead of:

```js
readable.pipe(transform).pipe(writable);
```

prefer `pipeline()` in production.

```js
const fs = require("fs");
const zlib = require("zlib");
const { pipeline } = require("stream/promises");

async function compressFile() {
  await pipeline(
    fs.createReadStream("large.log"),
    zlib.createGzip(),
    fs.createWriteStream("large.log.gz")
  );

  console.log("Done");
}

compressFile().catch(console.error);
```

Flow:

```text
large.log
    ↓
Readable
    ↓
Gzip Transform
    ↓
Writable
```

Each stage can apply backpressure to the previous stage.

```text
Network/File output slow
        ↑
Gzip slows
        ↑
Readable pauses
```

### Why `pipeline()` is better

It helps coordinate:

* Backpressure
* Errors
* Stream cleanup
* Proper destruction of connected streams

---

# 14. `pipe()` vs `pipeline()`

| Feature                           | `pipe()`    | `pipeline()`       |
| --------------------------------- | ----------- | ------------------ |
| Backpressure                      | ✅           | ✅                  |
| Connect streams                   | ✅           | ✅                  |
| Better centralized error handling | Manual      | ✅                  |
| Cleanup on failure                | More manual | Better coordinated |
| Promise support                   | ❌           | `stream/promises`  |
| Production preference             | Good        | Usually better     |

Example:

```js
await pipeline(
  source,
  destination
);
```

This is often a strong production answer.

---

# 15. Backpressure in HTTP Responses

Consider:

```js
app.get("/download", (req, res) => {
  const stream = fs.createReadStream("huge.mp4");

  stream.pipe(res);
});
```

What if the client's internet is slow?

```text
Server disk:       500 MB/s
Client network:      2 MB/s
```

If there were no backpressure:

```text
Server reads 500 MB/s
Network sends 2 MB/s
498 MB/s accumulates 💥
```

But:

```js
stream.pipe(res);
```

handles flow control.

Conceptually:

```text
Slow client
    ↓
res buffer fills
    ↓
res.write() returns false
    ↓
Source stream pauses
    ↓
Network drains buffer
    ↓
"drain"
    ↓
Source resumes
```

This is why streaming is memory efficient.

---

# 16. Backpressure Is NOT Just About Streams

The general concept applies everywhere.

## Database

```text
10,000 requests/sec
       ↓
DB can process 1,000/sec
```

Strategies:

```text
CONTROL → Rate limit
BUFFER  → Queue
DROP    → Reject less-important work
IGNORE  → DB overload 💥
```

---

## API Server

```text
Clients
  ↓↓↓↓↓
Node.js
  ↓
Slow external API
```

Possible strategy:

```text
Queue max = 1000
        ↓
Full?
        ↓
HTTP 429 Too Many Requests
```

That is a form of controlling overload rather than allowing infinite buffering.

---

## Message Queue

```text
Producer: 10,000 msgs/sec
Consumer: 1,000 msgs/sec
```

Queue grows.

Strategies:

```text
Scale consumers
Rate limit producers
Bound queue
Reject producer
Drop low-priority messages
Persist queue externally
```

---

# 17. Backpressure vs Rate Limiting

Very common confusion.

### Rate limiting

Controls:

> How much traffic is allowed over time?

Example:

```text
100 requests/minute
```

### Backpressure

Controls:

> What happens when the consumer cannot currently keep up?

Example:

```text
Consumer is slow
↓
Pause producer
```

They can work together:

```text
Rate Limiter
     ↓
Limits incoming load
     ↓
Application
     ↓
Backpressure
     ↓
Controls downstream flow
```

---

# 18. Backpressure vs Throttling

### Throttling

You intentionally limit speed:

```text
Maximum 10 MB/s
```

### Backpressure

The consumer's capacity determines whether the producer must slow down.

```text
Consumer fast → producer continues
Consumer slow → producer pauses
```

So:

> Throttling is usually proactive; backpressure is typically reactive flow control.

---

# 19. Backpressure vs Buffering

Another trick question.

### Buffering

```text
Store data temporarily
```

### Backpressure

```text
Signal/control flow because downstream capacity is limited
```

A buffer may be part of backpressure:

```text
Producer
   ↓
Buffer reaches threshold
   ↓
Backpressure signal
   ↓
Producer slows down
```

Therefore:

> **Buffering absorbs temporary speed differences. Backpressure prevents that buffer from growing indefinitely.**

---

# 20. Backpressure vs Queue

A queue:

```text
Producer → Queue → Consumer
```

Backpressure asks:

> What happens when the queue becomes too large?

Options:

```text
Pause producer
Reject new jobs
Scale consumers
Drop jobs
```

So:

> **A queue can absorb load, but it does not automatically solve backpressure unless its growth and capacity are controlled.**

---

# 21. Object Mode Interview Trick

For normal binary streams:

```js
highWaterMark: 16 * 1024
```

typically represents a size threshold in bytes.

But in:

```js
objectMode: true
```

it represents the **number of objects**, not bytes.

Example:

```js
const { Writable } = require("stream");

const stream = new Writable({
  objectMode: true,
  highWaterMark: 3,

  write(obj, encoding, callback) {
    setTimeout(callback, 1000);
  }
});
```

Here conceptually:

```text
highWaterMark = 3 objects
```

not:

```text
3 bytes
```

⚠️ Interview trick:

> In object mode, a huge 100 MB object can still count as one object for the object-count threshold.

So:

```js
objectMode: true
```

doesn't guarantee small memory usage just because:

```js
highWaterMark: 16
```

Each object itself might be huge.

---

# 22. `pause()` / `resume()` — Another Tricky Point

Readable streams have flow control.

```js
readable.pause();
```

means:

> Stop emitting/flowing data for now.

Later:

```js
readable.resume();
```

means:

> Continue flowing.

But generally, don't manually mix random:

```js
on("data")
pause()
resume()
pipe()
```

without understanding stream modes.

For standard stream-to-stream operations, prefer:

```js
pipeline()
```

because Node handles coordination.

---

# 23. Async Iteration and Backpressure

Modern Node.js supports:

```js
for await...of
```

Example:

```js
const fs = require("fs");

async function processFile() {
  const readable = fs.createReadStream("large.txt");

  for await (const chunk of readable) {
    await processChunk(chunk);
  }
}
```

This gives a natural sequential consumption model:

```text
Get chunk
   ↓
await processChunk()
   ↓
Get next chunk
```

Useful when your processing itself is async and you want consumption tied to processing progress.

But remember: if you intentionally start unlimited concurrent work inside the loop, you can reintroduce your own buffering/overload problem.

For example:

```js
const promises = [];

for await (const chunk of readable) {
  promises.push(processChunk(chunk));
}

await Promise.all(promises);
```

For a huge stream, this may create an enormous number of pending promises and retain lots of data.

Better to control concurrency.

---

# 24. Production Strategy: Bounded Concurrency

Suppose each chunk triggers an API call.

❌ Dangerous:

```js
for await (const chunk of readable) {
  processChunk(chunk); // unlimited outstanding work
}
```

Potentially:

```text
100,000 chunks
    ↓
100,000 API requests in flight 💥
```

Better:

```text
Producer
   ↓
Concurrency limit = 10
   ↓
Only 10 tasks running
   ↓
When one completes → accept next
```

This is another form of **application-level backpressure**.

---

# 25. Custom Transform Stream and Backpressure

A transform stream naturally participates in the pipeline.

```js
const { Transform } = require("stream");

const upperCase = new Transform({
  transform(chunk, encoding, callback) {
    const result = chunk.toString().toUpperCase();

    callback(null, result);
  }
});
```

Use:

```js
await pipeline(
  fs.createReadStream("input.txt"),
  upperCase,
  fs.createWriteStream("output.txt")
);
```

Flow:

```text
Readable
   ↓
Transform
   ↓
Writable
```

If writable slows:

```text
Writable backpressure
        ↑
Transform slows
        ↑
Readable slows
```

This propagation through the pipeline is one of the biggest benefits of streams.

---

# 26. `callback()` Is Important in Custom Streams

Example:

```js
const slowTransform = new Transform({
  transform(chunk, encoding, callback) {
    setTimeout(() => {
      callback(null, chunk);
    }, 1000);
  }
});
```

Until you call:

```js
callback()
```

Node knows that processing for that chunk isn't complete.

This naturally affects throughput and flow through the transform pipeline.

If you forget:

```js
callback();
```

the stream can appear stuck.

Example:

```js
transform(chunk, encoding, callback) {
  // Oops, callback never called
}
```

Result:

```text
Pipeline waits forever / appears hung
```

---

# 27. How Does `pipe()` Handle Backpressure Internally?

Conceptually, `.pipe()` does something similar to:

```js
readable.on("data", (chunk) => {
  const canContinue = writable.write(chunk);

  if (!canContinue) {
    readable.pause();

    writable.once("drain", () => {
      readable.resume();
    });
  }
});
```

This is simplified pseudocode, but the key idea is:

```text
write() returns false
        ↓
pause upstream
        ↓
wait for drain
        ↓
resume upstream
```

Therefore:

```js
readable.pipe(writable);
```

is much safer than manually writing:

```js
readable.on("data", chunk => writable.write(chunk));
```

and ignoring the return value.

---

# 28. What Happens If the Consumer Is Permanently Slow?

Example:

```text
Producer: 1000 MB/s
Consumer: 1 MB/s
```

Backpressure will pause the producer frequently.

The system remains controlled:

```text
Producer: produce → pause → produce → pause
```

But throughput is still limited by:

```text
Consumer capacity
```

### Important interview fact

> Backpressure does not make a slow consumer faster.

It prevents the producer from overwhelming it.

The real bottleneck may require:

* Faster consumer
* More consumers
* Horizontal scaling
* Batching
* Better database queries
* Caching
* Reduced payload size
* Dropping non-critical data

---

# 29. How to Debug Backpressure Problems?

Look for:

### 1. Growing memory

```text
RSS continuously increasing
```

or:

```text
heapUsed increasing
```

### 2. Growing queue

```js
console.log(queue.length);
```

### 3. Too many pending promises

```text
pendingTasks = 100
pendingTasks = 10,000
pendingTasks = 1,000,000
```

### 4. Slow downstream latency

```text
API latency ↑
DB latency ↑
Network latency ↑
```

### 5. Event loop lag

When overloaded, monitor event-loop delay.

A common production signal is:

```text
High event-loop lag
+
Growing queue
+
Increasing memory
```

That strongly suggests the system is accepting work faster than it can finish it.

---

# 30. `highWaterMark` Tuning — Trick ⚠️

Should you always increase:

```js
highWaterMark
```

to improve performance?

❌ No.

Increasing it may mean:

```text
More buffering
More memory
Potentially fewer pause/resume cycles
```

Decreasing it may mean:

```text
Less memory
More frequent flow-control signaling
```

There is a trade-off:

```text
Small HWM
↓
Lower memory
More coordination overhead

Large HWM
↓
Higher throughput potential in some workloads
More memory
Higher burst buffering
```

Don't randomly tune it.

Measure:

* Throughput
* Memory
* Latency
* Number of concurrent streams

### Very important

If you have:

```text
1,000 concurrent streams
```

and each can buffer significant data, the total memory impact can become substantial.

---

# 31. Production File Download Example

```js
const express = require("express");
const fs = require("fs");
const { pipeline } = require("stream/promises");

const app = express();

app.get("/download", async (req, res, next) => {
  try {
    const fileStream = fs.createReadStream("large-video.mp4");

    res.setHeader("Content-Type", "video/mp4");

    await pipeline(fileStream, res);
  } catch (error) {
    next(error);
  }
});
```

Why is this good?

```text
Large file
    ↓
Read in chunks
    ↓
Slow client?
    ↓
Backpressure propagates
    ↓
File reading slows
    ↓
No need to load entire file into RAM
```

Compare with:

```js
app.get("/download", (req, res) => {
  const file = fs.readFileSync("large-video.mp4");

  res.send(file);
});
```

Here, potentially the entire file is loaded into process memory before sending.

---

# 32. The Most Important Mental Model

Whenever you build a pipeline, ask:

```text
Who produces data?
        ↓
Who consumes data?
        ↓
What if producer is faster?
        ↓
Where does excess data go?
        ↓
Is that storage bounded?
        ↓
When full, what happens?
```

Then choose:

```text
CONTROL
BUFFER
DROP
REJECT
SCALE
```

Never simply assume:

```text
"Node.js is async, so overload is impossible."
```

❌ Async does not eliminate backpressure.

You can still have:

```text
Too many:
- requests
- promises
- buffers
- DB queries
- API calls
- queue messages
```

Async operations can accumulate faster than they complete.

---

# 🎯 Interview Facts & Tricky Questions

## Q1. What is backpressure?

> Backpressure occurs when a producer generates data faster than a consumer can process it. The system uses flow control to prevent unbounded buffering, typically by slowing or pausing the producer until the consumer catches up.

---

## Q2. What does `writable.write()` returning `false` mean?

> It means the writable stream has reached its flow-control buffering threshold. The producer should stop writing temporarily and wait for the `drain` event.

**It does not necessarily mean the write failed.**

---

## Q3. What should you do after `write()` returns `false`?

```js
if (!writable.write(chunk)) {
  readable.pause();

  writable.once("drain", () => {
    readable.resume();
  });
}
```

---

## Q4. What is the `drain` event?

> It signals that the writable stream has processed enough buffered data to resume accepting writes under normal flow control.

---

## Q5. Is `highWaterMark` a strict memory limit?

> No. It is primarily a threshold used for buffering and backpressure signaling, not a guarantee that memory usage can never exceed that exact amount.

---

## Q6. Does `.pipe()` handle backpressure?

> Yes. It coordinates readable and writable streams and pauses/resumes upstream flow based on downstream capacity.

---

## Q7. `pipe()` vs `pipeline()`?

> Both support backpressure. `pipeline()` is generally preferred for robust production pipelines because it provides better coordinated error propagation and cleanup.

---

## Q8. Does `write() === false` mean data loss?

> No. The write may have been accepted and buffered. `false` means the producer should stop sending more until `drain`.

---

## Q9. What is dangerous about ignoring backpressure?

> The producer continues generating data, pending data accumulates in buffers, memory and GC pressure increase, latency can worsen, and eventually the process may run out of memory.

---

## Q10. Does buffering solve backpressure?

> Not by itself. Buffering only absorbs a temporary mismatch. If the producer remains faster indefinitely, an unbounded buffer will eventually become a memory problem.

---

## Q11. What strategies can handle overload?

```text
1. Control/pause producer
2. Buffer temporarily
3. Use bounded queues
4. Drop data
5. Reject new work
6. Scale consumers
7. Batch work
8. Apply concurrency limits
```

---

## Q12. When should you drop data?

When losing some data is acceptable and freshness matters more than completeness:

* Metrics
* Mouse movements
* Cursor positions
* Live sensor updates
* Repeated UI state

Don't casually drop:

* Payments
* Orders
* Critical audit events

---

## Q13. Is backpressure only a Node.js Streams concept?

> No. Streams provide a built-in implementation, but the same concept applies to databases, HTTP servers, queues, WebSockets, message brokers, and async task processing.

---

## Q14. What does `highWaterMark` mean in object mode?

> It generally represents the number of objects buffered rather than their byte size. Therefore, a small object count can still consume significant memory if the objects themselves are large.

---

# 🧠 30-Second Interview TL;DR

> **Backpressure happens when a producer is faster than its consumer. In Node.js streams, `writable.write()` returns `false` when downstream reaches its flow-control threshold, and the producer should stop until the writable emits `drain`. `.pipe()` and especially `pipeline()` handle this automatically. `highWaterMark` is a backpressure/buffering threshold, not necessarily a strict memory cap. The main overload strategies are controlling the producer, bounded buffering, dropping non-critical data, rejecting work, or scaling consumers. Ignoring backpressure can cause growing buffers, memory pressure, high GC, latency, and eventually OOM.**

### Golden rule 🏆

```text
Producer faster than Consumer
            ↓
Do NOT let memory become your queue forever.
```

Choose explicitly:

```text
PAUSE → when data matters
BUFFER → for temporary bursts, with limits
DROP → when freshness matters more
REJECT → when overloaded
SCALE → when capacity is insufficient
IGNORE → ❌ usually dangerous
```
