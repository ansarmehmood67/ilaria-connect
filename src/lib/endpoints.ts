/**
 * Backend endpoint mapping - edit these paths to match your Django routes
 */
export const ENDPOINTS = {
  chat: "/api/chat/msg",           // POST  -> {text:string, session_id?:string}
  escalate: "/api/escalate/",      // POST  -> {session_id, reason, transcript}
  health: "/health/",              // GET   -> 200 OK (optional)
  stream: "/api/chat/stream/",     // SSE or WS (optional, set VITE_ENABLE_STREAMING=true)
} as const;

export function getBackendUrl(path: string): string {
  const baseUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
  return new URL(path, baseUrl).toString();
}
