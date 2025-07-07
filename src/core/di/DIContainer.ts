/**
 * Dependency Injection Container
 * 
 * Provides dependency injection to eliminate tight coupling between components
 * and improve testability and separation of concerns.
 */

import { agentLogger } from '../../utils/logger';
import { ConfigManager } from '../config/ConfigManager';

const logger = agentLogger.child({ component: 'di-container' });

export type ServiceFactory<T = any> = (...args: any[]) => T;
export type AsyncServiceFactory<T = any> = (...args: any[]) => Promise<T>;

export interface ServiceDefinition<T = any> {
  factory: ServiceFactory<T> | AsyncServiceFactory<T>;
  scope: 'singleton' | 'transient';
  dependencies?: string[];
}

export class DIContainer {
  private services = new Map<string, ServiceDefinition>();
  private instances = new Map<string, any>();
  private resolving = new Set<string>();

  /**
   * Register a service with the container
   */
  register<T>(
    name: string, 
    factory: ServiceFactory<T> | AsyncServiceFactory<T>,
    options: { 
      scope?: 'singleton' | 'transient';
      dependencies?: string[];
    } = {}
  ): void {
    this.services.set(name, {
      factory,
      scope: options.scope || 'singleton',
      dependencies: options.dependencies || []
    });

    logger.debug('Service registered', { name, scope: options.scope });
  }

  /**
   * Register a singleton instance directly
   */
  registerInstance<T>(name: string, instance: T): void {
    this.instances.set(name, instance);
    logger.debug('Instance registered', { name });
  }

  /**
   * Resolve a service from the container
   */
  async resolve<T>(name: string): Promise<T> {
    // Check for circular dependencies
    if (this.resolving.has(name)) {
      throw new Error(`Circular dependency detected: ${name}`);
    }

    // Return existing singleton instance
    if (this.instances.has(name)) {
      return this.instances.get(name);
    }

    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service not registered: ${name}`);
    }

    this.resolving.add(name);

    try {
      // Resolve dependencies first
      const dependencies = [];
      for (const dep of service.dependencies || []) {
        dependencies.push(await this.resolve(dep));
      }

      // Create instance
      const instance = await service.factory(...dependencies);

      // Store singleton instances
      if (service.scope === 'singleton') {
        this.instances.set(name, instance);
      }

      return instance;
    } finally {
      this.resolving.delete(name);
    }
  }

  /**
   * Resolve multiple services
   */
  async resolveMany<T>(names: string[]): Promise<T[]> {
    return Promise.all(names.map(name => this.resolve<T>(name)));
  }

  /**
   * Clear all instances (useful for testing)
   */
  clear(): void {
    this.instances.clear();
    this.resolving.clear();
    logger.debug('Container cleared');
  }

  /**
   * Get container status
   */
  getStatus() {
    return {
      services: Array.from(this.services.keys()),
      instances: Array.from(this.instances.keys()),
      resolving: Array.from(this.resolving)
    };
  }
}

/**
 * Global container instance
 */
export const globalContainer = new DIContainer();

/**
 * Register core services with the container
 */
export function registerCoreServices(): void {
  // Configuration
  globalContainer.registerInstance('config', ConfigManager.getConfig());

  // Logger
  globalContainer.registerInstance('logger', agentLogger);

  logger.info('Core services registered');
}
