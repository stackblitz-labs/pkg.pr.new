// https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Always set to true when GitHub Actions is running the workflow. You can use this variable to differentiate when tests are being run locally or by GitHub Actions.
      GITHUB_ACTIONS?: "true";
      //       The short ref name of the branch or tag that triggered the workflow run. This value matches the branch or tag name shown on GitHub. For example, feature-branch-1.
      // For pull requests, the format is <pr_number>/merge.
      GITHUB_REF_NAME: string;
            // The name of the base ref or target branch of the pull request in a workflow run. This is only set when the event that triggers a workflow run is either pull_request or pull_request_target. For example, main.
      GITHUB_BASE_REF: string
      // The head ref or source branch of the pull request in a workflow run. This property is only set when the event that triggers a workflow run is either pull_request or pull_request_target. For example, feature-branch-1.
      GITHUB_HEAD_REF: string
      // The owner and repository name. For example, octocat/Hello-World.
      GITHUB_REPOSITORY: string
      // The commit SHA that triggered the workflow. The value of this commit SHA depends on the event that triggered the workflow. For more information, see "Events that trigger workflows." For example, ffac537e6cbbf934b08745a378932722df287a53.
      GITHUB_SHA: string
      // The name of the person or app that initiated the workflow. For example, octocat.
      GITHUB_ACTOR: string
      // The path to the file on the runner that contains the full event webhook payload. For example, /github/workflow/event.json.
      GITHUB_EVENT_PATH: string
    }
  }
}

export {};
