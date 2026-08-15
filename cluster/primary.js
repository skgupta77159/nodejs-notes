const cluster = require("node:cluster");
const os = require("node:os");
const path = require("node:path");

const numCPUs = os.availableParallelism();

console.log(`Primary process started: PID ${process.pid}`);
console.log(`Creating ${numCPUs} workers...`);

// Must be set before cluster.fork()
cluster.schedulingPolicy = cluster.SCHED_RR;

cluster.setupPrimary({
  exec: path.join(__dirname, "index.js"),
});

for (let i = 0; i < numCPUs; i++) {
  const worker = cluster.fork();

  console.log(
    `Created worker ${worker.id}, PID: ${worker.process.pid}`
  );
}

cluster.on("online", (worker) => {
  console.log(
    `Worker ${worker.id} is online, PID: ${worker.process.pid}`
  );
});

cluster.on("exit", (worker, code, signal) => {
  console.log(
    `Worker ${worker.id} died. PID: ${worker.process.pid}`
  );

  console.log("Creating replacement worker...");

  cluster.fork();
});