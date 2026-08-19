# 5. Observer Pattern

Observer means:

> One object emits an event and multiple subscribers react to it.

Node.js's `EventEmitter` is a classic example.

```js
const EventEmitter = require("events");

const orderEvents = new EventEmitter();

orderEvents.on("orderCreated", (order) => {
    console.log("Send email");
});

orderEvents.on("orderCreated", (order) => {
    console.log("Update analytics");
});

orderEvents.on("orderCreated", (order) => {
    console.log("Notify warehouse");
});

orderEvents.emit("orderCreated", {
    id: 101
});
```

Output:

```text
Send email
Update analytics
Notify warehouse
```

### Real-world architecture

```text
             orderCreated
                  |
       ┌──────────┼──────────┐
       ↓          ↓          ↓
     Email     Analytics   Warehouse
```

### Important production point

Node's `EventEmitter` is **in-process**.

If you have:

```text
Server 1
Server 2
Server 3
```

an event emitted in Server 1 isn't automatically received by Server 2 or Server 3.

For distributed systems, you might use:

```text
Redis Pub/Sub
Kafka
RabbitMQ
SNS/SQS
```

---