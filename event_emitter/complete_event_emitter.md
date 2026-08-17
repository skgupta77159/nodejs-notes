# Event Emitters in Node.js — In Depth + Tricky Concepts + Interview Q&A

`EventEmitter` is one of the core concepts behind Node.js's **event-driven architecture**.

A lot of Node.js internals use this pattern: streams, HTTP servers, sockets, child processes, etc.

---

## 1. What is an Event Emitter?

An EventEmitter allows one part of your application to:

1. **Emit an event** → "Something happened"
2. **Listen to that event** → "Tell me when it happens"
3. Execute one or more listener functions when the event occurs.

```js
const EventEmitter = require("events");

const emitter = new EventEmitter();

emitter.on("userRegistered", () => {
    console.log("Send welcome email");
});

emitter.emit("userRegistered");
```

Output:

```text
Send welcome email
```

### Mental model

```text
Event happens
     │
     ▼
emitter.emit("userRegistered")
     │
     ▼
Find all listeners for "userRegistered"
     │
     ├──► Send email
     ├──► Create analytics event
     └──► Notify admin
```

This is similar to the **Observer / Publish-Subscribe pattern**.

---

# 2. Basic API

## Creating an EventEmitter

```js
const EventEmitter = require("events");

const emitter = new EventEmitter();
```

---

## Adding a listener: `.on()`

```js
emitter.on("login", () => {
    console.log("User logged in");
});
```

You can also use:

```js
emitter.addListener("login", () => {
    console.log("User logged in");
});
```

`on()` and `addListener()` essentially do the same thing.

---

## Emitting an event: `.emit()`

```js
emitter.emit("login");
```

You can pass arguments:

```js
emitter.on("login", (userId, device) => {
    console.log(userId, device);
});

emitter.emit("login", 101, "mobile");
```

Output:

```text
101 mobile
```

---

# 3. Important: EventEmitter Is Synchronous by Default

This is one of the **most important interview concepts**.

```js
const EventEmitter = require("events");

const emitter = new EventEmitter();

emitter.on("event", () => {
    console.log("Listener 1");
});

emitter.on("event", () => {
    console.log("Listener 2");
});

console.log("Before");

emitter.emit("event");

console.log("After");
```

Output:

```text
Before
Listener 1
Listener 2
After
```

Why?

Because:

```js
emitter.emit("event");
```

**calls listeners synchronously**.

Conceptually:

```js
function emit(eventName) {
    listeners[eventName].forEach(listener => {
        listener();
    });
}
```

So `emit()` does not automatically mean asynchronous.

---

# 4. Tricky Question: Does EventEmitter Use the Event Loop?

Consider:

```js
emitter.on("task", () => {
    console.log("Task executed");
});

console.log("1");

emitter.emit("task");

console.log("2");
```

Output:

```text
1
Task executed
2
```

The listener runs immediately on the current JavaScript call stack.

### Therefore:

> **EventEmitter is event-driven, but EventEmitter itself is not asynchronous by default.**

Node's Event Loop becomes involved only if your listener schedules asynchronous work.

For example:

```js
emitter.on("task", () => {
    setTimeout(() => {
        console.log("Async task");
    }, 0);
});

console.log("1");

emitter.emit("task");

console.log("2");
```

Output:

```text
1
2
Async task
```

---

# 5. Multiple Listeners

You can attach multiple listeners to the same event.

```js
const EventEmitter = require("events");

const emitter = new EventEmitter();

emitter.on("paymentSuccess", () => {
    console.log("Update database");
});

emitter.on("paymentSuccess", () => {
    console.log("Send receipt");
});

emitter.on("paymentSuccess", () => {
    console.log("Update analytics");
});

emitter.emit("paymentSuccess");
```

Output:

```text
Update database
Send receipt
Update analytics
```

### Important

Listeners execute **in the order they were registered**.

```js
emitter.on("event", () => console.log("A"));
emitter.on("event", () => console.log("B"));
emitter.on("event", () => console.log("C"));

emitter.emit("event");
```

Output:

```text
A
B
C
```

---

# 6. Real-World Example

Suppose a user registers.

Without events:

```js
async function registerUser(data) {
    const user = await createUser(data);

    await sendWelcomeEmail(user);
    await createAnalyticsEvent(user);
    await notifyAdmin(user);

    return user;
}
```

The registration service is tightly coupled with everything else.

Using events:

```js
const EventEmitter = require("events");

const appEvents = new EventEmitter();

async function registerUser(data) {
    const user = await createUser(data);

    appEvents.emit("userRegistered", user);

    return user;
}
```

Different modules can listen:

```js
appEvents.on("userRegistered", (user) => {
    sendWelcomeEmail(user);
});

appEvents.on("userRegistered", (user) => {
    createAnalyticsEvent(user);
});

appEvents.on("userRegistered", (user) => {
    notifyAdmin(user);
});
```

Architecture:

