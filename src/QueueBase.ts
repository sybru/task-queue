import { Task } from "./Task";
import type { Crypto, Status, TaskExecute, TaskIdStore, TaskNameStore, TaskResultStore, TaskStatusStore, UUID } from "./Task";
import type { Listener } from "./emitter";
import { eventName } from "./eventNames";
import type { Emitter as NodeEmitter } from "./node/Emitter";
import type { Emitter as BrowserEmitter } from "./web/Emitter";

type TaskParams<T = unknown> = {
  name?: string;
  /**
   * Function to be executed when it is the turn of a task.\
   * The return value of this function or an error object is stored in the `result` property of the task.
   */
  execute: TaskExecute<T>;
};

export type TaskExecutorStore = WeakMap<Task, TaskExecute>;
export type TaskRetryCountStore = WeakMap<Task, number>;
export type TaskErrorsStore = WeakMap<Task, Error[]>;
export type TaskResultResolversStore = WeakMap<Task, TaskResultResolvers>;

if (typeof Promise.withResolvers === "undefined") {
  Promise.withResolvers = <T>() => {
    let resolve: (value: T | PromiseLike<T>) => void;
    let reject: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    return { promise, resolve: resolve!, reject: reject! };
  };
}

type TaskResultResolvers = Pick<ReturnType<typeof Promise.withResolvers>, "resolve" | "reject">;

export type QueueOptions = {
  concurrentTasks?: number;
  maxRetryOnError?: number;
};

export class QueueBase<Emitter extends BrowserEmitter | NodeEmitter> {
  #crypto: Crypto;
  #taskIdStore: TaskIdStore = new WeakMap<Task, UUID>();
  #taskNameStore: TaskNameStore = new WeakMap<Task<unknown>, string>();
  #taskStatusStore: TaskStatusStore = new WeakMap<Task<unknown>, Status>();
  #taskExecuteStore: TaskExecutorStore = new WeakMap<Task, TaskExecute>();
  #taskRetryCountStore: TaskRetryCountStore = new WeakMap<Task, number>();
  #taskErrorsStore: TaskErrorsStore = new WeakMap<Task, Error[]>();
  #taskResultResolversStore: TaskResultResolversStore = new WeakMap<Task, TaskResultResolvers>();
  #emitter: Emitter;
  tasks: Task[] = [];
  #timer: number | NodeJS.Timeout = -1;
  #pause = false;
  concurrentTasks: number;
  maxRetryOnError: number;

  constructor(crypto: Crypto, emitter: Emitter, options?: QueueOptions) {
    this.#crypto = crypto;
    this.#emitter = emitter;
    this.concurrentTasks = options?.concurrentTasks ?? 1;
    this.maxRetryOnError = options?.maxRetryOnError ?? 1;
  }

  get #acceptsOrToRetry() {
    return this.tasks.filter(({ status }) => status === "accepted" || status === "to-retry");
  }

  start() {
    clearInterval(this.#timer);
    let wait = false;
    this.#timer = setInterval(() => {
      if (this.#pause || wait) {
        return;
      }
      const concurrents = this.#acceptsOrToRetry.slice(0, this.concurrentTasks);
      if (concurrents.length === 0) {
        return;
      }
      wait = true;
      const concurrentTasks = concurrents.map((accept) => {
        const id = this.#taskIdStore.get(accept);
        const executor = this.#taskExecuteStore.get(accept);
        const resolvers = this.#taskResultResolversStore.get(accept);
        if (!id || !executor || !resolvers) {
          throw new Error("");
        }
        this.#taskStatusStore.set(accept, "performed");
        this.#emitter.dispatchEvent(eventName.dequeue, accept);
        return Promise.resolve(executor(id))
          .then((result) => {
            this.#taskStatusStore.set(accept, "fulfilled");
            resolvers.resolve(result);
            this.#emitter.dispatchEvent(eventName.fulfilled, accept);
          })
          .catch((error) => {
            const errors = this.#taskErrorsStore.get(accept) ?? [];
            this.#taskErrorsStore.set(accept, [...errors, error]);
            const retryCount = this.#taskRetryCountStore.get(accept) ?? 0;
            if (retryCount < this.maxRetryOnError) {
              this.#taskRetryCountStore.set(accept, retryCount + 1);
              this.#taskStatusStore.set(accept, "to-retry");
              this.#emitter.dispatchEvent(eventName.retry, accept, error);
              return;
            }
            const aggregateErrors = this.#taskErrorsStore.get(accept) ?? [];
            this.#taskStatusStore.set(accept, "rejected");
            resolvers.reject(new AggregateError(aggregateErrors));
            this.#emitter.dispatchEvent(eventName.rejected, accept);
          });
      });
      Promise.all(concurrentTasks).finally(() => {
        wait = false;
      });
    });
    this.#pause = false;
  }

  pause() {
    this.#pause = true;
  }

  resume() {
    this.#pause = false;
  }

  clear() {
    this.tasks = [];
  }

  stop() {
    clearInterval(this.#timer);
    this.clear();
  }

  enqueue<T = unknown>({ name, execute }: TaskParams<T>) {
    const { promise, resolve, reject } = Promise.withResolvers<T>();
    const task = new Task<T>(this.#taskIdStore, this.#taskNameStore, this.#taskStatusStore, promise);
    this.#taskIdStore.set(task, this.#crypto.randomUUID());
    this.#taskNameStore.set(task, name);
    this.#taskStatusStore.set(task, "accepted");
    this.#taskExecuteStore.set(task, execute);
    this.#taskRetryCountStore.set(task, 0);
    // @ts-ignore
    this.#taskResultResolversStore.set(task, { resolve, reject });
    this.tasks.push(task);
    this.#emitter.dispatchEvent(eventName.enqueue, task);
    return task;
  }

  pauseTask(task: Task) {
    this.#taskStatusStore.set(task, "pause");
    this.#emitter.dispatchEvent(eventName.pause, task);
  }
  resumeTask(task: Task) {
    this.#taskStatusStore.set(task, "performed");
    this.#emitter.dispatchEvent(eventName.resume, task);
  }

  addEventListener(event: (typeof eventName)[keyof typeof eventName], listener: Listener): void;
  addEventListener(event: "retry", listener: Listener): void;
  addEventListener(event: (typeof eventName)[keyof typeof eventName], listener: Listener) {
    this.#emitter.addEventListener(event, listener);
  }

  removeEventListener(event: (typeof eventName)[keyof typeof eventName], listener: Listener) {
    this.#emitter.removeEventListener(event, listener);
  }
}
