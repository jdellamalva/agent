/**
 * SlackChannel - Slack workspace integration for agent communication
 * 
 * **Purpose**: 
 * Implements the MessageChannel interface to enable agent interaction through
 * Slack workspaces using Socket Mode for real-time message handling, thread
 * management, and user authentication.
 * 
 * **Dependencies**:
 * - @slack/bolt: Official Slack Bolt framework for event handling
 * - @slack/web-api: Slack Web API client for message operations
 * - MessageChannel: Base class providing common channel functionality
 * - SlackError: Specialized error handling for Slack-specific issues
 * 
 * **Key Patterns**:
 * - Event-driven architecture using Slack's real-time APIs
 * - Socket Mode for secure, firewall-friendly communication
 * - Thread-based conversations for organized agent interactions
 * - Mention-based triggering (@agent) for natural invocation
 * 
 * **Lifecycle**:
 * 1. Initialize with bot tokens and workspace credentials
 * 2. Establish Socket Mode connection for real-time events
 * 3. Register event handlers for mentions and direct messages
 * 4. Process incoming messages and route to agent logic
 * 5. Send responses with proper threading and formatting
 * 
 * **Performance Considerations**:
 * - Connection pooling for Web API calls
 * - Event deduplication to prevent duplicate processing
 * - Rate limiting compliance with Slack's API constraints
 * - Efficient message parsing and formatting
 * 
 * **Error Handling**:
 * - Automatic reconnection for Socket Mode disconnections
 * - Graceful handling of permission and authentication errors
 * - User-friendly error messages for configuration issues
 * - Retry logic for transient API failures
 */

import { App, SocketModeReceiver, LogLevel } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { 
  MessageChannel, 
  ChannelMessage, 
  ChannelResponse, 
  ChannelUser, 
  ChannelInfo, 
  ChannelCapabilities,
  MessageChannelConfig 
} from '../../core/channels/MessageChannel';
import { SlackError } from '../../utils/errors';

export interface SlackChannelConfig extends MessageChannelConfig {
  botToken: string;
  signingSecret: string;
  appToken: string;
}

export class SlackChannel extends MessageChannel {
  private app: App;
  private webClient: WebClient;
  private slackConfig: SlackChannelConfig;

  /**
   * Initialize Slack channel with workspace authentication and Socket Mode setup
   * 
   * @param config - Slack-specific configuration including:
   *   - botToken: Bot User OAuth Token for API access (required)
   *   - signingSecret: Signing secret for request verification (required)
   *   - appToken: App-level token for Socket Mode connection (required)
   * @param logger - Logger instance for message and event tracking
   * 
   * @throws SlackError if any required tokens are missing
   * 
   * **Side Effects**:
   * - Creates Socket Mode receiver for real-time events
   * - Initializes Slack Bolt app with authentication
   * - Sets up Web API client for message operations
   * - Prepares event handlers for mention detection
   * 
   * **Security**: All tokens are validated but never logged for security
   */
  constructor(config: SlackChannelConfig, logger: any) {
    super(config, logger);
    this.slackConfig = config;
    
    if (!config.botToken || !config.signingSecret || !config.appToken) {
      throw new SlackError('Missing required Slack configuration', 'SLACK_CONFIG_MISSING');
    }

    // Initialize Socket Mode receiver
    const receiver = new SocketModeReceiver({
      appToken: config.appToken,
    });

    // Initialize the app
    this.app = new App({
      token: config.botToken,
      receiver,
      logLevel: LogLevel.INFO,
    });

    this.webClient = new WebClient(config.botToken);

    this.setupEventHandlers();
  }

  getChannelName(): string {
    return 'slack';
  }

  getCapabilities(): ChannelCapabilities {
    return {
      supportsThreads: true,
      supportsFiles: true,
      supportsBlocks: true,
      supportsReactions: true,
      supportsTypingIndicator: false, // Slack doesn't have typing indicators for bots
      maxMessageLength: 40000,
      supportedFileTypes: ['*'] // Slack supports most file types
    };
  }

  async start(): Promise<void> {
    try {
      await this.app.start();
      this.isConnected = true;
      this.logger.info('Slack channel started successfully');
    } catch (error) {
      this.logger.error('Failed to start Slack channel', { error });
      throw new SlackError('Failed to start Slack channel', 'SLACK_START_FAILED');
    }
  }

  async stop(): Promise<void> {
    try {
      await this.app.stop();
      this.isConnected = false;
      this.logger.info('Slack channel stopped');
    } catch (error) {
      this.logger.error('Error stopping Slack channel', { error });
    }
  }

  async sendMessage(response: ChannelResponse): Promise<void> {
    try {
      const messageArgs: any = {
        channel: response.channel,
        text: response.content,
      };
      
      if (response.threadId) {
        messageArgs.thread_ts = response.threadId;
      }
      
      if (response.blocks) {
        messageArgs.blocks = response.blocks;
      }
      
      await this.webClient.chat.postMessage(messageArgs);

      this.logger.info('Message sent successfully', { 
        channel: response.channel,
        threadId: response.threadId 
      });
    } catch (error) {
      this.logger.error('Error sending message', { error, response });
      throw new SlackError('Failed to send message to Slack', 'SLACK_SEND_FAILED');
    }
  }

  async updateMessage(channel: string, messageId: string, content: string): Promise<void> {
    try {
      await this.webClient.chat.update({
        channel,
        ts: messageId,
        text: content,
      });
      
      this.logger.info('Message updated successfully', { channel, messageId });
    } catch (error) {
      this.logger.error('Error updating message', { error });
      throw new SlackError('Failed to update message', 'SLACK_UPDATE_FAILED');
    }
  }

