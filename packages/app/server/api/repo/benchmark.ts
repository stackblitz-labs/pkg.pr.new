import { useOctokitApp } from "../../utils/octokit";

export default defineEventHandler(async (event) => {
  const signal = toWebRequest(event).signal;
  const app = useOctokitApp(event, { ignoreBaseUrl: true });

  let repoCount = 0;
  const start = Date.now();

  await app.eachRepository(async ({ repository }) => {
    if (signal.aborted) return;
    if (repository.private) return;
    repoCount++;
  });

  const elapsed = Date.now() - start;
  return { repoCount, elapsed };
});
