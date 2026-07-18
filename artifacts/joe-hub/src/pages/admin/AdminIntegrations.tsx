import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Zap, CheckCircle, XCircle, Activity } from "lucide-react";
import {
  useIntegrations, useUpsertIntegration, usePatchIntegration, useTestIntegration, useSyncLogs,
} from "@/lib/community";
import { useUser } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";

function IntegrationCard({
  provider,
  existing,
}: {
  provider: "discord" | "slack";
  existing: any | null;
}) {
  const { toast } = useToast();
  const upsert = useUpsertIntegration();
  const patch = usePatchIntegration();
  const testIntegration = useTestIntegration();

  const [webhookUrl, setWebhookUrl] = useState(existing?.channelMap?.webhook ?? "");
  const [workspaceId, setWorkspaceId] = useState(existing?.externalWorkspaceId ?? "");
  const [syncAnnouncements, setSyncAnnouncements] = useState(existing?.syncAnnouncements ?? true);
  const [syncAssignments, setSyncAssignments] = useState(existing?.syncAssignments ?? true);
  const [syncEvents, setSyncEvents] = useState(existing?.syncEventReminders ?? true);
  const [isEnabled, setIsEnabled] = useState(existing?.isEnabled ?? false);

  useEffect(() => {
    if (existing) {
      setWebhookUrl(existing.channelMap?.webhook ?? "");
      setWorkspaceId(existing.externalWorkspaceId ?? "");
      setSyncAnnouncements(existing.syncAnnouncements);
      setSyncAssignments(existing.syncAssignments);
      setSyncEvents(existing.syncEventReminders);
      setIsEnabled(existing.isEnabled);
    }
  }, [existing]);

  const handleSave = () => {
    const data = {
      provider,
      isEnabled,
      externalWorkspaceId: workspaceId || undefined,
      channelMap: webhookUrl ? { webhook: webhookUrl } : undefined,
      syncAnnouncements,
      syncAssignments,
      syncEventReminders: syncEvents,
    };

    if (existing?.id) {
      patch.mutate(
        { id: existing.id, data },
        { onSuccess: () => toast({ title: `${provider} settings saved!` }), onError: () => toast({ title: "Save failed", variant: "destructive" }) },
      );
    } else {
      upsert.mutate(data, {
        onSuccess: () => toast({ title: `${provider} integration configured!` }),
        onError: () => toast({ title: "Save failed", variant: "destructive" }),
      });
    }
  };

  const handleTest = () => {
    if (!existing?.id) {
      toast({ title: "Save the configuration first", variant: "destructive" });
      return;
    }
    testIntegration.mutate(existing.id, {
      onSuccess: (result) => {
        if (result.ok) {
          toast({ title: "✅ Test notification sent!", description: result.detail });
        } else {
          toast({ title: "❌ Test failed", description: result.detail, variant: "destructive" });
        }
      },
    });
  };

  const providerColor = provider === "discord" ? "text-indigo-600" : "text-green-600";
  const providerBg = provider === "discord" ? "bg-indigo-100" : "bg-green-100";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg ${providerBg} flex items-center justify-center`}>
              <span className={`text-lg font-black ${providerColor}`}>
                {provider === "discord" ? "D" : "S"}
              </span>
            </div>
            <div>
              <CardTitle className="text-base capitalize">{provider}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {provider === "discord" ? "Discord webhook integration" : "Slack webhook integration"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {existing?.isEnabled ? (
              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                <CheckCircle className="h-3 w-3 mr-0.5" /> Active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                <XCircle className="h-3 w-3 mr-0.5" /> Disabled
              </Badge>
            )}
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>
            {provider === "discord" ? "Guild ID" : "Workspace ID"} (optional)
          </Label>
          <Input
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            placeholder={provider === "discord" ? "Discord guild / server ID" : "Slack workspace team ID"}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Incoming Webhook URL</Label>
          <Input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder={provider === "discord"
              ? "https://discord.com/api/webhooks/..."
              : "https://hooks.slack.com/services/..."}
            type="url"
          />
          <p className="text-xs text-muted-foreground">
            {provider === "discord"
              ? "Create a webhook in your Discord server settings → Integrations → Webhooks."
              : "Create an incoming webhook in your Slack app settings."}
          </p>
        </div>

        <div className="space-y-3 border-t pt-3">
          <p className="text-sm font-medium">Sync Options</p>
          {[
            { label: "Sync Announcements", value: syncAnnouncements, set: setSyncAnnouncements },
            { label: "Sync Assignment Notifications", value: syncAssignments, set: setSyncAssignments },
            { label: "Sync Event Reminders", value: syncEvents, set: setSyncEvents },
          ].map(({ label, value, set }) => (
            <div key={label} className="flex items-center justify-between">
              <Label className="font-normal">{label}</Label>
              <Switch checked={value} onCheckedChange={set} />
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button className="flex-1" onClick={handleSave} disabled={upsert.isPending || patch.isPending}>
            {upsert.isPending || patch.isPending ? "Saving…" : "Save Settings"}
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testIntegration.isPending}>
            <Zap className="h-4 w-4 mr-1" />
            {testIntegration.isPending ? "Testing…" : "Test"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminIntegrations() {
  const { user } = useUser();
  const role = (user?.publicMetadata as any)?.role;

  if (role !== "admin") {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>Admin access required.</p>
      </div>
    );
  }

  const { data: integrations = [] } = useIntegrations();
  const { data: syncLogs = [] } = useSyncLogs();

  const discordConfig = (integrations as any[]).find((i: any) => i.provider === "discord") ?? null;
  const slackConfig = (integrations as any[]).find((i: any) => i.provider === "slack") ?? null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Connect Discord and Slack to your cohort communities for richer collaboration
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <IntegrationCard provider="discord" existing={discordConfig} />
        <IntegrationCard provider="slack" existing={slackConfig} />
      </div>

      {/* Sync Logs */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Sync Log</h2>
          <Badge variant="outline" className="text-xs">{(syncLogs as any[]).length} entries</Badge>
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(syncLogs as any[]).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No sync events yet. Test an integration to see logs here.
                  </TableCell>
                </TableRow>
              ) : (
                (syncLogs as any[]).map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {log.event.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs ${log.status === "success" ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}`}
                      >
                        {log.status === "success" ? "✓ Success" : "✗ Failed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-64 truncate">
                      {log.detail ?? "–"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