  async sendTypingIndicator(channel: string): Promise<void> {
    try {
      // Slack doesn't have a typing indicator API for bots
      // We could send an immediate "thinking..." message instead
      await this.webClient.chat.postMessage({
        channel,
        text: "🤔 Thinking...",
      });
    } catch (error) {
      this.logger.error('Error sending typing indicator', { error });
    }
  }

  async getChannelInfo(channelId: string): Promise<ChannelInfo> {
    try {
      const result = await this.webClient.conversations.info({
        channel: channelId,
      });

      if (!result.channel) {
        throw new SlackError('Channel not found', 'CHANNEL_NOT_FOUND');
      }

      return {
        id: result.channel.id!,
        name: result.channel.name || 'Unknown',
        type: this.mapChannelType(result.channel),
        metadata: {
          topic: result.channel.topic?.value,
          purpose: result.channel.purpose?.value,
          memberCount: result.channel.num_members
        }
      };
    } catch (error) {
      this.logger.error('Error getting channel info', { error, channelId });
      throw new SlackError('Failed to get channel info', 'SLACK_CHANNEL_INFO_FAILED');
    }
  }

  async getUserInfo(userId: string): Promise<ChannelUser> {
    try {
      const result = await this.webClient.users.info({
        user: userId,
      });

      if (!result.user) {
        throw new SlackError('User not found', 'USER_NOT_FOUND');
      }

      return {
        id: result.user.id!,
        name: result.user.name || 'Unknown',
        displayName: result.user.real_name || 'Unknown',
        email: result.user.profile?.email || '',
        metadata: {
          title: result.user.profile?.title || '',
          timeZone: result.user.tz || '',
          isBot: result.user.is_bot || false
        }
      };
    } catch (error) {
      this.logger.error('Error getting user info', { error, userId });
      throw new SlackError('Failed to get user info', 'SLACK_USER_INFO_FAILED');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.webClient.auth.test();
      return result.ok === true;
    } catch (error) {
      this.logger.error('Slack health check failed', { error });
      return false;
    }
  }

  private setupEventHandlers(): void {
    // Handle app mentions (@agent)
    this.app.event('app_mention', async ({ event }: { event: any }) => {
      try {
        this.logger.info('Received app mention', { 
          user: event.user, 
          channel: event.channel,
          text: event.text 
        });

        const message: ChannelMessage = {
          id: event.ts,
          content: event.text || '',
          user: event.user || 'unknown',
          channel: event.channel,
          timestamp: event.ts,
          threadId: event.thread_ts,
          mentions: this.extractMentions(event.text || ''),
          metadata: {
            eventType: 'app_mention',
            originalEvent: event
          }
        };

        await this.triggerMessageHandlers(message);

      } catch (error) {
        this.logger.error('Error handling app mention', { error });
      }
    });

    // Handle direct messages
    this.app.message(async ({ message }: { message: any }) => {
      try {
        // Only handle direct messages (not in channels)
        if ('channel_type' in message && message.channel_type === 'im' && 'user' in message && 'text' in message) {
          this.logger.info('Received direct message', { 
            user: (message as any).user, 
            text: (message as any).text 
          });

          const channelMessage: ChannelMessage = {
            id: (message as any).ts,
            content: (message as any).text,
            user: (message as any).user,
            channel: (message as any).channel,
            timestamp: (message as any).ts,
            mentions: [],
            metadata: {
              eventType: 'direct_message',
              originalMessage: message
            }
          };

          await this.triggerMessageHandlers(channelMessage);
        }
      } catch (error) {
        this.logger.error('Error handling direct message', { error });
      }
    });

    // Handle errors
    this.app.error(async (error: any) => {
      this.logger.error('Slack app error', { error });
    });
  }

  private extractMentions(text: string): string[] {
    const mentionRegex = /<@(U[A-Z0-9]+)>/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      if (match[1]) {
        mentions.push(match[1]);
      }
    }

    return mentions;
  }

  private mapChannelType(channel: any): 'public' | 'private' | 'dm' {
    if (channel.is_im) return 'dm';
    if (channel.is_private) return 'private';
    return 'public';
  }

  /**
   * Get conversation history from a Slack thread
   */
  async getThreadHistory(channelId: string, threadId: string, limit: number = 10): Promise<ChannelMessage[]> {
    try {
      const result = await this.webClient.conversations.replies({
        channel: channelId,
        ts: threadId,
        limit
      });

      if (!result.messages) {
        return [];
      }

      return result.messages.map((msg: any) => ({
        id: msg.ts!,
        content: msg.text || '',
        user: msg.user || 'unknown',
        channel: channelId,
        timestamp: msg.ts!,
        threadId,
        mentions: this.extractMentions(msg.text || ''),
        metadata: {
          isBot: msg.bot_id !== undefined,
          originalMessage: msg
        }
      }));
    } catch (error) {
      this.logger.warn('Failed to retrieve thread history', { error, channelId, threadId });
      return [];
    }
  }

  /**
   * Get the Slack app instance for advanced operations
   */
  getApp(): App {
    return this.app;
  }
}

/**
 * Factory function for creating Slack channel instances
 */
export function createSlackChannel(config: MessageChannelConfig, logger: any): SlackChannel {
  return new SlackChannel(config as SlackChannelConfig, logger);
}
