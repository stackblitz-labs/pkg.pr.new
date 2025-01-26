import { it, expect } from "vitest";
import { PackageJson } from "pkg-types";
import { createResolver } from "./catalog";

it("pnpm catalogs", () => {
  const json: PackageJson = {
    dependencies: {
      a: "catalog:",
      b: "catalog:named",
    },
    devDependencies: {
      c: "catalog:",
      d: "catalog:named",
    },
    peerDependencies: {
      e: "catalog:default",
      f: "catalog:named1",
    },
  };

  createResolver({
    catalog: {
      a: "1.0.0",
      c: "2.0.0",
      e: "3.0.0",
    },
    catalogs: {
      named: {
        b: "1.0.0",
        d: "2.0.0",
      },
      named1: {
        f: "1.0.0",
      },
    },
  })(json);
  expect(json).toMatchInlineSnapshot(`
    {
      "dependencies": {
        "a": "1.0.0",
        "b": "1.0.0",
      },
      "devDependencies": {
        "c": "2.0.0",
        "d": "2.0.0",
      },
      "peerDependencies": {
        "e": "3.0.0",
        "f": "1.0.0",
      },
    }
  `);
});
