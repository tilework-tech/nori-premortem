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

Clone and install:

```bash
git clone git@github.com:tilework-tech/nori-premortem.git
cd nori-premortem
npm install
npm run build
```

Or install globally:

```bash
npm install -g .
```

## Configuration

Create your configuration file from the example template:

```bash
cp defaultConfig.example.json defaultConfig.json
# Edit defaultConfig.json with your webhookUrl, anthropicApiKey, and desired thresholds
```

**Note**: `defaultConfig.json` is gitignored to prevent accidentally committing sensitive credentials.

Example configuration:

```json
{
  "webhookUrl": "https://your-server.com/webhook-endpoint",
  "anthropicApiKey": "sk-ant-your-api-key-here",
  "pollingInterval": 10000,
  "thresholds": {
    "memoryPercent": 90,
    "diskPercent": 85,
    "cpuPercent": 80
  },
  "agentConfig": {
    "customPrompt": "You are diagnosing system performance issues. Focus on memory usage, disk space, CPU utilization, and process behavior."
  },
  "heartbeat": {
    "url": "https://your-server.com/heartbeat-endpoint",
    "interval": 60000,
    "processName": "my-process"
  }
}
```

### Configuration Options

- **webhookUrl** (required): HTTP endpoint to receive diagnostic output
  - Must accept POST requests with JSON payloads containing Claude SDK message objects
  - Messages are grouped by `session_id` field
  - Each message follows the format: `{type: string, session_id: string, ...other_fields}`
- **anthropicApiKey** (required): Your Anthropic API key for Claude
- **pollingInterval** (optional, default: 10000): Milliseconds between system checks
- **thresholds** (required): At least one threshold must be configured
  - **memoryPercent**: Trigger when memory usage exceeds this percentage (uses "available" memory, not "used", to avoid false alerts from Linux buffer/cache)
  - **diskPercent**: Trigger when disk usage exceeds this percentage
  - **cpuPercent**: Trigger when CPU usage exceeds this percentage
- **agentConfig** (optional): Claude agent configuration
  - **customPrompt**: Additional context prepended to diagnostic prompt (default: null)
  - Note: Model, allowed tools, and max turns are controlled by SDK defaults and not user-configurable
- **heartbeat** (optional): Health check configuration
  - **url**: Endpoint to receive periodic heartbeat signals
  - **interval** (default: 60000): Milliseconds between heartbeat signals
  - **processName**: Process name to monitor and report in heartbeat

## Usage

Run the daemon:

```bash
nori-premortem --config ./config.json
```

The daemon will:

1. Validate the Anthropic API key with a test query (fail-fast if invalid)
2. Create the archive directory at `~/.premortem-logs` if it doesn't exist
3. Validate the archive directory is writable (fail-fast if not)
4. Start monitoring system metrics
5. When a threshold is breached, spawn a Claude agent with system context
6. Stream all agent output to your webhook endpoint
7. Save complete session transcripts to `~/.premortem-logs/agent-{sessionId}.jsonl`
8. Reset after the agent completes, ready to trigger again

Stop the daemon with `Ctrl+C`.

## Webhook Integration

### API Dependency

**IMPORTANT**: This package requires a backend API to receive diagnostic data. It is designed to work with the Nori Observability Server, but any compatible webhook endpoint will work.

**Required API Endpoint**: `POST /api/premortem/ingest/:webhookKey`

The endpoint must:
- Accept POST requests with raw Claude SDK message payloads
- Handle messages grouped by `session_id`
- Be highly available (no retry logic in premortem daemon)

### Observability Server Setup

Diagnostic transcripts are sent to the Nori Observability Server (separate package):

1. The premortem daemon streams raw Claude SDK messages to the configured webhook URL
2. Messages are accumulated into "premortem" artifacts in the observability UI
3. Each diagnostic session appears as a transcript artifact viewable in the UI

**Observability Server Repository**: Internal (contact team for access)

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
