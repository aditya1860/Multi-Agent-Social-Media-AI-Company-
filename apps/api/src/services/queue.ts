import cron from 'node-cron';

export interface JobDefinition {
  name: string;
  schedule: string; // cron expression
  handler: () => Promise<void>;
}

export interface IJobQueue {
  register(job: JobDefinition): void;
  start(): void;
}

export class NodeCronQueue implements IJobQueue {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  register(job: JobDefinition) {
    if (this.jobs.has(job.name)) return;
    const task = cron.schedule(job.schedule, async () => {
      try {
        await job.handler();
      } catch (err) {
        console.error(`[Job:${job.name}] Error:`, err);
      }
    }, { scheduled: false });
    this.jobs.set(job.name, task);
  }

  start() {
    for (const [name, task] of this.jobs) {
      task.start();
      console.log(`[Jobs] Started: ${name}`);
    }
  }
}

export const jobQueue = new NodeCronQueue();
