"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Copy,
  Edit3,
  FileText,
  ImageIcon,
  Loader2,
  MessageCircle,
  Paperclip,
  Plus,
  Search,
  Send,
  Shield,
  SmilePlus,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { subscribeSSE } from "@/components/realtime/sse-provider";
import { readJsonResponse, secureFetch, getCsrfToken } from "@/lib/api/client";
import type { CommunityMediaItem, CommunityMediaType } from "@/lib/community/media-types";
import { cn } from "@/lib/utils";

type HubUser = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  avatar: string | null;
  country?: string | null;
};

type HubCommunity = {
  id: string;
  name: string;
  slug: string;
  topic: string;
  rules: string;
  avatarUrl: string | null;
  badgeUrl: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";
  ownerId: string;
  owner: HubUser;
  memberCount: number;
  messageCount: number;
  membership?: {
    id: string;
    role: "OWNER" | "MODERATOR" | "MEMBER";
    status: "ACTIVE" | "BLOCKED" | "REMOVED";
    rulesAgreedAt: string | null;
  };
  createdAt: string;
  approvedAt?: string | null;
};

type DmConversation = {
  id: string;
  otherUser: HubUser | null;
  latestMessage: {
    id: string;
    content: string | null;
    attachmentName: string | null;
    createdAt: string;
  } | null;
  updatedAt: string;
};

type HubData = {
  myCommunities: HubCommunity[];
  discoverCommunities: HubCommunity[];
  dmConversations: DmConversation[];
  incomingFriendRequests: Array<{ id: string; requester: HubUser; createdAt: string }>;
  outgoingFriendRequests: Array<{ id: string; recipient: HubUser; createdAt: string }>;
};

type ChatMessage = {
  id: string;
  senderId: string;
  content: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentSize: number | null;
  replyToId: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  sender: { id: string; name: string; username: string | null; avatar: string | null };
  replyTo: {
    id: string;
    content: string | null;
    attachmentName: string | null;
    deletedAt: string | null;
    sender: { id: string; name: string; username: string | null; avatar: string | null };
  } | null;
  deliveryStatus?: "sending" | "failed" | "sent";
};

type SearchUser = HubUser & {
  createdAt: string;
  outgoingFriendStatus: "PENDING" | "ACCEPTED" | "IGNORED" | null;
  incomingFriendStatus: "PENDING" | "ACCEPTED" | "IGNORED" | null;
};

type Member = {
  id: string;
  role: "OWNER" | "MODERATOR" | "MEMBER";
  status: "ACTIVE" | "BLOCKED" | "REMOVED";
  rulesAgreedAt: string | null;
  blockedReason: string | null;
  user: HubUser;
};

type ActiveTarget = { kind: "community"; id: string } | { kind: "dm"; id: string } | null;

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const MESSAGE_GROUP_GAP_MS = 5 * 60 * 1000;
const NEW_MESSAGE_GAP_MS = 30 * 60 * 1000;

type ChatEventPayload =
  | { type: "community.message"; communityId: string; message: ChatMessage }
  | { type: "dm.message"; conversationId: string; message: ChatMessage };

type TimelineItem =
  | { type: "divider"; id: string; label: string; tone: "date" | "new" }
  | { type: "group"; id: string; messages: ChatMessage[]; sender: ChatMessage["sender"]; isOwn: boolean; createdAt: string };

