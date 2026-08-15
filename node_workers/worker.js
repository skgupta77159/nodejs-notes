const { parentPort } = require("worker_threads");

function calculateSum(start, end) {
  let sum = 0;

  for (let i = start; i <= end; i++) {
    sum += i;
  }

  return sum;
}

parentPort.on("message", ({ taskId, data }) => {
  try {
    const result = calculateSum(data.start, data.end);

    parentPort.postMessage({
      taskId,
      result,
    });
  } catch (error) {
    parentPort.postMessage({
      taskId,
      error: error.message,
    });
  }
});
