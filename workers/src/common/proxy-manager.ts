import { logger } from '../services/logger';
import { config } from '../config';

export interface ProxyEntry {
  id: string;
  url: string;
  type: 'residential' | 'datacenter' | 'mobile';
  isActive: boolean;
  successCount: number;
  failureCount: number;
  lastUsed?: Date;
}

export class ProxyManager {
  private proxies: Map<string, ProxyEntry> = new Map();
  private roundRobinIndex: number = 0;

  constructor() {
    this.loadProxies();
  }

  private loadProxies(): void {
    // Add configured proxies
    if (config.proxies.residential) {
      this.addProxy({
        id: 'residential-1',
        url: config.proxies.residential,
        type: 'residential',
        isActive: true,
        successCount: 0,
        failureCount: 0,
      });
    }

    if (config.proxies.datacenter) {
      this.addProxy({
        id: 'datacenter-1',
        url: config.proxies.datacenter,
        type: 'datacenter',
        isActive: true,
        successCount: 0,
        failureCount: 0,
      });
    }

    logger.info('Proxy manager initialized', { proxyCount: this.proxies.size });
  }

  addProxy(proxy: ProxyEntry): void {
    this.proxies.set(proxy.id, proxy);
    logger.debug('Proxy added', { proxyId: proxy.id, type: proxy.type });
  }

  getProxy(type?: 'residential' | 'datacenter' | 'mobile'): ProxyEntry | null {
    const activeProxies = Array.from(this.proxies.values()).filter(
      (p) => p.isActive && (!type || p.type === type)
    );

    if (activeProxies.length === 0) {
      logger.warn('No active proxies available', { requestedType: type });
      return null;
    }

    // Round-robin selection
    const proxy = activeProxies[this.roundRobinIndex % activeProxies.length];
    this.roundRobinIndex++;

    proxy.lastUsed = new Date();
    logger.debug('Proxy selected', { proxyId: proxy.id, type: proxy.type });

    return proxy;
  }

  recordSuccess(proxyId: string): void {
    const proxy = this.proxies.get(proxyId);
    if (proxy) {
      proxy.successCount++;
      logger.debug('Proxy success recorded', { proxyId, successCount: proxy.successCount });
    }
  }

  recordFailure(proxyId: string): void {
    const proxy = this.proxies.get(proxyId);
    if (proxy) {
      proxy.failureCount++;

      // Deactivate proxy if failure rate is too high
      const totalRequests = proxy.successCount + proxy.failureCount;
      const failureRate = proxy.failureCount / totalRequests;

      if (totalRequests > 10 && failureRate > 0.5) {
        proxy.isActive = false;
        logger.warn('Proxy deactivated due to high failure rate', {
          proxyId,
          failureRate: failureRate.toFixed(2),
        });
      }
    }
  }

  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [id, proxy] of this.proxies) {
      stats[id] = {
        type: proxy.type,
        isActive: proxy.isActive,
        successCount: proxy.successCount,
        failureCount: proxy.failureCount,
        totalRequests: proxy.successCount + proxy.failureCount,
        lastUsed: proxy.lastUsed,
      };
    }

    return stats;
  }
}

export const proxyManager = new ProxyManager();
