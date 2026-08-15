# 2. Extended Error Object

The native JavaScript `Error` object has useful properties:

```js
const error = new Error("Something went wrong");

console.log(error.name);
console.log(error.message);
console.log(error.stack);
```

But in a production API, we usually need more information.

For example:

```text
HTTP status: 404
Error code: USER_NOT_FOUND
Operational: true
Details: { userId: 123 }
```

So we create a custom error class.

## `AppError`

```js
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
```

### Usage

```js
throw new AppError("User not found", {
  statusCode: 404,
  code: "USER_NOT_FOUND",
  details: {
    userId: 123
  }
});
```

The error now contains structured information:

```js
{
  name: "AppError",
  message: "User not found",
  statusCode: 404,
  code: "USER_NOT_FOUND",
  isOperational: true,
  details: {
    userId: 123
  }
}
```

---

## Why not just do this?

```js
throw new Error("User not found");
```

Because later, your central error handler doesn't know:

* Should it return 404 or 500?
* What error code should the frontend receive?
* Is this expected?
* Should an alert be triggered?
* Are there additional safe details to log?

A structured error solves this.

---

## Creating specialized errors

You can extend `AppError` further:

```js
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

class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, {
      statusCode: 401,
      code: "UNAUTHORIZED"
    });
  }
}
```

Usage:

```js
throw new NotFoundError("User", {
  userId: 123
});
```

or:

```js
throw new ValidationError("Email is invalid", {
  field: "email"
});
```

---
