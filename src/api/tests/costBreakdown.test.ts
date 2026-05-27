import { jest } from "@jest/globals";
import express, { Express } from "express";
import request from "supertest";

import { errorHandler } from "../../middleware/errorHandler";
import * as feeEstimatorModule from "../../services/feeEstimator";
import router from "../routes";

// Mock dependencies
jest.mock("../../services/feeEstimator");

describe("GET /api/simulate/cost-breakdown", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", router);
    // Add error handler
    app.use(errorHandler);
    jest.clearAllMocks();
  });

  describe("Success cases", () => {
    it("should return detailed cost breakdown with all required fields", async () => {
      const mockBreakdown = {
        baseFee: "100",
        resourceFee: "50000",
        inclusionFee: "100",
        totalStroops: "50100",
        totalXlm: "0.0050100",
        breakdown: {
          cpuFee: "25000",
          memoryFee: "15000",
          readFee: "5000",
          overheadFee: "5000",
        },
      };

      jest
        .spyOn(feeEstimatorModule, "estimateFeeDetailed")
        .mockResolvedValue(mockBreakdown);

      const response = await request(app).get(
        "/api/simulate/cost-breakdown?cpuInsns=100000&memBytes=5000",
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBreakdown);
      expect(feeEstimatorModule.estimateFeeDetailed).toHaveBeenCalledWith(
        "100000",
        "5000",
        "testnet",
      );
    });

    it("should accept network parameter", async () => {
      const mockBreakdown = {
        baseFee: "100",
        resourceFee: "50000",
        inclusionFee: "100",
        totalStroops: "50100",
        totalXlm: "0.0050100",
        breakdown: {
          cpuFee: "25000",
          memoryFee: "15000",
          readFee: "5000",
          overheadFee: "5000",
        },
      };

      jest
        .spyOn(feeEstimatorModule, "estimateFeeDetailed")
        .mockResolvedValue(mockBreakdown);

      const response = await request(app).get(
        "/api/simulate/cost-breakdown?cpuInsns=100000&memBytes=5000&network=mainnet",
      );

      expect(response.status).toBe(200);
      expect(feeEstimatorModule.estimateFeeDetailed).toHaveBeenCalledWith(
        "100000",
        "5000",
        "mainnet",
      );
    });

    it("should default to testnet when network is not provided", async () => {
      const mockBreakdown = {
        baseFee: "100",
        resourceFee: "50000",
        inclusionFee: "100",
        totalStroops: "50100",
        totalXlm: "0.0050100",
        breakdown: {
          cpuFee: "25000",
          memoryFee: "15000",
          readFee: "5000",
          overheadFee: "5000",
        },
      };

      jest
        .spyOn(feeEstimatorModule, "estimateFeeDetailed")
        .mockResolvedValue(mockBreakdown);

      const response = await request(app).get(
        "/api/simulate/cost-breakdown?cpuInsns=100000&memBytes=5000",
      );

      expect(response.status).toBe(200);
      expect(feeEstimatorModule.estimateFeeDetailed).toHaveBeenCalledWith(
        "100000",
        "5000",
        "testnet",
      );
    });

    it("should handle large numbers correctly", async () => {
      const mockBreakdown = {
        baseFee: "100",
        resourceFee: "5000000",
        inclusionFee: "100",
        totalStroops: "5000100",
        totalXlm: "0.5000100",
        breakdown: {
          cpuFee: "2500000",
          memoryFee: "1500000",
          readFee: "500000",
          overheadFee: "500000",
        },
      };

      jest
        .spyOn(feeEstimatorModule, "estimateFeeDetailed")
        .mockResolvedValue(mockBreakdown);

      const response = await request(app).get(
        "/api/simulate/cost-breakdown?cpuInsns=10000000&memBytes=500000",
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBreakdown);
    });
  });

  describe("Validation errors", () => {
    it("should return 400 when cpuInsns is missing", async () => {
      const response = await request(app).get(
        "/api/simulate/cost-breakdown?memBytes=5000",
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain(
        "Missing required query parameters",
      );
    });

    it("should return 400 when memBytes is missing", async () => {
      const response = await request(app).get(
        "/api/simulate/cost-breakdown?cpuInsns=100000",
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain(
        "Missing required query parameters",
      );
    });

    it("should return 400 when both parameters are missing", async () => {
      const response = await request(app).get("/api/simulate/cost-breakdown");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should return 400 when cpuInsns is not a valid number", async () => {
      const response = await request(app).get(
        "/api/simulate/cost-breakdown?cpuInsns=abc&memBytes=5000",
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain(
        "must be non-negative integer strings",
      );
    });

    it("should return 400 when memBytes is not a valid number", async () => {
      const response = await request(app).get(
        "/api/simulate/cost-breakdown?cpuInsns=100000&memBytes=xyz",
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain(
        "must be non-negative integer strings",
      );
    });

    it("should return 400 when cpuInsns is negative", async () => {
      const response = await request(app).get(
        "/api/simulate/cost-breakdown?cpuInsns=-100&memBytes=5000",
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should return 400 when network is invalid", async () => {
      const response = await request(app).get(
        "/api/simulate/cost-breakdown?cpuInsns=100000&memBytes=5000&network=invalid",
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Invalid network");
    });

    it("should accept valid network values", async () => {
      const mockBreakdown = {
        baseFee: "100",
        resourceFee: "50000",
        inclusionFee: "100",
        totalStroops: "50100",
        totalXlm: "0.0050100",
        breakdown: {
          cpuFee: "25000",
          memoryFee: "15000",
          readFee: "5000",
          overheadFee: "5000",
        },
      };

      jest
        .spyOn(feeEstimatorModule, "estimateFeeDetailed")
        .mockResolvedValue(mockBreakdown);

      const networks = ["testnet", "mainnet", "futurenet"];

      for (const network of networks) {
        const response = await request(app).get(
          `/api/simulate/cost-breakdown?cpuInsns=100000&memBytes=5000&network=${network}`,
        );

        expect(response.status).toBe(200);
      }
    });
  });

  describe("Error handling", () => {
    it("should return 500 when fee estimation fails", async () => {
      jest
        .spyOn(feeEstimatorModule, "estimateFeeDetailed")
        .mockRejectedValue(new Error("RPC connection failed"));

      const response = await request(app).get(
        "/api/simulate/cost-breakdown?cpuInsns=100000&memBytes=5000",
      );

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("RPC connection failed");
    });

    it("should handle unexpected errors gracefully", async () => {
      jest
        .spyOn(feeEstimatorModule, "estimateFeeDetailed")
        .mockRejectedValue("Unexpected error");

      const response = await request(app).get(
        "/api/simulate/cost-breakdown?cpuInsns=100000&memBytes=5000",
      );

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("Response structure", () => {
    it("should return all required fields in the response", async () => {
      const mockBreakdown = {
        baseFee: "100",
        resourceFee: "50000",
        inclusionFee: "100",
        totalStroops: "50100",
        totalXlm: "0.0050100",
        breakdown: {
          cpuFee: "25000",
          memoryFee: "15000",
          readFee: "5000",
          overheadFee: "5000",
        },
      };

      jest
        .spyOn(feeEstimatorModule, "estimateFeeDetailed")
        .mockResolvedValue(mockBreakdown);

      const response = await request(app).get(
        "/api/simulate/cost-breakdown?cpuInsns=100000&memBytes=5000",
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("baseFee");
      expect(response.body).toHaveProperty("resourceFee");
      expect(response.body).toHaveProperty("inclusionFee");
      expect(response.body).toHaveProperty("totalStroops");
      expect(response.body).toHaveProperty("totalXlm");
      expect(response.body).toHaveProperty("breakdown");
      expect(response.body.breakdown).toHaveProperty("cpuFee");
      expect(response.body.breakdown).toHaveProperty("memoryFee");
      expect(response.body.breakdown).toHaveProperty("readFee");
      expect(response.body.breakdown).toHaveProperty("overheadFee");
    });
  });
});
