import { App, SocketModeReceiver } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { agentLogger } from '@utils/logger';
import { SlackError } from '@utils/errors';
import defaultConfig from '@utils/config';

const logger = agentLogger.child({ component: 'slack' });

export interface SlackMessage {
  text: string;
  user: string;
  channel: string;
  ts: string;
  thread_ts?: string;
}

export interface SlackResponse {
  channel: string;
  text: string;
  thread_ts?: string;
  blocks?: any[];
}

export class SlackClient {
  private app: App;
  private webClient: WebClient;
  private isConnected: boolean = false;

  constructor() {
    const config = defaultConfig;
    
    if (!config.slack.botToken || !config.slack.signingSecret || !config.slack.appToken) {
      throw new SlackError('Missing required Slack configuration', 'SLACK_CONFIG_MISSING');
    }

    // Initialize Socket Mode receiver
    const receiver = new SocketModeReceiver({
      appToken: config.slack.appToken,
      // Note: signingSecret is not needed for Socket Mode
    });

    // Initialize the app
    this.app = new App({
      token: config.slack.botToken,
      receiver,
      logLevel: config.logging.level === 'debug' ? 'DEBUG' as any : 'INFO' as any,
    });

    this.webClient = new WebClient(config.slack.botToken);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle app mentions (@agent)
    this.app.event('app_mention', async ({ event, say }) => {
      try {
        logger.info('Received app mention', { 
          user: event.user, 
          channel: event.channel,
          text: event.text 
        });

        const message: SlackMessage = {
          text: event.text || '',
          user: event.user || 'unknown',
          channel: event.channel,
          ts: event.ts,
          ...(event.thread_ts && { thread_ts: event.thread_ts }),
        };

        // Extract the prompt (remove @agent mention)
        const prompt = this.extractPrompt(message.text);
        
        if (!prompt.trim()) {
          await say({
            text: "Hi! I'm your LLM agent. Mention me with a task and I'll help you manage your codebases!",
            thread_ts: event.ts,
          });
          return;
        }

        // TODO: Phase 3 - Send to OpenAI for processing
        // For now, just acknowledge the message
        await say({
          text: `I received your request: "${prompt}"\n\nI'm still learning! Once Phase 3 (OpenAI integration) is complete, I'll be able to process your requests.`,
          thread_ts: event.ts,
        });

      } catch (error) {
        logger.error('Error handling app mention', { error });
        await say({
          text: "Sorry, I encountered an error processing your request.",
          thread_ts: event.ts,
        });
      }
    });

    // Handle direct messages
    this.app.message(async ({ message, say }) => {
      try {
        // Only handle direct messages (not in channels)
        if ('channel_type' in message && message.channel_type === 'im' && 'user' in message && 'text' in message) {
          logger.info('Received direct message', { 
            user: (message as any).user, 
            text: (message as any).text 
          });

          await say({
            text: "Hi! I work best when you mention me in a channel with @agent followed by your request. Try it out!"
          });
        }
      } catch (error) {
        logger.error('Error handling direct message', { error });
      }
    });

    // Handle errors
    this.app.error(async (error) => {
      logger.error('Slack app error', { error });
    });
  }

  private extractPrompt(text: string): string {
    // Remove @agent or @botname mentions and clean up the text
    const cleanText = text
      .replace(/<@U[A-Z0-9]+>/g, '') // Remove user mentions
      .replace(/@\w+/g, '') // Remove @mentions
      .trim();
    
    return cleanText;
  }

  public async sendMessage(response: SlackResponse): Promise<void> {
    try {
      const messageArgs: any = {
        channel: response.channel,
        text: response.text,
      };
      
      if (response.thread_ts) {
        messageArgs.thread_ts = response.thread_ts;
      }
      
      if (response.blocks) {
        messageArgs.blocks = response.blocks;
      }
      
      await this.webClient.chat.postMessage(messageArgs);

      logger.info('Message sent successfully', { 
        channel: response.channel,
        thread_ts: response.thread_ts 
      });
    } catch (error) {
      logger.error('Error sending message', { error, response });
      throw new SlackError('Failed to send message to Slack', 'SLACK_SEND_FAILED');
    }
  }

  public async sendTypingIndicator(channel: string): Promise<void> {
    try {
      // Note: Slack doesn't have a typing indicator API for bots
      // We could send an immediate "thinking..." message instead
      await this.webClient.chat.postMessage({
        channel,
        text: "🤔 Thinking...",
      });
    } catch (error) {
      logger.error('Error sending typing indicator', { error });
    }
  }

  public async updateMessage(channel: string, ts: string, text: string): Promise<void> {
    try {
      await this.webClient.chat.update({
        channel,
        ts,
        text,
      });
    } catch (error) {
      logger.error('Error updating message', { error });
      throw new SlackError('Failed to update message', 'SLACK_UPDATE_FAILED');
    }
  }

  public async start(): Promise<void> {
    try {
      await this.app.start();
      this.isConnected = true;
      logger.info('Slack app started successfully');
    } catch (error) {
      logger.error('Failed to start Slack app', { error });
      throw new SlackError('Failed to start Slack app', 'SLACK_START_FAILED');
    }
  }

  public async stop(): Promise<void> {
    try {
      await this.app.stop();
      this.isConnected = false;
      logger.info('Slack app stopped');
    } catch (error) {
      logger.error('Error stopping Slack app', { error });
    }
  }

  public isReady(): boolean {
    return this.isConnected;
  }

  public getApp(): App {
    return this.app;
  }
}
