# 3. Central Error Handling

A common mistake is handling errors separately everywhere.

```js
app.get("/users/:id", async (req, res) => {
  try {
    const user = await getUser(req.params.id);

    res.json(user);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Something went wrong"
    });
  }
});
```

Then every route contains repeated code.

Instead, let errors propagate to **one central place**.

---

## Express example

```js
import express from "express";

const app = express();

app.use(express.json());
```

Create a route:

```js
app.get("/users/:id", async (req, res, next) => {
  try {
    const user = await getUser(req.params.id);

    if (!user) {
      throw new NotFoundError("User", {
        userId: req.params.id
      });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});
```

`next(error)` tells Express:

> Stop normal middleware flow and send this error to error middleware.

---

## Central error middleware

Express identifies error middleware using **four parameters**:

```js
app.use((err, req, res, next) => {
  // error handler
});
```

Example:

```js
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || "INTERNAL_ERROR";

  console.error({
    message: err.message,
    code,
    statusCode,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method
  });

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message:
        statusCode >= 500
          ? "Internal server error"
          : err.message
    }
  });
});
```

Now:

```js
throw new NotFoundError("User");
```

becomes:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  }
}
```

Whereas an unexpected error:

```js
const value = undefined;
value.name;
```

becomes:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Internal server error"
  }
}
```

But internally, you still log the real stack trace.

### This is important in production

**Never expose internal stack traces to clients.**

Bad:

```json
{
  "message": "Cannot read properties of undefined",
  "stack": "TypeError..."
}
```

That can expose implementation details.

---
