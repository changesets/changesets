import { createPromiseQueue } from "./createPromiseQueue";

function asyncSpy(implementation: () => unknown = () => {}) {
  return jest.fn().mockImplementation(async () => implementation());
}

function syncSpy(implementation: () => unknown = () => {}) {
  return jest.fn().mockImplementation(() => implementation());
}

describe("createPromiseQueue", () => {
  it("should start jobs immediately before hitting the concurrency limit", () => {
    const queue = createPromiseQueue(3);

    const job1 = asyncSpy();
    const job2 = asyncSpy();
    const job3 = asyncSpy();

    queue.add(job1);
    queue.add(job2);
    queue.add(job3);

    expect(job1).toHaveBeenCalled();
    expect(job2).toHaveBeenCalled();
    expect(job3).toHaveBeenCalled();
  });

  it("should not start a job immediately after hitting the concurrency limit", () => {
    const queue = createPromiseQueue(2);

    const job1 = asyncSpy();
    const job2 = asyncSpy();
    const job3 = asyncSpy();

    queue.add(job1);
    queue.add(job2);
    queue.add(job3);

    expect(job3).not.toHaveBeenCalled();
  });

  it("should start a next job after going below the concurrency limit", async () => {
    const queue = createPromiseQueue(2);

    const job1 = asyncSpy();
    const job2 = asyncSpy();
    const job3 = asyncSpy();

    queue.add(job1);
    const queuedJob2 = queue.add(job2);
    queue.add(job3);

    expect(job3).not.toHaveBeenCalled();

    await queuedJob2;

    expect(job3).toHaveBeenCalled();
  });

  it("should resolve with the original result", async () => {
    const queue = createPromiseQueue(2);

    const job = asyncSpy(() => 42);
    const queuedJob = queue.add(job);

    await expect(queuedJob).resolves.toBe(42);
  });

  it("should reject with the original error", async () => {
    const queue = createPromiseQueue(2);
    const error = new Error("My error.");

    const job = asyncSpy(() => {
      throw error;
    });
    const queuedJob = queue.add(job);

    await expect(queuedJob).rejects.toBe(error);
  });

  it("should drain pending jobs after a rejection", async () => {
    const queue = createPromiseQueue(1);

    const job1 = asyncSpy(() => {
      throw new Error("fail");
    });
    const job2 = asyncSpy(() => "ok");

    const q1 = queue.add(job1);
    const q2 = queue.add(job2);

    await expect(q1).rejects.toThrow("fail");
    await expect(q2).resolves.toBe("ok");
  });

  it("should handle a synchronously throwing job", async () => {
    const queue = createPromiseQueue(2);
    const error = new Error("sync throw");

    const job = syncSpy(() => {
      throw error;
    });
    const queuedJob = queue.add(job);

    await expect(queuedJob).rejects.toBe(error);
  });

  it("should drain pending jobs after a synchronous throw", async () => {
    const queue = createPromiseQueue(1);

    const job1 = syncSpy(() => {
      throw new Error("sync fail");
    });
    const job2 = asyncSpy(() => "ok");

    const q1 = queue.add(job1);
    const q2 = queue.add(job2);

    await expect(q1).rejects.toThrow("sync fail");
    await expect(q2).resolves.toBe("ok");
  });

  it("setConcurrency should allow more jobs to run", async () => {
    const queue = createPromiseQueue(1);

    const job1 = asyncSpy();
    const job2 = asyncSpy();

    queue.add(job1);
    queue.add(job2);

    expect(job2).not.toHaveBeenCalled();

    queue.setConcurrency(2);

    expect(job2).toHaveBeenCalled();
  });
});
