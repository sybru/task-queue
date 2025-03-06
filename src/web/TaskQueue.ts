import { QueueBase, type QueueOptions } from "../QueueBase";
import { Task } from "../Task";
import { Emitter } from "./Emitter";

export { Task };

export class TaskQueue extends QueueBase<Emitter> {
  constructor(options?: QueueOptions) {
    super(crypto, new Emitter(), options);
  }
}
