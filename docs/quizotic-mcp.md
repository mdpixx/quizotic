# Quizotic MCP Connector

The connector exposes Quizotic to Claude Code, Codex, and other MCP clients through a local stdio server.

## Setup

Set the Quizotic API key and optional base URL:

```bash
export QUIZOTIC_API_KEY=qz_your_key
export QUIZOTIC_BASE_URL=https://www.quizotic.live
```

Run the server:

```bash
node mcp/quizotic-mcp-server.mjs
```

## Tools

- `generate_quiz` creates questions from a topic, pasted text, or a URL.
- `create_quiz` saves a quiz to the connected Quizotic account.
- `publish_self_paced_quiz` returns a shareable self-paced link.
- `list_quizzes` lists saved quizzes.
- `get_report` fetches session results and teacher insights.

Live hosting is intentionally host-confirmed in the browser for this release.