```text
                    User Service
                         │
                         │ emit("userRegistered")
                         ▼
                  ┌───────────────┐
                  │ EventEmitter  │
                  └───────────────┘
                    │     │     │
                    ▼     ▼     ▼
                 Email Analytics Admin
```

This provides **loose coupling**.

---

# 7. `.once()` — Listener Runs Only Once

```js
emitter.once("connected", () => {
    console.log("Connected for the first time");
});

emitter.emit("connected");
emitter.emit("connected");
emitter.emit("connected");
```

Output:

```text
Connected for the first time
```

After the first execution, Node automatically removes the listener.

Useful for:

* Initialization
* First connection
* Handshake completion
* Application ready event
* One-time cleanup

---

# 8. `.off()` / `removeListener()`

To remove a listener, you need the same function reference.

```js
function handleLogin(user) {
    console.log("User logged in:", user);
}

emitter.on("login", handleLogin);

emitter.emit("login", "Sushil");

emitter.off("login", handleLogin);

emitter.emit("login", "Sushil");
```

Only the first `emit()` calls the listener.

### Tricky mistake

This does **not** work:

```js
emitter.on("login", () => {
    console.log("Login");
});

emitter.off("login", () => {
    console.log("Login");
});
```

Why?

These are two different function objects:

```text
function A !== function B
```

Correct:

```js
const handler = () => {
    console.log("Login");
};

emitter.on("login", handler);

emitter.off("login", handler);
```

---

# 9. `removeAllListeners()`

```js
emitter.removeAllListeners("login");
```

Removes all listeners for `login`.

Or:

```js
emitter.removeAllListeners();
```

Removes listeners for all events.

Be careful in production: another module may depend on those listeners.

---

# 10. The Special `"error"` Event — Very Important 🚨

`error` behaves differently from normal events.

```js
const EventEmitter = require("events");

const emitter = new EventEmitter();

emitter.emit("error", new Error("Something failed"));
```

If there is no `error` listener, Node treats it as an unhandled error and the process can terminate.

Correct:

```js
emitter.on("error", (error) => {
    console.error("Handled error:", error.message);
});

emitter.emit("error", new Error("Something failed"));
```

### Interview answer

> The `error` event is special in Node.js EventEmitter. Unlike ordinary events, emitting `error` without an attached error listener results in an unhandled error and can crash the Node.js process.

---

# 11. Tricky: Does `try/catch` Catch EventEmitter Errors?

### Case 1: Synchronous listener

```js
try {
    emitter.on("event", () => {
        throw new Error("Boom");
    });

    emitter.emit("event");
} catch (error) {
    console.log("Caught:", error.message);
}
```

Yes, because `emit()` calls the listener synchronously.

Output:

```text
Caught: Boom
```

---

### Case 2: Asynchronous listener

```js
try {
    emitter.on("event", () => {
        setTimeout(() => {
            throw new Error("Boom");
        }, 0);
    });

    emitter.emit("event");
} catch (error) {
    console.log("Caught");
}
```

This does **not** catch the error.

Why?

```text
try/catch finishes
     │
     ▼
setTimeout callback runs later
     │
     ▼
Error happens outside the original try/catch execution
```

This is a very common Node.js error-handling concept.

---

# 12. EventEmitter and Async Functions — Tricky Concept

Consider:

```js
emitter.on("task", async () => {
    throw new Error("Failed");
});

emitter.emit("task");
```

Many developers expect this:

```js
emitter.on("error", ...)
```

to automatically catch it.

But an async listener returns a Promise.

Conceptually:

```js
async function listener() {
    throw new Error("Failed");
}

// returns:
Promise.reject(error);
```

Traditional EventEmitter does not automatically `await` every listener Promise.

So this can lead to an unhandled rejected Promise depending on how the emitter/listener is configured.

### Important lesson

EventEmitter is fundamentally designed around **synchronous listener invocation**.

Do not assume:

```js
emitter.emit()
```

will do:

```js
await listener();
```

It doesn't.

---

# 13. `captureRejections`

You can create an EventEmitter that captures rejected Promises from async listeners:

```js
const EventEmitter = require("events");

const emitter = new EventEmitter({
    captureRejections: true
});

emitter.on("error", (error) => {
    console.error("Captured:", error.message);
});

emitter.on("task", async () => {
    throw new Error("Database failed");
});

emitter.emit("task");
```

The rejected Promise can be routed to error handling.

This is useful when you intentionally use async listeners.

However, for important production workflows, I would still avoid blindly treating EventEmitter as a reliable job queue.

---

# 14. Tricky: What Does `emit()` Return?

```js
const result = emitter.emit("login");

console.log(result);
```

`emit()` returns:

* `true` → at least one listener existed
* `false` → no listener existed

Example:

```js
console.log(emitter.emit("login"));
```

Output:

```text
false
```

After adding a listener:

```js
emitter.on("login", () => {});

console.log(emitter.emit("login"));
```

Output:

```text
true
```

### Important

It does **not** return the listener's return value.

