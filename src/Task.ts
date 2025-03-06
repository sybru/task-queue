export type UUID = `${string}-${string}-${string}-${string}-${string}`;

export type Crypto = {
  randomUUID: () => UUID;
};

export type Status = "accepted" | "performed" | "pause" | "fulfilled" | "rejected" | "to-retry";
export type TaskExecute<T = unknown> = (taskId: UUID, taskName?: string) => T | Promise<T>;
export type TaskIdStore = WeakMap<Task, UUID>;
export type TaskNameStore = WeakMap<Task, string | undefined>;
export type TaskStatusStore = WeakMap<Task, Status>;
export type TaskResultStore = WeakMap<Task, unknown>;

export class Task<T = unknown> {
  #idStore: TaskIdStore;
  #nameStore: TaskNameStore;
  #statusStore: TaskStatusStore;
  #resultPromise: Promise<T>;

  constructor(idStore: TaskIdStore, nameStore: TaskNameStore, statusStore: TaskStatusStore, resultPromise: Promise<T>) {
    this.#idStore = idStore;
    this.#nameStore = nameStore;
    this.#statusStore = statusStore;
    this.#resultPromise = resultPromise;
  }
  get id() {
    return this.#idStore.get(this);
  }
  get name() {
    return this.#nameStore.get(this);
  }
  get status() {
    return this.#statusStore.get(this);
  }

  /**
   * If the status is `fulfilled`, this is the value returned from the `TaskExecutor`.\
   * If the status is `rejected`, this value is a aggregate of values thrown in the `TaskExecutor`.
   */
  result() {
    return this.#resultPromise;
  }
}
