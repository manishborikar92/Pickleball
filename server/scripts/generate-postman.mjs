/* eslint-disable no-console */
import config from '../src/config/env.js';
import { generatePostman } from '../src/modules/openapi/postman.generator.js';

await generatePostman({ config });
console.log('Postman artifacts successfully generated');
