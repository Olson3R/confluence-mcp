export interface ConfluenceConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  allowedSpaces: string[];
  debug?: boolean;
}

export interface ConfluencePage {
  id: string;
  type: string;
  status: string;
  title: string;
  space: {
    key: string;
    name: string;
  };
  body?: {
    storage?: {
      value: string;
      representation: string;
    };
    view?: {
      value: string;
      representation: string;
    };
  };
  version: {
    number: number;
    when: string;
    by: {
      displayName: string;
      email: string;
    };
  };
  _links: {
    webui: string;
    self: string;
  };
}

export interface ConfluenceSpace {
  key: string;
  name: string;
  type: string;
  status: string;
  _links: {
    webui: string;
    self: string;
  };
}

export interface SearchResult {
  content: ConfluencePage[];
  start: number;
  limit: number;
  size: number;
  _links: {
    next?: string;
    prev?: string;
  };
}

export interface CreatePageRequest {
  type: string;
  title: string;
  space: {
    key: string;
  };
  body: {
    storage: {
      value: string;
      representation: string;
    };
  };
  ancestors?: Array<{
    id: string;
  }>;
}

export interface UpdatePageRequest {
  version: {
    number: number;
  };
  title: string;
  type: string;
  body: {
    storage: {
      value: string;
      representation: string;
    };
  };
}

export interface MovePageRequest {
  version: {
    number: number;
  };
  title: string;
  type: string;
  space: {
    key: string;
  };
  ancestors?: Array<{
    id: string;
  }>;
}