CLAUDE.md - Confluence MCP Service

#Overview
This MCP (Model Context Protocol) service enables Claude to interact with Atlassian Confluence through its REST API. The service provides secure, configurable access to Confluence spaces with proper authentication and space-based access control.

#Features

- Secure Authentication: Uses Atlassian API tokens for secure access
- Space Restrictions: Configurable allowed spaces list for security
- Full CRUD Operations: Create, read, update, and delete pages
- Content Search: Search across allowed spaces
- Space Management: List and explore space information
- Rich Content Support: Handle Confluence storage format and plain text

# Installation

## 1. Setup the MCP Server

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment configuration:**
   ```bash
   cp .env.example .env
   ```
   
3. **Edit `.env` with your Confluence credentials:**
   - `CONFLUENCE_BASE_URL`: Your Atlassian domain (e.g., https://yourcompany.atlassian.net)
   - `CONFLUENCE_USERNAME`: Your Atlassian account email
   - `CONFLUENCE_API_TOKEN`: Generate from https://id.atlassian.com/manage-profile/security/api-tokens
   - `ALLOWED_SPACES`: Comma-separated list of space keys to allow access to

4. **Build the server:**
   ```bash
   npm run build
   ```

## 2. Configure Claude Code

Add the MCP server to your Claude Code configuration file at `~/.config/claude-code/mcp_servers_config.json`:

```json
{
  "mcpServers": {
    "confluence": {
      "command": "node",
      "args": ["/Users/scotto/Documents/javascript/confluence_mcp/dist/index.js"],
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

**Important:** Replace the environment variables with your actual Confluence credentials.

## 3. Restart Claude Code

After updating the configuration, restart Claude Code to load the MCP server.

## 4. Test the Installation

Try asking Claude: "Search for pages in Confluence" or "List my Confluence spaces" to verify it's working.

# Configuration
## Environment Variables
Create a .env file in the root directory:
env
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_USERNAME=your-email@domain.com
CONFLUENCE_API_TOKEN=your-api-token
ALLOWED_SPACES=SPACE1,SPACE2,SPACE3

## Getting an API Token

- Go to Atlassian Account Settings
- Click "Create API token"
- Give it a descriptive label
- Copy the generated token (save it securely!)

# Available Tools
1. search_confluence
Search for content across allowed Confluence spaces.
Parameters:

query (string): Search query
spaceKey (string, optional): Limit search to specific space
limit (number, optional): Maximum results (default: 25)

Example:
CopySearch for "API documentation" in the DEV space

2. get_page
Retrieve a specific Confluence page by ID.
Parameters:

pageId (string): Confluence page ID
expand (string, optional): Additional data to include (body.storage, version, etc.)

Example:
CopyGet page with ID "123456789" including its content

3. create_page
Create a new Confluence page.
Parameters:

spaceKey (string): Target space key
title (string): Page title
content (string): Page content (HTML or storage format)
parentId (string, optional): Parent page ID

Example:
CopyCreate a new page titled "Meeting Notes" in the TEAM space

4. update_page
Update an existing Confluence page.
Parameters:

pageId (string): Page ID to update
title (string): New page title
content (string): New page content
version (number): Current version number (required for updates)

Example:
CopyUpdate page 123456789 with new content, current version is 5

5. delete_page
Delete a Confluence page.
Parameters:

pageId (string): Page ID to delete

Example:
CopyDelete page with ID "123456789"

6. list_spaces
List all accessible Confluence spaces (filtered by allowed spaces).
Parameters:

limit (number, optional): Maximum results (default: 50)

Example:
CopyList all available spaces

7. get_space_content
Get pages from a specific space.
Parameters:

spaceKey (string): Space key
limit (number, optional): Maximum results (default: 25)

Example:
CopyGet all pages from the DEV space

# Usage Examples
## Basic Search
Copy"Search for pages about 'deployment process' in our documentation"
## Creating Documentation
Copy"Create a new page in the DEV space titled 'API Integration Guide' with the following content: [your content here]"
## Updating Existing Pages
Copy"Find the page about 'Getting Started' and add a new section about authentication"
## Content Management
Copy"List all pages in the PROJ space and show me their titles and last modified dates"

# Security Considerations

API Token Security: Store API tokens securely and never commit them to version control
Space Restrictions: Always configure ALLOWED_SPACES to limit access to appropriate spaces
Permissions: The service respects Confluence permissions - you can only access content your account can see
Rate Limiting: The service includes basic rate limiting to avoid API throttling

# Troubleshooting
## Common Issues

### Authentication Failed

Verify your username and API token
Ensure the API token hasn't expired
Check that your account has access to Confluence


### Space Access Denied

Verify the space key is correct
Check that the space is listed in ALLOWED_SPACES
Ensure your account has permissions for the space


### Page Not Found

Verify the page ID is correct
Check that the page exists and you have permission to view it



# Debug Mode
Set the environment variable DEBUG=true for detailed logging:
envCopyDEBUG=true

# Development
Running in Development
bashCopynpm run dev

# Testing
bashCopynpm test

# Building
bashCopynpm run build

# API Reference
This service implements the MCP protocol and communicates with the Confluence REST API v2. For detailed API documentation, see:

# MCP Protocol Specification
Confluence REST API Documentation