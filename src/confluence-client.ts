import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  ConfluenceConfig, 
  ConfluencePage, 
  ConfluenceSpace, 
  SearchResult,
  CreatePageRequest,
  UpdatePageRequest,
  MovePageRequest
} from './types.js';
import { validateSpaceAccess } from './config.js';

export class ConfluenceClient {
  private client: AxiosInstance;
  private config: ConfluenceConfig;

  constructor(config: ConfluenceConfig) {
    this.config = config;
    
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

    if (config.debug) {
      this.client.interceptors.request.use(request => {
        console.log('Confluence API Request:', {
          method: request.method,
          url: request.url,
          params: request.params
        });
        return request;
      });

      this.client.interceptors.response.use(
        response => {
          console.log('Confluence API Response:', {
            status: response.status,
            url: response.config.url
          });
          return response;
        },
        error => {
          console.error('Confluence API Error:', {
            status: error.response?.status,
            message: error.message,
            url: error.config?.url
          });
          return Promise.reject(error);
        }
      );
    }
  }

  async searchContent(query: string, spaceKey?: string, limit = 25): Promise<SearchResult> {
    const params: any = {
      cql: `text ~ "${query}"`,
      limit,
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

    const response: AxiosResponse<SearchResult> = await this.client.get('/pages', { params });
    return response.data;
  }

  async getPage(pageId: string, expand?: string): Promise<ConfluencePage> {
    const params: any = {};
    if (expand) {
      params.expand = expand;
    } else {
      params.expand = 'body.storage,version,space';
    }

    const response: AxiosResponse<ConfluencePage> = await this.client.get(`/pages/${pageId}`, { params });
    
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
    
    if (!validateSpaceAccess(currentPage.space.key, this.config.allowedSpaces)) {
      throw new Error(`Access denied to space: ${currentPage.space.key}`);
    }

    await this.client.delete(`/pages/${pageId}`);
  }

  async listSpaces(limit = 50): Promise<ConfluenceSpace[]> {
    const response: AxiosResponse<{ results: ConfluenceSpace[] }> = await this.client.get('/spaces', {
      params: { limit }
    });
    
    return response.data.results.filter(space => 
      validateSpaceAccess(space.key, this.config.allowedSpaces)
    );
  }

  async getSpaceContent(spaceKey: string, limit = 25): Promise<ConfluencePage[]> {
    if (!validateSpaceAccess(spaceKey, this.config.allowedSpaces)) {
      throw new Error(`Access denied to space: ${spaceKey}`);
    }

    const response: AxiosResponse<{ results: ConfluencePage[] }> = await this.client.get('/pages', {
      params: {
        'space-key': spaceKey,
        limit,
        expand: 'version,space'
      }
    });
    
    return response.data.results;
  }

  async movePage(
    pageId: string,
    targetSpaceKey: string,
    parentId?: string
  ): Promise<ConfluencePage> {
    const currentPage = await this.getPage(pageId);
    
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
}