import {
  it,
  describe,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from "vitest";
import type { PackageManifest } from "query-registry";
import * as utils from "./index.js";

describe("utils", () => {
  describe("extractOwnerAndRepo", () => {
    it("is null for URLs with trailing characters", () => {
      expect(
        utils.extractOwnerAndRepo("https://github.com/org/repo.gitpewpew"),
      ).toBeNull();
    });

    it("is null for URLs with leading characters", () => {
      expect(
        utils.extractOwnerAndRepo("pewpewhttps://github.com/org/repo.git"),
      ).toBeNull();
    });

    it("returns org and repo for valid https URLs", () => {
      expect(
        utils.extractOwnerAndRepo("http://github.com/org/repo.git"),
      ).toEqual(["org", "repo"]);
    });

    it("returns org and repo for valid http URLs", () => {
      expect(
        utils.extractOwnerAndRepo("https://github.com/org/repo.git"),
      ).toEqual(["org", "repo"]);
    });

    it("returns org and repo for valid git+https URLs", () => {
      expect(
        utils.extractOwnerAndRepo("git+https://github.com/org/repo.git"),
      ).toEqual(["org", "repo"]);
    });

    it("returns org and repo for valid git+http URLs", () => {
      expect(
        utils.extractOwnerAndRepo("git+http://github.com/org/repo.git"),
      ).toEqual(["org", "repo"]);
    });
  });

  describe("extractRepository", () => {
    it("returns undefined if no repository", () => {
      expect(utils.extractRepository({} as PackageManifest)).toBeUndefined();
    });

    it("returns undefined if repository is object with no URL", () => {
      expect(
        utils.extractRepository({
          repository: {},
        } as PackageManifest),
      ).toBeUndefined();
    });

    it("returns URL if repository is string", () => {
      expect(
        utils.extractRepository({
          repository: "foo",
        } as PackageManifest),
      ).toBe("foo");
    });

    it("returns URL if repository is object with URL", () => {
      expect(
        utils.extractRepository({
          repository: {
            url: "foo",
          },
        } as PackageManifest),
      ).toBe("foo");
    });
  });

  describe("abbreviateCommitHash", () => {
    it("returns the first 7 characters of a hash", () => {
      expect(
        utils.abbreviateCommitHash("09efd0553374ff7d3e62b79378e3184f5eb57571"),
      ).toBe("09efd05");
    });
  });

  describe("isPullRequest", () => {
    it("returns true if ref is non-nan number", () => {
      expect(utils.isPullRequest("808")).toBe(true);
    });

    it("returns false if ref is nan number", () => {
      expect(utils.isPullRequest("foo")).toBe(false);
    });
  });

  describe("isWhitelisted", () => {
    let fetchSpy: MockInstance;
    let whitelist: string;

    beforeEach(() => {
      whitelist = "";
      fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
        return Promise.resolve(new Response(whitelist, { status: 200 }));
      });
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it("should return true if repo is in whitelist", async () => {
      whitelist = `
        foo/bar
        org/repo
        baz/zab
      `;
      const result = await utils.isWhitelisted("org", "repo");
      expect(result).toBe(true);
    });

    it("should return false if repo is not in whitelist", async () => {
      const result = await utils.isWhitelisted("org", "repo");
      expect(result).toBe(false);
    });

    it("should return false if fetch fails", async () => {
      fetchSpy.mockRejectedValue(new Error("bleep bloop"));
      const result = await utils.isWhitelisted("org", "repo");
      expect(result).toBe(false);
    });
  });
});
