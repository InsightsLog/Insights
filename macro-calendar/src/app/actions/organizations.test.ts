import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getOrganization,
  getCurrentUserRole,
  listOrganizationMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  transferOwnership,
  leaveOrganization,
} from "./organizations";

// Mock the createSupabaseServerClient function
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

// Mock the createSupabaseServiceClient function
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

// Mock env to avoid requiring real env vars in tests
vi.mock("@/lib/env", () => ({
  getServerEnv: vi.fn().mockReturnValue({
    RESEND_API_KEY: undefined,
    NEXT_PUBLIC_APP_URL: undefined,
  }),
}));

// Import the mocked function to control its behavior
import { createSupabaseServerClient } from "@/lib/supabase/server";
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);

// Helper to create a mock Supabase client
function createMockSupabase(options: {
  user?: { id: string } | null;
  authError?: Error | null;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user ?? null },
        error: options.authError ?? null,
      }),
    },
    from: vi.fn(),
  };
}

// Valid UUIDs for testing (must be valid UUID v4 format: version=4 at position 14, variant=8-b at position 19)
const mockUserId = "a1b2c3d4-e5f6-4890-abcd-ef1234567890";
const mockOrgId = "b2c3d4e5-f6a7-4901-bcde-f23456789012";
const mockMemberId = "c3d4e5f6-a7b8-4012-8def-345678901234";
const mockOtherUserId = "d4e5f6a7-b8c9-4123-8ef4-567890123456";

describe("getOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid slug format", async () => {
    const result = await getOrganization("Invalid Slug!");

    expect(result).toEqual({
      success: false,
      error: "Slug must contain only lowercase letters, numbers, and hyphens",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getOrganization("my-org");

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("returns error when organization not found", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getOrganization("nonexistent-org");

    expect(result).toEqual({
      success: false,
      error: "Organization not found",
    });
  });

  it("successfully returns organization", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockOrg = {
      id: mockOrgId,
      name: "My Organization",
      slug: "my-org",
      owner_id: mockUserId,
      created_at: "2026-01-14T00:00:00Z",
    };
    const mockSingle = vi.fn().mockResolvedValue({ data: mockOrg, error: null });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getOrganization("my-org");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(mockOrgId);
      expect(result.data.name).toBe("My Organization");
      expect(result.data.slug).toBe("my-org");
    }
  });
});

describe("getCurrentUserRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getCurrentUserRole(mockOrgId);

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("returns null when user is not a member", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    });
    const mockEqUser = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqUser });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqOrg });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getCurrentUserRole(mockOrgId);

    expect(result).toEqual({
      success: true,
      data: null,
    });
  });

  it("returns user role when member", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi.fn().mockResolvedValue({
      data: { role: "admin" },
      error: null,
    });
    const mockEqUser = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqUser });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqOrg });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getCurrentUserRole(mockOrgId);

    expect(result).toEqual({
      success: true,
      data: "admin",
    });
  });
});

describe("listOrganizationMembers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid organization ID", async () => {
    const result = await listOrganizationMembers("invalid-id");

    expect(result).toEqual({
      success: false,
      error: "Invalid organization ID",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await listOrganizationMembers(mockOrgId);

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("successfully returns members list", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockMembers = [
      {
        id: mockMemberId,
        org_id: mockOrgId,
        user_id: mockUserId,
        role: "owner",
        invited_at: "2026-01-14T00:00:00Z",
        joined_at: "2026-01-14T00:00:00Z",
        profiles: { email: "owner@example.com", display_name: "Owner" },
      },
      {
        id: mockMemberId + "2",
        org_id: mockOrgId,
        user_id: mockOtherUserId,
        role: "member",
        invited_at: "2026-01-14T01:00:00Z",
        joined_at: "2026-01-14T01:00:00Z",
        profiles: { email: "member@example.com", display_name: null },
      },
    ];
    const mockOrder2 = vi.fn().mockResolvedValue({ data: mockMembers, error: null });
    const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder1 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await listOrganizationMembers(mockOrgId);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].role).toBe("owner");
      expect(result.data[0].email).toBe("owner@example.com");
      expect(result.data[1].role).toBe("member");
    }
  });
});

