import { BaseConnector } from './base-connector';
import { blogConnector } from './blogs';

export interface ConnectorRegistry {
  [key: string]: BaseConnector;
}

export const connectors: ConnectorRegistry = {
  blog: blogConnector,
  // Add more connectors here:
  // twitter: twitterConnector,
  // instagram: instagramConnector,
  // reddit: redditConnector,
  // youtube: youtubeConnector,
};

export function getConnector(name: string): BaseConnector | null {
  return connectors[name] || null;
}

export { BaseConnector, blogConnector };
