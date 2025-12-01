import type { H3Event } from "h3";
import type { components as OctokitComponents } from "@octokit/openapi-types";
import type { Comment, PackageManager } from "@pkg-pr-new/utils";
import type { WorkflowData } from "../types";
import { isPullRequest, isWhitelisted } from "@pkg-pr-new/utils";
import { randomUUID } from "uncrypto";
import { setItemStream, useTemplatesBucket } from "../utils/bucket";
import { useOctokitInstallation } from "../utils/octokit";
import { generateTemplateHtml } from "../utils/template";
import { joinKeys } from "unstorage";

// Helper to check if error is a known error from createError
function isKnownError(error: unknown): error is { statusCode: number } {
  return error != null && typeof error === "object" && "statusCode" in error;
}

export default eventHandler(async (event) => {
  try {
    const origin = getRequestURL(event).origin;
    const {
      "sb-run-id": runIdHeader,
      "sb-key": key,
      "sb-shasums": shasumsHeader,
      "sb-comment": commentHeader,
      "sb-compact": compactHeader,
      "sb-bin": binHeader,
      "sb-package-manager": packageManagerHeader,
      "sb-only-templates": onlyTemplatesHeader,
    } = getHeaders(event);
    const compact = compactHeader === "true";
    const onlyTemplates = onlyTemplatesHeader === "true";
    const comment: Comment = (commentHeader ?? "update") as Comment;
    const bin = binHeader === "true";
    const packageManager: PackageManager =
      (packageManagerHeader as PackageManager) || "npm";

    if (!key || !runIdHeader || !shasumsHeader) {
      throw createError({
        statusCode: 400,
        message:
          "sb-commit-timestamp, sb-key and sb-shasums headers are required",
      });
    }
    const runId = Number(runIdHeader);
    const workflowsBucket = useWorkflowsBucket(event);
    const debugBucket = useDebugBucket(event);
    const workflowData = await workflowsBucket.getItem(key);
    const webhookDebugData = await debugBucket.getItem(key);

    if (!workflowData) {
      throw createError({
        statusCode: 404,
        fatal: true,
        message: `There is no workflow defined for ${key}`,
      });
    }

    const whitelisted = await isWhitelisted(
      workflowData.owner,
      workflowData.repo,
    );
    const contentLength = Number(getHeader(event, "content-length"));

    // 20mb limit for now
    if (!whitelisted && contentLength > 1024 * 1024 * 20) {
      // Payload too large
      throw createError({
        statusCode: 413,
        message:
          "Max payload limit is 20mb! Feel free to apply for the whitelist: https://github.com/stackblitz-labs/pkg.pr.new/blob/main/.whitelist",
      });
    }

    const shasums: Record<string, string> = JSON.parse(shasumsHeader);
    const formData = await readFormData(event);
    const packages = [...formData.keys()].filter((k) => k.startsWith("package:"));
    const packagesWithoutPrefix = packages.map((p) => p.slice("package:".length));
    const templateAssets = [...formData.keys()].filter((k) =>
      k.startsWith("template:"),
    );

    if (packages.length === 0) {
      throw createError({
        statusCode: 400,
        message: "No packages",
      });
    }

    const { appId } = useRuntimeConfig(event);
    const cursorBucket = useCursorsBucket(event);

    if (!(await workflowsBucket.hasItem(key))) {
      throw createError({
        statusCode: 401,
        message:
          "Try publishing from a github workflow! Also make sure you install https://github.com/apps/pkg-pr-new GitHub app on the repo",
      });
    }

    const baseKey = `${workflowData.owner}:${workflowData.repo}`;

    const cursorKey = `${baseKey}:${workflowData.ref}`;

    const currentCursor = await cursorBucket.getItem(cursorKey);

    let lastPackageKey: string;
    await Promise.all(
      packages.map((packageNameWithPrefix, i) => {
        const packageName = packageNameWithPrefix.slice("package:".length);
        const packageKey = `${baseKey}:${workflowData.sha}:${packageName}`;

        const file = formData.get(packageNameWithPrefix)!;
        if (file instanceof File) {
          lastPackageKey =
            i === packages.length - 1
              ? joinKeys(usePackagesBucket.base, packageKey)
              : lastPackageKey;

          const stream = file.stream();
          return setItemStream(
            event,
            usePackagesBucket.base,
            packageKey,
            stream,
            {
              sha1: shasums[packageName],
            },
          );
        }
        return null;
      }),
    );

    const templatesMap = new Map<string, Record<string, string>>();

    let lastTemplateKey: string;
    await Promise.all(
      templateAssets.map((templateAssetWithPrefix, i) => {
        const file = formData.get(templateAssetWithPrefix)!;
        const [template, encodedTemplateAsset] = templateAssetWithPrefix
          .slice("template:".length)
          .split(":");
        const templateAsset = decodeURIComponent(encodedTemplateAsset);

        const isBinary = !(typeof file === "string");
        const uuid = randomUUID();

        templatesMap.set(template, {
          ...templatesMap.get(template),
          [templateAsset]: isBinary
            ? new URL(`/template/${uuid}`, origin).href
            : file,
        });

        if (isBinary) {
          lastTemplateKey =
            i === templateAssets.length - 1
              ? joinKeys(useTemplatesBucket.base, uuid)
              : lastTemplateKey;

          const stream = file.stream();
          return setItemStream(event, useTemplatesBucket.base, uuid, stream);
        }
        return null;
      }),
    );

    const templatesBucket = useTemplatesBucket(event);

    const textEncoder = new TextEncoder();
    const templatesHtmlMap: Record<string, string> = {};

    for (const [template, files] of templatesMap) {
      const html = generateTemplateHtml(template, files);
      const uuid = randomUUID();
      await templatesBucket.setItemRaw(uuid, textEncoder.encode(html));
      templatesHtmlMap[template] = new URL(`/template/${uuid}`, origin).href;
    }

    if (!currentCursor || currentCursor.timestamp < runId) {
      await cursorBucket.setItem(cursorKey, {
        sha: workflowData.sha,
        timestamp: runId,
      });
    }

    await workflowsBucket.removeItem(key);

    const urls = packagesWithoutPrefix.map((packageName) =>
      generatePublishUrl("sha", origin, packageName, workflowData, compact),
    );

    const installation = await useOctokitInstallation(
      event,
      workflowData.owner,
      workflowData.repo,
    );

    const checkName = "Continuous Releases";
    const {
      data: { check_runs },
    } = await installation.request(
      "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
      {
        check_name: checkName,
        owner: workflowData.owner,
        repo: workflowData.repo,
        ref: workflowData.sha,
        app_id: Number(appId),
      },
    );

    let checkRunUrl = check_runs[0]?.html_url ?? "";

    if (check_runs.length === 0) {
      const {
        data: { html_url },
      } = await installation.request("POST /repos/{owner}/{repo}/check-runs", {
        name: checkName,
        owner: workflowData.owner,
        repo: workflowData.repo,
        head_sha: workflowData.sha,
        output: {
          title: "Successful",
          summary: "Published successfully.",
          text: generateCommitPublishMessage(
            origin,
            templatesHtmlMap,
            packagesWithoutPrefix,
            workflowData,
            compact,
            packageManager,
            bin,
          ),
        },
        conclusion: "success",
      });
      checkRunUrl = html_url!;
    }

    if (
      isPullRequest(workflowData.ref) &&
      (await getPullRequestState(installation, workflowData)) === "open"
    ) {
      let prevComment: OctokitComponents["schemas"]["issue-comment"];

      await installation.paginate(
        "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
        {
          owner: workflowData.owner,
          repo: workflowData.repo,
          issue_number: Number(workflowData.ref),
        },
        ({ data }, done) => {
          for (const c of data) {
            if (c.performed_via_github_app?.id === Number(appId)) {
              prevComment = c;
              done();
              break;
            }
          }
          return [];
        },
      );

      if (comment !== "off") {
        const {
          data: { permissions },
        } = await installation.request("GET /repos/{owner}/{repo}/installation", {
          owner: workflowData.owner,
          repo: workflowData.repo,
        });

        try {
          if (comment === "update" && prevComment!) {
            await installation.request(
              "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
              {
                owner: workflowData.owner,
                repo: workflowData.repo,
                comment_id: prevComment.id,
                body: generatePullRequestPublishMessage(
                  origin,
                  templatesHtmlMap,
                  packagesWithoutPrefix,
                  workflowData,
                  compact,
                  onlyTemplates,
                  checkRunUrl,
                  packageManager,
                  "ref",
                  bin,
                ),
              },
            );
          } else {
            await installation.request(
              "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
              {
                owner: workflowData.owner,
                repo: workflowData.repo,
                issue_number: Number(workflowData.ref),
                body: generatePullRequestPublishMessage(
                  origin,
                  templatesHtmlMap,
                  packagesWithoutPrefix,
                  workflowData,
                  compact,
                  onlyTemplates,
                  checkRunUrl,
                  packageManager,
                  comment === "update" ? "ref" : "sha",
                  bin,
                ),
              },
            );
          }
        } catch (error) {
          console.error("failed to create/update comment", error, permissions);
        }
      }
    }

    event.waitUntil(
      iterateAndDelete(event, usePackagesBucket.base, lastPackageKey!),
    );
    event.waitUntil(
      iterateAndDelete(event, useTemplatesBucket.base, lastTemplateKey!),
    );

    return {
      ok: true,
      urls,
      debug: {
        workflowData,
        key,
        runId,
        webhookDebug: webhookDebugData,
      },
    };
  } catch (error: unknown) {
    console.error("Publish route error:", error);

    // Re-throw known errors (from createError) as-is
    if (isKnownError(error)) {
      throw error;
    }

    // Return a JSON error response for unexpected errors
    const message = error instanceof Error ? error.message : "An unexpected error occurred during publishing";
    throw createError({
      statusCode: 500,
      statusMessage: "Internal Server Error",
      data: {
        error: true,
        message,
        type: "publish_error",
      },
    });
  }
});

