import {
  ForgePermissionError,
  ForgeValidationError,
  assertNoPrototypePollution,
  jsonValueSchema,
  qualifyJobName,
  type JsonValue,
  type PluginId,
  type PluginJobHandle,
  type PluginJobSchedule,
  type PluginJobs,
  type PluginLogger,
  type PluginPermission,
} from "@fluxo/forge";

export const FORGE_JOB_MAX_RETRIES = 3;
export const FORGE_JOB_MIN_INTERVAL_MS = 60_000;
export const FORGE_JOB_RETRY_DELAY_MS = 50;

const JOB_NAME_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/;

export type PluginJobHandler = (payload: JsonValue | undefined) => Promise<void> | void;

export interface HostPluginJobs extends PluginJobs {
  handle(name: string, handler: PluginJobHandler): () => void;
}

export interface JobScheduler {
  handle(pluginId: PluginId, name: string, handler: PluginJobHandler): () => void;
  schedule(
    pluginId: PluginId,
    job: PluginJobSchedule,
  ): Promise<PluginJobHandle>;
  cancel(jobId: string): Promise<void>;
  stopAll(): Promise<void>;
}

export interface CreateJobSchedulerOptions {
  logger: PluginLogger;
  isPluginEnabled: (pluginId: PluginId) => boolean | Promise<boolean>;
  maxRetries?: number;
  retryDelayMs?: number;
  minIntervalMs?: number;
}

interface ScheduledJob {
  jobId: string;
  pluginId: PluginId;
  name: string;
  payload: JsonValue | undefined;
  cron: string | undefined;
  attempt: number;
  timer: ReturnType<typeof setTimeout> | undefined;
}

export function createJobScheduler(options: CreateJobSchedulerOptions): JobScheduler {
  const maxRetries = options.maxRetries ?? FORGE_JOB_MAX_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? FORGE_JOB_RETRY_DELAY_MS;
  const minIntervalMs = options.minIntervalMs ?? FORGE_JOB_MIN_INTERVAL_MS;
  const handlers = new Map<string, Set<PluginJobHandler>>();
  const jobs = new Map<string, ScheduledJob>();

  function qualified(pluginId: PluginId, name: string): string {
    return qualifyJobName(pluginId, parseJobName(name));
  }

  function clearTimer(job: ScheduledJob): void {
    if (job.timer !== undefined) {
      clearTimeout(job.timer);
      job.timer = undefined;
    }
  }

  async function run(job: ScheduledJob): Promise<void> {
    job.timer = undefined;
    const enabled = await options.isPluginEnabled(job.pluginId);
    if (!enabled) {
      return;
    }
    const set = handlers.get(qualifyJobName(job.pluginId, job.name));
    if (!set || set.size === 0) {
      return;
    }
    try {
      for (const handler of [...set]) {
        await handler(job.payload);
      }
      job.attempt = 0;
      if (job.cron) {
        arm(job, nextCronDelayMs(job.cron, minIntervalMs));
      } else {
        jobs.delete(job.jobId);
      }
    } catch (error) {
      options.logger.error("plugin job failed", {
        pluginId: job.pluginId,
        job: job.name,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      if (job.attempt >= maxRetries) {
        jobs.delete(job.jobId);
        return;
      }
      job.attempt += 1;
      arm(job, retryDelayMs * 2 ** (job.attempt - 1));
    }
  }

  function arm(job: ScheduledJob, delayMs: number): void {
    clearTimer(job);
    job.timer = setTimeout(() => {
      void run(job);
    }, Math.max(0, delayMs));
    job.timer.unref?.();
  }

  return {
    handle(pluginId, name, handler) {
      const key = qualified(pluginId, name);
      const set = handlers.get(key) ?? new Set<PluginJobHandler>();
      set.add(handler);
      handlers.set(key, set);
      return () => {
        const current = handlers.get(key);
        current?.delete(handler);
        if (current && current.size === 0) {
          handlers.delete(key);
        }
      };
    },
    async schedule(pluginId, job) {
      const name = parseJobName(job.name);
      const payload = parsePayload(job.payload);
      if (job.cron !== undefined) {
        assertCron(job.cron);
      }
      const jobId = crypto.randomUUID();
      const scheduled: ScheduledJob = {
        jobId,
        pluginId,
        name,
        payload,
        cron: job.cron,
        attempt: 0,
        timer: undefined,
      };
      jobs.set(jobId, scheduled);
      arm(scheduled, initialDelayMs(job, minIntervalMs));
      return { jobId };
    },
    async cancel(jobId) {
      const job = jobs.get(jobId);
      if (!job) {
        return;
      }
      clearTimer(job);
      jobs.delete(jobId);
    },
    async stopAll() {
      for (const job of jobs.values()) {
        clearTimer(job);
      }
      jobs.clear();
      handlers.clear();
    },
  };
}

export function createPluginJobs(options: {
  pluginId: PluginId;
  permissions: readonly PluginPermission[];
  scheduler: JobScheduler;
}): HostPluginJobs {
  const permissions = new Set(options.permissions);
  return {
    handle(name, handler) {
      if (!permissions.has("jobs.schedule")) {
        throw new ForgePermissionError("jobs.schedule");
      }
      return options.scheduler.handle(options.pluginId, name, handler);
    },
    async schedule(job) {
      if (!permissions.has("jobs.schedule")) {
        throw new ForgePermissionError("jobs.schedule");
      }
      return options.scheduler.schedule(options.pluginId, job);
    },
    async cancel(jobId) {
      if (!permissions.has("jobs.schedule")) {
        throw new ForgePermissionError("jobs.schedule");
      }
      await options.scheduler.cancel(jobId);
    },
  };
}

function parseJobName(name: string): string {
  if (!JOB_NAME_PATTERN.test(name)) {
    throw new ForgeValidationError("Invalid job name");
  }
  return name;
}

function parsePayload(payload: JsonValue | undefined): JsonValue | undefined {
  if (payload === undefined) {
    return undefined;
  }
  assertNoPrototypePollution(payload);
  const parsed = jsonValueSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ForgeValidationError("Invalid job payload");
  }
  return parsed.data;
}

function initialDelayMs(job: PluginJobSchedule, minIntervalMs: number): number {
  if (job.delayMs !== undefined) {
    if (!Number.isFinite(job.delayMs) || job.delayMs < 0) {
      throw new ForgeValidationError("Invalid job delay");
    }
    return Math.floor(job.delayMs);
  }
  if (job.runAt !== undefined) {
    const at = Date.parse(job.runAt);
    if (!Number.isFinite(at)) {
      throw new ForgeValidationError("Invalid job runAt");
    }
    return Math.max(0, at - Date.now());
  }
  if (job.cron !== undefined) {
    return nextCronDelayMs(job.cron, minIntervalMs);
  }
  return 0;
}

function assertCron(value: string): void {
  const fields = value.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new ForgeValidationError("Invalid job cron");
  }
}

function nextCronDelayMs(cron: string, minIntervalMs: number): number {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new ForgeValidationError("Invalid job cron");
  }
  const minuteField = fields[0] ?? "*";
  const parsedEvery = /^\*\/(\d+)$/.exec(minuteField);
  if (parsedEvery) {
    const minutes = Number(parsedEvery[1]);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      throw new ForgeValidationError("Invalid job cron");
    }
    return Math.max(minutes * 60_000, minIntervalMs);
  }
  if (minuteField === "*") {
    return minIntervalMs;
  }
  return minIntervalMs;
}
