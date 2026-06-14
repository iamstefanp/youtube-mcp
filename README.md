# YouTube Live MCP

MCP server for controlling YouTube Live Streaming from Claude Code, Claude Desktop, or any MCP client.

Create broadcasts, go live, manage chat, and monitor stream health — all through the Model Context Protocol.

## What it does

This server wraps the YouTube Live Streaming API v3 and exposes it as MCP tools. Combined with [obs-mcp](https://github.com/royshil/obs-mcp), you get fully automated live streaming from your AI assistant.

### Tools

**Broadcasts** (8 tools)
- `yt-create-broadcast` — Create a new live broadcast
- `yt-list-broadcasts` — List broadcasts (filter by status)
- `yt-get-broadcast` — Get broadcast details
- `yt-update-broadcast` — Update title, description, privacy
- `yt-delete-broadcast` — Delete a broadcast
- `yt-bind-stream` — Bind a video stream to a broadcast
- `yt-transition-broadcast` — Go live, end broadcast (testing/live/complete)
- `yt-insert-cuepoint` — Insert ad break during live

**Streams** (4 tools)
- `yt-create-stream` — Create stream, get RTMP URL + key
- `yt-list-streams` — List your streams
- `yt-get-stream` — Get stream details + health
- `yt-delete-stream` — Delete a stream

**Chat** (6 tools)
- `yt-list-chat-messages` — Read live chat
- `yt-send-chat-message` — Post to live chat
- `yt-delete-chat-message` — Remove a message
- `yt-list-moderators` — List chat moderators
- `yt-add-moderator` — Add a moderator
- `yt-remove-moderator` — Remove a moderator

**Status** (2 tools)
- `yt-get-broadcast-status` — Broadcast lifecycle state
- `yt-get-stream-health` — Real-time stream health

**Videos**
- `yt-search-videos` — Search YouTube for videos by keyword. Params: `query` (required), `maxResults` (1–50, default 10), `channelId` (optional, restrict to one channel), `order` (relevance/date/viewCount/rating/title, default relevance). Returns `{ videoId, title, channelTitle, channelId, publishedAt, url, description }` per result. Note: `search.list` costs **100 quota units** per call (vs ~1 for list/get).

## Prerequisites

1. **Node.js 18+**
2. **Google Cloud project** with the YouTube Data API v3 enabled
3. **OAuth2 credentials** (Desktop application type)

### Setting up Google Cloud

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use an existing one)
3. Enable the **YouTube Data API v3**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Desktop app**
6. Note your **Client ID** and **Client Secret**

## Installation

### Claude Desktop / Claude Code

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "youtube-live": {
      "command": "npx",
      "args": ["-y", "youtube-live-mcp@latest"],
      "env": {
        "YOUTUBE_CLIENT_ID": "your-client-id.apps.googleusercontent.com",
        "YOUTUBE_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

### Manual

```bash
npm install -g youtube-live-mcp
YOUTUBE_CLIENT_ID="..." YOUTUBE_CLIENT_SECRET="..." youtube-live-mcp
```

## Authentication

On first run, the server opens your browser for Google OAuth consent. After authorizing, tokens are stored in `~/.youtube-live-mcp/tokens.json` and refreshed automatically.

Required scope: `https://www.googleapis.com/auth/youtube`

## Usage: Go Live in 7 Steps

With both `youtube-live-mcp` and `obs-mcp` installed:

```
1. yt-create-broadcast     → Create the YouTube event
2. yt-create-stream        → Get RTMP URL + stream key
3. obs-set-stream-settings → Configure OBS with RTMP details
4. yt-bind-stream          → Connect stream to broadcast
5. obs-start-stream        → Start sending video from OBS
6. yt-transition-broadcast → testing → validate feed
7. yt-transition-broadcast → live → YOU'RE LIVE
```

To end: `yt-transition-broadcast complete` + `obs-stop-stream`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `YOUTUBE_CLIENT_ID` | Yes | OAuth2 client ID |
| `YOUTUBE_CLIENT_SECRET` | Yes | OAuth2 client secret |

## API Quota

YouTube API has a daily quota of 10,000 units. Read operations cost ~1 unit, write operations cost ~50 units. Normal streaming use stays well within limits.

One exception: `search.list` (used by `yt-search-videos`) costs **100 units per call** — about 100 searches per day on the default quota. When the quota is spent, search tools return a clear `quotaExceeded` message; prefer `yt-list-videos` (by channel) for cheap listing.

## License

MIT

## Built by

[Runway Services](https://runwayservices.net) — a humanistic sales and marketing agency.
