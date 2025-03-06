import { EmitterBase } from "../emitter";

export class Emitter extends EmitterBase {
  constructor() {
    super(new EventTarget());
  }
}
