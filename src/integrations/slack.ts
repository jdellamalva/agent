import { App, SocketModeReceiver } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { agentLogger } from '@utils/logger';
import { SlackError } from '@utils/errors';
import defaultConfig from '@utils/config';
import { OpenAIClient } from './openai';

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
  private openaiClient: OpenAIClient;
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
    this.openaiClient = new OpenAIClient();

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

        // Send to OpenAI for processing with advanced features
        try {
          logger.info('Processing structured request via OpenAI', { prompt, user: message.user });
          
          // Get conversation history from thread if available
          const conversationHistory = await this.getThreadHistory(event);
          
          const result = await this.openaiClient.processStructuredRequest(prompt, {
            projectContext: 'Slack-based LLM agent for codebase management',
            conversationHistory
          });

          logger.info('Received structured OpenAI response', { 
            tokensUsed: result.tokenUsage,
            budgetStatus: result.budgetStatus,
            validCommands: result.validation.validCommands.length,
            invalidCommands: result.validation.invalidCommands.length,
            user: message.user
          });

          // Format response with structured information
          let responseText = result.response.userMessage || result.response.reasoning;
          
          if (result.validation.validCommands.length > 0) {
            responseText += `\n\n🔧 **Commands identified:** ${result.validation.validCommands.length}`;
            
            // Show first few commands as preview
            const previewCommands = result.validation.validCommands.slice(0, 3);
            if (previewCommands.length > 0) {
              responseText += '\n```\n';
              previewCommands.forEach((cmd, i) => {
                responseText += `${i + 1}. ${cmd.action}`;
                if (cmd.parameters && Object.keys(cmd.parameters).length > 0) {
                  responseText += ` (${Object.keys(cmd.parameters).join(', ')})`;
                }
                responseText += '\n';
              });
              if (result.validation.validCommands.length > 3) {
                responseText += `... and ${result.validation.validCommands.length - 3} more\n`;
              }
              responseText += '```';
            }
          }

          if (result.validation.invalidCommands.length > 0) {
            responseText += `\n\n⚠️ **${result.validation.invalidCommands.length} command(s) need attention**`;
          }

          // Add budget status if near limit
          if (result.budgetStatus.isNearLimit) {
            responseText += `\n\n📊 Token usage: ${result.budgetStatus.daily.percentUsed.toFixed(1)}% daily, ${result.budgetStatus.monthly.percentUsed.toFixed(1)}% monthly`;
          }

          await say({
            text: responseText,
            thread_ts: event.ts,
          });

        } catch (openaiError) {
          logger.error('Structured OpenAI processing failed', { error: openaiError, prompt });
          
          // Provide more specific error messages based on error type
          let errorMessage = "I encountered an error processing your request. Please try again later.";
          
          if (openaiError instanceof Error) {
            if (openaiError.message.includes('TOKEN_BUDGET_EXCEEDED')) {
              errorMessage = "⚠️ Token budget exceeded. Please try again later or contact an admin to increase limits.";
            } else if (openaiError.message.includes('RATE_LIMIT')) {
              errorMessage = "⏳ Rate limit reached. Please wait a moment and try again.";
            }
          }
          
          await say({
            text: errorMessage,
            thread_ts: event.ts,
          });
        }

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

  /**
   * Get conversation history from a Slack thread
   */
  private async getThreadHistory(event: any): Promise<string[]> {
    try {
      if (!event.thread_ts) {
        return []; // No thread, no history
      }

      const result = await this.webClient.conversations.replies({
        channel: event.channel,
        ts: event.thread_ts,
        limit: 10 // Limit to last 10 messages for context
      });

      if (!result.messages) {
        return [];
      }

      // Convert messages to simple text array, excluding the current message
      const history = result.messages
        .filter(msg => msg.ts !== event.ts) // Exclude current message
        .map(msg => {
          // Simple user identification - if it's a bot message, it's the assistant
          const user = msg.bot_id ? 'Assistant' : 'User';
          return `${user}: ${this.extractPrompt(msg.text || '')}`;
        })
        .filter(text => text.trim().length > 0);

      logger.debug('Retrieved thread history', { 
        threadTs: event.thread_ts,
        historyLength: history.length 
      });

      return history;
    } catch (error) {
      logger.warn('Failed to retrieve thread history', { error, threadTs: event.thread_ts });
      return [];
    }
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
