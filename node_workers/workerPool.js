const { Worker } = require("worker_threads");
const os = require("os");
const path = require("path");

class WorkerPool {
  constructor() {
    this.workers = [];
    this.queue = [];
    this.tasks = new Map();

    const numberOfWorkers = os.availableParallelism
      ? os.availableParallelism()
      : os.cpus().length;

    console.log(`Creating ${numberOfWorkers} workers`);

    for (let i = 0; i < numberOfWorkers; i++) {
      this.createWorker();
    }
  }

  createWorker() {
    const worker = new Worker(path.resolve(__dirname, "worker.js"));

    worker.isBusy = false;

    worker.on("message", ({ taskId, result }) => {
      const task = this.tasks.get(taskId);

      if (task) {
        task.resolve(result);
        this.tasks.delete(taskId);
      }

      worker.isBusy = false;

      this.processQueue();
    });

    worker.on("error", (error) => {
      console.error("Worker error:", error);

      worker.isBusy = false;

      this.processQueue();
    });

    this.workers.push(worker);
  }

  execute(data) {
    return new Promise((resolve, reject) => {
      const taskId = crypto.randomUUID();

      this.tasks.set(taskId, {
        resolve,
        reject,
      });

      this.queue.push({
        taskId,
        data,
      });

      this.processQueue();
    });
  }

  processQueue() {
    const availableWorker = this.workers.find((worker) => !worker.isBusy);

    if (!availableWorker) {
      return;
    }

    const task = this.queue.shift();

    if (!task) {
      return;
    }

    availableWorker.isBusy = true;

    availableWorker.postMessage(task);

    // Try assigning more queued tasks
    this.processQueue();
  }
}

module.exports = WorkerPool;
