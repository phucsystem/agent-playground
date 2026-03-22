import WebSocket from "ws";

type ClientState = "idle" | "connecting" | "connected" | "reconnecting" | "closed";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface PendingStream {
  onChunk: (data: { chunk?: string } | null) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

type EventCallback = (data: Record<string, unknown>) => void;

interface QueuedMessage {
  data: string;
}

interface WsMessage {
  type: "req" | "res" | "event";
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  data?: Record<string, unknown> | null;
  error?: { code: number; message: string };
}

interface GoclawWSClientConfig {
  connectionTimeoutMs?: number;
  requestTimeoutMs?: number;
  maxReconnectDelayMs?: number;
  streamTimeoutMs?: number;
}

const DEFAULT_CONFIG: Required<GoclawWSClientConfig> = {
  connectionTimeoutMs: 10_000,
  requestTimeoutMs: 25_000,
  maxReconnectDelayMs: 30_000,
  streamTimeoutMs: 120_000,
};

export class GoclawWSClient {
  private url: string;
  private token: string;
  private config: Required<GoclawWSClientConfig>;
  private ws: WebSocket | null = null;
  private state: ClientState = "idle";
  private pendingRequests = new Map<string, PendingRequest>();
  private pendingStreams = new Map<string, PendingStream>();
  private eventHandlers = new Map<string, EventCallback[]>();
  private requestIdCounter = 0;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectPromise: Promise<void> | null = null;
  private queue: QueuedMessage[] = [];

  constructor(url: string, token: string, config?: GoclawWSClientConfig) {
    this.url = url;
    this.token = token;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get currentState(): ClientState {
    return this.state;
  }

  async connect(): Promise<void> {
    if (this.state === "connected" && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.doConnect();
    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private doConnect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.state = "connecting";
      const connectionTimeout = setTimeout(() => {
        this.ws?.close();
        reject(new Error("Connection timeout"));
      }, this.config.connectionTimeoutMs);

      this.ws = new WebSocket(this.url);

      this.ws.on("open", () => {
        const authId = this.nextId();
        const authPayload: WsMessage = {
          type: "req",
          id: authId,
          method: "connect",
          params: { token: this.token, user_id: "system" },
        };

        const authTimeout = setTimeout(() => {
          clearTimeout(connectionTimeout);
          this.pendingRequests.delete(authId);
          reject(new Error("Auth handshake timeout"));
        }, this.config.connectionTimeoutMs);

        this.pendingRequests.set(authId, {
          resolve: () => {
            clearTimeout(connectionTimeout);
            clearTimeout(authTimeout);
            this.state = "connected";
            this.reconnectAttempts = 0;
            console.log("[goclaw-ws] Connected and authenticated");
            this.subscribeToEvents();
            resolve();
          },
          reject: (error: Error) => {
            clearTimeout(connectionTimeout);
            clearTimeout(authTimeout);
            reject(error);
          },
          timeout: authTimeout,
        });

        this.sendRaw(JSON.stringify(authPayload));
      });

      this.ws.on("message", (rawData: WebSocket.RawData) => {
        this.handleMessage(rawData.toString());
      });

      this.ws.on("close", (code: number, reason: Buffer) => {
        clearTimeout(connectionTimeout);
        console.log(`[goclaw-ws] Disconnected: code=${code} reason=${reason.toString()}`);

        if (this.state !== "closed") {
          this.rejectAllPending(new Error(`WebSocket closed: ${code}`));
          this.scheduleReconnect();
        }
      });

      this.ws.on("error", (error: Error) => {
        console.error("[goclaw-ws] WebSocket error:", error.message);
        if (this.state === "connecting") {
          clearTimeout(connectionTimeout);
          reject(error);
        }
      });
    });
  }

  async send(method: string, params: Record<string, unknown>): Promise<unknown> {
    await this.ensureConnected();
    const requestId = this.nextId();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${method}`));
      }, this.config.requestTimeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      const payload: WsMessage = { type: "req", id: requestId, method, params };
      this.sendRaw(JSON.stringify(payload));
    });
  }

  async stream(
    method: string,
    params: Record<string, unknown>,
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    await this.ensureConnected();
    const requestId = this.nextId();
    let fullContent = "";

    return new Promise<string>((resolve, reject) => {
      let timeoutHandle: ReturnType<typeof setTimeout> = null!;

      const resetTimeout = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        timeoutHandle = setTimeout(() => {
          this.pendingStreams.delete(requestId);
          reject(new Error(`Stream timeout: ${method}`));
        }, this.config.streamTimeoutMs);
      };

      resetTimeout();

      this.pendingStreams.set(requestId, {
        onChunk: (data) => {
          if (data === null) {
            clearTimeout(timeoutHandle);
            this.pendingStreams.delete(requestId);
            resolve(fullContent);
            return;
          }
          if (data.chunk) {
            fullContent += data.chunk;
            onChunk(data.chunk);
            resetTimeout();
          }
        },
        reject: (error: Error) => {
          clearTimeout(timeoutHandle);
          this.pendingStreams.delete(requestId);
          reject(error);
        },
        timeout: timeoutHandle,
      });

      const payload: WsMessage = { type: "req", id: requestId, method, params };
      this.sendRaw(JSON.stringify(payload));
    });
  }

  on(eventType: string, callback: EventCallback): () => void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(callback);
    this.eventHandlers.set(eventType, handlers);

    return () => {
      const remaining = (this.eventHandlers.get(eventType) || []).filter(
        (handler) => handler !== callback,
      );
      this.eventHandlers.set(eventType, remaining);
    };
  }

  close(): void {
    this.state = "closed";
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.rejectAllPending(new Error("Client closed"));
    this.ws?.close();
    this.ws = null;
    this.queue = [];
    console.log("[goclaw-ws] Client closed");
  }

  private handleMessage(raw: string): void {
    let message: WsMessage;
    try {
      message = JSON.parse(raw);
    } catch {
      console.error("[goclaw-ws] Invalid JSON from server:", raw.slice(0, 200));
      return;
    }

    if (message.type === "res" && message.id) {
      const pendingStream = this.pendingStreams.get(message.id);
      if (pendingStream) {
        if (message.error) {
          pendingStream.reject(new Error(message.error.message));
          return;
        }
        if (message.data === null || message.data === undefined) {
          pendingStream.onChunk(null);
        } else {
          pendingStream.onChunk(message.data as { chunk?: string });
        }
        return;
      }

      const pendingRequest = this.pendingRequests.get(message.id);
      if (pendingRequest) {
        clearTimeout(pendingRequest.timeout);
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pendingRequest.reject(new Error(message.error.message));
        } else {
          pendingRequest.resolve(message.data);
        }
        return;
      }
    }

    if (message.type === "event" && message.data) {
      const eventType = message.data.type as string | undefined;
      if (eventType) {
        const handlers = this.eventHandlers.get(eventType) || [];
        for (const handler of handlers) {
          try {
            handler(message.data);
          } catch (handlerError) {
            console.error(`[goclaw-ws] Event handler error (${eventType}):`, handlerError);
          }
        }
      }
    }
  }

  private subscribeToEvents(): void {
    const payload: WsMessage = {
      type: "req",
      id: this.nextId(),
      method: "event.stream",
      params: { subscribe: true },
    };
    this.sendRaw(JSON.stringify(payload));
    console.log("[goclaw-ws] Subscribed to event.stream");
  }

  private async ensureConnected(): Promise<void> {
    if (this.state === "connected" && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    await this.connect();
  }

  private sendRaw(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      this.queue.push({ data });
    }
  }

  private scheduleReconnect(): void {
    if (this.state === "closed") return;
    this.state = "reconnecting";

    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.config.maxReconnectDelayMs,
    );
    this.reconnectAttempts++;

    console.log(`[goclaw-ws] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        this.flushQueue();
      } catch (error) {
        console.error("[goclaw-ws] Reconnect failed:", (error as Error).message);
        this.scheduleReconnect();
      }
    }, delay);
  }

  private flushQueue(): void {
    const queued = [...this.queue];
    this.queue = [];
    for (const item of queued) {
      this.sendRaw(item.data);
    }
    if (queued.length > 0) {
      console.log(`[goclaw-ws] Flushed ${queued.length} queued messages`);
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pendingRequests.delete(requestId);
    }
    for (const [requestId, pending] of this.pendingStreams) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pendingStreams.delete(requestId);
    }
    this.queue = [];
  }

  private nextId(): string {
    this.requestIdCounter++;
    return `req_${this.requestIdCounter}`;
  }
}
