import { useState, useEffect, useRef, FormEvent } from "react";
import { Send, AlertCircle, User, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { chatClient } from "@/lib/chatClient";
import { detectLocale, translations, t, type Locale } from "@/lib/lang";
import type { Message } from "@/lib/chatClient";

export default function SupportChat() {
  const SID_KEY = "chat_session_id";
  const [locale, setLocale] = useState<Locale>(detectLocale());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showEscalateDialog, setShowEscalateDialog] = useState(false);
  const [showHealthCheck, setShowHealthCheck] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{ ok: boolean; error?: string } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ensure we have a server session id and first message
  useEffect(() => {
    let mounted = true;

    async function ensureSidAndGreeting() {
      // 1) Reuse sid if we already have one
      let sid = localStorage.getItem(SID_KEY);
      if (!sid) {
        // 2) Ask backend to start a session (gets server sid + first reply)
        const start = await chatClient.start();
        sid = start.session_id;
        localStorage.setItem(SID_KEY, sid);
        if (mounted && start?.reply) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: start.reply, timestamp: Date.now() },
          ]);
        }
      }
      if (mounted) setSessionId(sid);
    }

    if (!sessionId) ensureSidAndGreeting();

    return () => {
      mounted = false;
    };
  }, [sessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Detect language switching (tolerant of typos)
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "user") {
      const content = lastMessage.content.toLowerCase();
      if (/\b(english|inglese|engl\w*)\b/i.test(content)) {
        if (locale !== "en") setLocale("en");
      } else if (/\b(italian|italiano|ital\w*)\b/i.test(content)) {
        if (locale !== "it") setLocale("it");
      }
    }
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    const SID_KEY = "chat_session_id";

    // Make sure we have a server session id
    let sid = sessionId || localStorage.getItem(SID_KEY);
    if (!sid) {
      const start = await chatClient.start();
      sid = start.session_id;
      localStorage.setItem(SID_KEY, sid);
      setSessionId(sid);
      if (start?.reply) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: start.reply, timestamp: Date.now() },
        ]);
      }
    }

    const userMessage: Message = {
      role: "user",
      content: content.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await chatClient.askBackend({
        message: content.trim(),
        sessionId: sid!,
        locale,
      });

      await new Promise((r) => setTimeout(r, 800));

      if (response.error) {
        setMessages((prev) => [
          ...prev,
          { role: "system", content: `error:${response.error}`, timestamp: Date.now() },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: response.reply, timestamp: Date.now() },
        ]);

        if (response.suggestions?.length) {
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: `suggestions:${JSON.stringify(response.suggestions)}`,
              timestamp: Date.now(),
            },
          ]);
        }
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "system", content: "error:unknown_error", timestamp: Date.now() },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickReply = (text: string) => {
    sendMessage(text);
  };

  const handleEscalate = async () => {
    setShowEscalateDialog(false);
    
    try {
      const result = await chatClient.escalate({
        sessionId,
        reason: "user_requested",
        transcript: messages,
      });

      if (result.success) {
        const escalatedMessage: Message = {
          role: "system",
          content: t(locale, "escalated"),
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, escalatedMessage]);
      } else {
        const errorMessage: Message = {
          role: "system",
          content: `error:${result.error || "unknown_error"}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error("Escalation error:", error);
    }
  };

  const handleHealthCheck = async () => {
    setShowHealthCheck(true);
    const status = await chatClient.checkHealth();
    setHealthStatus(status);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const retryLastMessage = () => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMessage) {
      // Remove error message
      setMessages((prev) => prev.filter((m) => m !== prev[prev.length - 1]));
      sendMessage(lastUserMessage.content);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Ilaria" />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">IL</AvatarFallback>
            </Avatar>
            <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-[hsl(var(--status-online))]" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-semibold text-foreground">
              {t(locale, "agentName")}
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                {t(locale, "online")}
              </Badge>
              <span>{t(locale, "slaInfo")}</span>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowEscalateDialog(true)}
          className="text-xs"
        >
          <User className="mr-1.5 h-3.5 w-3.5" />
          {t(locale, "escalate")}
        </Button>
      </header>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <MessageBubble
            key={index}
            message={message}
            locale={locale}
            onQuickReply={handleQuickReply}
            onRetry={retryLastMessage}
          />
        ))}
        
        {isTyping && <TypingIndicator />}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="border-t bg-card p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t(locale, "placeholder")}
            className="min-h-[44px] max-h-32 resize-none"
            disabled={isTyping}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isTyping}
            className="h-11 w-11 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Health Check (hidden in footer) */}
      <button
        onClick={handleHealthCheck}
        className="absolute bottom-2 left-2 text-[10px] text-muted-foreground/50 hover:text-muted-foreground opacity-20 hover:opacity-100 transition-opacity"
      >
        {t(locale, "healthCheck")}
      </button>

      {/* Escalate Dialog */}
      <AlertDialog open={showEscalateDialog} onOpenChange={setShowEscalateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(locale, "escalateTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(locale, "escalateMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t(locale, "escalateCancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleEscalate}>
              {t(locale, "escalateConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Health Status Dialog */}
      {showHealthCheck && healthStatus && (
        <div className="fixed bottom-20 left-4 z-50 animate-in slide-in-from-bottom-4">
          <Card className="p-3 shadow-lg border-2">
            <div className="flex items-center gap-2">
              {healthStatus.ok ? (
                <>
                  <CheckCircle className="h-4 w-4 text-[hsl(var(--status-online))]" />
                  <span className="text-sm font-medium">{t(locale, "healthOk")}</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-destructive" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{t(locale, "healthFail")}</span>
                    {healthStatus.error && (
                      <span className="text-xs text-muted-foreground">{healthStatus.error}</span>
                    )}
                  </div>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHealthCheck(false)}
                className="ml-2 h-6 w-6 p-0"
              >
                ✕
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// Message Bubble Component
function MessageBubble({
  message,
  locale,
  onQuickReply,
  onRetry,
}: {
  message: Message;
  locale: Locale;
  onQuickReply: (text: string) => void;
  onRetry: () => void;
}) {
  // Handle special system messages
  if (message.role === "system") {
    if (message.content.startsWith("error:")) {
      const errorCode = message.content.replace("error:", "");
      return <ErrorBubble errorCode={errorCode} locale={locale} onRetry={onRetry} />;
    }
    
    if (message.content.startsWith("suggestions:")) {
      const suggestions = JSON.parse(message.content.replace("suggestions:", ""));
      return <QuickReplies suggestions={suggestions} onSelect={onQuickReply} />;
    }
    
    // Regular system message
    return (
      <div className="flex justify-center">
        <div className="rounded-full bg-muted px-4 py-2 text-xs text-muted-foreground max-w-md text-center">
          {message.content}
        </div>
      </div>
    );
  }

  const isUser = message.role === "user";
  
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-2`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm ${
          isUser
            ? "bg-[hsl(var(--chat-user-bg))] text-[hsl(var(--chat-user-text))] rounded-br-sm"
            : "bg-[hsl(var(--chat-assistant-bg))] text-[hsl(var(--chat-assistant-text))] rounded-bl-sm"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </p>
        {message.timestamp && (
          <p className={`mt-1 text-[10px] ${isUser ? "text-white/70" : "text-muted-foreground/70"}`}>
            {new Date(message.timestamp).toLocaleTimeString(locale, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </div>
  );
}

// Error Bubble Component
function ErrorBubble({
  errorCode,
  locale,
  onRetry,
}: {
  errorCode: string;
  locale: Locale;
  onRetry: () => void;
}) {
  const errorMessages: Record<string, string> = {
    network_error: t(locale, "errorNetwork"),
    timeout: t(locale, "errorTimeout"),
    quota_exceeded: t(locale, "errorQuota"),
    billing_not_active: t(locale, "errorBilling"),
    invalid_api_key: t(locale, "errorBilling"),
    unknown_error: t(locale, "errorUnknown"),
  };

  const errorMessage = errorMessages[errorCode] || t(locale, "errorUnknown");

  return (
    <div className="flex justify-center animate-in slide-in-from-bottom-2">
      <Card className="max-w-sm border-destructive/50 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-destructive">{t(locale, "errorTitle")}</p>
            <p className="text-xs text-muted-foreground">{errorMessage}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="h-7 text-xs"
            >
              <RefreshCw className="mr-1.5 h-3 w-3" />
              {t(locale, "retry")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Quick Replies Component
function QuickReplies({
  suggestions,
  onSelect,
}: {
  suggestions: string[];
  onSelect: (text: string) => void;
}) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 justify-start animate-in slide-in-from-bottom-2">
      {suggestions.map((suggestion, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          onClick={() => onSelect(suggestion)}
          className="h-8 rounded-full text-xs hover:bg-accent hover:text-accent-foreground transition-all hover:scale-105"
        >
          {suggestion}
        </Button>
      ))}
    </div>
  );
}

// Typing Indicator Component
function TypingIndicator() {
  return (
    <div className="flex justify-start animate-in slide-in-from-bottom-2">
      <div className="bg-[hsl(var(--chat-assistant-bg))] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
          <div className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
          <div className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" />
        </div>
      </div>
    </div>
  );
}
