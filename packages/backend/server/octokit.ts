// The MIT License

// Copyright (c) 2018 Octokit contributors

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// @octokit/app does not work in cloudflare workers in the latest versions

import { Octokit as OctokitCore } from "@octokit/core";
import { createAppAuth } from "@octokit/auth-app";
import { OAuthApp } from "@octokit/oauth-app";
import { Webhooks, type EmitterWebhookEvent } from "@octokit/webhooks";

import type { Octokit } from "@octokit/core";
import { createUnauthenticatedAuth } from "@octokit/auth-unauthenticated";

// https://github.com/octokit/app.js/blob/main/src/types.ts
import type { Endpoints } from "@octokit/types";

type Constructor<T> = new (...args: any[]) => T;

type OctokitType<TOptions extends Options> =
  TOptions["Octokit"] extends typeof OctokitCore
    ? InstanceType<TOptions["Octokit"]>
    : OctokitCore;

type OctokitClassType<TOptions extends Options> =
  TOptions["Octokit"] extends typeof OctokitCore
    ? TOptions["Octokit"]
    : typeof OctokitCore;

export class App<TOptions extends Options = Options> {
  static defaults<
    TDefaults extends Options,
    S extends Constructor<App<TDefaults>>,
  >(this: S, defaults: Partial<TDefaults>) {
    const AppWithDefaults = class extends this {
      constructor(...args: any[]) {
        super({
          ...defaults,
          ...args[0],
        });
      }
    };

    return AppWithDefaults as typeof AppWithDefaults & typeof this;
  }

  octokit: OctokitType<TOptions>;
  // @ts-ignore calling app.webhooks will throw a helpful error when options.webhooks is not set
  webhooks: Webhooks<{ octokit: OctokitType<TOptions> }>;
  // @ts-ignore calling app.oauth will throw a helpful error when options.oauth is not set
  oauth: OAuthApp<{
    clientType: "github-app";
    Octokit: OctokitClassType<TOptions>;
  }>;

  log: {
    debug: (message: string, additionalInfo?: object) => void;
    info: (message: string, additionalInfo?: object) => void;
    warn: (message: string, additionalInfo?: object) => void;
    error: (message: string, additionalInfo?: object) => void;
    [key: string]: unknown;
  };

  constructor(options: ConstructorOptions<TOptions>) {
    const Octokit = (options.Octokit ||
      OctokitCore) as OctokitClassType<TOptions>;

    const authOptions = Object.assign(
      {
        appId: options.appId,
        privateKey: options.privateKey,
      },
      options.oauth
        ? {
            clientId: options.oauth.clientId,
            clientSecret: options.oauth.clientSecret,
          }
        : {},
    );

    this.octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: authOptions,
      log: options.log,
    }) as OctokitType<TOptions>;

    this.log = Object.assign(
      {
        debug: () => {},
        info: () => {},
        warn: console.warn.bind(console),
        error: console.error.bind(console),
      },
      options.log,
    );

    // set app.webhooks depending on whether "webhooks" option has been passed
    if (options.webhooks) {
      // @ts-expect-error TODO: figure this out
      this.webhooks = webhooks(this.octokit, options.webhooks);
    } else {
      Object.defineProperty(this, "webhooks", {
        get() {
          throw new Error("[@octokit/app] webhooks option not set");
        },
      });
    }

    // set app.oauth depending on whether "oauth" option has been passed
    if (options.oauth) {
      this.oauth = new OAuthApp({
        ...options.oauth,
        clientType: "github-app",
        Octokit,
      });
    } else {
      Object.defineProperty(this, "oauth", {
        get() {
          throw new Error(
            "[@octokit/app] oauth.clientId / oauth.clientSecret options are not set",
          );
        },
      });
    }
  }
}

export function webhooks(
  appOctokit: Octokit,
  options: Required<Options>["webhooks"],
  // Explicit return type for better debugability and performance,
  // see https://github.com/octokit/app.js/pull/201
): Webhooks<EmitterWebhookEvent & { octokit: Octokit }> {
  return new Webhooks({
    secret: options.secret,
    transform: async (event) => {
      if (
        !("installation" in event.payload) ||
        typeof event.payload.installation !== "object"
      ) {
        const octokit = new (appOctokit.constructor as typeof Octokit)({
          authStrategy: createUnauthenticatedAuth,
          auth: {
            reason: `"installation" key missing in webhook event payload`,
          },
        });

        return {
          ...event,
          octokit,
        };
      }

      const installationId = event.payload.installation.id;
      const octokit = (await appOctokit.auth({
        type: "installation",
        installationId,
        factory(auth: any) {
          return new auth.octokit.constructor({
            ...auth.octokitOptions,
            authStrategy: createAppAuth,
            
              auth: {
                ...auth,
                installationId,
              }
            ,
          });
        },
      })) as Octokit;

      // set `x-github-delivery` header on all requests sent in response to the current
      // event. This allows GitHub Support to correlate the request with the event.
      // This is not documented and not considered public API, the header may change.
      // Once we document this as best practice on https://docs.github.com/en/rest/guides/best-practices-for-integrators
      // we will make it official
      /* istanbul ignore next */
      octokit.hook.before("request", (options) => {
        options.headers["x-github-delivery"] = event.id;
      });

      return {
        ...event,
        octokit,
      };
    },
  });
}

export type Options = {
  appId?: number | string;
  privateKey?: string;
  webhooks?: {
    secret: string;
  };
  oauth?: {
    clientId: string;
    clientSecret: string;
    allowSignup?: boolean;
  };
  Octokit?: typeof Octokit;
  log?: {
    debug: (...data: any[]) => void;
    info: (...data: any[]) => void;
    warn: (...data: any[]) => void;
    error: (...data: any[]) => void;
  };
};

// workaround for https://github.com/octokit/app.js/pull/227
// we cannot make appId & privateKey required on Options because
// it would break inheritance of the Octokit option set via App.defaults({ Octokit })
export type ConstructorOptions<TOptions extends Options> = TOptions & {
  appId: number | string;
  privateKey: string;
};

export type InstallationFunctionOptions<O> = {
  octokit: O;
  installation: Endpoints["GET /app/installations"]["response"]["data"][0];
};
export type EachInstallationFunction<O> = (
  options: InstallationFunctionOptions<O>,
) => unknown | Promise<unknown>;

export interface EachInstallationInterface<O> {
  (callback: EachInstallationFunction<O>): Promise<void>;
  iterator: () => AsyncIterable<InstallationFunctionOptions<O>>;
}

type EachRepositoryFunctionOptions<O> = {
  octokit: O;
  repository: Endpoints["GET /installation/repositories"]["response"]["data"]["repositories"][0];
};
export type EachRepositoryFunction<O> = (
  options: EachRepositoryFunctionOptions<O>,
) => unknown | Promise<unknown>;
export type EachRepositoryQuery = {
  installationId: number;
};

export interface EachRepositoryInterface<O> {
  (callback: EachRepositoryFunction<O>): Promise<void>;
  (
    query: EachRepositoryQuery,
    callback: EachRepositoryFunction<O>,
  ): Promise<void>;
  iterator: (
    query?: EachRepositoryQuery,
  ) => AsyncIterable<EachRepositoryFunctionOptions<O>>;
}

export interface GetInstallationOctokitInterface<O> {
  (installationId: number): Promise<O>;
}
