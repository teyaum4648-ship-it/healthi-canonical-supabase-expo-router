export type ProviderRequestSchedulerOptions = {
  minimumIntervalMs: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
};

export class ProviderRequestScheduler {
  private readonly minimumIntervalMs: number;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();
  private nextRequestAt = 0;

  constructor(options: ProviderRequestSchedulerOptions) {
    this.minimumIntervalMs = Math.max(0, options.minimumIntervalMs);
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  schedule<T>(request: () => Promise<T>): Promise<T> {
    const scheduled = this.queue.then(async () => {
      const remaining = this.nextRequestAt - this.now();
      if (remaining > 0) await this.sleep(remaining);
      this.nextRequestAt = this.now() + this.minimumIntervalMs;
      return request();
    });
    this.queue = scheduled.then(() => undefined, () => undefined);
    return scheduled;
  }

  defer(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
    this.nextRequestAt = Math.max(this.nextRequestAt, this.now() + milliseconds);
  }
}

type SchedulerRuntime = typeof globalThis & {
  __healthiOpenFoodFactsProductRequestScheduler?: ProviderRequestScheduler;
};

const schedulerRuntime = globalThis as SchedulerRuntime;
export const openFoodFactsProductRequestScheduler =
  schedulerRuntime.__healthiOpenFoodFactsProductRequestScheduler
  ?? new ProviderRequestScheduler({ minimumIntervalMs: 4_100 });
schedulerRuntime.__healthiOpenFoodFactsProductRequestScheduler = openFoodFactsProductRequestScheduler;