describe("inviteMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid organization ID", async () => {
    const result = await inviteMember("invalid-id", { email: "test@example.com" });

    expect(result).toEqual({
      success: false,
      error: "Invalid organization ID",
    });
  });

  it("returns error for invalid email", async () => {
    const result = await inviteMember(mockOrgId, { email: "not-an-email" });

    expect(result).toEqual({
      success: false,
      error: "Invalid email address",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await inviteMember(mockOrgId, { email: "test@example.com" });

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("returns error when user is already a member", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // profiles.maybeSingle() - user exists
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: mockOtherUserId },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    // organization_members.maybeSingle() - already a member
    const mockMemberMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: mockMemberId },
      error: null,
    });
    const mockMemberEqUser = vi.fn().mockReturnValue({ maybeSingle: mockMemberMaybeSingle });
    const mockMemberEqOrg = vi.fn().mockReturnValue({ eq: mockMemberEqUser });
    const mockMemberSelect = vi.fn().mockReturnValue({ eq: mockMemberEqOrg });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ select: mockMemberSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await inviteMember(mockOrgId, { email: "test@example.com" });

    expect(result).toEqual({
      success: false,
      error: "User is already a member of this organization",
    });
  });

  it("successfully creates an invite for a new email", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // profiles.maybeSingle() - user not found (email not yet registered)
    const mockProfileMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockProfileEq = vi.fn().mockReturnValue({ maybeSingle: mockProfileMaybeSingle });
    const mockProfileSelect = vi.fn().mockReturnValue({ eq: mockProfileEq });

    // organization_invites check (existing invite) - none found
    const mockInviteMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockInviteGt = vi.fn().mockReturnValue({ maybeSingle: mockInviteMaybeSingle });
    const mockInviteIsNull = vi.fn().mockReturnValue({ gt: mockInviteGt });
    const mockInviteEqEmail = vi.fn().mockReturnValue({ is: mockInviteIsNull });
    const mockInviteEqOrg = vi.fn().mockReturnValue({ eq: mockInviteEqEmail });
    const mockInviteSelect = vi.fn().mockReturnValue({ eq: mockInviteEqOrg });

    // insert invite
    const newInvite = {
      id: "invite-uuid-1234",
      org_id: mockOrgId,
      invited_email: "newmember@example.com",
      role: "member",
      token: "a".repeat(64),
      invited_by: mockUserId,
      expires_at: "2026-02-26T00:00:00Z",
      accepted_at: null,
      created_at: "2026-02-19T00:00:00Z",
    };
    const mockInsertSingle = vi.fn().mockResolvedValue({ data: newInvite, error: null });
    const mockInsertSelect = vi.fn().mockReturnValue({ single: mockInsertSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect });

    // org name lookup
    const mockOrgSingle = vi.fn().mockResolvedValue({ data: { name: "Test Org" }, error: null });
    const mockOrgEq = vi.fn().mockReturnValue({ single: mockOrgSingle });
    const mockOrgSelect = vi.fn().mockReturnValue({ eq: mockOrgEq });

    mockSupabase.from.mockReturnValueOnce({ select: mockProfileSelect });
    mockSupabase.from.mockReturnValueOnce({ select: mockInviteSelect });
    mockSupabase.from.mockReturnValueOnce({ insert: mockInsert });
    mockSupabase.from.mockReturnValueOnce({ select: mockOrgSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await inviteMember(mockOrgId, { email: "newmember@example.com" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.invited_email).toBe("newmember@example.com");
      expect(result.data.role).toBe("member");
    }
  });
});

