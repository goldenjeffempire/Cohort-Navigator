import { useListMyNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Check, Circle, Link as LinkIcon } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

export default function Notifications() {
  const { data: notifications, isLoading } = useListMyNotifications();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const queryClient = useQueryClient();

  const handleMarkRead = (id: number) => {
    markReadMutation.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications/me"] })
    });
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate(undefined, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications/me"] })
    });
  };

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 mt-1">You have {unreadCount} unread messages.</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={markAllReadMutation.isPending}>
            <Check className="mr-2 h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : notifications && notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map(notification => (
            <div 
              key={notification.id} 
              className={`p-4 rounded-xl border flex gap-4 transition-colors ${notification.isRead ? 'bg-white border-gray-100 text-gray-600' : 'bg-primary/5 border-primary/20 text-gray-900'}`}
            >
              <div className="mt-1">
                {notification.isRead ? (
                  <Circle className="h-3 w-3 text-gray-300" />
                ) : (
                  <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h4 className={`font-semibold ${notification.isRead ? 'text-gray-700' : 'text-gray-900'}`}>{notification.title}</h4>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{format(new Date(notification.createdAt), "MMM d, h:mm a")}</span>
                </div>
                <p className={`text-sm mb-3 ${notification.isRead ? 'text-gray-500' : 'text-gray-700'}`}>{notification.body}</p>
                <div className="flex items-center gap-3">
                  {notification.link && (
                    <Button variant="link" size="sm" className="h-auto p-0 text-primary" asChild>
                      <Link href={notification.link}><LinkIcon className="h-3 w-3 mr-1" /> View Context</Link>
                    </Button>
                  )}
                  {!notification.isRead && (
                    <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs text-gray-500 hover:text-gray-900" onClick={() => handleMarkRead(notification.id)}>
                      Mark as read
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center border-dashed bg-gray-50 shadow-none">
          <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            You don't have any notifications right now. When things happen, they'll show up here.
          </p>
        </Card>
      )}
    </div>
  );
}
