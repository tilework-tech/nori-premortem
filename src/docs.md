# Noridoc: Daemon Core Implementation

Path: @/src

### Overview

- Implements the premortem daemon lifecycle: initialization, system monitoring, threshold detection, and agent invocation
- Manages startup validation including API key authentication, heartbeat health checks, and archive directory creation
- Handles real-time system metrics polling and agent state management during threshold breach scenarios
- Provides graceful shutdown with cleanup of long-running processes

### How it fits into the larger codebase

- **Entry point:** `cli.ts` loads config via `config.ts` and passes it to `startDaemon`
- **System monitoring:** `monitor.ts` provides `fetchSystemMetrics` and `checkThresholds` called periodically by daemon
- **Agent execution:** `agent.ts` runs Claude agent via `@anthropic-ai/claude-agent-sdk` when thresholds breach
- **External communication:** `webhook.ts` sends all agent messages to configured webhook URL immediately as they arrive
- **Health heartbeat:** `heartbeat.ts` provides optional health signals to external monitoring (separate from threshold-triggered agent)
- **Initialization pipeline:** Config is validated in `config.ts` before passing to `startDaemon` - archive dir created, API key validated at daemon startup
- **State preservation:** Agent sessions produce `agent-{sessionId}.jsonl` files saved to `archiveDir` for transcript archival even if webhook delivery fails

### Core Implementation

**Daemon Startup Sequence** (see `daemon.ts:startDaemon`):
1. Initialize daemon state (running, agentRunning, breachDetected, sessionId flags)
2. Log "Premortem daemon starting..."
3. **Validate Anthropic API key** via `apiKeyValidator.ts:validateApiKey` - makes minimal test query to verify credentials before any agent work
4. If heartbeat config present: validate endpoint reachable, then start heartbeat loop (runs independently at configured interval)
5. Start monitoring loop at configured polling interval
6. Register SIGINT/SIGTERM handlers for graceful shutdown

**Configuration Loading** (see `config.ts:loadConfig`):
- Validates required fields: webhookUrl, anthropicApiKey, thresholds
- Applies defaults: pollingInterval (10000ms), model (claude-sonnet-4), heartbeat interval (60000ms)
- **Archive directory handling:** Uses DEFAULT_ARCHIVE_DIR (`~/.premortem-logs`) if not provided, expands `~` to home directory, creates directory if missing, validates writeability by writing test file
- Returns Config object with all fields including expanded archiveDir path

**Monitoring Loop** (see `daemon.ts:monitor`):
- Fetches system metrics via `monitor.ts:fetchSystemMetrics`
- Checks thresholds via `monitor.ts:checkThresholds`
- On breach detection: generates diagnostic prompt via `agent.ts:generatePrompt`, spawns agent, sets agentRunning flag
- Agent runs non-blocking - monitoring continues while agent executes
- Agent output (messages) streamed to webhook via `webhook.ts:sendWebhook`
- On agent completion: resets state flags, awaits next breach

**API Key Validation** (see `apiKeyValidator.ts:validateApiKey`):
- Called at daemon startup, must complete before monitoring begins
- Validates key is not empty string
- Makes minimal API call using `claude-3-haiku` model with maxTurns=1 to verify authentication
- Distinguishes error types: 401 (invalid key), 503 (service unavailable), others (rethrown)
- Throws clear error messages to fail-fast on invalid credentials

**Message Routing** (see `daemon.ts:monitor > onMessage callback`):
- First message with session_id extracted to state for tracking
- System vitals message sent to webhook with breach context
- All subsequent agent messages sent immediately to webhook URL as they arrive
- Agent archiving happens via `agent.ts:runAgent` passing archiveDir to SDK's cwd option - SDK handles JSONL file writing

### Things to Know

- **Fail-fast principle:** API key validation happens at startup (not when agent runs), archive directory must be writable before daemon starts - invalid configuration fails immediately with clear errors rather than discovering problems during threshold breaches
- **State management:** Daemon maintains single DaemonState object tracking running/agentRunning/breachDetected/sessionId; this prevents concurrent agent spawns while allowing new breaches to be detected while previous agent is running
- **Non-blocking agent execution:** `runAgent` is called without await, continues in background; monitoring loop never blocks on agent completion, enabling continuous threshold checking
- **Error boundaries:** Try-catch at monitor loop level catches and logs metric fetching errors; separate try-catch in runAgent lets agent errors bubble to caller's catch handler; only system boundaries use try-catch per codebase standards
- **Webhook delivery:** Messages sent immediately as they arrive from agent - if webhook fails or is slow, messages may be lost unless also saved by archiveDir mechanism via agent SDK; webhook URL is used directly (webhook key embedded in URL per recent design change)
- **Heartbeat independence:** Heartbeat loop runs on separate interval and independent of threshold monitoring - heartbeat fails only prevent heartbeat messages, not daemon operation
- **Archive directory:** Created during config loading (not at runtime), passed to agent via `runAgent({ archiveDir })`, agent SDK writes `agent-{sessionId}.jsonl` files for session transcript persistence

Created and maintained by Nori.
