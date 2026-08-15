const express = require("express");
const WorkerPool = require("./workerPool");

const app = express();

const workerPool = new WorkerPool();

app.get("/sum", async (req, res) => {
  try {
    const result = await workerPool.execute({
      start: 1,
      end: 1_000_000_000,
    });

    res.json({
      result,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
  });
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
