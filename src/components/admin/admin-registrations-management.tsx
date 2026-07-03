"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, List, RefreshCw, Search, Trash2 } from "lucide-react";
import type { Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CountryFlag, countryDisplayName } from "@/components/ui/country-flag";
import { readJsonResponse, secureFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type RegistrationItem = {
  id: string;
  ipAddress: string | null;
  country: string | null;
  city: string | null;
  browser: string | null;
  deviceType: string | null;
  os: string | null;
  userAgent: string | null;
  vpnDetected: boolean;
  vpnProvider: string | null;
  ipAsn: string | null;
  ipCompany: string | null;
  ipRiskSource: string | null;
  adminViewed: boolean;
  registeredAt: string;
  user: { id: string; name: string; email: string; username: string | null; avatar: string | null; role: Role };
};

type Pagination = { page: number; limit: number; total: number; totalPages: number };
type ManagementData = { items: RegistrationItem[]; pagination: Pagination };
type ApiResponse<T> = { success: boolean; data?: T; error?: string };
type ViewMode = "list" | "grid";

export function AdminRegistrationsManagement({ initialData }: { initialData: ManagementData }) {
  const [items, setItems] = useState(initialData.items);
  const [pagination, setPagination] = useState(initialData.pagination);
  const [view, setView] = useState<ViewMode>("list");
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const visibleIds = useMemo(() => items.map((item) => item.id), [items]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const loadItems = useCallback(
    async (page: number, q = activeQuery) => {
      setLoading(true);
      setMessage("");
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pagination.limit),
          ...(q ? { q } : {}),
        });
        const response = await fetch(`/api/admin/registrations?${params}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const json = await readJsonResponse<ApiResponse<ManagementData>>(response);
        if (!json.success || !json.data) throw new Error(json.error ?? "Failed to load registrations");
        setItems(json.data.items);
        setPagination(json.data.pagination);
        setSelectedIds(new Set());
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load registrations");
      } finally {
        setLoading(false);
      }
    },
    [activeQuery, pagination.limit]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadItems(pagination.page), 0);
    return () => window.clearTimeout(timer);
  }, [loadItems, pagination.page]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setActiveQuery(query.trim());
    setPagination((current) => ({ ...current, page: 1 }));
  }

  function toggleAll() {
    setSelectedIds((current) => (allSelected ? new Set() : new Set([...current, ...visibleIds])));
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    if (!selectedIds.size) {
      setMessage("Select at least one registration first.");
      return;
    }
    if (!window.confirm(`Delete ${selectedIds.size} selected registration record(s)?`)) return;
    setLoading(true);
    setMessage("Processing... Please wait a moment.");
    try {
      const response = await secureFetch("/api/admin/registrations", {
        method: "DELETE",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const json = await readJsonResponse<ApiResponse<{ deleted: number }>>(response);
      if (!json.success) throw new Error(json.error ?? "Failed to delete registrations");
      setMessage(`Deleted ${json.data?.deleted ?? 0} registration record(s).`);
      await loadItems(pagination.page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete registrations");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="bg-card/95">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <form onSubmit={submitSearch} className="relative max-w-xl flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search user, country, device, IP, VPN"
                className="h-11 w-full rounded-2xl border border-border bg-background/90 pl-10 pr-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </form>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void loadItems(pagination.page)}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={() => void deleteSelected()} className="bg-red-700 text-white hover:bg-red-600">
                <Trash2 className="h-4 w-4" />
                Delete selected
              </Button>
              <ViewToggle view={view} onChange={setView} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-primary" />
              Select all visible
            </label>
            <span>
              {pagination.total} registrations, page {pagination.page} of {pagination.totalPages}
            </span>
          </div>
          {message ? <p className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>

      <div className={cn("grid gap-4", view === "grid" ? "md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
        {items.map((item) => (
          <RegistrationRow key={item.id} item={item} selected={selectedIds.has(item.id)} onToggle={() => toggleSelected(item.id)} view={view} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" disabled={loading || pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}>
          Previous
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>
          Next
        </Button>
      </div>
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (view: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded-2xl border border-border bg-background/90 p-1 shadow-inner">
      <button type="button" onClick={() => onChange("list")} className={cn("rounded-xl px-3 py-2 transition", view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary")} aria-label="List view">
        <List className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => onChange("grid")} className={cn("rounded-xl px-3 py-2 transition", view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary")} aria-label="Card view">
        <LayoutGrid className="h-4 w-4" />
      </button>
    </div>
  );
}

function RegistrationRow({ item, selected, onToggle, view }: { item: RegistrationItem; selected: boolean; onToggle: () => void; view: ViewMode }) {
  const location = [countryDisplayName(item.country), item.city].filter(Boolean).join(", ") || "Location unavailable";
  const vpn = item.vpnDetected ? `${item.vpnProvider ?? item.ipCompany ?? "VPN"} USING (${item.ipAddress ?? "IP unavailable"}, ${location})` : "No VPN detected";
  return (
    <article className={cn("rounded-3xl border border-border bg-card/95 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl", selected && "border-primary/70 ring-2 ring-primary/20", view === "list" && "grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]")}>
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <input type="checkbox" checked={selected} onChange={onToggle} className="mt-3 h-4 w-4 shrink-0 accent-primary" aria-label={`Select ${item.user.email}`} />
          {item.user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.user.avatar} alt={item.user.name} className="h-12 w-12 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">{item.user.name.slice(0, 2).toUpperCase()}</div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {!item.adminViewed ? <Badge variant="warning">New</Badge> : null}
              <Badge variant="outline">{item.user.role.toLowerCase()}</Badge>
            </div>
            <h2 className="mt-1 truncate text-lg font-bold text-foreground">{item.user.name}</h2>
            <p className="truncate text-sm text-muted-foreground">{item.user.email}</p>
            {item.user.username ? <p className="text-xs text-muted-foreground">@{item.user.username}</p> : null}
          </div>
        </div>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <Info label="Location" value={location} country={item.country} />
          <Info label="Device" value={[item.deviceType, item.browser, item.os].filter(Boolean).join(" / ") || "Unknown"} />
          <Info label="IP" value={item.ipAddress ?? "IP unavailable"} mono />
          <Info label="Registered" value={new Date(item.registeredAt).toLocaleString()} />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-background/80 p-3 text-sm">
        <p className={cn("font-bold", item.vpnDetected ? "text-red-500" : "text-emerald-500")}>{vpn}</p>
        <p className="mt-2 text-xs text-muted-foreground">ASN: {item.ipAsn ?? "Unknown"}</p>
        <p className="mt-1 text-xs text-muted-foreground">Company: {item.ipCompany ?? "Unknown"}</p>
        <p className="mt-1 text-xs text-muted-foreground">Source: {item.ipRiskSource ?? "Not checked"}</p>
      </div>
    </article>
  );
}

function Info({ label, value, country, mono = false }: { label: string; value: string; country?: string | null; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{label}</p>
      <p className={cn("mt-1 flex min-w-0 items-center gap-2 truncate text-sm text-foreground", mono && "font-mono text-xs")}>
        {country !== undefined ? <CountryFlag countryCode={country} className="h-4 w-4" /> : null}
        <span className="truncate">{value}</span>
      </p>
    </div>
  );
}
