type EventType = "news" | "notification" | "market" | "chat";

interface SSEClient {
  id: string;
  userId?: string;
  send: (data: string) => void;
  close: () => void;
}

class EventBroadcaster {
  private clients = new Map<string, SSEClient>();

  subscribe(client: SSEClient) {
    this.clients.set(client.id, client);
    return () => this.clients.delete(client.id);
  }

  publish(channel: EventType, payload: unknown, userId?: string) {
    const message = `event: ${channel}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.clients.values()) {
      if (userId && client.userId !== userId) continue;
      try {
        client.send(message);
      } catch {
        this.clients.delete(client.id);
      }
    }
  }

  get clientCount() {
    return this.clients.size;
  }
}

export const eventBus = new EventBroadcaster();
