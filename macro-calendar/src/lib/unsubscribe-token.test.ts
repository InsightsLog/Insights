import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "crypto";
import {
  generateUnsubscribeToken,
  validateUnsubscribeToken,
} from "./unsubscribe-token";

describe("unsubscribe-token", () => {
  const mockUserId = "user-1234-5678-9abc-def012345678";
  const mockIndicatorId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  beforeEach(() => {
    // Set a test secret for token generation/validation
    process.env.UNSUBSCRIBE_TOKEN_SECRET = "test-secret-key-for-tokens";
  });

  describe("generateUnsubscribeToken", () => {
    it("generates a token with two parts separated by dot", () => {
      const token = generateUnsubscribeToken(mockUserId, mockIndicatorId);

      expect(token).toBeTruthy();
      expect(token.split(".")).toHaveLength(2);
    });

    it("generates different tokens for different users", () => {
      const token1 = generateUnsubscribeToken(mockUserId, mockIndicatorId);
      const token2 = generateUnsubscribeToken("different-user-id", mockIndicatorId);

      expect(token1).not.toBe(token2);
    });

    it("generates different tokens for different indicators", () => {
      const token1 = generateUnsubscribeToken(mockUserId, mockIndicatorId);
      const token2 = generateUnsubscribeToken(mockUserId, "different-indicator-id");

      expect(token1).not.toBe(token2);
    });

    it("throws error when UNSUBSCRIBE_TOKEN_SECRET is not set", () => {
      delete process.env.UNSUBSCRIBE_TOKEN_SECRET;

      expect(() =>
        generateUnsubscribeToken(mockUserId, mockIndicatorId)
      ).toThrow("UNSUBSCRIBE_TOKEN_SECRET environment variable is required");
    });
  });

  describe("validateUnsubscribeToken", () => {
    it("validates a valid token", () => {
      const token = generateUnsubscribeToken(mockUserId, mockIndicatorId);
      const payload = validateUnsubscribeToken(token);

      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe(mockUserId);
      expect(payload?.indicatorId).toBe(mockIndicatorId);
      expect(payload?.exp).toBeGreaterThan(Date.now());
    });

    it("rejects token with invalid format (no dot)", () => {
      const payload = validateUnsubscribeToken("invalid-token-format");

      expect(payload).toBeNull();
    });

    it("rejects token with invalid format (too many parts)", () => {
      const payload = validateUnsubscribeToken("part1.part2.part3");

      expect(payload).toBeNull();
    });

    it("rejects token with invalid signature", () => {
      const token = generateUnsubscribeToken(mockUserId, mockIndicatorId);
      const [payloadBase64] = token.split(".");
      const tamperedToken = `${payloadBase64}.invalid-signature`;

      const payload = validateUnsubscribeToken(tamperedToken);

      expect(payload).toBeNull();
    });

    it("rejects token with tampered payload", () => {
      const token = generateUnsubscribeToken(mockUserId, mockIndicatorId);
      const [, signature] = token.split(".");
      
      // Create a different payload but use the original signature
      const tamperedPayload = Buffer.from(
        JSON.stringify({ userId: "hacker", indicatorId: mockIndicatorId, exp: Date.now() + 1000000 })
      ).toString("base64url");
      const tamperedToken = `${tamperedPayload}.${signature}`;

      const payload = validateUnsubscribeToken(tamperedToken);

      expect(payload).toBeNull();
    });

    it("rejects expired token", () => {
      // Generate a token that expires immediately
      const token = generateUnsubscribeToken(mockUserId, mockIndicatorId, 0);

      // Wait a bit to ensure it expires
      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      const payload = validateUnsubscribeToken(token);

      expect(payload).toBeNull();

      vi.useRealTimers();
    });

    it("rejects token with invalid JSON payload", () => {
      const invalidPayloadBase64 = Buffer.from("not-valid-json").toString("base64url");
      const secret = "test-secret-key-for-tokens";
      const signature = createHmac("sha256", secret)
        .update(invalidPayloadBase64)
        .digest("base64url");
      const token = `${invalidPayloadBase64}.${signature}`;

      const payload = validateUnsubscribeToken(token);

      expect(payload).toBeNull();
    });

    it("rejects token with missing userId", () => {
      const invalidPayload = { indicatorId: mockIndicatorId, exp: Date.now() + 1000000 };
      const payloadBase64 = Buffer.from(JSON.stringify(invalidPayload)).toString("base64url");
      const secret = "test-secret-key-for-tokens";
      const signature = createHmac("sha256", secret)
        .update(payloadBase64)
        .digest("base64url");
      const token = `${payloadBase64}.${signature}`;

      const payload = validateUnsubscribeToken(token);

      expect(payload).toBeNull();
    });

    it("rejects token with missing indicatorId", () => {
      const invalidPayload = { userId: mockUserId, exp: Date.now() + 1000000 };
      const payloadBase64 = Buffer.from(JSON.stringify(invalidPayload)).toString("base64url");
      const secret = "test-secret-key-for-tokens";
      const signature = createHmac("sha256", secret)
        .update(payloadBase64)
        .digest("base64url");
      const token = `${payloadBase64}.${signature}`;

      const payload = validateUnsubscribeToken(token);

      expect(payload).toBeNull();
    });

    it("accepts token that is not yet expired", () => {
      // Generate a token that expires in 30 days
      const token = generateUnsubscribeToken(mockUserId, mockIndicatorId, 30);

      const payload = validateUnsubscribeToken(token);

      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe(mockUserId);
      expect(payload?.indicatorId).toBe(mockIndicatorId);
    });

    it("returns null when UNSUBSCRIBE_TOKEN_SECRET is not set during validation", () => {
      const token = generateUnsubscribeToken(mockUserId, mockIndicatorId);
      delete process.env.UNSUBSCRIBE_TOKEN_SECRET;

      const payload = validateUnsubscribeToken(token);

      expect(payload).toBeNull();
    });
  });
});