describe("updateMemberRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid member ID", async () => {
    const result = await updateMemberRole("invalid-id", "admin");

    expect(result).toEqual({
      success: false,
      error: "Invalid member ID",
    });
  });

  it("returns error for invalid role", async () => {
    // @ts-expect-error - Testing invalid role
    const result = await updateMemberRole(mockMemberId, "superadmin");

    expect(result).toEqual({
      success: false,
      error: "Invalid role",
    });
  });

  it("returns error when trying to assign owner role", async () => {
    const result = await updateMemberRole(mockMemberId, "owner");

    expect(result).toEqual({
      success: false,
      error: "Cannot assign owner role. Use transfer ownership instead.",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await updateMemberRole(mockMemberId, "admin");

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("returns error when trying to change own role", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: mockMemberId, org_id: mockOrgId, user_id: mockUserId, role: "admin" },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await updateMemberRole(mockMemberId, "member");

    expect(result).toEqual({
      success: false,
      error: "Cannot change your own role",
    });
  });

  it("returns error when trying to change owner role", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: mockMemberId, org_id: mockOrgId, user_id: mockOtherUserId, role: "owner" },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await updateMemberRole(mockMemberId, "admin");

    expect(result).toEqual({
      success: false,
      error: "Cannot change owner's role. Use transfer ownership instead.",
    });
  });

  it("successfully updates member role", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // First call: get member
    const mockSelectSingle = vi.fn().mockResolvedValue({
      data: { id: mockMemberId, org_id: mockOrgId, user_id: mockOtherUserId, role: "member" },
      error: null,
    });
    const mockSelectEq = vi.fn().mockReturnValue({ single: mockSelectSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockSelectEq });

    // Second call: update member
    const updatedMember = {
      id: mockMemberId,
      org_id: mockOrgId,
      user_id: mockOtherUserId,
      role: "admin",
      invited_at: "2026-01-14T00:00:00Z",
      joined_at: "2026-01-14T00:00:00Z",
      profiles: { email: "member@example.com", display_name: "Member" },
    };
    const mockUpdateSingle = vi.fn().mockResolvedValue({ data: updatedMember, error: null });
    const mockUpdateSelect = vi.fn().mockReturnValue({ single: mockUpdateSingle });
    const mockUpdateEq = vi.fn().mockReturnValue({ select: mockUpdateSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ update: mockUpdate });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await updateMemberRole(mockMemberId, "admin");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("admin");
    }
  });
});

describe("removeMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid member ID", async () => {
    const result = await removeMember("invalid-id");

    expect(result).toEqual({
      success: false,
      error: "Invalid member ID",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await removeMember(mockMemberId);

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("returns error when trying to remove self", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: mockMemberId, org_id: mockOrgId, user_id: mockUserId, role: "admin" },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await removeMember(mockMemberId);

    expect(result).toEqual({
      success: false,
      error: "Cannot remove yourself from the organization",
    });
  });

  it("returns error when trying to remove owner", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: mockMemberId, org_id: mockOrgId, user_id: mockOtherUserId, role: "owner" },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await removeMember(mockMemberId);

    expect(result).toEqual({
      success: false,
      error: "Cannot remove the organization owner",
    });
  });

  it("successfully removes a member", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // First call: get member
    const mockSelectSingle = vi.fn().mockResolvedValue({
      data: { id: mockMemberId, org_id: mockOrgId, user_id: mockOtherUserId, role: "member" },
      error: null,
    });
    const mockSelectEq = vi.fn().mockReturnValue({ single: mockSelectSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockSelectEq });

    // Second call: delete member
    const mockDeleteEq = vi.fn().mockResolvedValue({ error: null });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ delete: mockDelete });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await removeMember(mockMemberId);

    expect(result).toEqual({
      success: true,
      data: undefined,
    });
  });
});

