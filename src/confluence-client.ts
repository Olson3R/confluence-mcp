import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { 
  ConfluenceConfig, 
  ConfluencePage, 
  ConfluenceSpace, 
  SearchResult,
  CreatePageRequest,
  UpdatePageRequest,
  MovePageRequest,
  PaginatedResult
} from './types.js';
import { validateSpaceAccess } from './config.js';
import { Logger } from './logger.js';

interface RequestWithMetadata extends InternalAxiosRequestConfig {
  metadata?: { startTime: number };
}

export class ConfluenceClient {
  private client: AxiosInstance;
  private config: ConfluenceConfig;
  private logger: Logger;

  constructor(config: ConfluenceConfig) {
    this.config = config;
    this.logger = new Logger();
    
    const auth = Buffer.from(`${config.username}:${config.apiToken}`).toString('base64');
    
    this.client = axios.create({
      baseURL: `${config.baseUrl}/wiki/api/v2`,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Add request/response logging
    this.client.interceptors.request.use(async (request: RequestWithMetadata) => {
      const startTime = Date.now();
      request.metadata = { startTime };
      
      await this.logger.logRequest(
        request.method || 'unknown',
        request.url || '',
        request.params,
        request.data
      );

      if (config.debug) {
        console.log('Confluence API Request:', {
          method: request.method,
          url: request.url,
          params: request.params
        });
      }
      return request;
    });

    this.client.interceptors.response.use(
      async (response) => {
        const requestConfig = response.config as RequestWithMetadata;
        const duration = requestConfig.metadata?.startTime 
          ? Date.now() - requestConfig.metadata.startTime 
          : undefined;

        await this.logger.logResponse(
          response.config.method || 'unknown',
          response.config.url || '',
          response.status,
          response.data,
          duration
        );

        if (config.debug) {
          console.log('Confluence API Response:', {
            status: response.status,
            url: response.config.url
          });
        }
        return response;
      },
      async (error) => {
        await this.logger.logError(
          error.config?.method || 'unknown',
          error.config?.url || '',
          error
        );

        if (config.debug) {
          console.error('Confluence API Error:', {
            status: error.response?.status,
            message: error.message,
            url: error.config?.url
          });
        }
        return Promise.reject(error);
      }
    );
  }

  async searchContent(
    query?: string, 
    spaceKey?: string, 
    limit = 25, 
    title?: string,
    start = 0
  ): Promise<SearchResult> {
    // V2 API doesn't have a direct search endpoint, so we use v1 for CQL search
    // This is the recommended approach as CQL search is only available in v1
    
    // Build search conditions
    const searchConditions: string[] = [];
    
    if (query) {
      searchConditions.push(`text ~ "${query}"`);
    }
    
    if (title) {
      searchConditions.push(`title ~ "${title}"`);
    }
    
    // If neither query nor title provided, search for all content
    if (searchConditions.length === 0) {
      searchConditions.push('type = page');
    }
    
    const searchQuery = searchConditions.join(' AND ');
    
    const params: any = {
      cql: searchQuery,
      limit,
      start,
      expand: 'body.storage,version,space'
    };

    if (spaceKey) {
      if (!validateSpaceAccess(spaceKey, this.config.allowedSpaces)) {
        throw new Error(`Access denied to space: ${spaceKey}`);
      }
      params.cql = `space = "${spaceKey}" AND ${params.cql}`;
    } else {
      const allowedSpacesCql = this.config.allowedSpaces.map(space => `space = "${space}"`).join(' OR ');
      params.cql = `(${allowedSpacesCql}) AND ${params.cql}`;
    }

    // Use v1 API for search since v2 doesn't provide CQL search functionality
    const searchUrl = `${this.config.baseUrl}/wiki/rest/api/search`;
    const auth = Buffer.from(`${this.config.username}:${this.config.apiToken}`).toString('base64');
    const response: AxiosResponse<{ results: ConfluencePage[], start: number, limit: number, size: number, _links: any }> = await axios.get(searchUrl, {
      params,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    return {
      content: response.data.results,
      start: response.data.start,
      limit: response.data.limit,
      size: response.data.size,
      _links: response.data._links
    };
  }

  async getPage(pageId: string, expand?: string): Promise<ConfluencePage> {
    const params: any = {};
    if (expand) {
      params.expand = expand;
    } else {
      params.expand = 'body.storage,version,space';
    }

    const response: AxiosResponse<ConfluencePage> = await this.client.get(`/pages/${pageId}`, { params });
    
    // Check if space information is available and validate access
    if (response.data.space && response.data.space.key) {
      if (!validateSpaceAccess(response.data.space.key, this.config.allowedSpaces)) {
        throw new Error(`Access denied to space: ${response.data.space.key}`);
      }
    } else {
      // If space information is not available, we need to get it separately
      // This can happen with some expand parameter combinations in v2 API
      const pageWithSpace = await this.client.get(`/pages/${pageId}`, { 
        params: { expand: 'space' } 
      });
      if (pageWithSpace.data.space && pageWithSpace.data.space.key) {
        if (!validateSpaceAccess(pageWithSpace.data.space.key, this.config.allowedSpaces)) {
          throw new Error(`Access denied to space: ${pageWithSpace.data.space.key}`);
        }
        // Add space information to the response if it was missing
        if (!response.data.space) {
          response.data.space = pageWithSpace.data.space;
        }
      } else {
        throw new Error('Unable to determine page space for access validation');
      }
    }
    
    return response.data;
  }

  async createPage(
    spaceKey: string, 
    title: string, 
    content: string, 
    parentId?: string
  ): Promise<ConfluencePage> {
    if (!validateSpaceAccess(spaceKey, this.config.allowedSpaces)) {
      throw new Error(`Access denied to space: ${spaceKey}`);
    }

    const pageData: CreatePageRequest = {
      type: 'page',
      title,
      space: { key: spaceKey },
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      }
    };

    if (parentId) {
      pageData.ancestors = [{ id: parentId }];
    }

    const response: AxiosResponse<ConfluencePage> = await this.client.post('/pages', pageData);
    return response.data;
  }

  async updatePage(
    pageId: string, 
    title: string, 
    content: string, 
    version: number
  ): Promise<ConfluencePage> {
    const currentPage = await this.getPage(pageId);
    
    if (!currentPage.space || !currentPage.space.key) {
      throw new Error('Unable to determine page space for access validation');
    }
    
    if (!validateSpaceAccess(currentPage.space.key, this.config.allowedSpaces)) {
      throw new Error(`Access denied to space: ${currentPage.space.key}`);
    }

    const updateData: UpdatePageRequest = {
      version: { number: version },
      title,
      type: 'page',
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      }
    };

    const response: AxiosResponse<ConfluencePage> = await this.client.put(`/pages/${pageId}`, updateData);
    return response.data;
  }

  async deletePage(pageId: string): Promise<void> {
    const currentPage = await this.getPage(pageId);
    
    if (!currentPage.space || !currentPage.space.key) {
      throw new Error('Unable to determine page space for access validation');
    }
    
    if (!validateSpaceAccess(currentPage.space.key, this.config.allowedSpaces)) {
      throw new Error(`Access denied to space: ${currentPage.space.key}`);
    }

    await this.client.delete(`/pages/${pageId}`);
  }

  async listSpaces(limit = 50, start = 0): Promise<PaginatedResult<ConfluenceSpace>> {
    const response: AxiosResponse<PaginatedResult<ConfluenceSpace>> = await this.client.get('/spaces', {
      params: { limit, start }
    });
    
    const filteredResults = response.data.results.filter(space => 
      validateSpaceAccess(space.key, this.config.allowedSpaces)
    );
    
    return {
      ...response.data,
      results: filteredResults,
      size: filteredResults.length
    };
  }

  async getSpaceContent(spaceKey: string, limit = 25, start = 0): Promise<PaginatedResult<ConfluencePage>> {
    if (!validateSpaceAccess(spaceKey, this.config.allowedSpaces)) {
      throw new Error(`Access denied to space: ${spaceKey}`);
    }

    const response: AxiosResponse<PaginatedResult<ConfluencePage>> = await this.client.get('/pages', {
      params: {
        'space-key': spaceKey,
        limit,
        start,
        expand: 'version,space'
      }
    });
    
    return response.data;
  }

  async movePage(
    pageId: string,
    targetSpaceKey: string,
    parentId?: string
  ): Promise<ConfluencePage> {
    const currentPage = await this.getPage(pageId);
    
    if (!currentPage.space || !currentPage.space.key) {
      throw new Error('Unable to determine page space for access validation');
    }
    
    if (!validateSpaceAccess(currentPage.space.key, this.config.allowedSpaces)) {
      throw new Error(`Access denied to source space: ${currentPage.space.key}`);
    }
    
    if (!validateSpaceAccess(targetSpaceKey, this.config.allowedSpaces)) {
      throw new Error(`Access denied to target space: ${targetSpaceKey}`);
    }

    const moveData: MovePageRequest = {
      version: { number: currentPage.version.number },
      title: currentPage.title,
      type: 'page',
      space: { key: targetSpaceKey }
    };

    if (parentId) {
      moveData.ancestors = [{ id: parentId }];
    }

    const response: AxiosResponse<ConfluencePage> = await this.client.put(`/pages/${pageId}`, moveData);
    return response.data;
  }

  async getPageChildren(pageId: string, limit = 25, start = 0): Promise<PaginatedResult<ConfluencePage>> {
    const parentPage = await this.getPage(pageId);
    
    if (!parentPage.space || !parentPage.space.key) {
      throw new Error('Unable to determine page space for access validation');
    }
    
    if (!validateSpaceAccess(parentPage.space.key, this.config.allowedSpaces)) {
      throw new Error(`Access denied to space: ${parentPage.space.key}`);
    }

    const response: AxiosResponse<PaginatedResult<ConfluencePage>> = await this.client.get(`/pages/${pageId}/children`, {
      params: {
        limit,
        start,
        expand: 'version,space'
      }
    });
    
    return response.data;
  }
}