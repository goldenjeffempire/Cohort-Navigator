# Discord & Slack Integration Guide

## Overview

JOE Forge connects to Discord and Slack using **Incoming Webhooks** — the simplest integration method that requires no OAuth, no bot accounts, and no server-side credentials beyond the webhook URL itself.

## Setting Up Discord

1. Open your Discord server settings → **Integrations** → **Webhooks** → **New Webhook**
2. Name the webhook (e.g. "JOE Forge Announcements"), choose a channel, and copy the URL
3. In JOE Forge Admin → Integrations, paste the URL into the Discord **Incoming Webhook URL** field
4. Toggle **Enabled** and click **Save Settings**
5. Click **Test** to send a `{ "content": "..." }` payload — you should see a message appear in your channel immediately

## Setting Up Slack

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Under **Features → Incoming Webhooks**, enable the feature and click **Add New Webhook to Workspace**
3. Choose a channel and authorize — copy the generated webhook URL
4. In JOE Forge Admin → Integrations, paste it into the Slack **Incoming Webhook URL** field
5. Click **Test** — a `{ "text": "..." }` message will appear in your Slack channel

## Sync Options

| Option | What it controls |
|---|---|
| Sync Announcements | POST platform announcements to the channel |
| Sync Assignment Notifications | POST new assignment releases |
| Sync Event Reminders | POST live session reminders |

Toggle each option in the admin UI. Toggling requires saving settings.

## How Webhooks Work Internally

```ts
// routes/integrations/config.ts → POST /integrations/:id/test

const payload = provider === "discord"
  ? { content: "🧪 JOE Forge test notification" }
  : { text: "🧪 JOE Forge test notification" };

const response = await fetch(channelMap.webhook, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
```

Every sync attempt is logged to `integration_sync_logs` (visible in Admin → Integrations → Sync Log).

## Webhook URL Security

The webhook URL is stored in the `channel_map` JSONB column of `community_integrations`. It should be treated as a credential:
- Never share it publicly
- Rotate the webhook in Discord/Slack if compromised (old URL stops working immediately)
- JOE Forge never logs the URL itself, only HTTP status codes from each POST attempt
