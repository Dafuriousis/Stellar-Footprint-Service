import { createJob, getJob, InvalidWebhookUrlError } from "../webhook";

describe("webhook service", () => {
  it("creates a job for a valid HTTPS webhook URL", () => {
    const jobId = createJob("https://example.com/webhook");

    expect(typeof jobId).toBe("string");
    const job = getJob(jobId);
    expect(job).toBeDefined();
    expect(job?.webhookUrl).toBe("https://example.com/webhook");
    expect(job?.status).toBe("pending");
  });

  it("rejects non-HTTPS webhook URLs", () => {
    expect(() => createJob("http://example.com/webhook")).toThrow(
      InvalidWebhookUrlError,
    );
  });

  it("rejects invalid webhook URLs", () => {
    expect(() => createJob("not-a-url")).toThrow(InvalidWebhookUrlError);
  });

  it("rejects HTTPS URLs with embedded credentials", () => {
    expect(() => createJob("https://user:secret@example.com/webhook")).toThrow(
      InvalidWebhookUrlError,
    );
  });
});