export function CommunityHub({
  currentUser,
  initialData,
  initialTarget,
}: {
  currentUser: HubUser;
  initialData: HubData;
  initialTarget?: ActiveTarget;
}) {
  const [data, setData] = useState(initialData);
  const [active, setActive] = useState<ActiveTarget>(() => {
    if (initialTarget?.kind === "community") {
      const community = initialData.myCommunities.find(
        (item) => item.id === initialTarget.id || item.slug === initialTarget.id
      );
      if (community) return { kind: "community", id: community.id };
    }
    if (initialTarget?.kind === "dm") {
      const conversation = initialData.dmConversations.find((item) => item.id === initialTarget.id);
      if (conversation) return { kind: "dm", id: conversation.id };
    }
    const firstApproved = initialData.myCommunities.find((community) => community.status === "APPROVED");
    if (firstApproved) return { kind: "community", id: firstApproved.id };
    const firstDm = initialData.dmConversations[0];
    if (firstDm) return { kind: "dm", id: firstDm.id };
    return null;
  });
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [rulesCommunity, setRulesCommunity] = useState<HubCommunity | null>(null);
  const [manageCommunity, setManageCommunity] = useState<HubCommunity | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<CommunityMediaItem | null>(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState<CommunityMediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaQuery, setMediaQuery] = useState("");
  const [mediaTab, setMediaTab] = useState<CommunityMediaType | "ALL">("ALL");
  const [activeMessageActions, setActiveMessageActions] = useState<ChatMessage | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const optimisticCounterRef = useRef(0);

  const activeCommunity = active?.kind === "community" ? data.myCommunities.find((item) => item.id === active.id) ?? null : null;
  const activeDm = active?.kind === "dm" ? data.dmConversations.find((item) => item.id === active.id) ?? null : null;
  const isOwner = activeCommunity?.ownerId === currentUser.id || activeCommunity?.membership?.role === "OWNER";
  const canSend =
    active?.kind === "dm" ||
    (activeCommunity?.status === "APPROVED" &&
      activeCommunity.membership?.rulesAgreedAt &&
      activeCommunity.membership.status === "ACTIVE");
  const activeTitle = activeCommunity?.name ?? activeDm?.otherUser?.name ?? "Community";
  const timelineItems = useMemo(() => buildTimeline(messages, currentUser.id), [currentUser.id, messages]);
  const filteredMediaItems = useMemo(() => {
    const query = mediaQuery.trim().toLowerCase();
    return mediaItems.filter((item) => {
      if (mediaTab !== "ALL" && item.type !== mediaTab) return false;
      if (!query) return true;
      return item.name.toLowerCase().includes(query) || item.value?.includes(query);
    });
  }, [mediaItems, mediaQuery, mediaTab]);

  const refreshHub = useCallback(async () => {
    const response = await fetch("/api/community/hub", { cache: "no-store", credentials: "same-origin" });
    const json = await readJsonResponse<ApiResponse<HubData & { currentUser: HubUser }>>(response);
    if (json.success && json.data) {
      setData({
        myCommunities: json.data.myCommunities,
        discoverCommunities: json.data.discoverCommunities,
        dmConversations: json.data.dmConversations,
        incomingFriendRequests: json.data.incomingFriendRequests,
        outgoingFriendRequests: json.data.outgoingFriendRequests,
      });
    }
  }, []);

  const loadMediaItems = useCallback(async () => {
    setMediaLoading(true);
    try {
      const response = await fetch("/api/community/media", { cache: "no-store", credentials: "same-origin" });
      const json = await readJsonResponse<ApiResponse<{ items: CommunityMediaItem[] }>>(response);
      setMediaItems(json.success && json.data ? json.data.items : []);
    } finally {
      setMediaLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (target: ActiveTarget) => {
    if (!target) {
      setMessages([]);
      return;
    }
    if (target.kind === "community") {
      const community = data.myCommunities.find((item) => item.id === target.id);
      if (!community || community.status !== "APPROVED" || !community.membership?.rulesAgreedAt) {
        setMessages([]);
        return;
      }
    }

    setMessagesLoading(true);
    setMessageError("");
    try {
      const url =
        target.kind === "community"
          ? `/api/community/communities/${target.id}/messages`
          : `/api/community/dms/${target.id}/messages`;
      const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
      const json = await readJsonResponse<ApiResponse<{ messages: ChatMessage[] }>>(response);
      if (!json.success || !json.data) throw new Error(json.error ?? "Failed to load messages");
      setMessages(json.data.messages);
    } catch (error) {
      setMessages([]);
      setMessageError(error instanceof Error ? error.message : "Failed to load messages");
    } finally {
      setMessagesLoading(false);
    }
  }, [data.myCommunities]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadMessages(active), 0);
    return () => window.clearTimeout(timeout);
  }, [active, loadMessages]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadMediaItems(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadMediaItems]);

  useEffect(() => {
    return subscribeSSE((channel, payload) => {
      if (channel !== "chat" || !active) return;
      if (!isChatEventPayload(payload)) return;
      if (payload.type === "community.message" && active.kind === "community" && payload.communityId === active.id) {
        setMessages((current) => mergeIncomingMessage(current, payload.message, currentUser.id));
      }
      if (payload.type === "dm.message" && active.kind === "dm" && payload.conversationId === active.id) {
        setMessages((current) => mergeIncomingMessage(current, payload.message, currentUser.id));
      }
    });
  }, [active, currentUser.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    const query = searchQuery.trim();
    const timeout = window.setTimeout(async () => {
      if (query.length < 2) {
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      setSearchLoading(true);
      try {
        const response = await fetch(`/api/community/users/search?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const json = await readJsonResponse<ApiResponse<{ users: SearchUser[] }>>(response);
        setSearchResults(json.success && json.data ? json.data.users : []);
      } finally {
        setSearchLoading(false);
      }
    }, query.length < 2 ? 0 : 260);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  function selectCommunity(community: HubCommunity) {
    setDiscoverOpen(false);
    setActive({ kind: "community", id: community.id });
  }

  function selectDm(conversation: DmConversation) {
    setDiscoverOpen(false);
    setActive({ kind: "dm", id: conversation.id });
  }

  function selectMediaItem(item: CommunityMediaItem) {
    if (item.type === "EMOJI" && item.value) {
      setInput((current) => `${current}${item.value}`);
      return;
    }
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSelectedMedia(item);
    setMediaPickerOpen(false);
  }

  function onAttachmentSelected(files: FileList | null) {
    setAttachmentError("");
    const file = files?.[0] ?? null;
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setAttachmentError("Attachments must be smaller than 5MB.");
      return;
    }
    setSelectedMedia(null);
    setAttachment(file);
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!active) return;

    if (editing) {
      await saveEditedMessage();
      return;
    }

    const content = input.trim();
    if (!content && !attachment && !selectedMedia) return;
    if (!canSend) {
      setMessageError("You cannot send messages in this conversation.");
      return;
    }

    const target = active;
    optimisticCounterRef.current += 1;
    const optimisticId = `optimistic-${optimisticCounterRef.current}`;
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      senderId: currentUser.id,
      content: content || null,
      attachmentUrl: selectedMedia?.url ?? null,
      attachmentName: attachment?.name ?? selectedMedia?.name ?? null,
      attachmentType: attachment?.type ?? (selectedMedia ? (selectedMedia.type === "GIF" ? "image/gif" : "image/webp") : null),
      attachmentSize: attachment?.size ?? null,
      replyToId: replyTo?.id ?? null,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      sender: {
        id: currentUser.id,
        name: currentUser.name,
        username: currentUser.username,
        avatar: currentUser.avatar,
      },
      replyTo: replyTo
        ? {
            id: replyTo.id,
            content: replyTo.content,
            attachmentName: replyTo.attachmentName,
            deletedAt: replyTo.deletedAt,
            sender: replyTo.sender,
          }
        : null,
      deliveryStatus: "sending",
    };

    const formData = new FormData();
    if (content) formData.append("content", content);
    if (replyTo) formData.append("replyToId", replyTo.id);
    if (attachment) formData.append("attachment", attachment);
    if (selectedMedia && selectedMedia.type !== "EMOJI") formData.append("mediaId", selectedMedia.id);

    setMessages((current) => [...current, optimisticMessage]);
    setInput("");
    setAttachment(null);
    setSelectedMedia(null);
    setReplyTo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMessageError("");
    try {
      const url =
        target.kind === "community"
          ? `/api/community/communities/${target.id}/messages`
          : `/api/community/dms/${target.id}/messages`;
      const response = await secureFormFetch(url, formData);
      const json = await readJsonResponse<ApiResponse<{ message: ChatMessage }>>(response);
      if (!json.success || !json.data) throw new Error(json.error ?? "Failed to send message");
      setMessages((current) =>
        mergeIncomingMessage(
          current.map((message) => (message.id === optimisticId ? { ...json.data!.message, deliveryStatus: "sent" } : message)),
          json.data!.message,
          currentUser.id
        )
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send message";
      setMessageError(error instanceof Error ? error.message : "Failed to send message");
      setMessages((current) =>
        current.map((message) => (message.id === optimisticId ? { ...message, deliveryStatus: "failed", content: message.content ?? errorMessage } : message))
      );
    }
  }

  async function saveEditedMessage() {
    if (!editing || !active) return;
    const content = input.trim();
    if (!content) return;
    setSending(true);
    try {
      const url =
        active.kind === "community"
          ? `/api/community/messages/${editing.id}`
          : `/api/community/dms/messages/${editing.id}`;
      const response = await secureFetch(url, {
        method: "PATCH",
        body: JSON.stringify({ content }),
      });
      const json = await readJsonResponse<ApiResponse<{ message: { id: string; content: string; editedAt: string | null } }>>(response);
      if (!json.success || !json.data) throw new Error(json.error ?? "Failed to edit message");
      setMessages((current) =>
        current.map((message) =>
          message.id === editing.id
            ? { ...message, content: json.data!.message.content, editedAt: json.data!.message.editedAt }
            : message
        )
      );
      setEditing(null);
      setInput("");
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Failed to edit message");
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(message: ChatMessage) {
    if (message.id.startsWith("optimistic-")) {
      setMessages((current) => current.filter((item) => item.id !== message.id));
      setActiveMessageActions(null);
      return;
    }
    if (!active || !window.confirm("Delete this message?")) return;
    const url =
      active.kind === "community"
        ? `/api/community/messages/${message.id}`
        : `/api/community/dms/messages/${message.id}`;
    const response = await secureFetch(url, { method: "DELETE" });
    const json = await readJsonResponse<ApiResponse<{ deleted: boolean }>>(response);
    if (!json.success) {
      setMessageError(json.error ?? "Failed to delete message");
      return;
    }
    setMessages((current) =>
      current.map((item) =>
        item.id === message.id
          ? {
              ...item,
              content: "",
              attachmentUrl: null,
              attachmentName: null,
              attachmentType: null,
              attachmentSize: null,
              deletedAt: new Date().toISOString(),
            }
          : item
      )
    );
    setActiveMessageActions(null);
  }

  function beginEdit(message: ChatMessage) {
    if (message.id.startsWith("optimistic-")) return;
    setEditing(message);
    setReplyTo(null);
    setAttachment(null);
    setSelectedMedia(null);
    setInput(message.content ?? "");
    setActiveMessageActions(null);
  }

  async function copyMessage(message: ChatMessage) {
    const text = [message.content, message.attachmentUrl ? `${window.location.origin}${message.attachmentUrl}` : ""]
      .filter(Boolean)
      .join("\n");
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setNotice("Message copied.");
    window.setTimeout(() => setNotice(""), 1600);
  }

  async function joinCommunity(community: HubCommunity) {
    const response = await secureFetch(`/api/community/communities/${community.id}/join`, { method: "POST" });
    const json = await readJsonResponse<ApiResponse<unknown>>(response);
    if (!json.success) {
      setNotice(json.error ?? "Could not join community.");
      return;
    }
    setRulesCommunity(null);
    await refreshHub();
    setActive({ kind: "community", id: community.id });
    setDiscoverOpen(false);
  }

  async function sendFriendRequest(user: SearchUser) {
    const response = await secureFetch("/api/community/friend-requests", {
      method: "POST",
      body: JSON.stringify({ recipientId: user.id }),
    });
    const json = await readJsonResponse<ApiResponse<unknown>>(response);
    if (!json.success) {
      setNotice(json.error ?? "Could not send friend request.");
      return;
    }
    setSearchResults((current) =>
      current.map((item) => (item.id === user.id ? { ...item, outgoingFriendStatus: "PENDING" } : item))
    );
    setNotice("Friend request sent.");
  }

  async function respondFriendRequest(requestId: string, action: "accept" | "ignore") {
    const response = await secureFetch(`/api/community/friend-requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
    const json = await readJsonResponse<ApiResponse<unknown>>(response);
    if (!json.success) {
      setNotice(json.error ?? "Could not update friend request.");
      return;
    }
    await refreshHub();
  }

  async function startDm(user: HubUser) {
    const response = await secureFetch("/api/community/dms", {
      method: "POST",
      body: JSON.stringify({ userId: user.id }),
    });
    const json = await readJsonResponse<ApiResponse<{ conversation: DmConversation }>>(response);
    if (!json.success || !json.data) {
      setNotice(json.error ?? "Could not start DM.");
      return;
    }
    await refreshHub();
    setActive({ kind: "dm", id: json.data.conversation.id });
    setDiscoverOpen(false);
  }

  return (
    <div className="relative isolate mx-auto flex min-h-[calc(100vh-8.5rem)] w-full max-w-[1800px] overflow-hidden rounded-none border-y border-border bg-background/78 shadow-[0_28px_90px_rgba(0,0,0,0.16)] backdrop-blur-xl lg:rounded-[1.6rem] lg:border">
      <aside className="relative z-40 flex w-[72px] shrink-0 flex-col items-center gap-3 border-r border-border bg-card/90 px-2 py-4">
        <RailButton active={discoverOpen} label="Find Community" onClick={() => setDiscoverOpen(true)}>
          <Search className="h-5 w-5" />
        </RailButton>
        <Link
          href="/community/new"
          className="group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-sm transition hover:-translate-y-0.5 hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          aria-label="Add new community"
          data-tooltip="false"
        >
          <Plus className="h-5 w-5" />
          <RailTooltip label="Add new community" />
        </Link>
        <div className="h-px w-10 bg-border" />
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2">
          {data.myCommunities.map((community) => (
            <button
              key={community.id}
              type="button"
              onClick={() => selectCommunity(community)}
              className={cn(
                "group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-background text-sm font-black text-foreground shadow-sm transition hover:-translate-y-0.5 hover:rounded-xl hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                active?.kind === "community" && active.id === community.id && "rounded-xl border-primary bg-primary/10 text-primary shadow-primary/15"
              )}
              aria-label={community.name}
              data-tooltip="false"
            >
              <AvatarImage url={community.avatarUrl} name={community.name} className="h-full w-full overflow-hidden rounded-[inherit]" />
              {community.status === "PENDING" ? (
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border border-card bg-amber-400" />
              ) : null}
              <RailTooltip label={community.name} />
            </button>
          ))}
        </div>
      </aside>

      <aside className="relative z-20 hidden w-[286px] shrink-0 border-r border-border bg-card/70 md:flex md:flex-col">
        <div className="border-b border-border p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">TRADX Social</p>
          <h1 className="mt-1 text-xl font-black text-foreground">Community</h1>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
          <section>
            <SectionHeader icon={<Users className="h-4 w-4" />} label="Direct Messages" />
            <div className="mt-2 space-y-1">
              {data.dmConversations.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border bg-background/45 px-3 py-4 text-xs text-muted-foreground">
                  Search users to start a DM.
                </p>
              ) : (
                data.dmConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => selectDm(conversation)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border border-border bg-background/68 px-3 py-2 text-left shadow-sm transition hover:border-primary/25 hover:bg-muted",
                      active?.kind === "dm" && active.id === conversation.id && "border-primary/35 bg-primary/10 text-primary shadow-primary/10"
                    )}
                  >
                    <AvatarImage url={conversation.otherUser?.avatar ?? null} name={conversation.otherUser?.name ?? "DM"} className="h-10 w-10 rounded-2xl" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{conversation.otherUser?.name ?? "Direct Message"}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {conversation.latestMessage?.content ?? conversation.latestMessage?.attachmentName ?? "No messages yet"}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>

          <section>
            <SectionHeader icon={<UserPlus className="h-4 w-4" />} label="Friend Requests" />
            <div className="mt-2 space-y-2">
              {data.incomingFriendRequests.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border bg-background/45 px-3 py-4 text-xs text-muted-foreground">
                  No pending requests.
                </p>
              ) : (
                data.incomingFriendRequests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-border bg-background/75 p-3">
                    <div className="flex items-center gap-2">
                      <AvatarImage url={request.requester.avatar} name={request.requester.name} className="h-8 w-8 rounded-xl" />
                      <p className="min-w-0 flex-1 truncate text-sm font-bold">{request.requester.name}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void respondFriendRequest(request.id, "accept")}
                        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => void respondFriendRequest(request.id, "ignore")}
                        className="rounded-xl border border-border bg-background/80 px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        Ignore
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </aside>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col bg-background/50">
        {discoverOpen ? (
          <DiscoverPanel
            communities={data.discoverCommunities}
            onJoin={(community) => setRulesCommunity(community)}
            onClose={() => setDiscoverOpen(false)}
          />
        ) : (
          <>
            <div className="flex min-h-16 items-center gap-3 border-b border-border bg-card/45 px-4">
              <AvatarImage
                url={activeCommunity?.avatarUrl ?? activeDm?.otherUser?.avatar ?? null}
                name={activeTitle}
                className="h-10 w-10 rounded-2xl"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-base font-black text-foreground">{activeTitle}</h2>
                  {activeCommunity?.status === "PENDING" ? (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-300">
                      Pending
                    </span>
                  ) : null}
                  {activeCommunity?.membership?.status === "BLOCKED" ? (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-300">
                      Blocked
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {activeCommunity?.topic ?? activeDm?.otherUser?.username ?? activeDm?.otherUser?.email ?? "Select a community or direct message"}
                </p>
              </div>
              {isOwner && activeCommunity ? (
                <button
                  type="button"
                  onClick={() => setManageCommunity(activeCommunity)}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border bg-background/80 px-3 text-sm font-bold text-foreground shadow-sm hover:bg-muted"
                >
                  <Shield className="h-4 w-4" />
                  Manage
                </button>
              ) : null}
            </div>

            {activeCommunity?.status === "PENDING" ? (
              <StatePanel
                icon={<Sparkles className="h-8 w-8" />}
                title="Waiting for admin approval"
                description="This community request is saved and will unlock automatically after approval."
              />
            ) : active ? (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
                  {messagesLoading ? (
                    <StatePanel icon={<Loader2 className="h-8 w-8 animate-spin" />} title="Loading messages" description="" compact />
                  ) : messageError ? (
                    <StatePanel icon={<MessageCircle className="h-8 w-8" />} title={messageError} description="" compact />
                  ) : messages.length === 0 ? (
                    <StatePanel
                      icon={<MessageCircle className="h-8 w-8" />}
                      title="No messages yet"
                      description="Start the first conversation."
                      compact
                    />
                  ) : (
                    <div className="mx-auto max-w-4xl space-y-4">
                      {timelineItems.map((item) => (
                        item.type === "divider" ? (
                          <TimelineDivider key={item.id} label={item.label} tone={item.tone} />
                        ) : (
                          <MessageGroup
                            key={item.id}
                            item={item}
                            canModerate={isOwner}
                            onOpenActions={setActiveMessageActions}
                            onReply={(message) => {
                              setEditing(null);
                              setReplyTo(message);
                              setActiveMessageActions(null);
                            }}
                            onEdit={beginEdit}
                            onDelete={(message) => void deleteMessage(message)}
                            onCopy={(message) => void copyMessage(message)}
                          />
                        )
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                <form onSubmit={sendMessage} className="border-t border-border bg-card/70 p-3">
                  <div className="mx-auto max-w-4xl space-y-2">
                    {notice ? (
                      <p className="rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-bold text-primary">{notice}</p>
                    ) : null}
                    {attachmentError ? (
                      <p className="rounded-2xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-300">
                        {attachmentError}
                      </p>
                    ) : null}
                    {replyTo || editing ? (
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/75 px-3 py-2">
                        <div className="min-w-0 text-xs">
                          <p className="font-black text-foreground">{editing ? "Editing message" : `Replying to ${replyTo?.sender.name}`}</p>
                          <p className="truncate text-muted-foreground">{editing?.content ?? replyTo?.content ?? replyTo?.attachmentName}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo(null);
                            setEditing(null);
                            setInput("");
                            setSelectedMedia(null);
                          }}
                          className="rounded-xl border border-border bg-background/80 p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Cancel"
                          data-tooltip="false"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2 rounded-[1.4rem] border border-border bg-background px-3 py-2 shadow-inner">
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(event) => onAttachmentSelected(event.target.files)}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!canSend || Boolean(editing)}
                        className="rounded-2xl border border-border bg-card/80 p-2 text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground disabled:opacity-40"
                        aria-label="Attach file"
                        data-tooltip="false"
                      >
                        <Paperclip className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaPickerOpen(true)}
                        disabled={!canSend || Boolean(editing)}
                        className="rounded-2xl border border-border bg-card/80 p-2 text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground disabled:opacity-40"
                        aria-label="Open media picker"
                        data-tooltip="false"
                      >
                        <SmilePlus className="h-5 w-5" />
                      </button>
                      <div className="min-w-0 flex-1">
                        {attachment ? (
                          <div className="mb-1 flex items-center gap-2 rounded-xl bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">
                            <FileText className="h-3.5 w-3.5" />
                            <span className="truncate">{attachment.name}</span>
                            <button type="button" onClick={() => setAttachment(null)} className="ml-auto rounded-lg border border-border bg-background/70 p-1 shadow-sm hover:text-red-500" aria-label="Remove attachment" data-tooltip="false">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : null}
                        {selectedMedia ? (
                          <div className="mb-1 flex items-center gap-2 rounded-xl bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                            <ImageIcon className="h-3.5 w-3.5" />
                            <span className="truncate">{selectedMedia.name}</span>
                            <button type="button" onClick={() => setSelectedMedia(null)} className="ml-auto rounded-lg border border-primary/20 bg-background/70 p-1 hover:text-red-500" aria-label="Remove selected media" data-tooltip="false">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : null}
                        <input
                          value={input}
                          onChange={(event) => setInput(event.target.value)}
                          disabled={!canSend}
                          placeholder={canSend ? `Message ${activeTitle}` : "Messaging unavailable"}
                          className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!canSend || (!input.trim() && !attachment && !selectedMedia)}
                        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label="Send message"
                      >
                        {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                </form>
              </>
            ) : (
              <StatePanel
                icon={<Sparkles className="h-8 w-8" />}
                title="Choose a space"
                description="Open a community, discover a new one, or start a DM."
              />
            )}
          </>
        )}
      </main>

      <aside className="relative z-10 hidden w-[318px] shrink-0 border-l border-border bg-card/65 xl:flex xl:flex-col">
        <div className="border-b border-border p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search users"
              className="h-11 w-full rounded-2xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {searchLoading ? (
            <StatePanel icon={<Loader2 className="h-8 w-8 animate-spin" />} title="Searching" description="" compact />
          ) : searchQuery.trim().length >= 2 ? (
            <div className="space-y-2">
              {searchResults.map((user) => (
                <UserSearchRow
                  key={user.id}
                  user={user}
                  onAddFriend={() => void sendFriendRequest(user)}
                  onDm={() => void startDm(user)}
                />
              ))}
              {searchResults.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border bg-background/45 px-3 py-6 text-center text-sm text-muted-foreground">
                  No matching users.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <SectionHeader icon={<Sparkles className="h-4 w-4" />} label="Discover" />
                <div className="mt-3 space-y-2">
                  {data.discoverCommunities.slice(0, 4).map((community) => (
                    <button
                      key={community.id}
                      type="button"
                      onClick={() => setRulesCommunity(community)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background/70 p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/35"
                    >
                      <AvatarImage url={community.avatarUrl} name={community.name} className="h-10 w-10 rounded-2xl" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black">{community.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{community.memberCount} members</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {rulesCommunity ? (
        <RulesModal community={rulesCommunity} onClose={() => setRulesCommunity(null)} onAgree={() => void joinCommunity(rulesCommunity)} />
      ) : null}

      {manageCommunity ? (
        <ManageCommunityModal
          community={manageCommunity}
          onClose={() => setManageCommunity(null)}
          onDeleted={async () => {
            setManageCommunity(null);
            setActive(null);
            await refreshHub();
          }}
        />
      ) : null}

      {mediaPickerOpen ? (
        <MediaPickerModal
          items={filteredMediaItems}
          loading={mediaLoading}
          query={mediaQuery}
          tab={mediaTab}
          onQueryChange={setMediaQuery}
          onTabChange={setMediaTab}
          onRefresh={() => void loadMediaItems()}
          onSelect={selectMediaItem}
          onClose={() => setMediaPickerOpen(false)}
        />
      ) : null}

      {activeMessageActions ? (
        <MessageActionsModal
          message={activeMessageActions}
          isOwn={activeMessageActions.senderId === currentUser.id}
          canModerate={isOwner}
          onClose={() => setActiveMessageActions(null)}
          onReply={(message) => {
            setEditing(null);
            setReplyTo(message);
            setActiveMessageActions(null);
          }}
          onEdit={beginEdit}
          onDelete={(message) => void deleteMessage(message)}
          onCopy={(message) => void copyMessage(message)}
        />
      ) : null}
    </div>
  );
}

function RailButton({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-tooltip="false"
      className={cn(
        "group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground shadow-sm transition hover:-translate-y-0.5 hover:rounded-xl hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
        active && "rounded-xl border-primary bg-primary text-primary-foreground shadow-primary/20 hover:text-primary-foreground"
      )}
    >
      {children}
      <RailTooltip label={label} />
    </button>
  );
}

function RailTooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-[140] block max-w-56 -translate-y-1/2 translate-x-1 truncate whitespace-nowrap rounded-xl border border-border bg-card/96 px-2.5 py-1.5 text-xs font-black text-foreground opacity-0 shadow-2xl shadow-black/25 ring-1 ring-white/10 backdrop-blur-md transition duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 dark:bg-[#1a1d23]/96">
      {label}
    </span>
  );
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 px-1 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function AvatarImage({ url, name, className }: { url: string | null | undefined; name: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-500 via-sky-500 to-fuchsia-500 text-sm font-black text-white ring-1 ring-white/10",
        className
      )}
      style={
        url
          ? {
              backgroundImage: `url(${url})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }
          : undefined
      }
    >
      {!url ? initials(name) : null}
    </span>
  );
}

function DiscoverPanel({
  communities,
  onJoin,
  onClose,
}: {
  communities: HubCommunity[];
  onJoin: (community: HubCommunity) => void;
  onClose: () => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Discover</p>
          <h2 className="text-2xl font-black text-foreground">Find communities</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-2xl border border-border bg-background/85 p-2 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground" aria-label="Close discover" data-tooltip="false">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {communities.map((community) => (
          <article key={community.id} className="overflow-hidden rounded-[1.4rem] border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-2xl">
            <div
              className="h-28 bg-gradient-to-br from-sky-500 via-emerald-500 to-fuchsia-500"
              style={
                community.badgeUrl
                  ? {
                      backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.28)), url(${community.badgeUrl})`,
                      backgroundPosition: "center",
                      backgroundSize: "cover",
                    }
                  : undefined
              }
            />
            <div className="relative p-4 pt-8">
              <AvatarImage url={community.avatarUrl} name={community.name} className="absolute -top-8 left-4 h-16 w-16 rounded-2xl border-4 border-card" />
              <h3 className="line-clamp-1 text-lg font-black">{community.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{community.topic}</p>
              <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{community.memberCount} members</span>
                <span>{community.messageCount} messages</span>
              </div>
              <button
                type="button"
                onClick={() => onJoin(community)}
                className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-2xl bg-primary text-sm font-black text-primary-foreground hover:bg-primary/90"
              >
                Join
              </button>
            </div>
          </article>
        ))}
      </div>
      {communities.length === 0 ? (
        <StatePanel icon={<Sparkles className="h-8 w-8" />} title="No communities to discover" description="Create the first one and submit it for approval." />
      ) : null}
    </div>
  );
}

function TimelineDivider({ label, tone }: { label: string; tone: "date" | "new" }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-red-500/45" />
      <span className={cn("rounded-full border border-red-500/35 bg-card px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em]", tone === "new" ? "text-red-500" : "text-muted-foreground")}>
        {label}
      </span>
      <span className="h-px flex-1 bg-red-500/45" />
    </div>
  );
}

function MessageGroup({
  item,
  canModerate,
  onOpenActions,
  onReply,
  onEdit,
  onDelete,
  onCopy,
}: {
  item: Extract<TimelineItem, { type: "group" }>;
  canModerate: boolean;
  onOpenActions: (message: ChatMessage) => void;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onCopy: (message: ChatMessage) => void;
}) {
  return (
    <article className={cn("flex gap-3", item.isOwn && "flex-row-reverse")}>
      <AvatarImage url={item.sender.avatar} name={item.sender.name} className="mt-7 h-10 w-10 rounded-2xl" />
      <div className={cn("min-w-0 max-w-[78%]", item.isOwn && "items-end")}>
        <div className={cn("mb-1 flex items-center gap-2 text-xs text-muted-foreground", item.isOwn && "justify-end")}>
          <span className="font-black text-foreground">{item.sender.name}</span>
          <span>{formatClock(item.createdAt)}</span>
        </div>
        <div className={cn("space-y-1", item.isOwn && "flex flex-col items-end")}>
          {item.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={item.isOwn}
              canModerate={canModerate}
              onOpenActions={onOpenActions}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onCopy={onCopy}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

function MessageBubble({
  message,
  isOwn,
  canModerate,
  onOpenActions,
  onReply,
  onEdit,
  onDelete,
  onCopy,
}: {
  message: ChatMessage;
  isOwn: boolean;
  canModerate: boolean;
  onOpenActions: (message: ChatMessage) => void;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onCopy: (message: ChatMessage) => void;
}) {
  const deleted = Boolean(message.deletedAt);

  return (
    <div className={cn("group/message relative", isOwn && "text-right")}>
      {!deleted ? (
        <div className={cn("absolute -top-11 z-20 hidden rounded-full border border-border bg-card/95 p-1 shadow-2xl backdrop-blur-md group-hover/message:flex", isOwn ? "right-2" : "left-2")}>
          <MessageActionButton icon={<MessageCircle className="h-4 w-4" />} label="Reply" onClick={() => onReply(message)} />
          <MessageActionButton icon={<Copy className="h-4 w-4" />} label="Copy" onClick={() => onCopy(message)} />
          {isOwn ? <MessageActionButton icon={<Edit3 className="h-4 w-4" />} label="Edit" onClick={() => onEdit(message)} /> : null}
          {isOwn || canModerate ? <MessageActionButton icon={<Trash2 className="h-4 w-4" />} label="Delete" onClick={() => onDelete(message)} danger /> : null}
        </div>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpenActions(message)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenActions(message);
          }
        }}
        className={cn(
          "max-w-full cursor-pointer rounded-[1.15rem] border px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
          isOwn
            ? "rounded-br-md border-emerald-500/25 bg-emerald-500/14 text-foreground"
            : "rounded-bl-md border-border bg-card text-foreground",
          message.deliveryStatus === "failed" && "border-red-500/40 bg-red-500/10"
        )}
      >
        {message.replyTo ? (
          <div className="mb-2 rounded-xl border-l-2 border-primary bg-background/70 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-black text-foreground">{message.replyTo.sender.name}</span>
            <span className="ml-2 line-clamp-1">{message.replyTo.content || message.replyTo.attachmentName || "Deleted message"}</span>
          </div>
        ) : null}
        {deleted ? (
          <p className="text-sm italic text-muted-foreground">Message deleted</p>
        ) : (
          <>
            {message.content ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p> : null}
            {message.attachmentUrl ? (
              <MediaAttachment message={message} />
            ) : message.attachmentName ? (
              <span className="mt-2 inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-background/80 px-3 py-2 text-xs font-bold text-muted-foreground">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">{message.attachmentName}</span>
              </span>
            ) : null}
            {message.editedAt ? <span className="mt-1 block text-[10px] font-bold text-muted-foreground">edited</span> : null}
            {message.deliveryStatus && message.deliveryStatus !== "sent" ? (
              <span className={cn("mt-1 block text-[10px] font-black uppercase tracking-[0.12em]", message.deliveryStatus === "failed" ? "text-red-500" : "text-muted-foreground")}>
                {message.deliveryStatus}
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function MediaAttachment({ message }: { message: ChatMessage }) {
  const isImage = message.attachmentType?.startsWith("image/") || /\.(gif|png|jpe?g|webp)$/i.test(message.attachmentUrl ?? "");
  if (isImage && message.attachmentUrl) {
    return (
      <a href={message.attachmentUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="mt-2 block overflow-hidden rounded-2xl border border-border bg-background/80">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={message.attachmentUrl} alt={message.attachmentName ?? "message media"} className="max-h-64 w-full object-cover" />
      </a>
    );
  }

  return (
    <a
      href={message.attachmentUrl ?? "#"}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
      className="mt-2 inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-background/80 px-3 py-2 text-xs font-bold text-primary hover:bg-muted"
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate">{message.attachmentName ?? "Attachment"}</span>
      {message.attachmentSize ? <span className="text-muted-foreground">{formatBytes(message.attachmentSize)}</span> : null}
    </a>
  );
}

function MessageActionButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn("flex h-8 min-w-8 items-center justify-center gap-1 rounded-full px-2 text-xs font-black text-muted-foreground hover:bg-muted hover:text-foreground", danger && "hover:bg-red-500/10 hover:text-red-500")}
      title={label}
      data-tooltip="false"
    >
      {icon}
    </button>
  );
}

function MessageActionsModal({
  message,
  isOwn,
  canModerate,
  onClose,
  onReply,
  onEdit,
  onDelete,
  onCopy,
}: {
  message: ChatMessage;
  isOwn: boolean;
  canModerate: boolean;
  onClose: () => void;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onCopy: (message: ChatMessage) => void;
}) {
  const quick = ["❤️", "👍", "👎", "🔥", "😊", "👏"];
  const deleted = Boolean(message.deletedAt);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/20 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="w-full max-w-xs overflow-hidden rounded-[1.4rem] border border-border bg-card/96 shadow-2xl backdrop-blur-xl" onClick={(event) => event.stopPropagation()}>
        {!deleted ? (
          <div className="flex items-center justify-center gap-1 border-b border-border bg-background/50 p-2">
            {quick.map((emoji) => (
              <button key={emoji} type="button" className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-xl shadow-sm hover:bg-muted" onClick={onClose}>
                {emoji}
              </button>
            ))}
          </div>
        ) : null}
        <div className="p-2">
          <ModalAction icon={<MessageCircle className="h-4 w-4" />} label="Reply" onClick={() => onReply(message)} disabled={deleted} />
          {isOwn ? <ModalAction icon={<Edit3 className="h-4 w-4" />} label="Edit" onClick={() => onEdit(message)} disabled={deleted || message.id.startsWith("optimistic-")} /> : null}
          <ModalAction icon={<Copy className="h-4 w-4" />} label="Copy Text" onClick={() => {
            onCopy(message);
            onClose();
          }} disabled={deleted} />
          {(isOwn || canModerate) ? <ModalAction icon={<Trash2 className="h-4 w-4" />} label="Delete" onClick={() => onDelete(message)} danger disabled={deleted} /> : null}
        </div>
        <div className="border-t border-border bg-background/55 px-4 py-3 text-xs text-muted-foreground">
          <CheckCircle2 className="mr-2 inline h-3.5 w-3.5" />
          sent {formatClock(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

function ModalAction({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn("flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-sm font-black text-foreground hover:bg-muted disabled:opacity-40", danger && "text-red-500 hover:bg-red-500/10")}
    >
      {icon}
      {label}
    </button>
  );
}

function MediaPickerModal({
  items,
  loading,
  query,
  tab,
  onQueryChange,
  onTabChange,
  onRefresh,
  onSelect,
  onClose,
}: {
  items: CommunityMediaItem[];
  loading: boolean;
  query: string;
  tab: CommunityMediaType | "ALL";
  onQueryChange: (value: string) => void;
  onTabChange: (value: CommunityMediaType | "ALL") => void;
  onRefresh: () => void;
  onSelect: (item: CommunityMediaItem) => void;
  onClose: () => void;
}) {
  const tabs: Array<CommunityMediaType | "ALL"> = ["ALL", "EMOJI", "STICKER", "GIF"];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-[1.6rem] border border-border bg-card/96 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Media picker</p>
            <h2 className="text-lg font-black text-foreground">Emoticons, stickers, and GIFs</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-border bg-background/80 p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close media picker" data-tooltip="false">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="border-b border-border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search media"
                className="h-11 w-full rounded-2xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus:border-primary/50"
              />
            </div>
            <button type="button" onClick={onRefresh} className="h-11 rounded-2xl border border-border bg-background px-4 text-sm font-black text-foreground hover:bg-muted">
              Refresh
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {tabs.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onTabChange(item)}
                className={cn("rounded-2xl border border-border bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground hover:bg-muted", tab === item && "border-primary bg-primary/10 text-primary")}
              >
                {item.toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
              {items.map((item) => (
                <button key={item.id} type="button" onClick={() => onSelect(item)} className="group overflow-hidden rounded-2xl border border-border bg-background/80 p-2 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/45">
                  <MediaPickerPreview item={item} />
                  <span className="mt-2 block truncate text-xs font-bold text-muted-foreground group-hover:text-foreground">{item.name}</span>
                </button>
              ))}
            </div>
          )}
          {!loading && items.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-border bg-background/50 text-sm text-muted-foreground">
              No media found.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MediaPickerPreview({ item }: { item: CommunityMediaItem }) {
  if (item.type === "EMOJI") {
    return <span className="flex aspect-square items-center justify-center rounded-2xl bg-card text-4xl shadow-inner">{item.value}</span>;
  }
  return (
    <span className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-card shadow-inner">
      {item.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
      ) : (
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
      )}
    </span>
  );
}

function UserSearchRow({ user, onAddFriend, onDm }: { user: SearchUser; onAddFriend: () => void; onDm: () => void }) {
  const friendLabel =
    user.outgoingFriendStatus === "PENDING"
      ? "Pending"
      : user.outgoingFriendStatus === "ACCEPTED" || user.incomingFriendStatus === "ACCEPTED"
        ? "Friend"
        : "Add";
  const friendDisabled = friendLabel !== "Add";

  return (
    <div className="rounded-2xl border border-border bg-background/72 p-3">
      <div className="flex items-center gap-3">
        <AvatarImage url={user.avatar} name={user.name} className="h-11 w-11 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.username ? `@${user.username}` : user.email}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onAddFriend}
          disabled={friendDisabled}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border bg-background/75 text-xs font-black text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
        >
          <UserPlus className="h-3.5 w-3.5" />
          {friendLabel}
        </button>
        <button
          type="button"
          onClick={onDm}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-primary text-xs font-black text-primary-foreground hover:bg-primary/90"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          DM
        </button>
      </div>
    </div>
  );
}

function RulesModal({
  community,
  onClose,
  onAgree,
}: {
  community: HubCommunity;
  onClose: () => void;
  onAgree: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-2xl">
        <div className="relative h-32 bg-gradient-to-br from-emerald-500 via-sky-500 to-fuchsia-500">
          {community.badgeUrl ? (
            <span
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${community.badgeUrl})` }}
            />
          ) : null}
          <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-2xl border border-white/15 bg-black/50 p-2 text-white shadow-lg hover:bg-black/65" aria-label="Close rules" data-tooltip="false">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">
          <div className="-mt-12 mb-4 flex items-end gap-3">
            <AvatarImage url={community.avatarUrl} name={community.name} className="h-20 w-20 rounded-[1.4rem] border-4 border-card" />
            <div className="pb-1">
              <h2 className="text-xl font-black">{community.name}</h2>
              <p className="text-sm text-muted-foreground">{community.memberCount} members</p>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-border bg-background/75 p-4 text-sm leading-6">
            {community.rules}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose} className="h-11 rounded-2xl border border-border bg-background/80 text-sm font-black shadow-sm hover:bg-muted">
              Cancel
            </button>
            <button type="button" onClick={onAgree} className="h-11 rounded-2xl bg-primary text-sm font-black text-primary-foreground hover:bg-primary/90">
              Agree and enter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManageCommunityModal({
  community,
  onClose,
  onDeleted,
}: {
  community: HubCommunity;
  onClose: () => void;
  onDeleted: () => void | Promise<void>;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/community/communities/${community.id}/members`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    const json = await readJsonResponse<ApiResponse<{ members: Member[] }>>(response);
    setMembers(json.success && json.data ? json.data.members : []);
    setLoading(false);
  }, [community.id]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadMembers(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadMembers]);

  async function act(userId: string, action: "block" | "unblock" | "remove") {
    const reason = action === "unblock" ? undefined : window.prompt(`Reason to ${action} this member:`)?.trim();
    if (action !== "unblock" && !reason) return;
    const response = await secureFetch(`/api/community/communities/${community.id}/members`, {
      method: "PATCH",
      body: JSON.stringify({ userId, action, reason }),
    });
    const json = await readJsonResponse<ApiResponse<unknown>>(response);
    if (!json.success) {
      setMessage(json.error ?? "Action failed.");
      return;
    }
    await loadMembers();
  }

  async function deleteCommunity() {
    if (!window.confirm(`Delete ${community.name}?`)) return;
    const response = await secureFetch(`/api/community/communities/${community.id}`, { method: "DELETE" });
    const json = await readJsonResponse<ApiResponse<unknown>>(response);
    if (!json.success) {
      setMessage(json.error ?? "Could not delete community.");
      return;
    }
    await onDeleted();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="text-lg font-black">Manage {community.name}</h2>
            <p className="text-xs text-muted-foreground">Owner controls</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-border bg-background/80 p-2 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground" aria-label="Close management" data-tooltip="false">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {message ? <p className="mb-3 rounded-2xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">{message}</p> : null}
          {loading ? (
            <StatePanel icon={<Loader2 className="h-8 w-8 animate-spin" />} title="Loading members" description="" compact />
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background/70 p-3">
                  <AvatarImage url={member.user.avatar} name={member.user.name} className="h-10 w-10 rounded-2xl" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{member.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.role.toLowerCase()} · {member.status.toLowerCase()}
                    </p>
                  </div>
                  {member.role !== "OWNER" ? (
                    <div className="flex gap-1">
                      {member.status === "BLOCKED" ? (
                        <button type="button" onClick={() => void act(member.user.id, "unblock")} className="rounded-xl border border-border bg-background/80 px-2 py-1 text-xs font-bold shadow-sm hover:bg-muted">
                          Unblock
                        </button>
                      ) : (
                        <button type="button" onClick={() => void act(member.user.id, "block")} className="rounded-xl border border-border bg-background/80 px-2 py-1 text-xs font-bold shadow-sm hover:bg-muted" aria-label="Block member" data-tooltip="false">
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button type="button" onClick={() => void act(member.user.id, "remove")} className="rounded-xl border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-bold text-red-600 shadow-sm hover:bg-red-500/15">
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-border p-4">
          <button type="button" onClick={() => void deleteCommunity()} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-red-600 px-4 text-sm font-black text-white hover:bg-red-500">
            <Trash2 className="h-4 w-4" />
            Delete community
          </button>
        </div>
      </div>
    </div>
  );
}

function StatePanel({
  icon,
  title,
  description,
  compact,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-1 items-center justify-center p-8 text-center", compact && "min-h-56")}>
      <div className="max-w-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-border bg-card text-primary shadow-sm">
          {icon}
        </div>
        <h3 className="text-lg font-black text-foreground">{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}

async function secureFormFetch(url: string, formData: FormData) {
  return fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "x-csrf-token": await getCsrfToken(),
    },
    body: formData,
  });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "C";
}

function buildTimeline(messages: ChatMessage[], currentUserId: string): TimelineItem[] {
  const items: TimelineItem[] = [];
  let lastDateKey = "";
  let previousMessage: ChatMessage | null = null;
  let currentGroup: Extract<TimelineItem, { type: "group" }> | null = null;

  for (const message of messages) {
    const createdAt = new Date(message.createdAt);
    const dateKey = Number.isNaN(createdAt.getTime()) ? message.createdAt.slice(0, 10) : createdAt.toDateString();

    if (dateKey !== lastDateKey) {
      items.push({
        type: "divider",
        id: `date-${dateKey}-${message.id}`,
        label: formatDateDivider(message.createdAt),
        tone: "date",
      });
      lastDateKey = dateKey;
      currentGroup = null;
    }

    if (previousMessage) {
      const gap = new Date(message.createdAt).getTime() - new Date(previousMessage.createdAt).getTime();
      if (gap >= NEW_MESSAGE_GAP_MS) {
        items.push({ type: "divider", id: `new-${message.id}`, label: "NEW", tone: "new" });
        currentGroup = null;
      }
    }

    const gapFromPrevious = previousMessage
      ? new Date(message.createdAt).getTime() - new Date(previousMessage.createdAt).getTime()
      : Number.POSITIVE_INFINITY;
    const shouldJoinGroup =
      currentGroup &&
      previousMessage &&
      previousMessage.senderId === message.senderId &&
      gapFromPrevious < MESSAGE_GROUP_GAP_MS &&
      !message.replyToId;

    if (shouldJoinGroup && currentGroup) {
      currentGroup.messages.push(message);
    } else {
      currentGroup = {
        type: "group",
        id: `group-${message.id}`,
        messages: [message],
        sender: message.sender,
        isOwn: message.senderId === currentUserId,
        createdAt: message.createdAt,
      };
      items.push(currentGroup);
    }

    previousMessage = message;
  }

  return items;
}

function mergeIncomingMessage(current: ChatMessage[], incoming: ChatMessage, currentUserId: string) {
  const normalizedIncoming = { ...incoming, deliveryStatus: "sent" as const };
  const existingIndex = current.findIndex((message) => message.id === incoming.id);
  if (existingIndex >= 0) {
    return current.map((message, index) => (index === existingIndex ? normalizedIncoming : message));
  }

  const optimisticIndex = current.findIndex(
    (message) =>
      message.id.startsWith("optimistic-") &&
      message.senderId === incoming.senderId &&
      message.senderId === currentUserId &&
      (message.content ?? "") === (incoming.content ?? "") &&
      (message.replyToId ?? "") === (incoming.replyToId ?? "") &&
      (message.attachmentName ?? "") === (incoming.attachmentName ?? "")
  );

  if (optimisticIndex >= 0) {
    return current.map((message, index) => (index === optimisticIndex ? normalizedIncoming : message));
  }

  return [...current, normalizedIncoming].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function isChatEventPayload(payload: unknown): payload is ChatEventPayload {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Partial<ChatEventPayload>;
  return (
    (value.type === "community.message" && typeof value.communityId === "string" && Boolean(value.message)) ||
    (value.type === "dm.message" && typeof value.conversationId === "string" && Boolean(value.message))
  );
}

function formatClock(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateDivider(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
