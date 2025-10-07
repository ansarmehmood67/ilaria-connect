/**
 * Chat client for backend communication with flexible request/response adapters
 */

import { ENDPOINTS, getBackendUrl } from "./endpoints";
import type { Locale } from "./lang";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

export interface ChatRequest {
  message?: string;
  messages?: Message[];
  sessionId?: string;
  locale?: Locale;
}

export interface ChatResponse {
  reply: string;
  suggestions?: string[];
  sessionId?: string;
  error?: string;
  code?: string;
}

export interface EscalateRequest {
  sessionId: string;
  reason: string;
  transcript: Message[];
}

export class ChatClient {
  private enableStreaming: boolean;

  constructor() {
    this.enableStreaming = import.meta.env.VITE_ENABLE_STREAMING === "true";
  }

  /**
   * Send a chat message to the backend
   * Supports both simple {message} and {messages:[]} formats
   */
  async askBackend(request: ChatRequest): Promise<ChatResponse> {
    try {
      const url = getBackendUrl(ENDPOINTS.chat);
      
      // Build request body - support both formats
      const body: any = {
        session_id: request.sessionId,
        locale: request.locale,
      };
      
      if (request.messages && request.messages.length > 0) {
        body.messages = request.messages;
      } else if (request.message) {
        body.message = request.message;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return this.handleErrorResponse(response);
      }

      const data = await response.json();
      
      // Adapt response - support multiple formats
      return {
        reply: data.reply || data.message || data.content || "",
        suggestions: data.suggestions || data.quick_replies || [],
        sessionId: data.session_id || data.sessionId || request.sessionId,
      };
    } catch (error) {
      return this.handleNetworkError(error);
    }
  }

  /**
   * Escalate to human support
   */
  async escalate(request: EscalateRequest): Promise<{ success: boolean; error?: string }> {
    try {
      const url = getBackendUrl(ENDPOINTS.escalate);
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: request.sessionId,
          reason: request.reason,
          transcript: request.transcript,
        }),
      });

      if (!response.ok) {
        const error = await this.handleErrorResponse(response);
        return { success: false, error: error.error };
      }

      return { success: true };
    } catch (error) {
      const err = this.handleNetworkError(error);
      return { success: false, error: err.error };
    }
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<{ ok: boolean; error?: string }> {
    try {
      const url = getBackendUrl(ENDPOINTS.health);
      const response = await fetch(url, {
        method: "GET",
      });

      return {
        ok: response.ok,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  }

  /**
   * Handle HTTP error responses
   */
  private async handleErrorResponse(response: Response): Promise<ChatResponse> {
    let errorData: any = {};
    
    try {
      errorData = await response.json();
    } catch {
      // Ignore parse errors
    }

    const code = errorData.code || errorData.error_code || `http_${response.status}`;
    let error = errorData.error || errorData.message || `HTTP ${response.status}`;

    // Map common error codes to user-friendly messages
    switch (code) {
      case "quota_exceeded":
      case "rate_limit":
        error = "quota_exceeded";
        break;
      case "billing_not_active":
      case "payment_required":
        error = "billing_not_active";
        break;
      case "invalid_api_key":
      case "unauthorized":
        error = "invalid_api_key";
        break;
      case "timeout":
        error = "timeout";
        break;
      default:
        if (response.status >= 500) {
          error = "server_error";
        } else if (response.status === 401 || response.status === 403) {
          error = "invalid_api_key";
        } else if (response.status === 429) {
          error = "quota_exceeded";
        }
    }

    return { reply: "", error, code };
  }

  /**
   * Handle network errors
   */
  private handleNetworkError(error: unknown): ChatResponse {
    console.error("Network error:", error);
    
    const message = error instanceof Error ? error.message : "Unknown error";
    
    if (message.includes("fetch") || message.includes("network")) {
      return { reply: "", error: "network_error" };
    }
    
    return { reply: "", error: "unknown_error" };
  }
}

export const chatClient = new ChatClient();
