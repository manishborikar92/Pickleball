import crypto from 'node:crypto';

import logger from '../../utils/logger.js';

/**
 * PhonePe OAuth Token Manager.
 *
 * Manages OAuth access tokens for PhonePe PG v2 API using raw fetch.
 * Implements in-memory caching with TTL, automatic refresh before expiry,
 * and single-retry on 401 with cache invalidation.
 *
 * @see docs/integrations/02-PAYMENT-INTEGRATION.md §4
 */

const AUTH_URLS = {
  SANDBOX: 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token',
  PRODUCTION: 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token',
};

const TOKEN_FETCH_TIMEOUT_MS = 15_000;
const TOKEN_REFRESH_BUFFER_SECONDS = 60;

export const createPhonePeAuth = ({
  clientId,
  clientSecret,
  clientVersion,
  env = 'SANDBOX',
} = {}) => {
  const authUrl = AUTH_URLS[env] || AUTH_URLS.SANDBOX;

  // In-memory token cache — singleton per process.
  let tokenCache = { token: null, expiresAt: 0 };

  const fetchToken = async () => {
    const correlationId = crypto.randomUUID();
    const start = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TOKEN_FETCH_TIMEOUT_MS);

    try {
      const body = new URLSearchParams({
        client_id: clientId,
        client_version: String(clientVersion),
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      });

      logger.info('[PhonePe Auth] Fetching OAuth token', {
        correlationId,
        operation: 'phonepe:fetchToken',
        authUrl,
        env,
      });

      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Request-Id': correlationId,
        },
        body: body.toString(),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - start;

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        logger.error('[PhonePe Auth] Token fetch failed', {
          correlationId,
          operation: 'phonepe:fetchToken',
          httpStatus: response.status,
          latencyMs,
          error: errorBody,
        });
        throw new Error(`PhonePe OAuth token fetch failed: HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.access_token || !data.expires_at) {
        throw new Error('PhonePe OAuth response missing access_token or expires_at');
      }

      tokenCache = {
        token: data.access_token,
        expiresAt: data.expires_at,
      };

      logger.info('[PhonePe Auth] Token fetched successfully', {
        correlationId,
        operation: 'phonepe:fetchToken',
        latencyMs,
        expiresAt: data.expires_at,
        cacheStatus: 'refreshed',
      });

      return tokenCache.token;
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.error('[PhonePe Auth] Token fetch timed out', {
          correlationId,
          operation: 'phonepe:fetchToken',
          timeoutMs: TOKEN_FETCH_TIMEOUT_MS,
          latencyMs: Date.now() - start,
        });
        throw new Error(`PhonePe OAuth token fetch timed out after ${TOKEN_FETCH_TIMEOUT_MS}ms`, { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    /**
     * Returns a valid OAuth access token.
     * Uses cached token if still valid (with 60s buffer), otherwise fetches a fresh one.
     */
    async getAccessToken() {
      const nowSeconds = Math.floor(Date.now() / 1000);

      if (tokenCache.token && tokenCache.expiresAt > nowSeconds + TOKEN_REFRESH_BUFFER_SECONDS) {
        logger.debug('[PhonePe Auth] Using cached token', {
          operation: 'phonepe:getAccessToken',
          cacheStatus: 'hit',
          expiresIn: tokenCache.expiresAt - nowSeconds,
        });
        return tokenCache.token;
      }

      return fetchToken();
    },

    /**
     * Invalidates the cached token. Call this when a PhonePe API returns 401
     * to force a fresh token fetch on the next getAccessToken() call.
     */
    invalidateToken() {
      logger.info('[PhonePe Auth] Token cache invalidated');
      tokenCache = { token: null, expiresAt: 0 };
    },

    /** Visible for testing. */
    _getCache() {
      return { ...tokenCache };
    },
  };
};
