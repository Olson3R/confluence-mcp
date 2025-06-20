# Confluence MCP Server

A Model Context Protocol (MCP) server that provides secure access to Atlassian Confluence through its REST API.

<a href="https://glama.ai/mcp/servers/@Olson3R/confluence-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@Olson3R/confluence-mcp/badge" alt="Confluence Server MCP server" />
</a>

## Using with Claude Code

To use this MCP server with Claude Code, add it to your MCP configuration file:

### Option 1: Using the built version (recommended)

1. First, build the server:
   ```bash
   npm run build
   ```

2. Add to your MCP configuration file (`~/.config/claude-code/mcp_servers_config.json`):
   ```json
   {
     "mcpServers": {
       "confluence": {
         "command": "node",
         "args": ["/path/to/confluence_mcp/dist/index.js"],
         "env": {
           "CONFLUENCE_BASE_URL": "https://your-domain.atlassian.net",
           "CONFLUENCE_USERNAME": "your-email@domain.com",
           "CONFLUENCE_API_TOKEN": "your-api-token",
           "ALLOWED_SPACES": "SPACE1,SPACE2,SPACE3"
         }
       }
     }
   }
   ```

### Option 2: Using tsx for development

For development or if you prefer running TypeScript directly:

```json
{
  "mcpServers": {
    "confluence": {
      "command": "npx",
      "args": ["tsx", "/path/to/confluence_mcp/src/index.ts"],
      "env": {
        "CONFLUENCE_BASE_URL": "https://your-domain.atlassian.net",
        "CONFLUENCE_USERNAME": "your-email@domain.com",
        "CONFLUENCE_API_TOKEN": "your-api-token",
        "ALLOWED_SPACES": "SPACE1,SPACE2,SPACE3"
      }
    }
  }
}
```

### Configuration Notes

- Replace the environment variables with your actual Confluence credentials
- The `ALLOWED_SPACES` should be a comma-separated list of space keys you want to allow access to
- Restart Claude Code after updating the configuration
- Make sure you have built the project first with `npm run build` if using Option 1

Once configured, you can use commands like:
- "Search for API documentation in Confluence"
- "Create a new page in the DEV space"
- "Show me all pages in the PROJ space"

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Confluence credentials
   ```

3. **Build and run:**
   ```bash
   npm run build
   npm start
   ```

   Or for development:
   ```bash
   npm run dev
   ```

## Configuration

Create a `.env` file with your Confluence credentials:

```env
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_USERNAME=your-email@domain.com
CONFLUENCE_API_TOKEN=your-api-token
ALLOWED_SPACES=SPACE1,SPACE2,SPACE3
DEBUG=false
```

### Getting an API Token

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a descriptive label
4. Copy the generated token (save it securely!)

## Available Tools

- **search_confluence** - Search content across allowed spaces
- **get_page** - Retrieve a specific page by ID
- **create_page** - Create a new page
- **update_page** - Update an existing page
- **delete_page** - Delete a page
- **list_spaces** - List accessible spaces
- **get_space_content** - Get pages from a specific space

## Security Features

- **API Token Authentication** - Secure access using Atlassian API tokens
- **Space Restrictions** - Configurable allowed spaces list
- **Permission Validation** - Respects Confluence permissions
- **Request Validation** - Input validation and sanitization

## Development

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Testing
npm test

# Build
npm run build
```