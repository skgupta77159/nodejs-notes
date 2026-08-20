# Atomics in Node.js — Short Notes

## 1. What are Atomics?

`Atomics` is a JavaScript API used with **SharedArrayBuffer** to safely share and modify memory between **Worker Threads**.

Normally, each worker has its **own memory**:

```text
Main Thread
    │
    ├── Worker 1 → Separate memory
    └── Worker 2 → Separate memory
```

With `SharedArrayBuffer`:

```text
              SharedArrayBuffer
             /        |         \
      Main Thread   Worker 1   Worker 2
```

Because multiple threads can access the same memory simultaneously, we can get **race conditions**.

`Atomics` provides thread-safe operations.

---

# 2. Why do we need Atomics?

Suppose two workers increment the same counter.

Without synchronization:

```js
counter[0] = counter[0] + 1;
```

This looks simple, but internally:

```text
1. Read counter → 10
2. Add 1 → 11
3. Write 11
```

Imagine:

```text
Worker 1 reads 10
Worker 2 reads 10

Worker 1 writes 11
Worker 2 writes 11

Expected: 12 ❌
Actual:   11 ❌
```

This is a **race condition**.

Using:

```js
Atomics.add(counter, 0, 1);
```

The operation is performed atomically:

```text
10 → 11 → 12
```

No update is lost.

---

# 3. SharedArrayBuffer + TypedArray

`Atomics` does not directly work with normal JavaScript objects.

❌ This cannot be safely shared:

```js
const data = {
  count: 0
};
```

Instead, use:

```js
const sharedBuffer = new SharedArrayBuffer(4);
const sharedArray = new Int32Array(sharedBuffer);
```

Memory structure:

```text
SharedArrayBuffer
        ↓
     Raw memory
        ↓
    Int32Array
        ↓
[ sharedArray[0] ]
```

`SharedArrayBuffer` contains the actual shared memory, while `Int32Array` provides a way to read/write it.

---

# 4. Basic Example with Worker Threads

### `main.js`

```js
const { Worker } = require("worker_threads");

const sharedBuffer = new SharedArrayBuffer(4);
const counter = new Int32Array(sharedBuffer);

counter[0] = 0;

const workers = [];

for (let i = 0; i < 4; i++) {
  workers.push(
    new Worker("./worker.js", {
      workerData: sharedBuffer
    })
  );
}

Promise.all(
  workers.map(
    (worker) =>
      new Promise((resolve) => worker.on("exit", resolve))
  )
).then(() => {
  console.log("Final count:", counter[0]);
});
```

### `worker.js`

```js
const { workerData } = require("worker_threads");

const counter = new Int32Array(workerData);

for (let i = 0; i < 1_000_000; i++) {
  Atomics.add(counter, 0, 1);
}
```

### Output

```text
Final count: 4000000
```

Each of the 4 workers increments the **same memory location** one million times.

---

# 5. Common Atomics Methods

## `Atomics.load()`

Safely reads a value.

```js
const value = Atomics.load(array, 0);
```

Equivalent conceptually to:

```js
const value = array[0];
```

But with atomic synchronization guarantees.

---

## `Atomics.store()`

Safely writes a value.

```js
Atomics.store(array, 0, 100);
```

```text
array[0] = 100
```

---

## `Atomics.add()`

Atomically adds a value.

```js
Atomics.add(array, 0, 1);
```

Useful for:

* Counters
* Metrics
* Shared job indexes
* Resource allocation

---

## `Atomics.sub()`

```js
Atomics.sub(array, 0, 1);
```

Useful for shared counters such as available slots.

---

## `Atomics.exchange()`

Replaces a value and returns the old value.

```js
const oldValue = Atomics.exchange(array, 0, 100);
```

Example:

```text
Before: 50
exchange(..., 100)
After: 100

Returns: 50
```

---

## `Atomics.compareExchange()`

Very important for concurrency.

It means:

> "Change the value only if it currently equals my expected value."

```js
Atomics.compareExchange(
  array,
  0,
  expectedValue,
  replacementValue
);
```

Example:

```js
const result = Atomics.compareExchange(
  array,
  0,
  0,
  1
);
```

Concept:

```text
IF array[0] === 0
    array[0] = 1
```

This can be used to implement a basic **lock**.

---

# 6. Example: Simple Lock

Imagine:

```text
0 = unlocked
1 = locked
```

```js
function acquireLock(lock) {
  while (
    Atomics.compareExchange(lock, 0, 0, 1) !== 0
  ) {
    // Another worker owns the lock
  }
}

function releaseLock(lock) {
  Atomics.store(lock, 0, 0);
}
```

