## 1. SSL Encryption

Nginx can handle HTTPS connections before forwarding requests to Node.js.

```text
Client
   |
 HTTPS (encrypted)
   |
   v
 Nginx
   |
 HTTP (internal network)
   |
   v
Node.js
```

### Why use Nginx for SSL?

* Centralized SSL certificate management
* Node.js does not need to manage certificates directly
* Easier certificate renewal
* Multiple applications can share the same HTTPS entry point
* TLS configuration is managed separately from application code

Nginx performs **SSL/TLS termination**:

```text
Client ── HTTPS ──> Nginx ── HTTP ──> Node.js
```

---

# 2. Buffering

Nginx can buffer requests and responses.

### Request buffering

```text
Slow Client
     |
     | Uploading request
     v
   Nginx
     |
     | Buffered request
     v
 Node.js
```

This helps prevent slow clients from directly consuming Node.js resources for the entire request transfer.

Example:

```nginx
proxy_request_buffering on;
```

### Response buffering

Nginx can also buffer responses from Node.js before sending them to the client:

```nginx
proxy_buffering on;
```

This can help manage slow clients and reduce pressure on the application server in appropriate workloads.

> Note: For streaming, Server-Sent Events, and some real-time responses, buffering may need to be disabled.

---

# 3. Recovery

Nginx can improve application availability when multiple backend instances are running.

```text
              Nginx
                |
        ┌───────┴───────┐
        |               |
      Node 1          Node 2
      Healthy         Failed ❌
```

If one backend is unavailable, Nginx can try another available backend depending on the configured failure and retry behavior.

Example:

```nginx
upstream node_backend {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s;
}
```

For proxy requests:

```nginx
proxy_next_upstream error timeout http_502 http_503 http_504;
```

### Important

Nginx does **not restart a crashed Node.js process**.

For process recovery, use something such as:

* systemd
* PM2
* Docker/Kubernetes

Production architecture:

```text
             Client
                |
              Nginx
                |
        ┌───────┴────────┐
        |                |
      Node.js          Node.js
        |                |
   systemd/PM2      systemd/PM2
        |                |
    Restart on       Restart on
      failure         failure
```

So:

> **Nginx provides traffic-level failover; a process manager provides process-level recovery.**

---

# 4. Load Balancing

If one Node.js instance cannot handle all traffic, run multiple instances.

```text
                    Nginx
                      |
           ┌──────────┼──────────┐
           |          |          |
           v          v          v
        Node 1      Node 2      Node 3
        :3000       :3001       :3002
```

Example:

```nginx
upstream node_backend {
    least_conn;

    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}
```

`least_conn` sends new requests to the server with the fewest active connections.

Other strategies include:

```nginx
# Default
round_robin;

# Based on client IP
ip_hash;

# Custom weights
server 127.0.0.1:3000 weight=3;
server 127.0.0.1:3001 weight=1;
```

---

# 5. Enterprise Routing

Nginx can act as a single **API Gateway / reverse proxy entry point** for multiple services.

```text
                         api.example.com
                                |
                              Nginx
                                |
             ┌──────────────────┼──────────────────┐
             |                  |                  |
          /users/*           /orders/*          /payments/*
             |                  |                  |
             v                  v                  v
        User Service       Order Service      Payment Service
```

Example:

```nginx
location /users/ {
    proxy_pass http://127.0.0.1:3000/;
}

location /orders/ {
    proxy_pass http://127.0.0.1:4000/;
}

location /payments/ {
    proxy_pass http://127.0.0.1:5000/;
}
```

This allows:

```text
https://api.example.com/users/
https://api.example.com/orders/
https://api.example.com/payments/
```

even though the actual services run on different ports.

The client only knows:

```text
api.example.com
```

Nginx hides the internal service architecture.

---

# 6. Gzip Compression

Nginx can compress responses before sending them to the client.

Without compression:

```text
Node.js
   |
   | 1 MB JSON
   |
Client
```

With compression:

```text
Node.js
   |
   | 1 MB JSON
   |
Nginx
   |
   | 200 KB compressed response
   |
Client
```

Example:

```nginx
gzip on;

gzip_vary on;
gzip_proxied any;

gzip_types
    text/plain
    text/css
    application/json
    application/javascript
    text/xml
    application/xml;
```

Benefits:

* Reduced bandwidth
* Faster response transfer
* Faster frontend asset delivery

Nginx does not usually compress files that are already compressed, such as many images and videos.

---

# 7. Static Routing

Nginx is highly efficient at serving static files.

Instead of:

```text
Browser
   |
   v
Node.js
   |
   v
Read logo.png
```

Use:

```text
Browser
   |
   v
Nginx
   |
   v
Static Files
```

Example:

```nginx
location /static/ {
    alias /var/www/myapp/static/;
    try_files $uri =404;

    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

For example:

```text
/static/logo.png
/static/app.js
/static/style.css
```

These requests never reach Node.js.

This reduces Node.js workload.

---