```js
emitter.on("event", () => {
    return "Hello";
});

console.log(emitter.emit("event"));
```

Output:

```text
true
```

Not:

```text
Hello
```

---

# 15. Tricky: Can One Listener Stop Other Listeners?

```js
emitter.on("event", () => {
    console.log("A");
    return false;
});

emitter.on("event", () => {
    console.log("B");
});

emitter.emit("event");
```

Output:

```text
A
B
```

Returning `false` does not stop propagation.

This is different from some browser APIs where cancellation concepts exist.

### To stop execution?

EventEmitter does not have built-in propagation cancellation.

You must design it explicitly, for example:

```js
const context = {
    stopped: false
};

emitter.on("event", (ctx) => {
    ctx.stopped = true;
});

emitter.on("event", (ctx) => {
    if (ctx.stopped) return;

    console.log("Execute");
});

emitter.emit("event", context);
```

Or use another architecture if cancellation is important.

---

# 16. Tricky: Adding a Listener While Emitting

Consider:

```js
emitter.on("event", () => {
    console.log("First");

    emitter.on("event", () => {
        console.log("New listener");
    });
});

emitter.on("event", () => {
    console.log("Second");
});

emitter.emit("event");
```

Question: Will `"New listener"` run during the current `emit()`?

No.

It will generally be considered on a future emit.

```text
First
Second
```

Next:

```js
emitter.emit("event");
```

Now previously added listeners can participate.

This avoids unpredictable modification of the currently executing listener cycle.

---

# 17. Tricky: Removing a Listener While Emitting

```js
function listener2() {
    console.log("Listener 2");
}

emitter.on("event", () => {
    console.log("Listener 1");

    emitter.off("event", listener2);
});

emitter.on("event", listener2);

emitter.emit("event");
```

A common misconception is that `listener2` will necessarily be skipped immediately.

You should not rely on removing listeners during an active `emit()` to modify the already-started dispatch sequence. EventEmitter can work from its current listener snapshot/dispatch state.

For complex dynamic subscription systems, manage explicit state rather than depending on mutation during dispatch.

---

# 18. Maximum Listeners Warning — Memory Leak Detection

By default, EventEmitter warns when more than **10 listeners** are added to the same event.

```js
for (let i = 0; i < 20; i++) {
    emitter.on("data", () => {});
}
```

You may see:

```text
MaxListenersExceededWarning
Possible EventEmitter memory leak detected
```

This is a **warning**, not necessarily proof of a memory leak.

Why does Node warn?

Imagine this:

```js
setInterval(() => {
    emitter.on("data", () => {
        console.log("Received");
    });
}, 1000);
```

Listeners continuously accumulate:

```text
After 1 second  → 1 listener
After 10 seconds → 10 listeners
After 1 hour → 3600 listeners
```

Every listener can retain references through closures.

Result:

```text
Growing memory
     │
     ▼
More retained objects
     │
     ▼
Possible memory leak
```

---

## Wrong fix ❌

```js
emitter.setMaxListeners(1000);
```

This only suppresses or increases the warning threshold.

It does not fix a leak.

### Correct approach

Find why listeners keep getting registered.

For example:

```js
function start() {
    emitter.on("data", handleData);
}
```

If `start()` runs repeatedly:

```js
start();
start();
start();
```

You keep adding listeners.

Better:

```js
emitter.on("data", handleData);
```

Register once during initialization.

Or:

```js
emitter.once("data", handleData);
```

Or clean up:

```js
emitter.off("data", handleData);
```

---

# 19. Checking Listeners

## `listenerCount()`

```js
console.log(emitter.listenerCount("event"));
```

Example:

```js
emitter.on("event", () => {});
emitter.on("event", () => {});

console.log(emitter.listenerCount("event"));
```

Output:

```text
2
```

Useful for debugging listener leaks.

---

## `listeners()`

```js
console.log(emitter.listeners("event"));
```

Returns registered listener functions.

---

## `eventNames()`

```js
console.log(emitter.eventNames());
```

Example:

```js
emitter.on("login", () => {});
emitter.on("logout", () => {});

console.log(emitter.eventNames());
```

Output approximately:

```js
["login", "logout"]
```

Useful when debugging complex event-driven systems.

---

# 20. Event Names Can Be Strings or Symbols

Most commonly:

```js
emitter.on("login", handler);
```

But Symbols can also be used:

```js
const LOGIN = Symbol("login");

emitter.on(LOGIN, () => {
    console.log("Login");
});

emitter.emit(LOGIN);
```

Symbols can help avoid accidental event-name collisions in complex libraries.

---

# 21. `prependListener()`

Normally:

```js
emitter.on("event", () => console.log("A"));
emitter.on("event", () => console.log("B"));
```

Output:

```text
A
B
```

But:

```js
emitter.prependListener("event", () => console.log("First"));

emitter.emit("event");
```

Output:

```text
First
A
B
```

Useful when ordering matters.

There is also:

```js
emitter.prependOnceListener("event", handler);
```

---

