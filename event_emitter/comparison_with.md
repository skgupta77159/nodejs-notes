# 22. EventEmitter Is Not a Distributed Event System

This is extremely important in production.

```text
Node Process A
   │
   └── EventEmitter
          │
          └── Memory of Process A only
```

If you have:

```text
Load Balancer
     │
 ┌───┴────┐
 ▼        ▼
Node A   Node B
```

And you emit:

```js
emitter.emit("userRegistered");
```

inside Node A:

```text
Node A listener → receives event
Node B listener → DOES NOT receive it
```

Because EventEmitter exists only inside that process's memory.

### Similarly with Cluster

Each worker has its own memory.

```text
Primary
   │
 ┌─┴─┐
 ▼   ▼
W1   W2

W1 EventEmitter ≠ W2 EventEmitter
```

For cross-process events, use something external, such as:

```text
Redis Pub/Sub
RabbitMQ
Kafka
BullMQ
Cloud queues
```

The exact choice depends on whether you need durability, retries, ordering, consumer groups, etc.

---

# 23. EventEmitter vs Message Queue

| Feature                 | EventEmitter                | Message Queue                        |
| ----------------------- | --------------------------- | ------------------------------------ |
| Location                | Same process                | External/distributed                 |
| Persistence             | ❌                           | Often ✅                              |
| Retry                   | ❌                           | Often configurable                   |
| Survives process crash  | ❌                           | Often ✅                              |
| Multiple Node instances | No shared events            | ✅                                    |
| Latency                 | Very low                    | Network overhead                     |
| Best for                | Internal application events | Reliable background/distributed jobs |

### Example

Good use of EventEmitter:

```text
HTTP request completed
        ↓
Update in-process metrics
```

Better use of queue:

```text
Payment successful
        ↓
Send invoice
        ↓
Must retry if email provider is down
        ↓
Must survive application restart
```

Use a durable queue/job system.

---

# 24. EventEmitter vs Callback

Callback:

```js
function getUser(id, callback) {
    callback(user);
}
```

Usually represents a direct relationship:

```text
Producer → one callback
```

EventEmitter:

```js
emitter.emit("userFound", user);
```

Can notify many listeners:

```text
Producer
   │
   ├── Listener A
   ├── Listener B
   └── Listener C
```

---

# 25. EventEmitter vs Promise

Promise represents one eventual result:

```js
const user = await fetchUser();
```

Conceptually:

```text
Pending → Resolved OR Rejected
```

Only settles once.

EventEmitter can emit repeatedly:

```js
emitter.emit("data", chunk1);
emitter.emit("data", chunk2);
emitter.emit("data", chunk3);
```

Conceptually:

```text
data → data → data → data → ...
```

### Interview answer

> Promise is generally one asynchronous operation with one settlement, whereas EventEmitter represents a potentially continuous stream of notifications with zero or more listeners.

---

# 26. EventEmitter vs Streams

A stream uses events internally.

For example:

```js
const fs = require("fs");

const stream = fs.createReadStream("large.txt");

stream.on("data", (chunk) => {
    console.log(chunk.length);
});

stream.on("end", () => {
    console.log("Finished");
});

stream.on("error", (error) => {
    console.error(error);
});
```

Conceptually:

```text
ReadStream
    │
    ├── emits "data"
    ├── emits "end"
    ├── emits "error"
    └── emits "close"
```

So streams are a practical example of EventEmitter-based architecture.

But a Stream is much more than just an EventEmitter because it also handles things like:

* Backpressure
* Buffering
* Flow control
* Chunk processing

---