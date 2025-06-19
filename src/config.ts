import dotenv from 'dotenv';
import { ConfluenceConfig } from './types.js';

dotenv.config();

export function getConfig(): ConfluenceConfig {
  const baseUrl = process.env.CONFLUENCE_BASE_URL;
  const username = process.env.CONFLUENCE_USERNAME;  
  const apiToken = process.env.CONFLUENCE_API_TOKEN;
  const allowedSpaces = process.env.ALLOWED_SPACES;

  if (!baseUrl) {
    throw new Error('CONFLUENCE_BASE_URL environment variable is required');
  }

  if (!username) {
    throw new Error('CONFLUENCE_USERNAME environment variable is required');
  }

  if (!apiToken) {
    throw new Error('CONFLUENCE_API_TOKEN environment variable is required');
  }

  if (!allowedSpaces) {
    throw new Error('ALLOWED_SPACES environment variable is required');
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    username,
    apiToken,
    allowedSpaces: allowedSpaces.split(',').map(s => s.trim()),
    debug: process.env.DEBUG === 'true'
  };
}

export function validateSpaceAccess(spaceKey: string, allowedSpaces: string[]): boolean {
  return allowedSpaces.includes(spaceKey);
}