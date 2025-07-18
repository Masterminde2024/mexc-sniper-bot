/**
 * WebSocket Server Service
 *
 * Server-side WebSocket management for real-time communication in the AI trading system.
 * Supports agent status broadcasting, trading data streaming, and user notifications.
 *
 * Features:
 * - Connection management with authentication
 * - Channel-based message routing
 * - Rate limiting and security
 * - Performance monitoring
 * - Graceful error handling
 * - Integration with 11-agent system
 */

import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
// OpenTelemetry WebSocket instrumentation
import {
  instrumentChannelOperation,
  instrumentWebSocketSend,
} from "@/src/lib/opentelemetry-websocket-instrumentation";
import type {
  AgentStatusMessage,
  ConnectionMetrics,
  MessageHandler,
  NotificationMessage,
  PatternDiscoveryMessage,
  ServerMetrics,
  TradingPriceMessage,
  WebSocketChannel,
  WebSocketConnection,
  WebSocketMessage,
  WebSocketServerConfig,
} from "@/src/lib/websocket-types";

// ======================
// Connection Management
// ======================

class ConnectionManager {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[websocket-server]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[websocket-server]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[websocket-server]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[websocket-server]", message, context || ""),
  };

  private connections = new Map<
    string,
    WebSocketConnection & { ws: WebSocket }
  >();
  private userConnections = new Map<string, Set<string>>();
  private channelSubscriptions = new Map<string, Set<string>>();
  private connectionMetrics = new Map<string, ConnectionMetrics>();

  addConnection(
    connectionId: string,
    ws: WebSocket,
    userId?: string,
    clientType: WebSocketConnection["clientType"] = "dashboard"
  ): void {
    const connection: WebSocketConnection & { ws: WebSocket } = {
      id: connectionId,
      userId,
      clientType,
      subscriptions: new Set(),
      lastActivity: Date.now(),
      isAuthenticated: !!userId,
      ws,
      metadata: {
        userAgent: "",
        clientIP: "",
        connectedAt: Date.now(),
      },
    };

    this.connections.set(connectionId, connection);

    if (userId) {
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      this.userConnections.get(userId)?.add(connectionId);
    }

    // Initialize metrics
    this.connectionMetrics.set(connectionId, {
      connectionId,
      userId,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      messagesSent: 0,
      messagesReceived: 0,
      subscriptions: [],
    });

    console.info(
      `[WebSocket] Connection added: ${connectionId} (user: ${userId || "anonymous"})`
    );
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from user connections
    if (connection.userId) {
      const userConns = this.userConnections.get(connection.userId);
      if (userConns) {
        userConns.delete(connectionId);
        if (userConns.size === 0) {
          this.userConnections.delete(connection.userId);
        }
      }
    }

    // Remove from channel subscriptions
    for (const channel of connection.subscriptions) {
      const subscribers = this.channelSubscriptions.get(channel);
      if (subscribers) {
        subscribers.delete(connectionId);
        if (subscribers.size === 0) {
          this.channelSubscriptions.delete(channel);
        }
      }
    }

    this.connections.delete(connectionId);
    this.connectionMetrics.delete(connectionId);

    console.info(`[WebSocket] Connection removed: ${connectionId}`);
  }

  getConnection(
    connectionId: string
  ): (WebSocketConnection & { ws: WebSocket }) | undefined {
    return this.connections.get(connectionId);
  }

  getUserConnections(
    userId: string
  ): (WebSocketConnection & { ws: WebSocket })[] {
    const connectionIds = this.userConnections.get(userId) || new Set();
    return Array.from(connectionIds)
      .map((id) => this.connections.get(id))
      .filter(Boolean) as (WebSocketConnection & { ws: WebSocket })[];
  }

  getChannelSubscribers(
    channel: string
  ): (WebSocketConnection & { ws: WebSocket })[] {
    const connectionIds = this.channelSubscriptions.get(channel) || new Set();
    return Array.from(connectionIds)
      .map((id) => this.connections.get(id))
      .filter(Boolean) as (WebSocketConnection & { ws: WebSocket })[];
  }

  subscribeToChannel(connectionId: string, channel: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    connection.subscriptions.add(channel);

    if (!this.channelSubscriptions.has(channel)) {
      this.channelSubscriptions.set(channel, new Set());
    }
    this.channelSubscriptions.get(channel)?.add(connectionId);

    // Update metrics
    const metrics = this.connectionMetrics.get(connectionId);
    if (metrics) {
      metrics.subscriptions = Array.from(connection.subscriptions);
    }

    console.info(
      `[WebSocket] Subscription added: ${connectionId} -> ${channel}`
    );
    return true;
  }

  unsubscribeFromChannel(connectionId: string, channel: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    connection.subscriptions.delete(channel);

    const subscribers = this.channelSubscriptions.get(channel);
    if (subscribers) {
      subscribers.delete(connectionId);
      if (subscribers.size === 0) {
        this.channelSubscriptions.delete(channel);
      }
    }

    // Update metrics
    const metrics = this.connectionMetrics.get(connectionId);
    if (metrics) {
      metrics.subscriptions = Array.from(connection.subscriptions);
    }

    console.info(
      `[WebSocket] Subscription removed: ${connectionId} -> ${channel}`
    );
    return true;
  }

  updateActivity(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    const metrics = this.connectionMetrics.get(connectionId);

    if (connection) {
      connection.lastActivity = Date.now();
    }

    if (metrics) {
      metrics.lastActivity = Date.now();
    }
  }

  incrementMessageCount(connectionId: string, type: "sent" | "received"): void {
    const metrics = this.connectionMetrics.get(connectionId);
    if (metrics) {
      if (type === "sent") {
        metrics.messagesSent++;
      } else {
        metrics.messagesReceived++;
      }
    }
  }

  getAllConnections(): (WebSocketConnection & { ws: WebSocket })[] {
    return Array.from(this.connections.values());
  }

  getMetrics(): {
    totalConnections: number;
    authenticatedConnections: number;
    totalChannels: number;
    totalSubscriptions: number;
    connectionMetrics: ConnectionMetrics[];
  } {
    const connections = Array.from(this.connections.values());
    const authenticatedCount = connections.filter(
      (c) => c.isAuthenticated
    ).length;
    const totalSubscriptions = connections.reduce(
      (sum, c) => sum + c.subscriptions.size,
      0
    );

    return {
      totalConnections: connections.length,
      authenticatedConnections: authenticatedCount,
      totalChannels: this.channelSubscriptions.size,
      totalSubscriptions,
      connectionMetrics: Array.from(this.connectionMetrics.values()),
    };
  }
}

