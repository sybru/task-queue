import type { EventEmitter } from "node:events";
import type { Task } from "./Task";

import type { eventName } from "./eventNames";

class BrowserEmitterEvent extends Event {
  #task: Task;
  #error: unknown;
  constructor(type: string, task: Task, error?: unknown, eventInitDict?: EventInit) {
    super(type, eventInitDict);
    this.#task = task;
    this.#error = error;
  }
  get task() {
    return this.#task;
  }
  get error() {
    return this.#error;
  }
}

export type Listener = (task: Task, error?: unknown) => void;
type WebEventListener = (event: Event | BrowserEmitterEvent) => void;

export abstract class EmitterBase {
  #emitter: EventTarget | EventEmitter;
  constructor(emitter: EventTarget | EventEmitter) {
    this.#emitter = emitter;
  }

  #webListeners: Record<string, Listener[]> = {};
  #webEventListeners: Record<string, WebEventListener> = {};
  #registerWebListener(eventName: string, listener: Listener): [eventName: string, listener: WebEventListener] {
    if (!(eventName in this.#webEventListeners)) {
      Object.defineProperty(this.#webEventListeners, eventName, {
        value: (event: Event | BrowserEmitterEvent) => {
          if (!(event instanceof BrowserEmitterEvent)) {
            throw new Error("");
          }

          for (const __listener of Object.values(this.#webListeners[eventName])) {
            __listener(event.task, event.error);
          }
        },
        enumerable: true,
      });
    }
    if (!(eventName in this.#webListeners)) {
      Object.defineProperty(this.#webListeners, eventName, {
        value: [],
        enumerable: true,
      });
    }
    this.#webListeners[eventName].push(listener);
    return [eventName, this.#webEventListeners[eventName]];
  }

  addEventListener(event: string, listener: Listener) {
    if (this.#emitter instanceof EventTarget) {
      this.#emitter.addEventListener(...this.#registerWebListener(event, listener));
      return;
    }
    this.#emitter.addListener(event, listener);
  }

  removeEventListener(event: string, listener: Listener) {
    if (this.#emitter instanceof EventTarget) {
      this.#webListeners[event] = this.#webListeners[event].filter((__listener) => __listener !== listener);
      return;
    }
    this.#emitter.removeListener(event, listener);
  }

  dispatchEvent(event: (typeof eventName)[keyof typeof eventName], task: Task, error?: unknown): void;

  dispatchEvent(eventName: string, task: Task, error?: unknown) {
    if (this.#emitter instanceof EventTarget) {
      const event = new BrowserEmitterEvent(eventName, task, error);
      this.#emitter.dispatchEvent(event);
      return;
    }
    this.#emitter.emit(eventName, task, error);
  }
}
