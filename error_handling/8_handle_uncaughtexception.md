# 8. Also Handle `uncaughtException`

You specifically asked about unhandled rejections, but in production these are normally discussed together.

Example:

```js
setTimeout(() => {
  throw new Error("Unexpected crash");
}, 1000);
```

This can trigger:

```js
process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION", error);

  shutdown("uncaughtException");
});
```

Full example:

```js
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");

  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled rejection");

  shutdown("unhandledRejection");
});
```

### Important distinction

| Error                | Example                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `uncaughtException`  | Synchronous error that reaches the event loop without being caught |
| `unhandledRejection` | Promise rejects without a rejection handler                        |

Example of uncaught exception:

```js
throw new Error("Boom");
```

Example of unhandled rejection:

```js
Promise.reject(new Error("Boom"));
```

---