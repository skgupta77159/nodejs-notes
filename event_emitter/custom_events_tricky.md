# 27. Production Example: Custom Application Events

A cleaner architecture might look like this:

```js
// events.js
const EventEmitter = require("events");

class AppEvents extends EventEmitter {}

const appEvents = new AppEvents();

module.exports = appEvents;
```

Register listeners during startup:

```js
// listeners/user.listener.js
const appEvents = require("../events");

appEvents.on("user.registered", async (user) => {
    try {
        await sendWelcomeEmail(user);
    } catch (error) {
        console.error("Email failed:", error);
    }
});
```

Then emit:

```js
// user.service.js
const appEvents = require("../events");

async function registerUser(data) {
    const user = await createUser(data);

    appEvents.emit("user.registered", user);

    return user;
}
```

### Important production concern

Since EventEmitter listeners are synchronous in invocation:

```js
appEvents.on("user.registered", () => {
    expensiveCpuTask();
});
```

Then:

```js
appEvents.emit("user.registered");
```

will block until that CPU-heavy work finishes.

So do not use EventEmitter to magically make CPU work asynchronous.

Use:

* `worker_threads` for CPU-heavy tasks
* a queue for durable background work
* async I/O for I/O-bound operations

---

# 28. Tricky Example: Heavy Listener Blocks the Request

```js
app.get("/users", (req, res) => {
    emitter.emit("analytics");

    res.send("Done");
});

emitter.on("analytics", () => {
    for (let i = 0; i < 5_000_000_000; i++) {
        // heavy work
    }
});
```

The response will wait because:

```text
Request
  │
  ▼
emit()
  │
  ▼
Heavy listener runs synchronously
  │
  ▼
Event loop blocked
  │
  ▼
Response delayed
```

This is a common misconception:

> ❌ "Events automatically run in the background."

Correct:

> EventEmitter dispatch is synchronous by default.

---

# 29. How to Make a Listener Run Later?

For example:

```js
emitter.on("event", () => {
    setImmediate(() => {
        console.log("Run later");
    });
});
```

Or:

```js
emitter.on("event", () => {
    setTimeout(() => {
        console.log("Run later");
    }, 0);
});
```

Or:

```js
emitter.on("event", () => {
    queueMicrotask(() => {
        console.log("Microtask");
    });
});
```

But remember:

### This does not make CPU-heavy JavaScript non-blocking.

```js
setImmediate(() => {
    heavyCpuTask();
});
```

It merely delays when it starts.

Once `heavyCpuTask()` starts:

```text
JavaScript thread → blocked
```

For CPU-heavy work:

```text
Worker Thread
      or
Separate Job Worker
```

---

# 30. Tricky Execution Order Question

```js
const EventEmitter = require("events");

const emitter = new EventEmitter();

emitter.on("event", () => {
    console.log("listener");

    process.nextTick(() => {
        console.log("nextTick");
    });

    Promise.resolve().then(() => {
        console.log("promise");
    });

    setImmediate(() => {
        console.log("immediate");
    });
});

console.log("start");

emitter.emit("event");

console.log("end");
```

Expected order:

```text
start
listener
end
nextTick
promise
immediate
```

Reason:

```text
Current synchronous stack:
start
listener
end

Then Node nextTick queue:
nextTick

Then Promise microtasks:
promise

Then Event Loop phases:
setImmediate
```

The key point is that the EventEmitter listener itself executes synchronously.

---

# 31. Tricky Recursive Event

```js
emitter.on("event", () => {
    console.log("Event");

    emitter.emit("event");
});

emitter.emit("event");
```

This creates synchronous recursion:

```text
emit
 └── listener
       └── emit
             └── listener
                   └── emit
```

Eventually:

```text
RangeError: Maximum call stack size exceeded
```

EventEmitter does not protect you from recursive event loops.

---

# 32. EventEmitter Memory Leak Example

Bad:

```js
app.get("/users", (req, res) => {
    emitter.on("updated", () => {
        console.log("User updated");
    });

    res.send("OK");
});
```

Every request adds a new listener:

```text
Request 1 → 1 listener
Request 2 → 2 listeners
Request 3 → 3 listeners
...
```

After enough requests:

```text
MaxListenersExceededWarning
```

Correct approach:

Register global listeners once:

```js
emitter.on("updated", handleUpdate);

app.get("/users", (req, res) => {
    res.send("OK");
});
```

If the listener is request-specific, remove it:

```js
function handler(data) {
    console.log(data);
}

emitter.on("updated", handler);

// Later
emitter.off("updated", handler);
```

---