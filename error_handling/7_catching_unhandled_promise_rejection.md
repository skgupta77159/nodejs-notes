# 7. Catching Unhandled Promise Rejections

Consider:

```js
async function main() {
  await Promise.reject(new Error("Database connection failed"));
}

main();
```

The promise rejects, but nobody catches it.

This is an **unhandled rejection**.

You can listen globally:

```js
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Promise Rejection");

  console.error({
    reason,
    promise
  });
});
```

Example:

```js
Promise.reject(new Error("Redis connection failed"));
```

The handler receives:

```js
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});
```

---

## Production approach

Do not just log and continue blindly.

A truly unhandled rejection may indicate that your application is in an unexpected state.

A safer pattern is:

```js
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION", reason);

  shutdown("unhandledRejection");
});
```

For example:

```js
process.on("unhandledRejection", (reason) => {
  logger.fatal(
    {
      err: reason
    },
    "Unhandled promise rejection"
  );

  shutdown("unhandledRejection");
});
```

### Why shutdown?

Suppose this happened:

```js
await updateOrder();
await chargePayment(); // unexpected rejection
await markOrderAsPaid();
```

Your process may now be in an unknown application state.

Continuing to serve requests can sometimes be more dangerous than restarting.

A typical production strategy is:

```text
Unhandled rejection
       ↓
Log it
       ↓
Capture it in monitoring
       ↓
Begin graceful shutdown
       ↓
Exit with failure
       ↓
Supervisor restarts process
```

---