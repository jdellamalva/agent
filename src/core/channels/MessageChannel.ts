/**
 * Message Channel Interface
 * 
 * This interface defines the contract that all message channels must implement
 * to be used within the agent system. It provides a unified API for 
 * interacting with different communication platforms.
 */

export interface ChannelMessage {
  id: string;
  content: string;
  user: string;
  channel: string;
  timestamp: string;
  threadId?: string;
  mentions: string[];
  metadata?: Record<string, any>;
}

export interface ChannelResponse {
  channel: string;
  content: string;
  threadId?: string;
  blocks?: any[];
  metadata?: Record<string, any>;
}

export interface ChannelUser {
  id: string;
  name: string;
  displayName?: string;
  email?: string;
  metadata?: Record<string, any>;
}

export interface ChannelInfo {
  id: string;
  name: string;
  type: 'public' | 'private' | 'dm';
  members?: string[];
  metadata?: Record<string, any>;
}

export interface ChannelCapabilities {
  supportsThreads: boolean;
  supportsFiles: boolean;
  supportsBlocks: boolean;
  supportsReactions: boolean;
  supportsTypingIndicator: boolean;
  maxMessageLength: number;
  supportedFileTypes: string[];
}

export interface MessageChannelConfig {
  [key: string]: any;
}

/**
 * Message handler function type
 */
export type MessageHandler = (message: ChannelMessage) => Promise<void>;

/**
 * Abstract base class for message channels
 */
export abstract class MessageChannel {
  protected config: MessageChannelConfig;
  protected logger: any;
  protected messageHandlers: MessageHandler[] = [];
  protected isConnected: boolean = false;

  constructor(config: MessageChannelConfig, logger: any) {
    this.config = config;
    this.logger = logger.child({ component: `channel-${this.getChannelName()}` });
  }

  /**
   * Get the channel name (e.g., 'slack', 'discord', 'cli')
   */
  abstract getChannelName(): string;

  /**
   * Get the capabilities of this channel
   */
  abstract getCapabilities(): ChannelCapabilities;

  /**
   * Start the channel connection
   */
  abstract start(): Promise<void>;

  /**
   * Stop the channel connection
   */
  abstract stop(): Promise<void>;

  /**
   * Send a message to the channel
   */
  abstract sendMessage(response: ChannelResponse): Promise<void>;

  /**
   * Update an existing message
   */
  abstract updateMessage(channel: string, messageId: string, content: string): Promise<void>;

  /**
   * Send a typing indicator
   */
  abstract sendTypingIndicator(channel: string): Promise<void>;

  /**
   * Get channel information
   */
  abstract getChannelInfo(channelId: string): Promise<ChannelInfo>;

  /**
   * Get user information
   */
  abstract getUserInfo(userId: string): Promise<ChannelUser>;

  /**
   * Health check for the channel
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Register a message handler
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Remove a message handler
   */
  offMessage(handler: MessageHandler): void {
    const index = this.messageHandlers.indexOf(handler);
    if (index > -1) {
      this.messageHandlers.splice(index, 1);
    }
  }

  /**
   * Trigger message handlers
   */
  protected async triggerMessageHandlers(message: ChannelMessage): Promise<void> {
    for (const handler of this.messageHandlers) {
      try {
        await handler(message);
      } catch (error) {
        this.logger.error('Message handler error', { error, message });
      }
    }
  }

  /**
   * Get connection status
   */
  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * Get current configuration
   */
  getConfig(): MessageChannelConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MessageChannelConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * Factory function type for creating message channels
 */
export type MessageChannelFactory = (config: MessageChannelConfig, logger: any) => MessageChannel;

/**
 * Registry for message channel factories
 */
export class MessageChannelRegistry {
  private static factories: Map<string, MessageChannelFactory> = new Map();

  /**
   * Register a new message channel factory
   */
  static registerChannel(name: string, factory: MessageChannelFactory): void {
    this.factories.set(name, factory);
  }

  /**
   * Create a channel instance
   */
  static createChannel(name: string, config: MessageChannelConfig, logger: any): MessageChannel {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Unknown message channel: ${name}`);
    }
    return factory(config, logger);
  }

  /**
   * Get available channel names
   */
  static getAvailableChannels(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Check if a channel is registered
   */
  static hasChannel(name: string): boolean {
    return this.factories.has(name);
  }
}
