import { randomUUID } from "crypto";

import { SimulateResult } from "./simulator";

export interface WebhookJob {
  jobId: string;
  webhookUrl: string;
  status: "pending" | "delivered" | "failed";
}

const jobs = new Map<string, WebhookJob>();

export function createJob(webhookUrl: string): string {
  const jobId = randomUUID();
  jobs.set(jobId, { jobId, webhookUrl, status: "pending" });
  return jobId;
}

export function getJob(jobId: string): WebhookJob | undefined {
  return jobs.get(jobId);
}

export async function deliverWebhook(
  jobId: string,
  result: SimulateResult,
  retries = 3,
): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  const payload = JSON.stringify({ jobId, ...result });

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(job.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      if (res.ok) {
        job.status = "delivered";
        return;
      }
    } catch {
      // retry
    }
  }

  job.status = "failed";
}
