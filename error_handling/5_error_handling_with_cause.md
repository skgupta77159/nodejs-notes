# 5. Error Handling with Cause

Suppose your service calls an external API:

```js
try {
  await paymentService.charge();
} catch (error) {
  throw new AppError("Payment processing failed", {
    statusCode: 502,
    code: "PAYMENT_SERVICE_ERROR",
    cause: error
  });
}
```

Now you have two levels of information:

```text
AppError
  Payment processing failed
        ↓ cause
AxiosError
  ECONNREFUSED
```

This is very useful for production debugging.

You return a clean message to the user:

```json
{
  "error": {
    "code": "PAYMENT_SERVICE_ERROR",
    "message": "Internal server error"
  }
}
```

But your logs can contain the original error.

---