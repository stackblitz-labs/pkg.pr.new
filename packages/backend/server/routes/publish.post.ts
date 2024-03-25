import { objectHash, sha256 } from "ohash";
import {generateCommitPublishMessage} from '../utils/markdown'

export default eventHandler(async (event) => {
  const contentLength = Number(getHeader(event, "content-length"));
  // 5mb limits for now
  if (contentLength > 1024 * 1024 * 5) {
    // Payload too large
    return new Response("Max size limit is 5mb", { status: 413 });
  }
  const key = getRequestHeader(event, "sb-key");
  const workflowsBucket = useWorkflowsBucket();
  const packagesBucket = usePackagesBucket();

  if (!(await workflowsBucket.hasItem(key))) {
    return new Response("", { status: 401 });
  }

  const binary = await readRawBody(event, false);
  const { "sb-package-name": packageName, "sb-package-version": _ } =
    getHeaders(event);

  const workflowData = await workflowsBucket.getItem(key);
  const { sha, ...hashPrefixMetadata } = workflowData;
  const metadataHash = sha256(objectHash(hashPrefixMetadata));
  const packageKey = `${metadataHash}:${sha}:${packageName}`;

  await packagesBucket.setItemRaw(packageKey, binary);

  await workflowsBucket.removeItem(key);

  const app = useOctokitApp(event);
  const origin = getRequestURL(event).origin

  app.octokit.request("POST /repos/{owner}/{repo}/check-runs", {
    name: "Stackblitz CR (Publish)",
    owner: workflowData.orgOrAuthor,
    repo: workflowData.repo,
    head_sha: sha,
    output: {
      title: 'Stackblitz CR',
      summary: 'Published successfully.',
      text: generateCommitPublishMessage(origin, packageName, workflowData)
    },
    conclusion: "success",
  });

  return { ok: true };
});
