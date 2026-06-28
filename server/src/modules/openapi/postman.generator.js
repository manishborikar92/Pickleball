import { mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createOpenApiSpec } from './openapi.spec.js';

const methodNames = ['get', 'post', 'put', 'patch', 'delete'];

const extractPathVariables = (path) => {
  const matches = path.match(/\{([^}]+)\}/g);
  if (!matches) return undefined;
  return matches.map((m) => ({
    key: m.slice(1, -1),
    value: '',
  }));
};

const pathToUrl = (path, apiPrefix = '') => {
  const isRoot = path === '/';
  const prefix = isRoot ? '' : apiPrefix;
  const cleanPath = path.replace(/\{([^}]+)\}/g, ':$1');
  const hasPrefix = prefix && cleanPath.startsWith(prefix);
  const fullPath = hasPrefix ? cleanPath : `${prefix}${cleanPath}`;
  const variables = extractPathVariables(path);
  return {
    raw: `{{baseUrl}}${fullPath}`,
    host: ['{{baseUrl}}'],
    path: fullPath.replace(/^\//, '').split('/'),
    ...(variables ? { variable: variables } : {}),
  };
};

const buildBody = (operation) => {
  const jsonContent = operation.requestBody?.content?.['application/json'];
  if (!jsonContent) {
    return undefined;
  }

  const properties = jsonContent.schema?.properties || {};
  const example = Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [key, value.example ?? '']),
  );

  return {
    mode: 'raw',
    raw: JSON.stringify(example, null, 2),
    options: {
      raw: { language: 'json' },
    },
  };
};

const buildRequest = ({ path, method, operation, apiPrefix = '' }) => {
  const body = buildBody(operation);
  
  // Automatic extraction of JWT access token upon successful auth callback
  const isAuthCallback = 
    (path.endsWith('/auth/otp/verify') && method.toLowerCase() === 'post') ||
    (path.endsWith('/auth/admin/login') && method.toLowerCase() === 'post') ||
    (path.endsWith('/auth/refresh') && method.toLowerCase() === 'post');

  const testEvent = isAuthCallback ? [
    {
      listen: 'test',
      script: {
        exec: [
          'if (pm.response.code === 200) {',
          '    var jsonData = pm.response.json();',
          '    if (jsonData.success && jsonData.data && jsonData.data.access_token) {',
          '        pm.environment.set("accessToken", jsonData.data.access_token);',
          '        console.log("Automatically saved new access_token to accessToken env variable");',
          '    }',
          '}'
        ],
        type: 'text/javascript'
      }
    }
  ] : undefined;

  return {
    name: operation.summary || `${method.toUpperCase()} ${path}`,
    request: {
      method: method.toUpperCase(),
      header: body ? [
        {
          key: 'Content-Type',
          value: 'application/json',
          type: 'text',
        },
      ] : [],
      url: pathToUrl(path, apiPrefix),
      ...(body ? { body } : {}),
      ...(operation.security?.some((item) => item.bearerAuth) ? {
        auth: {
          type: 'bearer',
          bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
        },
      } : {}),
    },
    ...(testEvent ? { event: testEvent } : {}),
  };
};

const extractRequestsByTag = (spec) => {
  const groups = new Map();
  const apiPrefix = spec.servers?.[0]?.url || '';

  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    for (const method of methodNames) {
      const operation = pathItem[method];
      if (!operation) continue;
      const tag = operation.tags?.[0] || 'Default';
      if (!groups.has(tag)) {
        groups.set(tag, []);
      }
      groups.get(tag).push(buildRequest({ path, method, operation, apiPrefix }));
    }
  }

  return groups;
};

export const createPostmanCollection = (spec, { baseUrl = 'http://localhost:5000' } = {}) => {
  const groups = extractRequestsByTag(spec);
  const sortedEntries = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return {
    info: {
      name: spec.info?.title || 'API',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      description: spec.info?.description || '',
    },
    item: sortedEntries.map(([name, item]) => ({ name, item })),
    variable: [
      { key: 'baseUrl', value: baseUrl },
      { key: 'accessToken', value: '' },
    ],
  };
};

export const createPostmanCollections = (spec, { baseUrl = 'http://localhost:5000' } = {}) => {
  const groups = extractRequestsByTag(spec);
  const sortedEntries = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return sortedEntries.map(([tag, requests]) => ({
    info: {
      name: tag,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      description: `${tag} endpoints.`,
    },
    item: requests,
    variable: [
      { key: 'baseUrl', value: baseUrl },
      { key: 'accessToken', value: '' },
    ],
  }));
};

export const createPostmanEnvironment = ({
  name = 'Baseline Arena Local',
  baseUrl = 'http://localhost:5000',
} = {}) => ({
  name,
  values: [
    { key: 'baseUrl', value: baseUrl, type: 'default', enabled: true },
    { key: 'accessToken', value: '', type: 'secret', enabled: true },
  ],
});

export const generatePostman = async ({ config }) => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outputDir = resolve(__dirname, '..', '..', '..', 'postman');

  const spec = createOpenApiSpec({ config });
  const baseUrl = `http://localhost:${config.app.port}`;
  const collections = createPostmanCollections(spec, { baseUrl });
  const environment = createPostmanEnvironment({ baseUrl });

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  await writeFile(
    resolve(outputDir, 'baseline-arena.local.postman_environment.json'),
    `${JSON.stringify(environment, null, 2)}\n`,
  );

  for (const collection of collections) {
    const sanitizedTag = collection.info.name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-');
    const fileName = `${sanitizedTag}.postman_collection.json`;
    await writeFile(
      resolve(outputDir, fileName),
      `${JSON.stringify(collection, null, 2)}\n`,
    );
  }
};
