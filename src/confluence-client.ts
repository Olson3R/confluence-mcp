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
    start = 0,
    bodyFormat?: string
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
    
    // Set expand based on bodyFormat parameter
    let expandParam = 'version,space';
    if (bodyFormat) {
      const format = bodyFormat === 'view' ? 'body.view' : 'body.storage';
      expandParam += `,${format}`;
    }
    
    const params: any = {
      cql: searchQuery,
      limit,
      start,
      expand: expandParam
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

  async getPage(pageId: string, bodyFormat?: string): Promise<ConfluencePage> {
    // Use v1 API for getPage since we need space information anyway
    let expandParam = 'space,version';
    if (bodyFormat) {
      const format = bodyFormat === 'view' ? 'body.view' : 'body.storage';
      expandParam += `,${format}`;
    }
    
    const v1Url = `${this.config.baseUrl}/wiki/rest/api/content/${pageId}?expand=${expandParam}`;
    const auth = Buffer.from(`${this.config.username}:${this.config.apiToken}`).toString('base64');
    
    const response = await axios.get(v1Url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    // Validate space access
    if (!response.data.space || !response.data.space.key) {
      throw new Error('Unable to determine page space for access validation');
    }
    
    if (!validateSpaceAccess(response.data.space.key, this.config.allowedSpaces)) {
      throw new Error(`Access denied to space: ${response.data.space.key}`);
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

  async getSpace(spaceKey: string): Promise<ConfluenceSpace> {
    if (!validateSpaceAccess(spaceKey, this.config.allowedSpaces)) {
      throw new Error(`Access denied to space: ${spaceKey}`);
    }

    const response: AxiosResponse<ConfluenceSpace> = await this.client.get(`/spaces/${spaceKey}`);
    return response.data;
  }

  async getSpaceContent(spaceKey: string, limit = 25, start = 0, bodyFormat?: string): Promise<PaginatedResult<ConfluencePage>> {
    if (!validateSpaceAccess(spaceKey, this.config.allowedSpaces)) {
      throw new Error(`Access denied to space: ${spaceKey}`);
    }

    // Get basic page list from v2 API
    const response: AxiosResponse<PaginatedResult<ConfluencePage>> = await this.client.get('/pages', {
      params: {
        'space-key': spaceKey,
        limit,
        start
      }
    });
    
    // If body content is requested, enhance each page with body content from v1 API
    if (bodyFormat && response.data.results.length > 0) {
      const format = bodyFormat === 'view' ? 'body.view' : 'body.storage';
      const auth = Buffer.from(`${this.config.username}:${this.config.apiToken}`).toString('base64');
      
      const enhancedResults = await Promise.all(
        response.data.results.map(async (page) => {
          try {
            const v1Url = `${this.config.baseUrl}/wiki/rest/api/content/${page.id}?expand=${format},version,space`;
            const v1Response = await axios.get(v1Url, {
              headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              },
              timeout: 30000
            });
            
            if (v1Response.data.body) {
              page.body = v1Response.data.body;
            }
          } catch (error) {
            if (this.config.debug) {
              console.warn(`Failed to retrieve body content for page ${page.id}:`, error);
            }
          }
          return page;
        })
      );
      
      response.data.results = enhancedResults;
    }
    
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

  async getPageChildren(pageId: string, limit = 25, start = 0, bodyFormat?: string): Promise<PaginatedResult<ConfluencePage>> {
    const parentPage = await this.getPage(pageId);
    
    if (!parentPage.space || !parentPage.space.key) {
      throw new Error('Unable to determine page space for access validation');
    }
    
    if (!validateSpaceAccess(parentPage.space.key, this.config.allowedSpaces)) {
      throw new Error(`Access denied to space: ${parentPage.space.key}`);
    }

    // Get basic children list from v2 API
    const response: AxiosResponse<PaginatedResult<ConfluencePage>> = await this.client.get(`/pages/${pageId}/children`, {
      params: {
        limit,
        start
      }
    });
    
    // If body content is requested, enhance each page with body content from v1 API
    if (bodyFormat && response.data.results.length > 0) {
      const format = bodyFormat === 'view' ? 'body.view' : 'body.storage';
      const auth = Buffer.from(`${this.config.username}:${this.config.apiToken}`).toString('base64');
      
      const enhancedResults = await Promise.all(
        response.data.results.map(async (page) => {
          try {
            const v1Url = `${this.config.baseUrl}/wiki/rest/api/content/${page.id}?expand=${format},version,space`;
            const v1Response = await axios.get(v1Url, {
              headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              },
              timeout: 30000
            });
            
            if (v1Response.data.body) {
              page.body = v1Response.data.body;
            }
          } catch (error) {
            if (this.config.debug) {
              console.warn(`Failed to retrieve body content for page ${page.id}:`, error);
            }
          }
          return page;
        })
      );
      
      response.data.results = enhancedResults;
    }
    
    return response.data;
  }
}