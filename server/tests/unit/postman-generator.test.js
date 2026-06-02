import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPostmanCollection,
  createPostmanCollections,
} from '../../src/modules/openapi/postman.generator.js';

test('createPostmanCollection turns OpenAPI paths into request items', () => {
  const collection = createPostmanCollection({
    openapi: '3.0.3',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {
      '/api/v1/auth/otp/send': { post: { summary: 'Send OTP', tags: ['Auth'] } },
      '/api/v1/users/me': { get: { summary: 'Current user', tags: ['Users'] } },
    },
  });

  assert.equal(collection.info.name, 'Test API');
  assert.equal(collection.item.length, 2);
  assert.equal(collection.item[0].name, 'Auth');
  assert.equal(collection.item[0].item[0].request.method, 'POST');
  assert.equal(collection.item[0].item[0].request.url.raw, '{{baseUrl}}/api/v1/auth/otp/send');
});

test('createPostmanCollections generates separate collections for each tag', () => {
  const collections = createPostmanCollections({
    openapi: '3.0.3',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {
      '/api/v1/auth/otp/send': { post: { summary: 'Send OTP', tags: ['Auth'] } },
      '/api/v1/users/me': { get: { summary: 'Current user', tags: ['Users'] } },
    },
  });

  assert.equal(collections.length, 2);

  assert.equal(collections[0].info.name, 'Auth');
  assert.equal(collections[0].item.length, 1);
  assert.equal(collections[0].item[0].request.method, 'POST');
  assert.equal(collections[0].item[0].request.url.raw, '{{baseUrl}}/api/v1/auth/otp/send');

  assert.equal(collections[1].info.name, 'Users');
  assert.equal(collections[1].item.length, 1);
  assert.equal(collections[1].item[0].request.method, 'GET');
  assert.equal(collections[1].item[0].request.url.raw, '{{baseUrl}}/api/v1/users/me');
});
