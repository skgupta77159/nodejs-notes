# 9. Middleware / Chain of Responsibility ⭐

Express middleware is essentially a practical implementation of the **Chain of Responsibility** concept.

Imagine:

```text
Request
   ↓
Logger
   ↓
Authentication
   ↓
Authorization
   ↓
Validation
   ↓
Controller
```

Example:

```js
function logger(req, res, next) {
    console.log(req.method, req.url);
    next();
}

function authenticate(req, res, next) {

    if (!req.headers.authorization) {
        return res.status(401).json({
            message: "Unauthorized"
        });
    }

    next();
}
```

Register:

```js
app.use(logger);
app.use(authenticate);

app.get("/orders", getOrders);
```

Each handler decides whether to:

```js
next();
```

or terminate the request.

### Real-world use

```text
Request
 ↓
Rate Limiter
 ↓
Logger
 ↓
JWT Authentication
 ↓
Role Authorization
 ↓
Validation
 ↓
Controller
```

---