# Github Actions

A Github Action is a series of bash commands that runs on some trigger. The
Actions are described using YAML. We use Actions to manage our CI, testing,
linting -- basically all of the little robots that we want to run over our code
whenever we change something. Actions are meant to make our deployment
processes more legible and more robust by removing/automating tedious
deployment BS.

## Anatomy of a Github Action script

The full docs are at https://docs.github.com/en/actions. Below, we list a VERY
ABBREVIATED summary that is meant to help you make sense of what our scripts
currently do. This guide should help you get started with copy pasting other
scripts and making slight modifications, but note that Github Actions are
fairly powerful and can be configured to do much more than this summary
suggests.

The basic structure is as follows:

- Name your script
- Describe how the script triggers using the `on` syntax. Common options
  include `on: pull_request`, which triggers on a PR, and
  `on: workflow_dispatch`, which triggers manually.
- Define a job. The job name can be arbitrary, but must be unique within the
  workflow.
- List the base docker image the job should run on. Generally `ubuntu-latest`.
- List steps. Each step can either by a prepackaged Github Action from the
  [marketplace](https://github.com/marketplace?type=actions), or is a series of
  bash commands.
- Generally, the first step is to clone the repo using the
  `actions/checkout@v4` Github Action. Note that this only fetches the ref that
  the workflow is executing on, and not the rest of the history/branches.
- Generally, we also want to set up node or python or some other thing. For
  example, we can setup node using the `actions/setup-node@v4` Github Action.
  Check [here](https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners#supported-software)
  for a complete list of pre-installed software.
- Bash scripts can be run in a step using the `run: <script>` command. Bash
  scripts are run in the same directory as the cloned checkout, which allows us
  to run common npm commands from our `package.json`.

The full schema documentation can be found at https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions.

## Our Workflows

### ci.yaml

The main CI workflow that runs on every push to main and on every pull request.

**Triggers:**
- `push` to `main` branch
- `pull_request` targeting `main` branch

**Steps:**
1. Checkout code
2. Setup Node.js using version from `.nvmrc` file
3. Install dependencies with `npm ci`
4. Run linter with `npm run lint`
5. Run tests with `npm test`
6. Build package with `npm run build`

This workflow ensures that all code merged to main passes linting, tests, and builds successfully.