async function getPullRequestState(
  installation: Awaited<ReturnType<typeof useOctokitInstallation>>,
  workflowData: WorkflowData,
) {
  try {
    const { data: pr } = await installation.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      {
        owner: workflowData.owner,
        repo: workflowData.repo,
        pull_number: Number(workflowData.ref),
      },
    );
    return pr.state;
  } catch (error) {
    return null;
  }
}

async function iterateAndDelete(
  event: H3Event,
  base: string,
  startAfter: string,
) {
  const binding = useBinding(event);
  const removedItems: Array<{
    key: string;
    uploaded: Date;
    downloadedAt?: Date;
  }> = [];
  const downloadedAtBucket = useDownloadedAtBucket(event);
  const today = Date.parse(new Date().toString());

  const next = await binding.list({
    prefix: base,
    limit: 1000,
    startAfter,
  });

  for (const object of next.objects) {
    const uploaded = Date.parse(object.uploaded.toString());
    const uploadedDate = new Date(uploaded);
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    if (uploadedDate <= sixMonthsAgo) {
      removedItems.push({
        key: object.key,
        uploaded: new Date(object.uploaded),
      });
      await binding.delete(object.key);
      await downloadedAtBucket.removeItem(object.key);
      return;
    }
    const downloadedAt = await downloadedAtBucket.getItem(object.key);
    if (!downloadedAt) {
      return;
    }
    const downloadedAtDate = new Date(downloadedAt);
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const uploadedDate2 = new Date(uploaded);
    if (downloadedAtDate <= oneMonthAgo && uploadedDate2 <= oneMonthAgo) {
      removedItems.push({
        key: object.key,
        uploaded: new Date(object.uploaded),
        downloadedAt: new Date(downloadedAt),
      });
      await binding.delete(object.key);
      await downloadedAtBucket.removeItem(object.key);
    }
  }
}
