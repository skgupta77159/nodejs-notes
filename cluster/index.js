const http = require("node:http");
const cluster = require("node:cluster");

const server = http.createServer((req, res) => {
  console.log(
    `Request ${req.url} handled by worker ${cluster.worker.id}, PID: ${process.pid}`,
  );

  if (req.url === "/") {
    res.end(`Hello from worker ${cluster.worker.id}`);
    return;
  }

  if (req.url === "/heavy") {
    let sum = 0;

    for (let i = 0; i < 5_000_000_000; i++) {
      sum += i;
    }

    res.end(`Heavy task completed by worker ${cluster.worker.id}`);

    return;
  }

  res.statusCode = 404;
  res.end("Not Found");
});

server.listen(3000, () => {
  console.log(
    `Server running on port 3000 - Worker ${cluster.worker.id}, PID: ${process.pid}`,
  );
});
