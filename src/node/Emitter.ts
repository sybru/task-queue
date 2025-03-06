import { EventEmitter } from "node:events";
import { EmitterBase } from "../emitter";

export class Emitter extends EmitterBase {
  constructor() {
    super(new EventEmitter());
  }
}
