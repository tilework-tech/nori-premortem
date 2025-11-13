# Nori Premortem

A system monitoring daemon that intelligently diagnoses machine issues before critical failure using Claude AI.

## Overview

Premortem watches your system vitals (CPU, memory, disk, processes) and spawns Claude Code instances to diagnose problems when thresholds are breached. All diagnostic output is streamed in real-time to a configured webhook endpoint - critical for capturing diagnostics before a machine dies.

## Features

- **Continuous Monitoring**: Polls system metrics at configurable intervals
- **Intelligent Diagnosis**: Spawns Claude agents with full system context when thresholds breach
- **Real-Time Streaming**: Fire-and-forget webhook delivery ensures data reaches your backend even if the machine crashes
- **Reset on Completion**: Daemon resets after each agent run, allowing multiple diagnostic sessions
- **Configurable Thresholds**: Monitor memory %, disk %, CPU %, and process counts

## Installation

From the monorepo root:

```bash
npm install
```

Build the premortem package:

```bash
cd premortem
npm run build
```

## Configuration

A `defaultConfig.json` file is provided with reasonable defaults. Copy and customize it:

```bash
cp defaultConfig.json config.json
# Edit config.json with your webhookUrl, anthropicApiKey, and desired thresholds
```

Example configuration:

```json
{
  "webhookUrl": "https://your-observability-server.com/api/premortem/ingest",
  "webhookKey": "premortem-hardcoded-key-12345",
  "anthropicApiKey": "sk-ant-your-api-key-here",
  "pollingInterval": 10000,
  "thresholds": {
    "memoryPercent": 90,
    "diskPercent": 85,
    "cpuPercent": 80
  },
  "agentConfig": {
    "model": "claude-sonnet-4",
    "allowedTools": ["Read", "Bash", "Grep", "Glob"],
    "maxTurns": 20,
    "customPrompt": "You are diagnosing system performance issues. Focus on memory usage, disk space, CPU utilization, and process behavior."
  }
}
```

### Configuration Options

- **webhookUrl** (required): HTTP endpoint to receive diagnostic output
  - Should point to your observability server's premortem ingest endpoint
  - Format: `https://your-server.com/api/premortem/ingest`
  - Do NOT include the webhook key in the URL - it will be appended automatically
- **webhookKey** (optional, default: "premortem-hardcoded-key-12345"): Authentication key for webhook endpoint
  - Current: Hardcoded temporary value
  - Future: Will be generated per-webhook in observability UI
- **anthropicApiKey** (required): Your Anthropic API key for Claude
- **pollingInterval** (optional, default: 10000): Milliseconds between system checks
- **thresholds** (required): At least one threshold must be configured
  - **memoryPercent**: Trigger when memory usage exceeds this percentage (uses "available" memory, not "used", to avoid false alerts from Linux buffer/cache)
  - **diskPercent**: Trigger when disk usage exceeds this percentage
  - **cpuPercent**: Trigger when CPU usage exceeds this percentage
- **agentConfig** (optional): Claude agent configuration
  - **model** (default: "claude-sonnet-4"): Claude model to use
  - **allowedTools**: Tools the agent can use (Read, Bash, Grep, etc.)
  - **maxTurns**: Maximum conversation turns
  - **customPrompt**: Additional context for the agent

## Usage

Run the daemon:

```bash
nori-premortem --config ./config.json
```

The daemon will:

1. Start monitoring system metrics
2. When a threshold is breached, spawn a Claude agent with system context
3. Stream all agent output to your webhook endpoint
4. Reset after the agent completes, ready to trigger again

Stop the daemon with `Ctrl+C`.

## Webhook Integration

### Observability Server Setup

Diagnostic transcripts are sent to the Nori observability server:

1. The premortem daemon streams raw Claude SDK messages to the configured webhook URL
2. Messages are accumulated into "premortem" artifacts in the observability UI
3. Each diagnostic session appears as a transcript artifact viewable in the UI

### Message Format

Messages are sent as raw Claude SDK output, one message per POST:

```json
{
  "type": "assistant",
  "session_id": "session-abc123",
  "message": {
    "role": "assistant",
    "content": "Analyzing system metrics..."
  }
}
```

The `session_id` field groups messages into a single diagnostic transcript artifact on the backend.

### Authentication

Currently uses a hardcoded webhook key (`premortem-hardcoded-key-12345`). In future releases, this will be user-configurable via the observability UI's webhook management interface.

## Architecture

```
Daemon (monitoring loop)
  ↓ (threshold breach detected)
Agent SDK (Claude diagnostics)
  ↓ (immediate streaming)
Webhook Endpoint (your server)
```

**Key Design Decisions:**

1. **First-breach-only**: When multiple thresholds breach, only the first (memory > disk > cpu) triggers
2. **Reset on completion**: Agent finish resets daemon state, allowing new breaches to trigger
3. **Fire-and-forget webhooks**: No retries - webhook endpoint must be reliable
4. **API key in config**: anthropicApiKey stored in config file, set to env before SDK calls

## Development

Run tests:

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

Build:

```bash
npm run build
```

## Troubleshooting

**Daemon not starting:**

- Check that `anthropicApiKey` is valid in config
- Verify webhook URL is reachable

**No agent triggering:**

- Check threshold values - may need to lower them for testing
- Review daemon logs for system metrics

**Webhook not receiving data:**

- Test webhook endpoint separately
- Check firewall/network settings
- Remember: no retries, so endpoint must be reliable

## License

MIT
