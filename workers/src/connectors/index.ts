import { BaseConnector } from './base-connector';
import { blogConnector } from './blogs';
import { TwitterConnector } from './twitter';
import { InstagramConnector } from './instagram';
import { RedditConnector } from './reddit';
import { TikTokConnector } from './tiktok';
import { YouTubeConnector } from './youtube';
import { LinkedInConnector } from './linkedin';
import { FacebookConnector } from './facebook';

export interface ConnectorRegistry {
  [key: string]: BaseConnector;
}

// Initialize connector instances
const twitterConnector = new TwitterConnector();
const instagramConnector = new InstagramConnector();
const redditConnector = new RedditConnector();
const tiktokConnector = new TikTokConnector();
const youtubeConnector = new YouTubeConnector();
const linkedinConnector = new LinkedInConnector();
const facebookConnector = new FacebookConnector();

export const connectors: ConnectorRegistry = {
  blog: blogConnector,
  twitter: twitterConnector,
  instagram: instagramConnector,
  reddit: redditConnector,
  tiktok: tiktokConnector,
  youtube: youtubeConnector,
  linkedin: linkedinConnector,
  facebook: facebookConnector,
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
  tiktokConnector,
  youtubeConnector,
  linkedinConnector,
  facebookConnector,
};
