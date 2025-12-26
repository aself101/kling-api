/**
 * Tests for Kling API Authentication Module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { KlingAuth, decodeToken, isTokenExpired } from '../src/auth.js';
import {
  JWT_EXPIRY_SECONDS,
  CLOCK_SKEW_SECONDS,
  JWT_FORMAT_REGEX,
  BUFFER_BOUNDARY_MS,
  PAST_EXPIRY_MINUTES,
} from './test-constants.js';

describe('KlingAuth', () => {
  const testAccessKey = 'test-access-key-12345';
  const testSecretKey = 'test-secret-key-67890';

  describe('constructor', () => {
    it('should create instance with valid credentials', () => {
      const auth = new KlingAuth(testAccessKey, testSecretKey);
      expect(auth).toBeInstanceOf(KlingAuth);
    });

    it('should throw error when access key is empty', () => {
      expect(() => new KlingAuth('', testSecretKey)).toThrow('Access key is required');
    });

    it('should throw error when access key is whitespace', () => {
      expect(() => new KlingAuth('   ', testSecretKey)).toThrow('Access key is required');
    });

    it('should throw error when secret key is empty', () => {
      expect(() => new KlingAuth(testAccessKey, '')).toThrow('Secret key is required');
    });

    it('should throw error when secret key is whitespace', () => {
      expect(() => new KlingAuth(testAccessKey, '   ')).toThrow('Secret key is required');
    });

    it('should trim whitespace from credentials', () => {
      const auth = new KlingAuth(`  ${testAccessKey}  `, `  ${testSecretKey}  `);
      const token = auth.generateToken();
      const decoded = jwt.decode(token) as { iss: string };
      expect(decoded.iss).toBe(testAccessKey);
    });
  });

  describe('generateToken', () => {
    let auth: KlingAuth;

    beforeEach(() => {
      auth = new KlingAuth(testAccessKey, testSecretKey);
    });

    it('should generate valid JWT token', () => {
      const token = auth.generateToken();
      expect(token).toMatch(JWT_FORMAT_REGEX);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include correct issuer (iss)', () => {
      const token = auth.generateToken();
      const decoded = jwt.decode(token) as { iss: string };
      expect(decoded.iss).toBe(testAccessKey);
    });

    it('should include expiration 30 minutes in future', () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      const token = auth.generateToken();
      const afterTime = Math.floor(Date.now() / 1000);

      const decoded = jwt.decode(token) as { exp: number };
      expect(decoded.exp).toBeGreaterThanOrEqual(beforeTime + JWT_EXPIRY_SECONDS);
      expect(decoded.exp).toBeLessThanOrEqual(afterTime + JWT_EXPIRY_SECONDS + 1);
    });

    it('should include nbf 5 seconds in past (clock skew)', () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      const token = auth.generateToken();

      const decoded = jwt.decode(token) as { nbf: number };
      expect(decoded.nbf).toBeGreaterThanOrEqual(beforeTime - CLOCK_SKEW_SECONDS - 1);
      expect(decoded.nbf).toBeLessThanOrEqual(beforeTime - CLOCK_SKEW_SECONDS + 1);
    });

    it('should use HS256 algorithm', () => {
      const token = auth.generateToken();
      const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());
      expect(header.alg).toBe('HS256');
      expect(header.typ).toBe('JWT');
    });

    it('should be verifiable with secret key', () => {
      const token = auth.generateToken();
      expect(() => {
        jwt.verify(token, testSecretKey);
      }).not.toThrow();
    });

    it('should fail verification with wrong secret', () => {
      const token = auth.generateToken();
      expect(() => {
        jwt.verify(token, 'wrong-secret');
      }).toThrow();
    });
  });

  describe('isTokenValid', () => {
    let auth: KlingAuth;

    beforeEach(() => {
      auth = new KlingAuth(testAccessKey, testSecretKey);
    });

    it('should return false when no token is cached', () => {
      expect(auth.isTokenValid()).toBe(false);
    });

    it('should return true after generating token', () => {
      auth.generateToken();
      expect(auth.isTokenValid()).toBe(true);
    });

    it('should return false when token is about to expire', () => {
      // Generate token
      auth.generateToken();

      // Mock time to be 26 minutes in future (within 5 min buffer)
      const originalNow = Date.now;
      Date.now = vi.fn(() => originalNow() + 26 * 60 * 1000);

      expect(auth.isTokenValid()).toBe(false);

      Date.now = originalNow;
    });

    it('should return true when token has plenty of time left', () => {
      auth.generateToken();

      // Mock time to be 10 minutes in future (well within validity)
      const originalNow = Date.now;
      Date.now = vi.fn(() => originalNow() + 10 * 60 * 1000);

      expect(auth.isTokenValid()).toBe(true);

      Date.now = originalNow;
    });

    // Edge case tests for buffer boundary (TOKEN_EXPIRY_BUFFER_MINUTES = 5 minutes)
    describe('buffer boundary edge cases', () => {
      it('should return false when token expires in exactly 5 minutes (buffer boundary)', () => {
        auth.generateToken();

        // Token expires at JWT_EXPIRY_MINUTES. Move time forward BUFFER_BOUNDARY_MINUTES = expires in 5 min exactly
        // At buffer boundary, token should be refreshed (returns false)
        const originalNow = Date.now;
        Date.now = vi.fn(() => originalNow() + BUFFER_BOUNDARY_MS);

        expect(auth.isTokenValid()).toBe(false);

        Date.now = originalNow;
      });

      it('should return false when token expires in 4 minutes 59 seconds (just under buffer)', () => {
        auth.generateToken();

        // Token expires at JWT_EXPIRY_MINUTES. Move forward BUFFER_BOUNDARY_MINUTES + 1sec = expires in 4:59
        // Under buffer, should refresh (returns false)
        const originalNow = Date.now;
        Date.now = vi.fn(() => originalNow() + BUFFER_BOUNDARY_MS + 1000);

        expect(auth.isTokenValid()).toBe(false);

        Date.now = originalNow;
      });

      it('should return true when token expires in 5 minutes 1 second (just over buffer)', () => {
        auth.generateToken();

        // Token expires at JWT_EXPIRY_MINUTES. Move forward BUFFER_BOUNDARY_MINUTES - 1sec = expires in 5:01
        // Over buffer, should be valid (returns true)
        const originalNow = Date.now;
        Date.now = vi.fn(() => originalNow() + BUFFER_BOUNDARY_MS - 1000);

        expect(auth.isTokenValid()).toBe(true);

        Date.now = originalNow;
      });

      it('should return false when token is already expired', () => {
        auth.generateToken();

        // Move forward past expiration (PAST_EXPIRY_MINUTES)
        const originalNow = Date.now;
        Date.now = vi.fn(() => originalNow() + PAST_EXPIRY_MINUTES * 60 * 1000);

        expect(auth.isTokenValid()).toBe(false);

        Date.now = originalNow;
      });
    });
  });

  describe('getValidToken', () => {
    let auth: KlingAuth;

    beforeEach(() => {
      auth = new KlingAuth(testAccessKey, testSecretKey);
    });

    it('should generate new token when none exists', () => {
      const token = auth.getValidToken();
      expect(token).toMatch(JWT_FORMAT_REGEX);
    });

    it('should return cached token when valid', () => {
      const token1 = auth.getValidToken();
      const token2 = auth.getValidToken();
      expect(token1).toBe(token2);
    });

    it('should generate new token when cached one is expiring', () => {
      const token1 = auth.getValidToken();

      // Mock time to be 26 minutes in future
      const originalNow = Date.now;
      Date.now = vi.fn(() => originalNow() + 26 * 60 * 1000);

      const token2 = auth.getValidToken();
      expect(token2).not.toBe(token1);

      Date.now = originalNow;
    });
  });

  describe('refreshToken', () => {
    it('should always generate new token', () => {
      const auth = new KlingAuth(testAccessKey, testSecretKey);

      // Get initial token
      auth.getValidToken();
      const token2 = auth.refreshToken();

      // Verify refreshed token is valid JWT format
      expect(token2).toMatch(JWT_FORMAT_REGEX);
    });

    it('should generate token different from cached one when time advances', () => {
      const auth = new KlingAuth(testAccessKey, testSecretKey);
      const originalNow = Date.now;

      try {
        // Mock time for initial token
        let mockTime = 1700000000000; // Fixed timestamp
        Date.now = vi.fn(() => mockTime);

        // Get initial cached token
        const token1 = auth.getValidToken();

        // Advance time by 1 second to ensure different token
        mockTime += 1000;
        Date.now = vi.fn(() => mockTime);

        // Call refreshToken - should generate a new token
        const token2 = auth.refreshToken();

        // Verify the new token is different from the original
        expect(token2).not.toBe(token1);

        // Both should be valid JWT format
        expect(token1).toMatch(JWT_FORMAT_REGEX);
        expect(token2).toMatch(JWT_FORMAT_REGEX);

        // Verify the tokens have different payloads (due to different iat/exp)
        const payload1 = JSON.parse(atob(token1.split('.')[1]));
        const payload2 = JSON.parse(atob(token2.split('.')[1]));
        expect(payload2.iat).toBeGreaterThan(payload1.iat);
      } finally {
        Date.now = originalNow;
      }
    });

    it('should return token that differs from subsequent getValidToken calls', () => {
      const auth = new KlingAuth(testAccessKey, testSecretKey);
      const originalNow = Date.now;

      try {
        let mockTime = 1700000000000;
        Date.now = vi.fn(() => mockTime);

        // Get initial token
        const initialToken = auth.getValidToken();

        // Advance time
        mockTime += 1000;
        Date.now = vi.fn(() => mockTime);

        // refreshToken should generate new token
        const refreshedToken = auth.refreshToken();
        expect(refreshedToken).not.toBe(initialToken);

        // The new token should now be cached and returned by getValidToken
        // (since refreshToken calls generateToken which updates cache)
        const cachedToken = auth.getValidToken();
        expect(cachedToken).toBe(refreshedToken);
      } finally {
        Date.now = originalNow;
      }
    });
  });

  describe('getAuthorizationHeader', () => {
    it('should return Bearer token format', () => {
      const auth = new KlingAuth(testAccessKey, testSecretKey);
      const header = auth.getAuthorizationHeader();

      expect(header).toMatch(/^Bearer .+$/);
    });

    it('should include valid JWT in header', () => {
      const auth = new KlingAuth(testAccessKey, testSecretKey);
      const header = auth.getAuthorizationHeader();
      const token = header.replace('Bearer ', '');

      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('clearCache', () => {
    it('should invalidate cached token', () => {
      const auth = new KlingAuth(testAccessKey, testSecretKey);

      auth.getValidToken();
      expect(auth.isTokenValid()).toBe(true);

      auth.clearCache();
      expect(auth.isTokenValid()).toBe(false);

      // After clearing, getValidToken should generate a new one
      // We verify by checking isTokenValid becomes true again
      auth.getValidToken();
      expect(auth.isTokenValid()).toBe(true);
    });
  });

  describe('getTimeUntilExpiry', () => {
    it('should return 0 when no token', () => {
      const auth = new KlingAuth(testAccessKey, testSecretKey);
      expect(auth.getTimeUntilExpiry()).toBe(0);
    });

    it('should return positive value after generating token', () => {
      const auth = new KlingAuth(testAccessKey, testSecretKey);
      auth.generateToken();

      const timeUntil = auth.getTimeUntilExpiry();
      // Allow 100 second margin for test execution time
      expect(timeUntil).toBeGreaterThan(JWT_EXPIRY_SECONDS - 100);
      expect(timeUntil).toBeLessThanOrEqual(JWT_EXPIRY_SECONDS);
    });
  });

  describe('getRedactedAccessKey', () => {
    it('should show only last 4 characters', () => {
      const auth = new KlingAuth(testAccessKey, testSecretKey);
      expect(auth.getRedactedAccessKey()).toBe('***2345');
    });

    it('should return **** for short keys', () => {
      const auth = new KlingAuth('ab12', testSecretKey);
      expect(auth.getRedactedAccessKey()).toBe('****');
    });
  });

  describe('validateCredentials', () => {
    it('should return true for valid credentials', () => {
      const auth = new KlingAuth(testAccessKey, testSecretKey);
      expect(auth.validateCredentials()).toBe(true);
    });
  });
});

describe('Helper Functions', () => {
  describe('decodeToken', () => {
    it('should decode valid JWT', () => {
      const auth = new KlingAuth('test-key', 'test-secret');
      const token = auth.generateToken();
      const decoded = decodeToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.iss).toBe('test-key');
    });

    it('should return null for invalid token', () => {
      expect(decodeToken('invalid-token')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(decodeToken('')).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for fresh token', () => {
      const auth = new KlingAuth('test-key', 'test-secret');
      const token = auth.generateToken();

      expect(isTokenExpired(token)).toBe(false);
    });

    it('should return true for invalid token', () => {
      expect(isTokenExpired('invalid')).toBe(true);
    });

    it('should return true for expired token', () => {
      // Create a token with exp in the past
      const payload = {
        iss: 'test',
        exp: Math.floor(Date.now() / 1000) - 100, // 100 seconds ago
        nbf: Math.floor(Date.now() / 1000) - 200,
      };
      const token = jwt.sign(payload, 'secret');

      expect(isTokenExpired(token)).toBe(true);
    });
  });
});