describe("transferOwnership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid organization ID", async () => {
    const result = await transferOwnership("invalid-id", mockOtherUserId);

    expect(result).toEqual({
      success: false,
      error: "Invalid organization ID",
    });
  });

  it("returns error for invalid user ID", async () => {
    const result = await transferOwnership(mockOrgId, "invalid-id");

    expect(result).toEqual({
      success: false,
      error: "Invalid user ID",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await transferOwnership(mockOrgId, mockOtherUserId);

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("returns error when transferring to self", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await transferOwnership(mockOrgId, mockUserId);

    expect(result).toEqual({
      success: false,
      error: "Cannot transfer ownership to yourself",
    });
  });

  it("returns error when not the current owner", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: mockOrgId, owner_id: mockOtherUserId },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await transferOwnership(mockOrgId, mockOtherUserId);

    expect(result).toEqual({
      success: false,
      error: "Only the current owner can transfer ownership",
    });
  });

  it("returns error when new owner is not a member", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // First call: get org
    const mockOrgSingle = vi.fn().mockResolvedValue({
      data: { id: mockOrgId, owner_id: mockUserId },
      error: null,
    });
    const mockOrgEq = vi.fn().mockReturnValue({ single: mockOrgSingle });
    const mockOrgSelect = vi.fn().mockReturnValue({ eq: mockOrgEq });

    // Second call: check new owner membership (not found)
    const mockNewOwnerSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    });
    const mockNewOwnerEqUser = vi.fn().mockReturnValue({ single: mockNewOwnerSingle });
    const mockNewOwnerEqOrg = vi.fn().mockReturnValue({ eq: mockNewOwnerEqUser });
    const mockNewOwnerSelect = vi.fn().mockReturnValue({ eq: mockNewOwnerEqOrg });

    mockSupabase.from.mockReturnValueOnce({ select: mockOrgSelect });
    mockSupabase.from.mockReturnValueOnce({ select: mockNewOwnerSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await transferOwnership(mockOrgId, mockOtherUserId);

    expect(result).toEqual({
      success: false,
      error: "New owner must be an existing member of the organization",
    });
  });

  it("successfully transfers ownership", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // First call: get org
    const mockOrgSingle = vi.fn().mockResolvedValue({
      data: { id: mockOrgId, owner_id: mockUserId },
      error: null,
    });
    const mockOrgEq = vi.fn().mockReturnValue({ single: mockOrgSingle });
    const mockOrgSelect = vi.fn().mockReturnValue({ eq: mockOrgEq });

    // Second call: check new owner membership
    const mockNewOwnerSingle = vi.fn().mockResolvedValue({
      data: { id: mockMemberId, role: "admin" },
      error: null,
    });
    const mockNewOwnerEqUser = vi.fn().mockReturnValue({ single: mockNewOwnerSingle });
    const mockNewOwnerEqOrg = vi.fn().mockReturnValue({ eq: mockNewOwnerEqUser });
    const mockNewOwnerSelect = vi.fn().mockReturnValue({ eq: mockNewOwnerEqOrg });

    // Third call: get current owner membership
    const mockCurrentOwnerSingle = vi.fn().mockResolvedValue({
      data: { id: "current-owner-member-id" },
      error: null,
    });
    const mockCurrentOwnerEqUser = vi.fn().mockReturnValue({ single: mockCurrentOwnerSingle });
    const mockCurrentOwnerEqOrg = vi.fn().mockReturnValue({ eq: mockCurrentOwnerEqUser });
    const mockCurrentOwnerSelect = vi.fn().mockReturnValue({ eq: mockCurrentOwnerEqOrg });

    // Fourth call: update organization owner_id
    const mockUpdateOrgEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdateOrg = vi.fn().mockReturnValue({ eq: mockUpdateOrgEq });

    // Fifth call: update new owner role
    const mockUpdateNewOwnerEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdateNewOwner = vi.fn().mockReturnValue({ eq: mockUpdateNewOwnerEq });

    // Sixth call: update current owner role
    const mockUpdateCurrentOwnerEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdateCurrentOwner = vi.fn().mockReturnValue({ eq: mockUpdateCurrentOwnerEq });

    mockSupabase.from.mockReturnValueOnce({ select: mockOrgSelect });
    mockSupabase.from.mockReturnValueOnce({ select: mockNewOwnerSelect });
    mockSupabase.from.mockReturnValueOnce({ select: mockCurrentOwnerSelect });
    mockSupabase.from.mockReturnValueOnce({ update: mockUpdateOrg });
    mockSupabase.from.mockReturnValueOnce({ update: mockUpdateNewOwner });
    mockSupabase.from.mockReturnValueOnce({ update: mockUpdateCurrentOwner });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await transferOwnership(mockOrgId, mockOtherUserId);

    expect(result).toEqual({
      success: true,
      data: undefined,
    });
  });
});

describe("leaveOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid organization ID", async () => {
    const result = await leaveOrganization("invalid-id");

    expect(result).toEqual({
      success: false,
      error: "Invalid organization ID",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await leaveOrganization(mockOrgId);

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("returns error when not a member", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    });
    const mockEqUser = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqUser });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqOrg });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await leaveOrganization(mockOrgId);

    expect(result).toEqual({
      success: false,
      error: "You are not a member of this organization",
    });
  });

  it("returns error when owner tries to leave", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: mockMemberId, role: "owner" },
      error: null,
    });
    const mockEqUser = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqUser });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqOrg });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await leaveOrganization(mockOrgId);

    expect(result).toEqual({
      success: false,
      error: "Owners cannot leave. Transfer ownership first.",
    });
  });

  it("successfully leaves organization", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // First call: get membership
    const mockSelectSingle = vi.fn().mockResolvedValue({
      data: { id: mockMemberId, role: "member" },
      error: null,
    });
    const mockSelectEqUser = vi.fn().mockReturnValue({ single: mockSelectSingle });
    const mockSelectEqOrg = vi.fn().mockReturnValue({ eq: mockSelectEqUser });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockSelectEqOrg });

    // Second call: delete membership
    const mockDeleteEq = vi.fn().mockResolvedValue({ error: null });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ delete: mockDelete });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await leaveOrganization(mockOrgId);

    expect(result).toEqual({
      success: true,
      data: undefined,
    });
  });
});
