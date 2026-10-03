"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://localhost:4000";

type Conversation = {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type Message = {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
};

export default function ChatPage() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);

  const [message, setMessage] = useState("");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [deletingConversationId, setDeletingConversationId] =
    useState<number | null>(null);

  const [loadingConversationId, setLoadingConversationId] =
    useState<number | null>(null);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /*
  ============================================================
  AUTHENTICATION
  ============================================================
  */

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          localStorage.removeItem("token");
          router.replace("/login");
          return;
        }

        await loadConversations();

        setCheckingAuth(false);
      } catch (error) {
        console.error("Auth check failed:", error);

        localStorage.removeItem("token");
        router.replace("/login");
      }
    };

    checkAuth();
  }, [router]);

  /*
  ============================================================
  AUTO SCROLL
  ============================================================
  */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, sending]);

  /*
  ============================================================
  LOGOUT
  ============================================================
  */

  function handleLogout() {
    localStorage.removeItem("token");
    router.replace("/login");
  }

  /*
  ============================================================
  NEW CHAT
  ============================================================
  */

  function handleNewChat() {
    setConversationId(null);
    setMessages([]);
    setMessage("");
    setError("");

    textareaRef.current?.focus();
  }

  /*
  ============================================================
  LOAD CONVERSATIONS
  ============================================================
  */

  async function loadConversations() {
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/conversations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load conversations");
      }

      const data = await response.json();

      setConversations(data.conversations);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  }

  /*
  ============================================================
  LOAD INDIVIDUAL CONVERSATION
  ============================================================
  */

  async function loadConversation(id: number) {
    if (sending || loadingConversationId !== null) {
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      setError("");
      setLoadingConversationId(id);

      const response = await fetch(
        `${API_URL}/api/conversations/${id}/messages`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load conversation");
      }

      const data = await response.json();

      setConversationId(data.conversation.id);
      setMessages(data.messages);
      setMessage("");

      textareaRef.current?.focus();
    } catch (error) {
      console.error("Failed to load conversation:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Failed to load conversation."
      );
    } finally {
      setLoadingConversationId(null);
    }
  }

  /*
  ============================================================
  DELETE CONVERSATION
  ============================================================
  */

  async function handleDeleteConversation(id: number) {
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      setError("");
      setDeletingConversationId(id);

      const response = await fetch(
        `${API_URL}/api/conversations/${id}`,
        {
          method: "DELETE",

          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);

        throw new Error(
          data?.error || "Failed to delete conversation."
        );
      }

      /*
       * Immediately remove the conversation
       * from the sidebar.
       */
      setConversations((previous) =>
        previous.filter(
          (conversation) => conversation.id !== id
        )
      );

      /*
       * If the deleted conversation is currently
       * open, reset the chat.
       */
      if (conversationId === id) {
        setConversationId(null);
        setMessages([]);
        setMessage("");
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete conversation."
      );
    } finally {
      setDeletingConversationId(null);
    }
  }

  /*
  ============================================================
  SEND MESSAGE
  ============================================================
  */

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();

    const trimmedMessage = message.trim();

    if (!trimmedMessage || sending) {
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/login");
      return;
    }

    /*
     * Remember whether this is the first message
     * of a new conversation.
     */
    const isNewConversation = conversationId === null;

    setError("");
    setSending(true);

    /*
     * Immediately show the user's message.
     *
     * This makes the UI feel responsive while the
     * backend is processing the request.
     */
    const temporaryUserMessage: Message = {
      id: Date.now(),
      role: "user",
      content: trimmedMessage,
      createdAt: new Date().toISOString(),
    };

    setMessages((previous) => [
      ...previous,
      temporaryUserMessage,
    ]);

    setMessage("");

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          ...(conversationId !== null && {
            conversationId,
          }),

          message: trimmedMessage,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);

        throw new Error(
          data?.error || "Failed to send message."
        );
      }

      const data = await response.json();

      /*
       * Backend gives us the conversation ID.
       */
      setConversationId(data.conversationId);

      /*
       * Add assistant response.
       */
      setMessages((previous) => [
        ...previous,
        data.message,
      ]);

      /*
       * If this was the first message, the backend
       * created a new conversation.
       *
       * Add it directly to React state.
       *
       * No page reload.
       * No GET request required.
       */
      if (isNewConversation) {
        const newConversation: Conversation = {
          id: data.conversationId,

          /*
           * For Phase 1, simply use the first
           * user message as the title.
           */
          title:
            trimmedMessage.length > 50
              ? `${trimmedMessage.slice(0, 50)}...`
              : trimmedMessage,

          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setConversations((previous) => [
          newConversation,
          ...previous,
        ]);
      } else {
        /*
         * Existing conversation was updated.
         *
         * Move it to the top of the sidebar and
         * update its timestamp.
         */
        setConversations((previous) => {
          const updated = previous.map((conversation) =>
            conversation.id === data.conversationId
              ? {
                  ...conversation,
                  updatedAt: new Date().toISOString(),
                }
              : conversation
          );

          return updated.sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() -
              new Date(a.updatedAt).getTime()
          );
        });
      }
    } catch (error) {
      console.error("Chat request failed:", error);

      /*
       * Remove the temporary user message if
       * the request failed.
       */
      setMessages((previous) =>
        previous.filter(
          (item) => item.id !== temporaryUserMessage.id
        )
      );

      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setSending(false);

      textareaRef.current?.focus();
    }
  }

  /*
  ============================================================
  ENTER KEY
  ============================================================
  */

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      handleSubmit();
    }
  }

  /*
  ============================================================
  LOADING SCREEN
  ============================================================
  */

  if (checkingAuth) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fafafa]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.04),transparent_45%)]" />

        <div className="relative flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black shadow-lg shadow-black/10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Loading workspace</span>

            <span className="flex gap-0.5">
              <span className="h-1 w-1 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-gray-400" />
            </span>
          </div>
        </div>
      </main>
    );
  }

  /*
  ============================================================
  MAIN UI
  ============================================================
  */

  return (
    <main className="flex h-screen overflow-hidden bg-white text-gray-900">

      {/* =====================================================
          SIDEBAR
      ====================================================== */}

      <aside className="hidden w-70 shrink-0 flex-col border-r border-gray-200 bg-[#fafafa] md:flex">

        {/* Brand */}

        <div className="flex h-18 items-center border-b border-gray-200 px-5">
          <div className="flex items-center gap-3">

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black shadow-sm">
              <span className="text-base text-white">
                ✦
              </span>
            </div>

            <div>
              <h1 className="text-sm font-semibold tracking-tight text-gray-950">
                AI Assistant
              </h1>

              <p className="text-[11px] text-gray-400">
                Your AI workspace
              </p>
            </div>

          </div>
        </div>

        {/* New Chat */}

        <div className="p-4">
          <button
            onClick={handleNewChat}
            disabled={sending}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md border border-white/20 text-sm transition group-hover:rotate-90">
              +
            </span>

            New chat
          </button>
        </div>

        {/* Conversations */}

        <div className="flex-1 overflow-y-auto px-3">

          <div className="mb-2 flex items-center justify-between px-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
              Conversations
            </p>

            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-400">
              {conversations.length}
            </span>
          </div>

          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">

              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
                <span className="text-sm text-gray-400">
                  ✦
                </span>
              </div>

              <p className="text-sm font-medium text-gray-600">
                No conversations yet
              </p>

              <p className="mt-1 max-w-45 text-xs leading-5 text-gray-400">
                Your conversations will appear here once you start chatting.
              </p>

            </div>
          ) : (
            <div className="space-y-1">

              {conversations.map((conversation) => {
                const isActive =
                  conversation.id === conversationId;

                const isLoading =
                  loadingConversationId === conversation.id;

                const isDeleting =
                  deletingConversationId === conversation.id;

                return (
                  <div
                    key={conversation.id}
                    className={`group flex items-center gap-1 rounded-xl transition ${
                      isActive
                        ? "bg-gray-200"
                        : "hover:bg-gray-100"
                    }`}
                  >

                    {/* Conversation */}

                    <button
                      onClick={() =>
                        loadConversation(conversation.id)
                      }
                      disabled={
                        sending ||
                        isDeleting ||
                        loadingConversationId !== null
                      }
                      className="min-w-0 flex-1 px-3 py-2.5 text-left disabled:cursor-not-allowed"
                    >

                      {isLoading ? (
                        <div className="flex items-center gap-2">

                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />

                          <span className="text-sm text-gray-400">
                            Loading...
                          </span>

                        </div>
                      ) : (
                        <p
                          className={`truncate text-sm ${
                            isActive
                              ? "font-medium text-gray-900"
                              : "text-gray-600"
                          }`}
                        >
                          {conversation.title ||
                            "Untitled conversation"}
                        </p>
                      )}

                    </button>

                    {/* Delete */}

                    <button
                      onClick={() =>
                        handleDeleteConversation(
                          conversation.id
                        )
                      }
                      disabled={
                        isDeleting ||
                        loadingConversationId !== null ||
                        sending
                      }
                      className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Delete conversation"
                    >

                      {isDeleting ? (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
                      ) : (
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v5" />
                          <path d="M14 11v5" />
                        </svg>
                      )}

                    </button>

                  </div>
                );
              })}

            </div>
          )}

        </div>

        {/* User */}

        <div className="border-t border-gray-200 p-3">

          <div className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-gray-100">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white shadow-sm">
              U
            </div>

            <div className="min-w-0 flex-1">

              <p className="truncate text-sm font-medium text-gray-800">
                User
              </p>

              <div className="mt-0.5 flex items-center gap-1.5">

                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

                <p className="text-[11px] text-gray-400">
                  Online
                </p>

              </div>

            </div>

            <button
              onClick={handleLogout}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-400 transition hover:bg-red-50 hover:text-red-600"
            >
              Logout
            </button>

          </div>

        </div>

      </aside>

      {/* =====================================================
          MAIN
      ====================================================== */}

      <section className="flex min-w-0 flex-1 flex-col bg-white">

        {/* Header */}

        <header className="flex h-18 shrink-0 items-center justify-between border-b border-gray-200 px-4 sm:px-6">

          <div className="min-w-0">

            <div className="flex items-center gap-2">

              <h2 className="truncate text-sm font-semibold text-gray-900">
                {conversationId
                  ? "Conversation"
                  : "New conversation"}
              </h2>

              <span className="hidden rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-400 sm:inline-block">
                AI
              </span>

            </div>

            <p className="mt-0.5 text-xs text-gray-400">
              {conversationId
                ? "Continue your conversation"
                : "Start a new conversation with your assistant"}
            </p>

          </div>

          {/* Mobile logout */}

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 md:hidden"
          >
            Logout
          </button>

        </header>

        {/* =================================================
            CHAT BODY
        ================================================== */}

        <div className="flex-1 overflow-y-auto">

          {messages.length === 0 ? (

            /* Empty state */

            <div className="flex min-h-full items-center justify-center px-4">

              <div className="mx-auto w-full max-w-2xl py-12 text-center">

                <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center">

                  <div className="absolute inset-0 rounded-2xl bg-gray-100 blur-sm" />

                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm">

                    <span className="text-2xl text-gray-900">
                      ✦
                    </span>

                  </div>

                </div>

                <h3 className="text-[28px] font-semibold tracking-tight text-gray-950 sm:text-3xl">
                  How can I help you?
                </h3>

                <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-gray-500">
                  Ask questions, explore ideas, debug code, or work through
                  complex problems with your AI assistant.
                </p>

                <div className="mx-auto mt-9 grid max-w-2xl gap-3 sm:grid-cols-2">

                  <Suggestion
                    title="Explain a concept"
                    description="Break down something difficult"
                    onClick={() =>
                      setMessage(
                        "Explain a programming concept simply."
                      )
                    }
                  />

                  <Suggestion
                    title="Debug some code"
                    description="Find and understand a problem"
                    onClick={() =>
                      setMessage("Help me debug some code.")
                    }
                  />

                  <Suggestion
                    title="Learn something"
                    description="Explore a new technical topic"
                    onClick={() =>
                      setMessage(
                        "Teach me something interesting."
                      )
                    }
                  />

                  <Suggestion
                    title="Plan a project"
                    description="Turn an idea into a plan"
                    onClick={() =>
                      setMessage(
                        "Help me plan a software project."
                      )
                    }
                  />

                </div>

              </div>

            </div>

          ) : (

            /* Messages */

            <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">

              <div className="space-y-6">

                {messages.map((item) => (
                  <MessageBubble
                    key={item.id}
                    message={item}
                  />
                ))}

                {sending && (
                  <div className="flex items-start gap-3">

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-xs text-white">
                      ✦
                    </div>

                    <div className="rounded-2xl bg-gray-100 px-4 py-3">

                      <div className="flex gap-1">

                        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />

                        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />

                        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />

                      </div>

                    </div>

                  </div>
                )}

                <div ref={messagesEndRef} />

              </div>

            </div>

          )}

        </div>

        {/* =================================================
            INPUT
        ================================================== */}

        <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-4 sm:px-5 sm:py-5">

          <form
            onSubmit={handleSubmit}
            className="mx-auto max-w-3xl"
          >

            {error && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                {error}
              </div>
            )}

            <div className="group flex items-end gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-2 transition focus-within:border-gray-300 focus-within:bg-white focus-within:shadow-sm">

              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) =>
                  setMessage(e.target.value)
                }
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={sending}
                placeholder="Message your AI assistant..."
                className="max-h-40 min-h-10.5 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={
                  !message.trim() || sending
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Send message"
              >

                {sending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 19V5" />
                    <path d="m5 12 7-7 7 7" />
                  </svg>
                )}

              </button>

            </div>

            <p className="mt-2.5 text-center text-[11px] text-gray-400">
              AI responses can make mistakes. Verify important information.
            </p>

          </form>

        </div>

      </section>

    </main>
  );
}

/*
============================================================
MESSAGE BUBBLE
============================================================
*/

function MessageBubble({
  message,
}: {
  message: Message;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex items-start gap-3 ${
        isUser
          ? "justify-end"
          : "justify-start"
      }`}
    >

      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-xs text-white">
          ✦
        </div>
      )}

      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${
          isUser
            ? "bg-black text-white"
            : "bg-gray-100 text-gray-800"
        }`}
      >
        <p className="whitespace-pre-wrap">
          {message.content}
        </p>
      </div>

    </div>
  );
}

/*
============================================================
SUGGESTION
============================================================
*/

function Suggestion({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-gray-300 hover:shadow-sm"
    >

      <div className="flex items-center justify-between">

        <span className="text-sm font-medium text-gray-700">
          {title}
        </span>

        <span className="text-gray-300 transition-transform group-hover:translate-x-0.5">
          →
        </span>

      </div>

      <p className="mt-1 text-xs leading-5 text-gray-400">
        {description}
      </p>

    </button>
  );
}