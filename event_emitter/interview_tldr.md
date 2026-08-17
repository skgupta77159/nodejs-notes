# Interview Q&A 🔥

## Q1. What is EventEmitter in Node.js?

**Answer:**

EventEmitter is a core Node.js mechanism for implementing event-driven architecture. An object emits named events, and registered listener functions are invoked when that event is emitted.

---

## Q2. Is EventEmitter asynchronous?

**Answer:**

No, not by default. Calling `emit()` invokes registered listeners synchronously and in registration order. A listener can explicitly schedule asynchronous work using APIs such as timers or promises.

---

## Q3. Why is EventEmitter useful?

**Answer:**

It decouples the event producer from event consumers. The producer only emits an event and doesn't need to know how many listeners exist or what each listener does.

---

## Q4. What happens if multiple listeners listen to the same event?

They are called synchronously in the order they were registered.

```js
emitter.on("event", A);
emitter.on("event", B);
emitter.on("event", C);
```

Result:

```text
A → B → C
```

---

## Q5. Difference between `on()` and `once()`?

```js
on()
```

Runs every time the event occurs.

```js
once()
```

Runs only the first time and is then automatically removed.

---

## Q6. What is special about the `error` event?

If an `error` event is emitted without an appropriate error listener, Node treats it as unhandled and it can terminate the process.

---

## Q7. Does `emit()` return listener results?

No.

It returns a boolean:

```text
true  → listeners existed
false → no listeners existed
```

---

## Q8. Does EventEmitter run listeners in parallel?

No.

Normal EventEmitter listener dispatch is synchronous.

```text
Listener 1 completes
       ↓
Listener 2 runs
       ↓
Listener 3 runs
```

Async operations started by listeners may overlap, but `emit()` itself doesn't coordinate or await them.

---

## Q9. Can EventEmitter communicate between two Node.js servers?

Not by itself.

EventEmitter is in-memory and process-local.

For multiple servers/processes, use a distributed mechanism such as a broker, queue, or Pub/Sub system.

---

## Q10. What causes `MaxListenersExceededWarning`?

Usually too many listeners are being attached to the same event, which may indicate a listener leak.

Increasing `setMaxListeners()` only changes the warning threshold; it does not fix the underlying accumulation.

---

## Q11. How do you prevent EventEmitter memory leaks?

* Register long-lived listeners once during startup.
* Use `once()` when appropriate.
* Remove temporary listeners with `off()`.
* Avoid registering listeners inside repeatedly executed functions or request handlers unless cleanup is guaranteed.
* Monitor `listenerCount()`.
* Investigate the root cause instead of only increasing the max listener limit.

---

## Q12. Can an EventEmitter listener block Node.js?

Yes.

```js
emitter.on("event", () => {
    heavyCpuWork();
});
```

Because listeners run synchronously, CPU-heavy work can block the Event Loop.

---

## Q13. What happens when an async EventEmitter listener throws?

An `async` function converts the thrown error into a rejected Promise. Traditional EventEmitter dispatch does not automatically await listener Promises, so the rejection needs proper handling; `captureRejections` can help route rejected listener Promises to error handling when configured.

---

## Q14. EventEmitter vs Promise?

> A Promise represents one eventual result and settles once. An EventEmitter can emit events repeatedly and notify multiple listeners.

---

## Q15. EventEmitter vs Queue?

> EventEmitter is generally an in-process, non-durable event mechanism. A queue is designed for asynchronous/distributed workloads and may provide persistence, retries, and recovery after crashes.

---

# 🎯 Best Interview Summary

> **EventEmitter is the foundation of Node.js's event-driven architecture. Producers emit named events and listeners react to them. A key point is that `emit()` invokes listeners synchronously and in registration order by default—it does not automatically make work asynchronous. EventEmitters are process-local, so they are useful for in-memory communication within one Node.js process but not for reliable cross-server messaging. In production, I handle the special `error` event, avoid listener leaks, clean up temporary listeners, and avoid CPU-heavy work inside listeners. For durable or distributed background processing, I use a message queue rather than EventEmitter.**
