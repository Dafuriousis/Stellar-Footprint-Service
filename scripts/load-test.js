const autocannon = require("autocannon");

const baseUrl = process.env.LOAD_TEST_URL || "http://localhost:3000";
const defaultPath = process.env.LOAD_TEST_PATH || "/health";
const target = new URL(defaultPath, baseUrl).toString();
const duration = parseInt(process.env.LOAD_TEST_DURATION || "25", 10);
const scenarios = [10, 50, 100];

function formatNumber(value) {
  return String(value).padStart(5, " ");
}

function calculateErrorRate(result) {
  const totalRequests = result.requests?.total ?? 0;
  const totalErrors =
    (result.errors ?? 0) + (result.timeouts ?? 0) + (result.non2xx ?? 0);
  return totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
}

async function runScenario(connections) {
  console.log(
    `\nRunning load test: ${connections} connections for ${duration}s against ${target}`,
  );

  const result = await autocannon({
    url: target,
    connections,
    duration,
    timeout: 30000,
  });

  return {
    connections,
    p50: Math.round(result.latency?.p50 ?? 0),
    p95: Math.round(result.latency?.p95 ?? 0),
    p99: Math.round(result.latency?.p99 ?? 0),
    reqPerSec: Math.round(result.requests?.average ?? 0),
    errors: calculateErrorRate(result).toFixed(2),
  };
}

function printSummary(results) {
  const header =
    "Connections | p50(ms) | p95(ms) | p99(ms) | Req/sec | Errors(%)";
  const divider =
    "---------------------------------------------------------------";

  console.log("\nLoad Test Summary");
  console.log(header);
  console.log(divider);

  results.forEach((row) => {
    console.log(
      `${String(row.connections).padEnd(11)} | ${formatNumber(row.p50).padEnd(7)} | ${formatNumber(row.p95).padEnd(7)} | ${formatNumber(row.p99).padEnd(7)} | ${formatNumber(row.reqPerSec).padEnd(7)} | ${String(row.errors).padStart(8)}`,
    );
  });
}

async function runLoadTests() {
  try {
    console.log("Starting autocannon load tests...");
    const results = [];

    for (const connections of scenarios) {
      const result = await runScenario(connections);
      results.push(result);
    }

    printSummary(results);
    process.exit(0);
  } catch (error) {
    console.error("Load test failed:", error);
    process.exit(1);
  }
}

runLoadTests();
