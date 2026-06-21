"use client";

import { useState } from "react";
import { secureFetch } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import type { Role } from "@prisma/client";

interface AdminUserActionsProps {
  userId: string;
  role: Role;
  isSuspended: boolean;
  isBanned: boolean;
}

export function AdminUserActions({
  userId,
  role,
  isSuspended,
  isBanned,
}: AdminUserActionsProps) {
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");

  const act = async (payload: Record<string, unknown>) => {
    setLoading(String(payload.action));
    setMessage("");
    try {
      const res = await secureFetch("/api/admin", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        setMessage(json.data?.message ?? "Action completed");
        window.location.reload();
      } else {
        setMessage(json.error ?? "Action failed");
      }
    } catch {
      setMessage("Request failed");
    } finally {
      setLoading("");
    }
  };

  return (
    <div className="flex flex-wrap gap-1">
      {message && <span className="text-xs text-muted-foreground w-full">{message}</span>}
      {!isSuspended && !isBanned && (
        <Button
          size="sm"
          variant="outline"
          disabled={!!loading}
          onClick={() =>
            act({ action: "update_user", userId, isSuspended: true })
          }
        >
          Suspend
        </Button>
      )}
      {isSuspended && (
        <Button
          size="sm"
          variant="outline"
          disabled={!!loading}
          onClick={() =>
            act({ action: "update_user", userId, isSuspended: false })
          }
        >
          Reactivate
        </Button>
      )}
      {!isBanned && (
        <Button
          size="sm"
          variant="outline"
          disabled={!!loading}
          onClick={() => act({ action: "update_user", userId, isBanned: true })}
        >
          Ban
        </Button>
      )}
      {role !== "ADMIN" && (
        <Button
          size="sm"
          variant="outline"
          disabled={!!loading}
          onClick={() => act({ action: "update_user", userId, role: "MODERATOR" })}
        >
          Make Mod
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        disabled={!!loading}
        onClick={() => act({ action: "reset_password", userId })}
      >
        Reset PW
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={!!loading}
        onClick={() => {
          if (confirm("Delete this user permanently?")) {
            act({ action: "delete_user", userId });
          }
        }}
      >
        Delete
      </Button>
    </div>
  );
}
