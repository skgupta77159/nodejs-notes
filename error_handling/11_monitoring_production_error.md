# 11. Monitoring Production Errors

Logging to `console.log()` alone is not enough.

In production, logs should ideally be:

### Structured

Instead of:

```text
Error happened
```

prefer:

```json
{
  "level": "error",
  "message": "Database query failed",
  "code": "DATABASE_ERROR",
  "requestId": "abc-123",
  "userId": "42",
  "method": "POST",
  "path": "/orders",
  "stack": "..."
}
```

A logger such as [Pino](https://getpino.io/?utm_source=chatgpt.com) or [Winston](https://github.com/winstonjs/winston?utm_source=chatgpt.com) can help create structured logs.

For example, conceptually:

```js
logger.error({
  err: error,
  requestId: req.requestId,
  method: req.method,
  path: req.originalUrl
}, "Request failed");
```

---

# 12. Request IDs

A very useful production feature is assigning every request an ID.

```js
import crypto from "node:crypto";

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();

  res.setHeader("X-Request-ID", req.requestId);

  next();
});
```

Now:

```text
Client reports:
"My request failed."
```

You can search:

```text
requestId = abc-123
```

and find the relevant logs.

Your error log becomes:

```json
{
  "requestId": "abc-123",
  "error": "Database timeout",
  "path": "/orders/50"
}
```

This is much easier to debug than searching millions of logs.

---

# 13. Metrics: Don't Only Monitor Individual Errors

You should also monitor patterns.

For example:

```text
http_requests_total
http_request_errors_total
http_request_duration_seconds
unhandled_rejections_total
uncaught_exceptions_total
```

Useful alerts:

```text
5xx error rate > 2% for 5 minutes
```

```text
Unhandled rejection > 0
```

```text
Application restart count increasing
```

```text
Database error rate suddenly increases
```

```text
External payment API failures > threshold
```

The important distinction:

### Logs answer:

> What exactly happened?

### Metrics answer:

> Is something becoming a problem?

### Alerts answer:

> Wake someone up because action is needed.

---

# 14. Monitoring and Notification Flow

A production flow might look like:

```text
                    Application
                         │
                ┌────────┴────────┐
                │                 │
             Logs              Metrics
                │                 │
                ▼                 ▼
          Log Platform      Monitoring System
                │                 │
                │           Threshold exceeded
                │                 │
                └──────────┬──────┘
                           ▼
                        Alerting
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
            Slack       PagerDuty      Email
```

For application error tracking, tools such as [Sentry](https://sentry.io/?utm_source=chatgpt.com) can capture exceptions, stack traces, releases, and error trends.

For infrastructure/metrics, [Prometheus](https://prometheus.io/?utm_source=chatgpt.com) and [Grafana](https://grafana.com/?utm_source=chatgpt.com) are commonly used together.

A typical critical notification could contain:

```text
ALERT: Production API 5xx rate increased

Service: user-service
Environment: production
Error rate: 8.4%
Threshold: 2%
Duration: 5 minutes
Deployment: v2.14.3
Top error: DATABASE_CONNECTION_ERROR
```

---

# 15. What Should Trigger a Notification?

Not every 404 should send you an alert.

For example:

| Event                           | Log          | Metric   | Immediate Alert |
| ------------------------------- | ------------ | -------- | --------------- |
| 404 user not found              | Yes          | Optional | No              |
| Validation error                | Yes/optional | Optional | No              |
| Single 500                      | Yes          | Yes      | Usually no      |
| 500 rate suddenly increases     | Yes          | Yes      | Yes             |
| Database completely unavailable | Yes          | Yes      | Yes             |
| `unhandledRejection`            | Yes          | Yes      | Usually yes     |
| `uncaughtException`             | Yes          | Yes      | Yes             |
| Process restarting continuously | Yes          | Yes      | Yes             |

The key idea is to avoid **alert fatigue**.

You don't want:

```text
1000 Slack messages
```

for:

```text
1000 occurrences of the same error
```

Instead:

```text
Error rate crossed threshold
Affected requests: 1,000
Started: 10:15 AM
Still ongoing
```

---

# 16. My Recommended Production Checklist

For a Node.js API, I would use:

```text
1. Custom AppError
       ↓
2. Error codes + HTTP status
       ↓
3. Central Express error middleware
       ↓
4. Async error propagation
       ↓
5. Safe error response to clients
       ↓
6. Detailed structured server logs
       ↓
7. Request/correlation ID
       ↓
8. process.on("unhandledRejection")
       ↓
9. process.on("uncaughtException")
       ↓
10. SIGTERM / SIGINT graceful shutdown
       ↓
11. Shutdown timeout
       ↓
12. Close DB, Redis, queues, consumers
       ↓
13. Process supervisor restarts failed process
       ↓
14. Error tracking
       ↓
15. Metrics and alerts
```

## Best interview summary

If asked **"How do you handle errors in Node.js in production?"**, a strong answer would be:

> "I separate expected operational errors from unexpected programming or system failures. For expected errors, I use custom error classes with fields like HTTP status, error code, operational flag, details, and optionally the original cause. Errors propagate to a centralized error handler, which logs structured information and returns a safe response without exposing stack traces.
>
> For async code, I ensure rejected promises reach the central handler. At the process level, I handle `unhandledRejection` and `uncaughtException`, log them as critical events, and initiate a graceful shutdown rather than continuing in a potentially corrupted state. During shutdown, I stop accepting traffic, allow in-flight work to complete within a timeout, close database and external connections, and let Docker, Kubernetes, or a process manager restart the process.
>
> Finally, I validate failure scenarios through unit and integration tests, use structured logs and request IDs for debugging, track error rates and critical failures with metrics, and configure alerting for sustained 5xx spikes, crashes, and infrastructure failures rather than alerting on every individual error."

That answer covers both **Node.js internals and real production practices**.
