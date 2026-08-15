# 10. How Do You Validate Error Handling?

You should test **both expected and unexpected failures**.

## A. Unit test custom errors

For example:

```js
const error = new NotFoundError("User", {
  userId: 10
});

console.log(error.message);
// User not found

console.log(error.statusCode);
// 404

console.log(error.code);
// NOT_FOUND
```

With Jest:

```js
test("NotFoundError should have correct properties", () => {
  const error = new NotFoundError("User");

  expect(error.statusCode).toBe(404);
  expect(error.code).toBe("NOT_FOUND");
  expect(error.message).toBe("User not found");
  expect(error).toBeInstanceOf(AppError);
});
```

---

## B. Integration test central error handling

For example, deliberately throw an error:

```js
app.get("/test-error", () => {
  throw new Error("Test error");
});
```

Call:

```text
GET /test-error
```

Expected:

```http
HTTP/1.1 500
```

Response:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Internal server error"
  }
}
```

Verify:

* Client doesn't receive stack trace
* Status is correct
* Error was logged
* Error code is correct

---

## C. Validate async errors

Create a test route:

```js
app.get(
  "/test-async-error",
  asyncHandler(async () => {
    throw new Error("Async failure");
  })
);
```

Verify that:

```text
Async failure
     ↓
asyncHandler
     ↓
next(error)
     ↓
central error middleware
```

and not a hung request.

---

## D. Validate graceful shutdown

Run your application:

```bash
node app.js
```

Make a long-running request:

```js
app.get("/slow", async (req, res) => {
  await new Promise(resolve => setTimeout(resolve, 5000));

  res.json({
    success: true
  });
});
```

Start a request to:

```text
GET /slow
```

While it is running, send:

```bash
kill -SIGTERM <PID>
```

Validate:

1. Application receives `SIGTERM`
2. New requests are no longer accepted
3. Existing request finishes
4. Server closes
5. Database/Redis connections close
6. Process exits

Also test the timeout case where a request never completes.

---