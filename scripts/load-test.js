const autocannon = require("autocannon");

const baseUrl = process.env.LOAD_TEST_URL || "http://localhost:3000";
const defaultPath = process.env.LOAD_TEST_PATH || "/health";
const target = new URL(defaultPath, baseUrl).toString();
const duration = parseInt(process.env.LOAD_TEST_DURATION || "25", 10);
const scenarios = [10, 50, 100];
const scenario = process.env.LOAD_TEST_SCENARIO || "health";

// Sample Soroban transaction XDR for batch simulation testing
const SAMPLE_XDR =
  "AAAAAgAAAACnDQTKOBdaOH0ynf6k7SpkytahlUjNsWgm4WEB8rmE1QAAAGQAAAAAAAAAZwAAAAEAAAAAAAAAAAAAAABp6joKAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFaGVsbG8AAAAAAAABAAAAAQAAAAAAAAAAAAAAAfK5hNUAAABAIbPVF4x6vSLx/J3T0SDhvTNtytA/BNO+qMJ74p/b3Y8xpBhR7xzy68FuEyffaF9fNXHEC+77WK+oOJpfon1tCg==";

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
  const isHealthCheck = scenario === "health";
  const targetUrl = isHealthCheck
    ? target
    : new URL("/api/simulate/batch", baseUrl).toString();

  console.log(
    `\nRunning load test: ${connections} connections for ${duration}s against ${targetUrl}`,
  );

  const config = {
    url: targetUrl,
    connections,
    duration,
    timeout: 30000,
  };

  // Add POST body for batch simulation scenario
  if (!isHealthCheck) {
    config.method = "POST";
    config.headers = {
      "Content-Type": "application/json",
    };
    config.body = JSON.stringify({
      transactions: Array(5)
        .fill(null)
        .map(() => ({ xdr: SAMPLE_XDR })),
      network: "testnet",
    });
  }

  const result = await autocannon(config);

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
    console.log(
      `Starting autocannon load tests (scenario: ${scenario})...`,
    );
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
