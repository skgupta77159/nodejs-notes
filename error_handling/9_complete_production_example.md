# 9. Complete Production Example

Here is how these pieces can work together.

```js
import express from "express";

const app = express();

app.use(express.json());

class AppError extends Error {
  constructor(message, options = {}) {
    const {
      statusCode = 500,
      code = "INTERNAL_ERROR",
      isOperational = true,
      details,
      cause
    } = options;

    super(message, { cause });

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace?.(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource, details) {
    super(`${resource} not found`, {
      statusCode: 404,
      code: "NOT_FOUND",
      details
    });
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message, {
      statusCode: 400,
      code: "VALIDATION_ERROR",
      details
    });
  }
}

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};


// ---------------- ROUTES ----------------

app.get(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const user = null;

    if (!user) {
      throw new NotFoundError("User", {
        userId: req.params.id
      });
    }

    res.json(user);
  })
);


app.post(
  "/users",
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
      throw new ValidationError("Email is required", {
        field: "email"
      });
    }

    res.status(201).json({
      success: true
    });
  })
);


// ---------------- CENTRAL ERROR HANDLER ----------------

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || "INTERNAL_ERROR";

  const logData = {
    message: err.message,
    name: err.name,
    code,
    statusCode,
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
    requestId: req.requestId
  };

  console.error(logData);

  if (res.headersSent) {
    return next(err);
  }

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


// ---------------- SERVER ----------------

const server = app.listen(3000, () => {
  console.log("Server running on port 3000");
});


// ---------------- GRACEFUL SHUTDOWN ----------------

let isShuttingDown = false;

async function shutdown(reason) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`Starting shutdown. Reason: ${reason}`);

  const forceExitTimer = setTimeout(() => {
    console.error("Forced exit after shutdown timeout");

    process.exit(1);
  }, 30_000);

  forceExitTimer.unref();

  try {
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    });

    console.log("HTTP server closed");

    // await db.close();
    // await redis.quit();
    // await queue.close();

    console.log("Resources closed");

    process.exit(0);
  } catch (error) {
    console.error("Shutdown error", error);

    process.exit(1);
  }
}


// ---------------- SIGNALS ----------------

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  shutdown("SIGINT");
});


// ---------------- UNEXPECTED ERRORS ----------------

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION", reason);

  shutdown("unhandledRejection");
});

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION", error);

  shutdown("uncaughtException");
});
```

---