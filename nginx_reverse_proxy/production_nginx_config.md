# 8. Production-Ready Nginx Configuration

Below is an example configuration combining:

* SSL
* Buffering
* Recovery/failover
* Load balancing
* Enterprise routing
* Gzip compression
* Static file routing

```nginx
# ============================================================
# NGINX CONFIGURATION FOR NODE.JS PRODUCTION APPLICATION
# ============================================================


# ------------------------------------------------------------
# 1. NODE.JS BACKEND LOAD BALANCER
# ------------------------------------------------------------
# Multiple Node.js instances can run on different ports.
# least_conn sends traffic to the backend with the fewest
# active connections.
#
# max_fails + fail_timeout:
# If a backend repeatedly fails, Nginx temporarily considers
# it unavailable.
# ------------------------------------------------------------

upstream node_backend {
    least_conn;

    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s;

    keepalive 32;
}


# ------------------------------------------------------------
# 2. HTTP SERVER
# ------------------------------------------------------------
# Redirect all HTTP traffic to HTTPS.
# ------------------------------------------------------------

server {
    listen 80;
    server_name example.com www.example.com;

    return 301 https://$host$request_uri;
}


# ============================================================
# 3. HTTPS SERVER
# ============================================================

server {
    listen 443 ssl http2;

    server_name example.com www.example.com;


    # --------------------------------------------------------
    # SSL / TLS CONFIGURATION
    # --------------------------------------------------------
    # Nginx handles HTTPS encryption and decryption.
    # Requests are then forwarded internally to Node.js.
    # --------------------------------------------------------

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;


    # --------------------------------------------------------
    # SECURITY
    # --------------------------------------------------------

    server_tokens off;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;


    # --------------------------------------------------------
    # GZIP COMPRESSION
    # --------------------------------------------------------

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 5;
    gzip_min_length 1000;

    gzip_types
        text/plain
        text/css
        application/json
        application/javascript
        application/xml
        text/xml
        image/svg+xml;


    # --------------------------------------------------------
    # STATIC FILE ROUTING
    # --------------------------------------------------------
    # Static requests are served directly by Nginx.
    # Node.js does not handle these requests.
    # --------------------------------------------------------

    location /static/ {
        alias /var/www/myapp/static/;

        try_files $uri =404;

        expires 30d;

        add_header Cache-Control "public, immutable";
    }


    # --------------------------------------------------------
    # MAIN NODE.JS APPLICATION
    # --------------------------------------------------------

    location / {

        # Forward request to Node.js load balancer.
        proxy_pass http://node_backend;


        # ----------------------------------------------------
        # PROXY HEADERS
        # ----------------------------------------------------
        # Send original client information to Node.js.
        # ----------------------------------------------------

        proxy_set_header Host $host;

        proxy_set_header X-Real-IP $remote_addr;

        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        proxy_set_header X-Forwarded-Proto $scheme;


        # ----------------------------------------------------
        # BUFFERING
        # ----------------------------------------------------

        # Buffer client request before forwarding where appropriate.
        proxy_request_buffering on;

        # Buffer backend responses.
        proxy_buffering on;

        proxy_buffer_size 16k;

        proxy_buffers 8 16k;


        # ----------------------------------------------------
        # TIMEOUTS
        # ----------------------------------------------------

        proxy_connect_timeout 5s;

        proxy_send_timeout 60s;

        proxy_read_timeout 60s;


        # ----------------------------------------------------
        # RECOVERY / FAILOVER
        # ----------------------------------------------------
        # If one upstream fails because of a connection error,
        # timeout, or selected server errors, Nginx can attempt
        # another backend.
        # ----------------------------------------------------

        proxy_next_upstream
            error
            timeout
            http_502
            http_503
            http_504;

        proxy_next_upstream_tries 2;
    }


    # --------------------------------------------------------
    # ENTERPRISE SERVICE ROUTING EXAMPLE
    # --------------------------------------------------------
    #
    # Uncomment these locations when using separate services.
    #
    # Client:
    # https://example.com/users/
    #
    # Nginx:
    # Forwards internally to User Service.
    # --------------------------------------------------------

    # location /users/ {
    #
    #     proxy_pass http://127.0.0.1:4000/;
    #
    #     proxy_set_header Host $host;
    #     proxy_set_header X-Real-IP $remote_addr;
    #     proxy_set_header X-Forwarded-For
    #                      $proxy_add_x_forwarded_for;
    # }


    # --------------------------------------------------------
    # ORDER SERVICE
    # --------------------------------------------------------

    # location /orders/ {
    #
    #     proxy_pass http://127.0.0.1:5000/;
    #
    #     proxy_set_header Host $host;
    #     proxy_set_header X-Real-IP $remote_addr;
    #     proxy_set_header X-Forwarded-For
    #                      $proxy_add_x_forwarded_for;
    # }
}