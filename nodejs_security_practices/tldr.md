# Node.js Security Best Practices — Complete Interview TL;DR

### 1. Rate Limiting

> Limit requests per IP/user/API key within a time window to prevent brute-force attacks, API abuse, and resource exhaustion.

* Use `express-rate-limit`
* Stricter limits for login, OTP, and password reset
* Use **Redis** as a shared store in multi-server production environments

---

### 2. Password Hashing

> Passwords should be **hashed, not encrypted**, because passwords should not be reversible.

* Use **Argon2**, `bcrypt`, or `scrypt`
* Never store plain-text passwords
* Use slow, adaptive password hashing

```js
const hash = await bcrypt.hash(password, 12);
const valid = await bcrypt.compare(password, hash);
```

---

### 3. JWT Blacklisting / Token Revocation

> JWTs are stateless, so a token normally remains valid until expiration.

* Use short-lived access tokens
* Use refresh tokens with rotation/revocation
* For immediate invalidation, store JWT `jti` in a Redis blacklist with TTL

**Recommended architecture:**

```text
Short-lived Access Token
        +
Rotating / Revocable Refresh Token
```

---

### 4. JSON Schema Validation

> Never trust client input such as `req.body`, `req.params`, or `req.query`.

Validate:

* Type
* Required fields
* Length
* Format
* Allowed values
* Unexpected properties

Use `additionalProperties: false` where appropriate to help prevent mass assignment.

---

### 5. HTML/CSS Escaping — XSS Prevention

> Never directly insert untrusted data into HTML, JavaScript, CSS, or URLs.

* Escape output based on its context
* Sanitize user HTML when rich text is intentionally allowed
* Avoid untrusted `v-html` and `dangerouslySetInnerHTML`
* Don't allow arbitrary user-provided CSS

---

### 6. ORM/ODM Against Injection

> ORM/ODM helps, but does not automatically prevent every injection vulnerability.

For SQL:

* Use ORM APIs or parameterized queries
* Never concatenate user input into SQL

For MongoDB:

* Validate input types
* Don't pass arbitrary `req.query` directly into database queries

```js
// Safer
User.findOne({ email });

// Risky
User.find(req.query);
```

---

### 7. Security Linter

> Detect insecure coding patterns during development.

Use:

* ESLint
* `eslint-plugin-security`
* Run linting in CI/CD

Can help identify patterns involving:

* `eval()`
* Unsafe regex
* Dangerous process execution
* Other insecure code patterns

---

### 8. Security Headers

> Security headers add browser-level protection against common attacks.

Use Helmet:

```js
app.use(helmet());
```

Important areas include CSP, clickjacking protection, MIME sniffing protection, etc.

---

### 9. HTTPS / TLS

> Encrypt data while it travels between client and server.

```text
Client → HTTPS → Load Balancer/Nginx → Node.js
```

Never send passwords, tokens, or sensitive data over plain HTTP in production.

---

### 10. CORS

> Controls which browser origins can make cross-origin requests to your server.

* Allow only required origins
* Restrict methods and headers where appropriate

**Important interview point:**

> CORS is not authentication or authorization.

---

### 11. Request Body and File Size Limits

> Prevent attackers from exhausting memory or server resources using huge requests/uploads.

```js
app.use(express.json({ limit: "1mb" }));
```

For uploads, limit:

* File size
* File count
* Allowed file types
* Upload time

---

### 12. Environment Variables and Secrets

> Never hardcode passwords, API keys, JWT secrets, or database credentials.

```js
const secret = process.env.JWT_SECRET;
```

Production best practices:

* Keep `.env` out of Git
* Use secret managers
* Rotate compromised credentials
* Never log secrets

---

### 13. Authentication vs Authorization

> Authentication verifies **who you are**. Authorization verifies **what you can do**.

```text
Authentication → Who are you?
Authorization  → Are you allowed?
```

Always check:

* User roles
* Permissions
* Resource ownership

This helps prevent **IDOR/BOLA** vulnerabilities.

---

### 14. Information Leakage

> Never expose internal implementation details to clients.

Don't return:

```text
Stack traces
Database errors
Internal file paths
Secrets
SQL queries
```

Instead:

```text
Detailed error → Logs/Monitoring
Safe generic error → Client
```

---

### 15. Dependency Security

> Third-party packages are part of your attack surface.

* Run `npm audit`
* Use dependency scanning
* Use secret scanning
* Keep packages updated
* Remove unused dependencies
* Test updates before production

---

### 16. Prototype Pollution

> Avoid blindly merging user-controlled objects into application objects.

Risky:

```js
Object.assign(config, req.body);
```

or unsafe deep merge operations.

Prefer explicitly selecting allowed fields:

```js
const config = {
  theme: req.body.theme
};
```

after validation.

---

### 17. ReDoS — Regular Expression Denial of Service

> A poorly designed regex can consume excessive CPU through catastrophic backtracking.

This is particularly serious in Node.js because CPU-heavy JavaScript can block the event loop.

Protection:

* Avoid dangerous nested quantifiers
* Limit input length
* Test regex performance
* Use security/static analysis tools

```js
if (input.length > 1000) {
  throw new Error("Input too long");
}
```

---

### 18. CSRF — Cross-Site Request Forgery

> CSRF tricks a user's browser into sending an authenticated request to another website.

This is especially relevant when authentication uses **cookies**, because browsers may automatically send them.

Protection includes:

* CSRF tokens
* `SameSite` cookies
* `HttpOnly`
* `Secure` cookies
* Origin/Referer validation where appropriate

```js
res.cookie("refreshToken", token, {
  httpOnly: true,
  secure: true,
  sameSite: "strict"
});
```

---

# Quick Complete Interview Checklist

```text
1.  Rate Limiting
2.  Password Hashing
3.  JWT Revocation / Blacklisting
4.  Input / JSON Schema Validation
5.  XSS Prevention / HTML Escaping
6.  SQL / NoSQL Injection Prevention
7.  Security Linting
8.  Security Headers
9.  HTTPS / TLS
10. CORS
11. Body / File Size Limits
12. Secrets Management
13. Authentication & Authorization / IDOR
14. Information Leakage Prevention
15. Dependency Security
16. Prototype Pollution Prevention
17. ReDoS Prevention
18. CSRF Protection
```

## ⭐ Strong Interview Answer

> **"I follow a defense-in-depth approach for Node.js security. I rate-limit sensitive APIs, hash passwords using Argon2 or bcrypt, use short-lived access tokens with refresh-token revocation, validate all request data using schemas, prevent XSS through context-aware escaping and sanitization, and prevent SQL or NoSQL injection using parameterized queries and strict input validation. I also use security headers, HTTPS, properly configured CORS, request size limits, secure secrets management, authentication and authorization checks, safe error handling, dependency scanning, protection against prototype pollution and ReDoS, and CSRF protection when using cookie-based authentication."**

This is a good **concise but complete answer** for a Node.js interview.
