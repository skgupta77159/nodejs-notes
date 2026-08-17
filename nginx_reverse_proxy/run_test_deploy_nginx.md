# 9. Steps to Create and Run the Nginx Server

## Step 1: Create a Node.js application

Create a project:

```bash
mkdir nginx-node-app
cd nginx-node-app
npm init -y
npm install express
```

Create `server.js`:

```js
const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.json({
        message: "Hello from Node.js",
        port: PORT,
        pid: process.pid
    });
});

app.get("/api/users", (req, res) => {
    res.json([
        { id: 1, name: "Sushil" },
        { id: 2, name: "John" }
    ]);
});

app.listen(PORT, "127.0.0.1", () => {
    console.log(`Node.js server running on port ${PORT}`);
});
```

---

## Step 2: Run multiple Node.js instances

Terminal 1:

```bash
PORT=3000 node server.js
```

Terminal 2:

```bash
PORT=3001 node server.js
```

Now:

```text
Node.js Instance 1 → 127.0.0.1:3000
Node.js Instance 2 → 127.0.0.1:3001
```

Test them:

```bash
curl http://127.0.0.1:3000
```

```bash
curl http://127.0.0.1:3001
```

---

## Step 3: Install Nginx

### Ubuntu/Debian

```bash
sudo apt update
sudo apt install nginx -y
```

Check the status:

```bash
sudo systemctl status nginx
```

Start Nginx:

```bash
sudo systemctl start nginx
```

Enable automatic startup:

```bash
sudo systemctl enable nginx
```

---

## Step 4: Create an Nginx configuration

Create:

```bash
sudo nano /etc/nginx/sites-available/node-app
```

For local testing, use this simpler configuration first:

```nginx
upstream node_backend {
    least_conn;

    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
}

server {
    listen 80;

    server_name _;

    gzip on;

    gzip_types
        application/json
        application/javascript
        text/css
        text/plain;

    location /static/ {
        alias /var/www/myapp/static/;
        try_files $uri =404;
    }

    location / {
        proxy_pass http://node_backend;

        proxy_set_header Host $host;

        proxy_set_header X-Real-IP $remote_addr;

        proxy_set_header X-Forwarded-For
                         $proxy_add_x_forwarded_for;

        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering on;

        proxy_connect_timeout 5s;
        proxy_read_timeout 60s;

        proxy_next_upstream
            error
            timeout
            http_502
            http_503
            http_504;
    }
}
```

---

## Step 5: Enable the Nginx configuration

Create a symbolic link:

```bash
sudo ln -s /etc/nginx/sites-available/node-app \
/etc/nginx/sites-enabled/
```

Optionally remove the default configuration:

```bash
sudo rm /etc/nginx/sites-enabled/default
```

---

## Step 6: Test the Nginx configuration

Always test before reloading:

```bash
sudo nginx -t
```

Expected result:

```text
syntax is ok
test is successful
```

If the configuration is valid:

```bash
sudo systemctl reload nginx
```

---

## Step 7: Test the application

Previously, you accessed Node.js directly:

```text
http://localhost:3000
```

Now access:

```text
http://YOUR_SERVER_IP
```

The request flow is:

```text
Browser
   |
   v
Nginx :80
   |
   v
Load Balancer
   |
   +----------+
   |          |
   v          v
Node :3000  Node :3001
```

You can test:

```bash
curl http://localhost
```

You should receive a response from one of the Node.js instances.

---

# Step 8: Test Load Balancing

Run:

```bash
for i in {1..10}; do
    curl http://localhost
    echo
done
```

You should see responses containing different ports:

```text
Hello from Node.js
port: 3000

Hello from Node.js
port: 3001
```

Depending on the load-balancing algorithm and connection behavior, requests may not alternate perfectly.

---

# Step 9: Test Recovery / Failover

Stop one Node.js instance:

```bash
# Stop the application running on port 3000
```

Keep port `3001` running.

Then test:

```bash
curl http://localhost
```

Nginx can route requests to the remaining healthy backend according to the upstream and retry configuration.

```text
                    Nginx
                      |
          ┌───────────┴───────────┐
          |                       |
     Node :3000 ❌             Node :3001 ✅
                                    |
                                    v
                              Handles request
```

If all Node.js instances fail:

```text
Client
   |
   v
Nginx
   |
   X
All backends unavailable
```

Nginx typically returns an upstream error such as:

```text
502 Bad Gateway
```

A process manager such as **PM2 or systemd** should then restart the failed Node.js process.

---

# Step 10: Add SSL for Production

For a real domain:

```text
example.com → Your Server IP
```

Install Certbot and its Nginx integration:

```bash
sudo apt install certbot python3-certbot-nginx -y
```

Request a certificate:

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

Then test automatic renewal:

```bash
sudo certbot renew --dry-run
```

The final request flow becomes:

```text
                         INTERNET
                            |
                         HTTPS :443
                            |
                            v
                    ┌───────────────┐
                    │     NGINX     │
                    │               │
                    │ SSL Terminate │
                    │ Gzip          │
                    │ Buffering     │
                    │ Static Files  │
                    │ Routing       │
                    │ Load Balance  │
                    └───────┬───────┘
                            |
               ┌────────────┴────────────┐
               |                         |
          Node.js :3000              Node.js :3001
               |                         |
               └────────────┬────────────┘
                            |
                         Database
```

## Final Summary

| Feature                | Why Nginx Handles It                                                |
| ---------------------- | ------------------------------------------------------------------- |
| **SSL Encryption**     | Centralized HTTPS/TLS termination                                   |
| **Buffering**          | Helps manage request/response transfer and slow clients             |
| **Recovery**           | Can retry another upstream; process manager handles actual restarts |
| **Load Balancing**     | Distributes traffic across Node.js instances                        |
| **Enterprise Routing** | Routes paths/domains to different services                          |
| **Gzip Compression**   | Reduces response size and bandwidth                                 |
| **Static Routing**     | Serves files directly without involving Node.js                     |

### Production interview takeaway

> **Nginx acts as the internet-facing layer, while Node.js handles business logic. Nginx terminates SSL, manages connections and buffering, serves static files, compresses responses, applies routing and security policies, and distributes traffic across application instances. For failures, Nginx can fail over at the traffic level, while PM2, systemd, or Kubernetes handles process recovery.**
