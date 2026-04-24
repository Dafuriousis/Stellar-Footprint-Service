import * as http from "http";

/**
 * Response type for mock RPC server
 */
export type MockResponseType = "success" | "error" | "restore";

/**
 * Configuration for mock RPC responses
 */
export interface MockRpcConfig {
  responseType?: MockResponseType;
  simulationError?: string;
  transactionData?: string;
  ledgerSequence?: number;
}

/**
 * Mock RPC Server instance
 */
export interface MockRpcServerInstance {
  port: number;
  url: string;
  server: http.Server;
  configure: (config: MockRpcConfig) => void;
  stop: () => Promise<void>;
}

/**
 * Default mock responses for different scenarios
 */
const DEFAULT_RESPONSES = {
  success: {
    transactionData: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    minResourceFee: "100000",
    cost: { cpuInsns: "100000", memBytes: "100000" },
    events: [],
    latestLedger: 1000,
  },
  error: {
    error: "Transaction simulation failed",
  },
  restore: {
    restorePreamble: Buffer.from("restore_preamble").toString("base64"),
    minResourceFee: "100000",
  },
};

/**
 * Create a lightweight mock Stellar RPC server for testing
 * Starts on a random port and returns configurable responses
 *
 * @returns Promise resolving to MockRpcServerInstance
 *
 * @example
 * ```typescript
 * const mockRpc = await startMockRpcServer();
 * mockRpc.configure({ responseType: "success" });
 * // Use mockRpc.url in your tests
 * await mockRpc.stop();
 * ```
 */
export async function startMockRpcServer(): Promise<MockRpcServerInstance> {
  let config: MockRpcConfig = { responseType: "success" };

  const requestHandler = (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void => {
    // Only handle POST requests
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    // Collect request body
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const jsonBody = JSON.parse(body);
        const method = jsonBody.method || "";

        // Route to appropriate handler
        if (method === "simulateTransaction") {
          handleSimulateTransaction(res, config);
        } else if (method === "getLatestLedger") {
          handleGetLatestLedger(res, config);
        } else if (method === "getLedgerEntries") {
          handleGetLedgerEntries(res, config);
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: `Unknown method: ${method}` }));
        }
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
  };

  const server = http.createServer(requestHandler);

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to get server address"));
        return;
      }

      const port = address.port;
      const url = `http://127.0.0.1:${port}`;

      resolve({
        port,
        url,
        server,
        configure: (newConfig: MockRpcConfig) => {
          config = { ...config, ...newConfig };
        },
        stop: async () => {
          return new Promise((stopResolve, stopReject) => {
            server.close((err) => {
              if (err) stopReject(err);
              else stopResolve();
            });
          });
        },
      });
    });

    server.on("error", reject);
  });
}

/**
 * Handle simulateTransaction RPC method
 */
function handleSimulateTransaction(
  res: http.ServerResponse,
  config: MockRpcConfig,
): void {
  res.writeHead(200, { "Content-Type": "application/json" });

  const responseType = config.responseType || "success";

  if (responseType === "error") {
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        result: {
          error: config.simulationError || DEFAULT_RESPONSES.error.error,
        },
        id: 1,
      }),
    );
  } else if (responseType === "restore") {
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        result: {
          restorePreamble: DEFAULT_RESPONSES.restore.restorePreamble,
          minResourceFee: DEFAULT_RESPONSES.restore.minResourceFee,
        },
        id: 1,
      }),
    );
  } else {
    // success response
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        result: {
          transactionData:
            config.transactionData || DEFAULT_RESPONSES.success.transactionData,
          minResourceFee: DEFAULT_RESPONSES.success.minResourceFee,
          cost: DEFAULT_RESPONSES.success.cost,
          events: DEFAULT_RESPONSES.success.events,
          latestLedger:
            config.ledgerSequence || DEFAULT_RESPONSES.success.latestLedger,
        },
        id: 1,
      }),
    );
  }
}

/**
 * Handle getLatestLedger RPC method
 */
function handleGetLatestLedger(
  res: http.ServerResponse,
  config: MockRpcConfig,
): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      result: {
        sequence:
          config.ledgerSequence || DEFAULT_RESPONSES.success.latestLedger,
        protocolVersion: 21,
        sorobanLedgerSequence:
          config.ledgerSequence || DEFAULT_RESPONSES.success.latestLedger,
      },
      id: 1,
    }),
  );
}

/**
 * Handle getLedgerEntries RPC method
 */
function handleGetLedgerEntries(
  res: http.ServerResponse,
  config: MockRpcConfig,
): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      result: {
        entries: [],
        latestLedger:
          config.ledgerSequence || DEFAULT_RESPONSES.success.latestLedger,
      },
      id: 1,
    }),
  );
}