// ======================
// Rate Limiting
// ======================

class RateLimiter {
  private connectionLimits = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private ipLimits = new Map<
    string,
    { connections: Set<string>; resetTime: number }
  >();

  constructor(
    private maxConnectionsPerIP = 10,
    private maxMessagesPerMinute = 100,
    private windowMs = 60000
  ) {}

  checkConnectionLimit(ip: string, connectionId: string): boolean {
    const now = Date.now();

    // Clean up expired entries
    this.cleanupExpired(now);

    const ipLimit = this.ipLimits.get(ip);
    if (!ipLimit) {
      this.ipLimits.set(ip, {
        connections: new Set([connectionId]),
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (
      ipLimit.connections.size >= this.maxConnectionsPerIP &&
      !ipLimit.connections.has(connectionId)
    ) {
      return false;
    }

    ipLimit.connections.add(connectionId);
    return true;
  }

  checkMessageLimit(connectionId: string): boolean {
    const now = Date.now();

    const limit = this.connectionLimits.get(connectionId);
    if (!limit) {
      this.connectionLimits.set(connectionId, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (now > limit.resetTime) {
      limit.count = 1;
      limit.resetTime = now + this.windowMs;
      return true;
    }

    if (limit.count >= this.maxMessagesPerMinute) {
      return false;
    }

    limit.count++;
    return true;
  }

  removeConnection(ip: string, connectionId: string): void {
    const ipLimit = this.ipLimits.get(ip);
    if (ipLimit) {
      ipLimit.connections.delete(connectionId);
      if (ipLimit.connections.size === 0) {
        this.ipLimits.delete(ip);
      }
    }

    this.connectionLimits.delete(connectionId);
  }

  private cleanupExpired(now: number): void {
    for (const [key, limit] of this.connectionLimits.entries()) {
      if (now > limit.resetTime) {
        this.connectionLimits.delete(key);
      }
    }

    for (const [ip, limit] of this.ipLimits.entries()) {
      if (now > limit.resetTime) {
        this.ipLimits.delete(ip);
      }
    }
  }
}

// ======================
// Message Router
// ======================

class MessageRouter {
  private handlers = new Map<string, MessageHandler[]>();
  private globalHandlers: MessageHandler[] = [];

  addHandler(channel: string, handler: MessageHandler): void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, []);
    }
    this.handlers.get(channel)?.push(handler);
  }

  addGlobalHandler(handler: MessageHandler): void {
    this.globalHandlers.push(handler);
  }

  async routeMessage(
    message: WebSocketMessage,
    _connectionId: string
  ): Promise<void> {
    try {
      // Execute global handlers first
      for (const handler of this.globalHandlers) {
        await handler(message);
      }

      // Execute channel-specific handlers
      const channelHandlers = this.handlers.get(message.channel) || [];
      for (const handler of channelHandlers) {
        await handler(message);
      }
    } catch (error) {
      console.error(`[WebSocket] Error routing message:`, error);
      throw error;
    }
  }
}

// ======================
// Main WebSocket Server
// ======================

export class WebSocketServerService extends EventEmitter {
  private static instance: WebSocketServerService;
  private wss: WebSocketServer | null = null;
  private connectionManager = new ConnectionManager();
  private rateLimiter: RateLimiter;
  private messageRouter = new MessageRouter();
  private config: WebSocketServerConfig;
  private isRunning = false;
  private heartbeatInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private serverMetrics: ServerMetrics = {
    totalConnections: 0,
    authenticatedConnections: 0,
    totalChannels: 0,
    totalSubscriptions: 0,
    messagesPerSecond: 0,
    averageLatency: 0,
    errorRate: 0,
    uptime: 0,
  };

  constructor(config: Partial<WebSocketServerConfig> = {}) {
    super();

    this.config = {
      port: 8080,
      host: "localhost",
      path: "/ws",
      authentication: {
        required: true,
        tokenValidation: this.defaultTokenValidation.bind(this),
      },
      rateLimiting: {
        enabled: true,
        maxConnections: 10,
        maxMessagesPerMinute: 100,
        blockDuration: 60000,
      },
      performance: {
        heartbeatInterval: 30000,
        pingTimeout: 10000,
        maxPayloadSize: 1024 * 1024, // 1MB
        compressionEnabled: true,
      },
      monitoring: {
        metricsEnabled: true,
        loggingLevel: "info",
        healthCheckInterval: 10000,
      },
      ...config,
    };

    this.rateLimiter = new RateLimiter(
      this.config.rateLimiting.maxConnections,
      this.config.rateLimiting.maxMessagesPerMinute
    );

    this.setupMessageHandlers();
  }

  static getInstance(
    config?: Partial<WebSocketServerConfig>
  ): WebSocketServerService {
    if (!WebSocketServerService.instance) {
      WebSocketServerService.instance = new WebSocketServerService(config);
    }
    return WebSocketServerService.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("[WebSocket] Server is already running");
      return;
    }

    try {
      this.wss = new WebSocketServer({
        port: this.config.port,
        host: this.config.host,
        path: this.config.path,
        maxPayload: this.config.performance.maxPayloadSize,
      });

      this.wss.on("connection", this.handleConnection.bind(this));
      this.wss.on("error", (error) => {
        console.error("[WebSocket] Server error:", error);
        this.emit("error", error);
      });

      this.startHeartbeat();
      this.startMetricsCollection();

      this.isRunning = true;
      console.info(
        `[WebSocket] Server started on ${this.config.host}:${this.config.port}${this.config.path}`
      );
      this.emit("server:started");
    } catch (error) {
      console.error("[WebSocket] Failed to start server:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.info("[WebSocket] Stopping server...");

    // Stop intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Close all connections gracefully
    const connections = this.connectionManager.getAllConnections();
    for (const connection of connections) {
      connection.ws.close(1001, "Server shutting down");
    }

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.isRunning = false;
    console.info("[WebSocket] Server stopped");
    this.emit("server:stopped");
  }

  // ======================
  // Message Broadcasting
  // ======================

  broadcast<T>(
    message: Omit<WebSocketMessage<T>, "messageId" | "timestamp">
  ): void {
    const fullMessage: WebSocketMessage<T> = {
      ...message,
      messageId: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    // Instrument broadcast operation
    instrumentChannelOperation(
      "broadcast",
      message.channel,
      async () => {
        this.broadcastToChannel(
          message.channel as WebSocketChannel,
          fullMessage
        );
        return Promise.resolve();
      },
      { messageType: message.type }
    ).catch((error) => {
      console.error("[WebSocket] Broadcast instrumentation error:", error);
    });
  }

  broadcastToChannel<T>(
    channel: WebSocketChannel,
    message: WebSocketMessage<T>
  ): void {
    const subscribers = this.connectionManager.getChannelSubscribers(channel);

    for (const connection of subscribers) {
      this.sendMessage(connection.id, message);
    }

    console.info(
      `[WebSocket] Broadcasted to ${channel}: ${subscribers.length} subscribers`
    );
  }

  broadcastToUser<T>(userId: string, message: WebSocketMessage<T>): void {
    const connections = this.connectionManager.getUserConnections(userId);

    for (const connection of connections) {
      this.sendMessage(connection.id, message);
    }

    console.info(
      `[WebSocket] Broadcasted to user ${userId}: ${connections.length} connections`
    );
  }

  sendMessage<T>(connectionId: string, message: WebSocketMessage<T>): boolean {
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    // Instrument message sending
    instrumentWebSocketSend(
      message,
      async () => {
        const serialized = JSON.stringify(message);
        connection.ws.send(serialized);
        return Promise.resolve();
      },
      {
        connectionId,
        channel: message.channel,
        messageType: message.type,
        clientType: connection.clientType,
      }
    ).catch((error) => {
      console.error("[WebSocket] Send message instrumentation error:", error);
    });

    try {
      const serialized = JSON.stringify(message);
      connection.ws.send(serialized);

      this.connectionManager.updateActivity(connectionId);
      this.connectionManager.incrementMessageCount(connectionId, "sent");

      return true;
    } catch (error) {
      console.error(
        `[WebSocket] Failed to send message to ${connectionId}:`,
        error
      );
      return false;
    }
  }

  // ======================
  // Agent Integration Methods
  // ======================

  broadcastAgentStatus(agentStatus: AgentStatusMessage): void {
    this.broadcast({
      type: "agent:status",
      channel: "agents:status",
      data: agentStatus,
    });

    // Also broadcast to specific agent channel
    this.broadcast({
      type: "agent:status",
      channel: `agent:${agentStatus.agentId}:status`,
      data: agentStatus,
    });
  }

  broadcastTradingPrice(priceData: TradingPriceMessage): void {
    this.broadcast({
      type: "trading:price",
      channel: "trading:prices",
      data: priceData,
    });

    // Also broadcast to symbol-specific channel
    this.broadcast({
      type: "trading:price",
      channel: `trading:${priceData.symbol}:price`,
      data: priceData,
    });
  }

  broadcastPatternDiscovery(pattern: PatternDiscoveryMessage): void {
    this.broadcast({
      type: "pattern:discovery",
      channel: "patterns:discovery",
      data: pattern,
    });

    // Also broadcast to symbol-specific channel
    this.broadcast({
      type: "pattern:discovery",
      channel: `patterns:${pattern.symbol}:discovery`,
      data: pattern,
    });
  }

  broadcastNotification(notification: NotificationMessage): void {
    if (notification.userId) {
      // Send to specific user
      this.broadcastToUser(notification.userId, {
        type: "notification:info",
        channel: `user:${notification.userId}:notifications`,
        data: notification,
        messageId: crypto.randomUUID(),
        timestamp: Date.now(),
      });
    } else {
      // Global notification
      this.broadcast({
        type: "notification:info",
        channel: "notifications:global",
        data: notification,
      });
    }
  }

  // ======================
  // Private Methods
  // ======================

  private async handleConnection(
    ws: WebSocket,
    request: IncomingMessage
  ): Promise<void> {
    const connectionId = crypto.randomUUID();
    const clientIP = this.getClientIP(request);
    let connectionAdded = false;

    // Connection timeout handler
    const connectionTimeout = setTimeout(() => {
      if (
        ws.readyState === WebSocket.CONNECTING ||
        ws.readyState === WebSocket.OPEN
      ) {
        console.warn(`[WebSocket] Connection timeout for ${connectionId}`);
        ws.close(1008, "Connection timeout");
      }
    }, 10000); // 10 second timeout

    try {
      // Validate WebSocket state
      if (
        ws.readyState !== WebSocket.OPEN &&
        ws.readyState !== WebSocket.CONNECTING
      ) {
        console.warn(
          `[WebSocket] Invalid WebSocket state: ${ws.readyState} for ${connectionId}`
        );
        return;
      }

      // Rate limiting check
      if (
        this.config.rateLimiting.enabled &&
        !this.rateLimiter.checkConnectionLimit(clientIP, connectionId)
      ) {
        ws.close(1008, "Too many connections from this IP");
        return;
      }

      // Authentication (if required) with timeout
      let userId: string | undefined;
      if (this.config.authentication.required) {
        const authPromise = this.authenticateConnection(request);
        const authTimeout = new Promise<{ valid: false; error: string }>(
          (resolve) =>
            setTimeout(
              () => resolve({ valid: false, error: "Authentication timeout" }),
              5000
            )
        );

        const authResult = await Promise.race([authPromise, authTimeout]);
        if (!authResult.valid) {
          const errorMsg =
            "error" in authResult ? authResult.error : "Authentication failed";
          console.warn(
            `[WebSocket] Authentication failed for ${connectionId}: ${errorMsg}`
          );
          ws.close(1008, errorMsg);
          return;
        }
        userId = authResult.userId;
      }

      // Validate connection is still open before proceeding
      if (ws.readyState !== WebSocket.OPEN) {
        console.warn(
          `[WebSocket] Connection closed during setup: ${connectionId}`
        );
        return;
      }

      // Add connection to manager
      this.connectionManager.addConnection(connectionId, ws, userId);
      connectionAdded = true;

      // Clear connection timeout since setup is successful
      clearTimeout(connectionTimeout);

      // Setup message handling with error recovery
      ws.on("message", async (data) => {
        try {
          await this.handleMessage(connectionId, data);
        } catch (error) {
          console.error(
            `[WebSocket] Error in message handler for ${connectionId}:`,
            error
          );
          this.sendError(
            connectionId,
            "MESSAGE_ERROR",
            "Failed to process message"
          );
        }
      });

      ws.on("close", (code, reason) => {
        this.handleDisconnection(connectionId, clientIP, code, reason);
      });

      ws.on("error", (error) => {
        console.error(
          `[WebSocket] Connection error for ${connectionId}:`,
          error
        );
        this.handleDisconnection(
          connectionId,
          clientIP,
          1006,
          Buffer.from(error.message)
        );
      });

      // Setup connection health monitoring
      ws.on("pong", () => {
        this.connectionManager.updateActivity(connectionId);
      });

      // Send welcome message
      const welcomeSuccess = this.sendMessage(connectionId, {
        type: "system:connect",
        channel: "system",
        data: {
          connectionId,
          serverTime: Date.now(),
          features: ["agents", "trading", "patterns", "notifications"],
        },
        messageId: crypto.randomUUID(),
        timestamp: Date.now(),
      });

      if (!welcomeSuccess) {
        console.warn(
          `[WebSocket] Failed to send welcome message to ${connectionId}`
        );
        this.handleDisconnection(
          connectionId,
          clientIP,
          1011,
          Buffer.from("Welcome message failed")
        );
        return;
      }

      console.info(
        `[WebSocket] New connection established: ${connectionId} (user: ${userId || "anonymous"})`
      );
      this.emit("connection:open", { connectionId, userId });
    } catch (error) {
      console.error(
        `[WebSocket] Failed to handle connection ${connectionId}:`,
        error
      );

      // Clear timeout on error
      clearTimeout(connectionTimeout);

      // Clean up connection if it was added
      if (connectionAdded) {
        this.connectionManager.removeConnection(connectionId);
        this.rateLimiter.removeConnection(clientIP, connectionId);
      }

      // Close WebSocket with appropriate error code
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        const errorMsg =
          error instanceof Error ? error.message : "Internal server error";
        ws.close(1011, errorMsg);
      }

      this.emit("connection:error", { connectionId, error });
    }
  }

  private async handleMessage(
    connectionId: string,
    data: Buffer | ArrayBuffer | Buffer[]
  ): Promise<void> {
    try {
      // Rate limiting check
      if (
        this.config.rateLimiting.enabled &&
        !this.rateLimiter.checkMessageLimit(connectionId)
      ) {
        this.sendError(connectionId, "RATE_LIMITED", "Too many messages");
        return;
      }

      const messageStr = data.toString();
      const message: WebSocketMessage = JSON.parse(messageStr);

      // Validate message structure
      if (!this.isValidMessage(message)) {
        this.sendError(
          connectionId,
          "INVALID_MESSAGE",
          "Invalid message format"
        );
        return;
      }

      this.connectionManager.updateActivity(connectionId);
      this.connectionManager.incrementMessageCount(connectionId, "received");

      // Handle subscription management
      if (message.type === "subscription:subscribe") {
        this.handleSubscription(connectionId, message);
        return;
      }

      if (message.type === "subscription:unsubscribe") {
        this.handleUnsubscription(connectionId, message);
        return;
      }

      // Route message to handlers
      await this.messageRouter.routeMessage(message, connectionId);

      this.emit("message:received", { message, connectionId });
    } catch (error) {
      console.error(
        `[WebSocket] Error handling message from ${connectionId}:`,
        error
      );
      this.sendError(connectionId, "SERVER_ERROR", "Failed to process message");
    }
  }

  private handleDisconnection(
    connectionId: string,
    clientIP: string,
    code: number,
    reason: Buffer
  ): void {
    this.connectionManager.removeConnection(connectionId);
    this.rateLimiter.removeConnection(clientIP, connectionId);

    console.info(
      `[WebSocket] Connection closed: ${connectionId} (code: ${code}, reason: ${reason.toString()})`
    );
    this.emit("connection:close", { connectionId, reason: reason.toString() });
  }

  private handleSubscription(
    connectionId: string,
    message: WebSocketMessage
  ): void {
    const { channel } = message.data;
    const success = this.connectionManager.subscribeToChannel(
      connectionId,
      channel
    );

    this.sendMessage(connectionId, {
      type: "system:ack",
      channel: "system",
      data: {
        originalMessageId: message.messageId,
        success,
        action: "subscribe",
        channel,
      },
      messageId: crypto.randomUUID(),
      timestamp: Date.now(),
    });

    if (success) {
      this.emit("subscription:added", { channel, connectionId });
    }
  }

  private handleUnsubscription(
    connectionId: string,
    message: WebSocketMessage
  ): void {
    const { channel } = message.data;
    const success = this.connectionManager.unsubscribeFromChannel(
      connectionId,
      channel
    );

    this.sendMessage(connectionId, {
      type: "system:ack",
      channel: "system",
      data: {
        originalMessageId: message.messageId,
        success,
        action: "unsubscribe",
        channel,
      },
      messageId: crypto.randomUUID(),
      timestamp: Date.now(),
    });

    if (success) {
      this.emit("subscription:removed", { channel, connectionId });
    }
  }

  private sendError(connectionId: string, code: string, message: string): void {
    this.sendMessage(connectionId, {
      type: "system:error",
      channel: "system",
      data: {
        code,
        message,
        timestamp: Date.now(),
        recoverable: code !== "AUTH_FAILED",
      },
      messageId: crypto.randomUUID(),
      timestamp: Date.now(),
      error: message,
    });
  }

  private isValidMessage(message: unknown): message is WebSocketMessage {
    if (!message || typeof message !== "object" || message === null) {
      return false;
    }

    const msg = message as Record<string, unknown>;

    return (
      typeof msg.type === "string" &&
      typeof msg.channel === "string" &&
      msg.data !== undefined &&
      typeof msg.timestamp === "number" &&
      typeof msg.messageId === "string"
    );
  }

  private async defaultTokenValidation(
    token: string
  ): Promise<{ valid: boolean; userId?: string }> {
    try {
      // This would integrate with Kinde Auth in a real implementation
      // For now, returning a basic validation
      if (!token) {
        return { valid: false };
      }

      // In a real implementation, this would validate the JWT token
      // and extract user information
      return { valid: true, userId: "test-user" };
    } catch (error) {
      console.error("[WebSocket] Token validation error:", error);
      return { valid: false };
    }
  }

  private async authenticateConnection(
    request: IncomingMessage
  ): Promise<{ valid: boolean; userId?: string }> {
    try {
      const url = new URL(request.url || "", `http://${request.headers.host}`);
      const token =
        url.searchParams.get("token") ||
        request.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return { valid: false };
      }

      return await this.config.authentication.tokenValidation(token);
    } catch (error) {
      console.error("[WebSocket] Authentication error:", error);
      return { valid: false };
    }
  }

  private getClientIP(request: IncomingMessage): string {
    const xForwardedFor = request.headers["x-forwarded-for"];
    const xRealIP = request.headers["x-real-ip"];

    if (xForwardedFor) {
      return Array.isArray(xForwardedFor)
        ? xForwardedFor[0]
        : xForwardedFor.split(",")[0];
    }

    if (xRealIP) {
      return Array.isArray(xRealIP) ? xRealIP[0] : xRealIP;
    }

    return request.socket.remoteAddress || "unknown";
  }

  private setupMessageHandlers(): void {
    // Add global message logging handler
    this.messageRouter.addGlobalHandler(async (message) => {
      if (this.config.monitoring.loggingLevel === "debug") {
        console.info(`[WebSocket] Message routed:`, {
          type: message.type,
          channel: message.channel,
          timestamp: message.timestamp,
        });
      }
    });

    // Add heartbeat handler
    this.messageRouter.addHandler("system", async (message) => {
      if (message.type === "system:heartbeat") {
        // Heartbeat response is handled automatically
      }
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const connections = this.connectionManager.getAllConnections();
      const now = Date.now();
      const timeout = this.config.performance.pingTimeout;

      for (const connection of connections) {
        if (connection.ws.readyState === WebSocket.OPEN) {
          // Send ping
          connection.ws.ping();

          // Check if connection is stale
          if (now - connection.lastActivity > timeout * 2) {
            console.info(
              `[WebSocket] Closing stale connection: ${connection.id}`
            );
            connection.ws.close(1001, "Connection timeout");
          }
        }
      }
    }, this.config.performance.heartbeatInterval);
  }

  private startMetricsCollection(): void {
    if (!this.config.monitoring.metricsEnabled) return;

    this.metricsInterval = setInterval(() => {
      const connectionMetrics = this.connectionManager.getMetrics();

      this.serverMetrics = {
        ...connectionMetrics,
        messagesPerSecond: 0, // Would need to track this properly
        averageLatency: 0, // Would need to measure latency
        errorRate: 0, // Would need to track errors
        uptime: this.isRunning
          ? Date.now() - (this.serverMetrics.uptime || Date.now())
          : 0,
      };

      this.emit("system:performance", { metrics: this.serverMetrics });
    }, this.config.monitoring.healthCheckInterval);
  }

  // ======================
  // Public API
  // ======================

  getServerMetrics(): ServerMetrics {
    return { ...this.serverMetrics };
  }

  getConnectionMetrics(): ConnectionMetrics[] {
    return this.connectionManager.getMetrics().connectionMetrics;
  }

  isHealthy(): boolean {
    return this.isRunning && !!this.wss;
  }

  addMessageHandler(channel: string, handler: MessageHandler): void {
    this.messageRouter.addHandler(channel, handler);
  }

  addGlobalMessageHandler(handler: MessageHandler): void {
    this.messageRouter.addGlobalHandler(handler);
  }
}

// Export singleton instance
export const webSocketServer = WebSocketServerService.getInstance();
