#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { getConfig } from './config.js';
import { ConfluenceClient } from './confluence-client.js';

const config = getConfig();
const confluenceClient = new ConfluenceClient(config);

const server = new Server(
  {
    name: 'confluence-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_confluence',
        description: 'Search for content across allowed Confluence spaces by text and/or title',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for content text'
            },
            title: {
              type: 'string',
              description: 'Search query for page titles'
            },
            spaceKey: {
              type: 'string',
              description: 'Optional: Limit search to specific space'
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default: 25)',
              default: 25
            },
            start: {
              type: 'number',
              description: 'Starting index for pagination (default: 0)',
              default: 0
            },
            bodyFormat: {
              type: 'string',
              description: 'Body format to include: "storage" or "view" (optional)',
              enum: ['storage', 'view']
            }
          },
          required: []
        }
      },
      {
        name: 'get_page',
        description: 'Retrieve a specific Confluence page by ID',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: 'Confluence page ID'
            },
            bodyFormat: {
              type: 'string',
              description: 'Body format to include: "storage" or "view" (optional)',
              enum: ['storage', 'view']
            }
          },
          required: ['pageId']
        }
      },
      {
        name: 'create_page',
        description: 'Create a new Confluence page',
        inputSchema: {
          type: 'object',
          properties: {
            spaceKey: {
              type: 'string',
              description: 'Target space key'
            },
            title: {
              type: 'string',
              description: 'Page title'
            },
            content: {
              type: 'string',
              description: 'Page content (HTML or storage format)'
            },
            parentId: {
              type: 'string',
              description: 'Optional: Parent page ID'
            }
          },
          required: ['spaceKey', 'title', 'content']
        }
      },
      {
        name: 'update_page',
        description: 'Update an existing Confluence page',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: 'Page ID to update'
            },
            title: {
              type: 'string',
              description: 'New page title'
            },
            content: {
              type: 'string',
              description: 'New page content'
            },
            version: {
              type: 'number',
              description: 'Current version number (required for updates)'
            }
          },
          required: ['pageId', 'title', 'content', 'version']
        }
      },
      {
        name: 'move_page',
        description: 'Move a Confluence page to a different space or parent',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: 'Page ID to move'
            },
            targetSpaceKey: {
              type: 'string',
              description: 'Target space key to move the page to'
            },
            parentId: {
              type: 'string',
              description: 'Optional: New parent page ID in the target space'
            }
          },
          required: ['pageId', 'targetSpaceKey']
        }
      },
      {
        name: 'list_spaces',
        description: 'List all accessible Confluence spaces (filtered by allowed spaces)',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum results (default: 50)',
              default: 50
            },
            cursor: {
              type: 'string',
              description: 'Cursor for pagination (from _links.next)'
            }
          }
        }
      },
      {
        name: 'get_space_by_id',
        description: 'Get detailed information about a specific Confluence space by ID',
        inputSchema: {
          type: 'object',
          properties: {
            spaceId: {
              type: 'string',
              description: 'Space ID'
            }
          },
          required: ['spaceId']
        }
      },
      {
        name: 'get_space_by_key',
        description: 'Get detailed information about a specific Confluence space by key',
        inputSchema: {
          type: 'object',
          properties: {
            spaceKey: {
              type: 'string',
              description: 'Space key'
            }
          },
          required: ['spaceKey']
        }
      },
      {
        name: 'get_space_content',
        description: 'Get pages from a specific space',
        inputSchema: {
          type: 'object',
          properties: {
            spaceKey: {
              type: 'string',
              description: 'Space key'
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default: 25)',
              default: 25
            },
            start: {
              type: 'number',
              description: 'Starting index for pagination (default: 0)',
              default: 0
            },
            bodyFormat: {
              type: 'string',
              description: 'Body format to include: "storage" or "view" (optional)',
              enum: ['storage', 'view']
            }
          },
          required: ['spaceKey']
        }
      },
      {
        name: 'get_page_children',
        description: 'Get child pages of a specific page',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: 'Parent page ID'
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default: 25)',
              default: 25
            },
            start: {
              type: 'number',
              description: 'Starting index for pagination (default: 0)',
              default: 0
            },
            bodyFormat: {
              type: 'string',
              description: 'Body format to include: "storage" or "view" (optional)',
              enum: ['storage', 'view']
            }
          },
          required: ['pageId']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_confluence': {
        const { query, title, spaceKey, limit = 25, start = 0, bodyFormat } = args as {
          query?: string;
          title?: string;
          spaceKey?: string;
          limit?: number;
          start?: number;
          bodyFormat?: string;
        };
        
        // Validate that at least one search parameter is provided
        if (!query && !title) {
          throw new Error('At least one of "query" or "title" must be provided');
        }
        
        const results = await confluenceClient.searchContent(query, spaceKey, limit, title, start, bodyFormat);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2)
            }
          ]
        };
      }

      case 'get_page': {
        const { pageId, bodyFormat } = args as {
          pageId: string;
          bodyFormat?: string;
        };
        
        const page = await confluenceClient.getPage(pageId, bodyFormat);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(page, null, 2)
            }
          ]
        };
      }

      case 'create_page': {
        const { spaceKey, title, content, parentId } = args as {
          spaceKey: string;
          title: string;
          content: string;
          parentId?: string;
        };
        
        const page = await confluenceClient.createPage(spaceKey, title, content, parentId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(page, null, 2)
            }
          ]
        };
      }

      case 'update_page': {
        const { pageId, title, content, version } = args as {
          pageId: string;
          title: string;
          content: string;
          version: number;
        };
        
        const page = await confluenceClient.updatePage(pageId, title, content, version);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(page, null, 2)
            }
          ]
        };
      }

      case 'move_page': {
        const { pageId, targetSpaceKey, parentId } = args as {
          pageId: string;
          targetSpaceKey: string;
          parentId?: string;
        };
        
        const page = await confluenceClient.movePage(pageId, targetSpaceKey, parentId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(page, null, 2)
            }
          ]
        };
      }

      case 'list_spaces': {
        const { limit = 50, cursor } = args as {
          limit?: number;
          cursor?: string;
        };
        
        const spaces = await confluenceClient.listSpaces(limit, cursor);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(spaces, null, 2)
            }
          ]
        };
      }

      case 'get_space_by_id': {
        const { spaceId } = args as {
          spaceId: string;
        };
        
        const space = await confluenceClient.getSpaceById(spaceId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(space, null, 2)
            }
          ]
        };
      }

      case 'get_space_by_key': {
        const { spaceKey } = args as {
          spaceKey: string;
        };
        
        const space = await confluenceClient.getSpaceByKey(spaceKey);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(space, null, 2)
            }
          ]
        };
      }

      case 'get_space_content': {
        const { spaceKey, limit = 25, start = 0, bodyFormat } = args as {
          spaceKey: string;
          limit?: number;
          start?: number;
          bodyFormat?: string;
        };
        
        const pages = await confluenceClient.getSpaceContent(spaceKey, limit, start, bodyFormat);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(pages, null, 2)
            }
          ]
        };
      }

      case 'get_page_children': {
        const { pageId, limit = 25, start = 0, bodyFormat } = args as {
          pageId: string;
          limit?: number;
          start?: number;
          bodyFormat?: string;
        };
        
        const children = await confluenceClient.getPageChildren(pageId, limit, start, bodyFormat);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(children, null, 2)
            }
          ]
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (config.debug) {
      console.error('Tool execution error:', error);
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Error executing ${name}: ${errorMessage}`
    );
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  if (config.debug) {
    console.error('Confluence MCP Server started successfully');
    console.error(`Connected to: ${config.baseUrl}`);
    console.error(`Allowed spaces: ${config.allowedSpaces.join(', ')}`);
  }
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});