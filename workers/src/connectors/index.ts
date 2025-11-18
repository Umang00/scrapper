import { BaseConnector } from './base-connector';
import { blogConnector } from './blogs';
import { TwitterConnector } from './twitter';
import { InstagramConnector } from './instagram';
import { RedditConnector } from './reddit';

export interface ConnectorRegistry {
  [key: string]: BaseConnector;
}

// Initialize connector instances
const twitterConnector = new TwitterConnector();
const instagramConnector = new InstagramConnector();
const redditConnector = new RedditConnector();

export const connectors: ConnectorRegistry = {
  blog: blogConnector,
  twitter: twitterConnector,
  instagram: instagramConnector,
  reddit: redditConnector,
  // Add more connectors here:
  // youtube: youtubeConnector,
  // tiktok: tiktokConnector,
  // linkedin: linkedinConnector,
};

export function getConnector(name: string): BaseConnector | null {
  return connectors[name] || null;
}

export function listConnectors(): string[] {
  return Object.keys(connectors);
}

export {
  BaseConnector,
  blogConnector,
  twitterConnector,
  instagramConnector,
  redditConnector,
};
