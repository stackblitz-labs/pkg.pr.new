import { DurableObjectState } from "@cloudflare/workers-types";
import type { Env } from "nitro-cloudflare-dev";

export class Workflows {
  constructor(state: DurableObjectState, env: Env) {}

  async fetch(request: Request) {
    return new Response("Hello World");
  }
}
