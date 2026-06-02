import jwt from 'jsonwebtoken';

import defaultConfig from '../config/env.js';
import { getPrisma } from '../lib/prisma.js';
import { UnauthorizedError } from '../utils/api-error.js';

const extractBearerToken = (req) => {
  const authorization = req.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Bearer token required');
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    throw new UnauthorizedError('Bearer token required');
  }

  return token;
};

const resolveSessionId = (decoded) => decoded.session_id || decoded.sid || null;

const validateDatabaseSession = async ({ config, decoded }) => {
  if (!config.database?.enabled) {
    return true;
  }

  const sessionId = resolveSessionId(decoded);
  if (!sessionId || !decoded.sub) {
    return false;
  }

  const session = await getPrisma().authSession.findUnique({
    where: { id: sessionId },
    select: {
      userId: true,
      status: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  return Boolean(
    session
    && session.userId === decoded.sub
    && session.status === 'active'
    && !session.revokedAt
    && session.expiresAt > new Date(),
  );
};

export const authenticate = (options = {}) => async (req, _res, next) => {
  try {
    const config = options.config || req.app.get('config') || defaultConfig;
    const token = extractBearerToken(req);
    const verifyOptions = {
      ...(config.auth.issuer ? { issuer: config.auth.issuer } : {}),
      ...(config.auth.audience ? { audience: config.auth.audience } : {}),
    };
    const decoded = jwt.verify(token, config.auth.accessTokenSecret, verifyOptions);
    const sessionValidator = options.validateSession || validateDatabaseSession;
    const sessionActive = await sessionValidator({
      sessionId: resolveSessionId(decoded),
      userId: decoded.sub,
      decoded,
      req,
      config,
    });

    if (!sessionActive) {
      throw new UnauthorizedError('Session is no longer active');
    }

    const roles = Array.isArray(decoded.roles)
      ? decoded.roles
      : [decoded.role].filter(Boolean);

    let principal = {
      subject: decoded.sub,
      sessionId: resolveSessionId(decoded),
      role: decoded.role || roles[0],
      roles,
      permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
      claims: decoded,
    };

    if (typeof options.resolveUser === 'function') {
      const resolved = await options.resolveUser(decoded, req);
      if (!resolved) {
        throw new UnauthorizedError('Authenticated principal not found');
      }

      principal = {
        ...principal,
        user: resolved,
        role: resolved.role || resolved.roleType || principal.role,
      };
    }

    req.auth = principal;
    return next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return next(error);
    }

    return next(new UnauthorizedError('Invalid or expired token'));
  }
};