Usage:

```js
acquireLock(lock);

try {
  // Critical section
  // Only one worker should execute this at a time
} finally {
  releaseLock(lock);
}
```

### ⚠️ Problem: Busy Waiting

This:

```js
while (...) {
}
```

continuously consumes CPU.

```text
Worker:
"Is lock free?"
"No"

"Is lock free?"
"No"

"Is lock free?"
"No"
```

This is called **spin waiting / busy waiting**.

For waiting, `Atomics.wait()` can be better.

---

# 7. `Atomics.wait()` and `Atomics.notify()`

These allow one thread to wait until another thread signals it.

### Worker

```js
Atomics.wait(array, 0, 0);
```

Meaning:

> Wait if `array[0]` is currently `0`.

```text
Worker Thread
     │
     ▼
Atomics.wait()
     │
     ▼
Sleeping / blocked efficiently
     │
     ▼
Atomics.notify()
     │
     ▼
Continues execution
```

Another thread:

```js
Atomics.store(array, 0, 1);

Atomics.notify(array, 0);
```

Example:

```js
const result = Atomics.wait(array, 0, 0);

console.log(result);
```

Possible results include:

```text
ok
not-equal
timed-out
```

---

# 8. Important: Don't block the Main Thread

Avoid using `Atomics.wait()` on the main Node.js thread.

```js
// ❌ Avoid on the main thread
Atomics.wait(array, 0, 0);
```

Because it blocks execution.

It is mainly useful inside:

```text
Worker Threads
```

---

# 9. Real-World Use Cases

### Shared counter

```text
Multiple workers
       ↓
Atomics.add()
       ↓
Shared counter
```

Example:

```text
Processed jobs: 1,000,000
```

---

### Shared job index

Instead of giving jobs manually:

```text
Worker 1 → Job 1
Worker 2 → Job 2
Worker 3 → Job 3
```

Workers can atomically claim the next job:

```js
const jobIndex = Atomics.add(sharedArray, 0, 1);
```

Each worker gets a unique index.

Example:

```text
Worker 1 → gets index 0
Worker 2 → gets index 1
Worker 3 → gets index 2
```

This is useful in CPU-heavy parallel processing.

---

### Producer-consumer coordination

```text
Producer Worker
      │
      │ Atomics.store()
      ▼
 Shared Memory
      │
      │ Atomics.notify()
      ▼
Consumer Worker
      │
      │ Atomics.wait()
      ▼
Process data
```

---

# 10. Atomics vs `postMessage()`

| Feature         | `postMessage()`                    | Atomics + SharedArrayBuffer   |
| --------------- | ---------------------------------- | ----------------------------- |
| Communication   | Message passing                    | Shared memory                 |
| Memory sharing  | Usually data is transferred/cloned | Same memory                   |
| Synchronization | Message events                     | Atomic operations             |
| Race conditions | Less direct shared-state risk      | Must manage carefully         |
| Complexity      | Easier                             | More complex                  |
| Best for        | Most worker communication          | High-performance shared state |

### Normal case

Prefer:

```js
worker.postMessage(data);
```

For most applications.

Use `Atomics` when you genuinely need:

```text
Multiple workers
+
Same shared memory
+
Safe synchronization
```

---

# 11. Important Production Point

`Atomics` is **not usually needed just because you are using Worker Threads**.

For example:

```text
Main Thread
   │
   ├── Worker A → Calculate image
   │                ↓
   │            postMessage(result)
   │
   └── Worker B → Calculate PDF
                    ↓
                postMessage(result)
```

No shared state → **No Atomics needed**.

Use Atomics when:

```text
Workers concurrently access
        ↓
the same SharedArrayBuffer
        ↓
and updates/coordination must be safe
```

---

# 12. Interview TL;DR 🚀

> **Atomics in Node.js provide thread-safe operations on shared memory, typically a `SharedArrayBuffer` accessed through a typed array. They are used with Worker Threads to prevent race conditions when multiple threads read or modify the same memory. Common methods include `Atomics.load`, `store`, `add`, `sub`, `exchange`, and `compareExchange`. `Atomics.wait` and `notify` can coordinate sleeping and waking worker threads. For normal worker communication, `postMessage()` is simpler; Atomics are mainly useful for high-performance shared-state and synchronization scenarios.**

### One-line distinction:

```text
Worker Threads = Parallel execution
SharedArrayBuffer = Shared memory
Atomics = Safe synchronization of that shared memory
```

### Best interview fact:

> `async/await` does not make CPU work parallel, Worker Threads provide parallelism, and Atomics safely coordinate shared memory between those threads.
