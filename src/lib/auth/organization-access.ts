import { eq, and, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/pg/db.pg';
import { OrganizationMemberTable, McpServerPermissionTable, McpServerTable } from '@/lib/db/pg/schema.pg';

export class OrganizationAccessControl {
  /**
   * Check if a user can access a specific MCP server
   */
  static async canAccessMcpServer(userId: string, serverId: string): Promise<boolean> {
    // Check if user owns the server
    const [ownedServer] = await db
      .select()
      .from(McpServerTable)
      .where(and(
        eq(McpServerTable.id, serverId),
        eq(McpServerTable.userId, userId)
      ))
      .limit(1);

    if (ownedServer) {
      return true;
    }

    // Check if server is shared with user's organization
    const [member] = await db
      .select({
        organizationId: OrganizationMemberTable.organizationId,
      })
      .from(OrganizationMemberTable)
      .where(eq(OrganizationMemberTable.userId, userId))
      .limit(1);

    if (member) {
      const [permission] = await db
        .select()
        .from(McpServerPermissionTable)
        .where(and(
          eq(McpServerPermissionTable.mcpServerId, serverId),
          eq(McpServerPermissionTable.organizationId, member.organizationId),
          eq((McpServerPermissionTable.permissions as any).canUse, true)
        ))
        .limit(1);

      if (permission) {
        return true;
      }
    }

    // Check if server is shared directly with user
    const [userPermission] = await db
      .select()
      .from(McpServerPermissionTable)
      .where(and(
        eq(McpServerPermissionTable.mcpServerId, serverId),
        eq(McpServerPermissionTable.userId, userId),
        eq((McpServerPermissionTable.permissions as any).canUse, true)
      ))
      .limit(1);

    return !!userPermission;
  }

  /**
   * Check if a user can edit a specific MCP server
   */
  static async canEditMcpServer(userId: string, serverId: string): Promise<boolean> {
    // Only owner can edit
    const [server] = await db
      .select()
      .from(McpServerTable)
      .where(and(
        eq(McpServerTable.id, serverId),
        eq(McpServerTable.userId, userId)
      ))
      .limit(1);

    return !!server;
  }

  /**
   * Check if a user can delete a specific MCP server
   */
  static async canDeleteMcpServer(userId: string, serverId: string): Promise<boolean> {
    // Only owner can delete
    const [server] = await db
      .select()
      .from(McpServerTable)
      .where(and(
        eq(McpServerTable.id, serverId),
        eq(McpServerTable.userId, userId)
      ))
      .limit(1);

    return !!server;
  }

  /**
   * Check if a user can share a specific MCP server
   */
  static async canShareMcpServer(userId: string, serverId: string): Promise<boolean> {
    // Only owner can share
    const [server] = await db
      .select()
      .from(McpServerTable)
      .where(and(
        eq(McpServerTable.id, serverId),
        eq(McpServerTable.userId, userId)
      ))
      .limit(1);

    return !!server;
  }

  /**
   * Check if a user is an organization owner
   */
  static async isOrganizationOwner(userId: string, organizationId?: string): Promise<boolean> {
    const query = organizationId
      ? and(
          eq(OrganizationMemberTable.userId, userId),
          eq(OrganizationMemberTable.organizationId, organizationId),
          eq(OrganizationMemberTable.role, 'account_owner')
        )
      : and(
          eq(OrganizationMemberTable.userId, userId),
          eq(OrganizationMemberTable.role, 'account_owner')
        );

    const [member] = await db
      .select()
      .from(OrganizationMemberTable)
      .where(query)
      .limit(1);

    return !!member;
  }

  /**
   * Check if a user can invite members to an organization
   */
  static async canInviteMembers(userId: string, organizationId: string): Promise<boolean> {
    const [member] = await db
      .select()
      .from(OrganizationMemberTable)
      .where(and(
        eq(OrganizationMemberTable.userId, userId),
        eq(OrganizationMemberTable.organizationId, organizationId),
        or(
          eq(OrganizationMemberTable.role, 'account_owner'),
          eq((OrganizationMemberTable.permissions as any).invite_members, true)
        )
      ))
      .limit(1);

    return !!member;
  }

  /**
   * Get all MCP servers accessible to a user
   */
  static async getAccessibleMcpServers(userId: string) {
    // Get user's owned servers
    const ownedServers = await db
      .select({
        id: McpServerTable.id,
        name: McpServerTable.name,
        config: McpServerTable.config,
        enabled: McpServerTable.enabled,
        userId: McpServerTable.userId,
        visibility: McpServerTable.visibility,
        createdAt: McpServerTable.createdAt,
        updatedAt: McpServerTable.updatedAt,
        accessType: sql`'owned'`,
      })
      .from(McpServerTable)
      .where(eq(McpServerTable.userId, userId));

    // Get user's organization
    const [member] = await db
      .select({
        organizationId: OrganizationMemberTable.organizationId,
      })
      .from(OrganizationMemberTable)
      .where(eq(OrganizationMemberTable.userId, userId))
      .limit(1);

    let organizationServers: any[] = [];
    if (member) {
      // Get organization-shared servers
      organizationServers = await db
        .select({
          id: McpServerTable.id,
          name: McpServerTable.name,
          config: McpServerTable.config,
          enabled: McpServerTable.enabled,
          userId: McpServerTable.userId,
          visibility: McpServerTable.visibility,
          createdAt: McpServerTable.createdAt,
          updatedAt: McpServerTable.updatedAt,
          accessType: sql`'organization'`,
        })
        .from(McpServerPermissionTable)
        .innerJoin(McpServerTable, eq(McpServerPermissionTable.mcpServerId, McpServerTable.id))
        .where(and(
          eq(McpServerPermissionTable.organizationId, member.organizationId),
          eq((McpServerPermissionTable.permissions as any).canUse, true)
        ));
    }

    // Get directly shared servers
    const sharedServers = await db
      .select({
        id: McpServerTable.id,
        name: McpServerTable.name,
        config: McpServerTable.config,
        enabled: McpServerTable.enabled,
        userId: McpServerTable.userId,
        visibility: McpServerTable.visibility,
        createdAt: McpServerTable.createdAt,
        updatedAt: McpServerTable.updatedAt,
        accessType: sql`'shared'`,
      })
      .from(McpServerPermissionTable)
      .innerJoin(McpServerTable, eq(McpServerPermissionTable.mcpServerId, McpServerTable.id))
      .where(and(
        eq(McpServerPermissionTable.userId, userId),
        eq((McpServerPermissionTable.permissions as any).canUse, true)
      ));

    return [...ownedServers, ...organizationServers, ...sharedServers] as any;
  }

  /**
   * Get user's permissions for a specific MCP server
   */
  static async getMcpServerPermissions(userId: string, serverId: string) {
    // Check ownership
    const [ownedServer] = await db
      .select()
      .from(McpServerTable)
      .where(and(
        eq(McpServerTable.id, serverId),
        eq(McpServerTable.userId, userId)
      ))
      .limit(1);

    if (ownedServer) {
      return {
        canUse: true,
        canEdit: true,
        canDelete: true,
        canShare: true,
        accessType: 'owned',
      };
    }

    // Check organization permissions
    const [member] = await db
      .select({
        organizationId: OrganizationMemberTable.organizationId,
      })
      .from(OrganizationMemberTable)
      .where(eq(OrganizationMemberTable.userId, userId))
      .limit(1);

    if (member) {
      const [orgPermission] = await db
        .select()
        .from(McpServerPermissionTable)
        .where(and(
          eq(McpServerPermissionTable.mcpServerId, serverId),
          eq(McpServerPermissionTable.organizationId, member.organizationId)
        ))
        .limit(1);

      if (orgPermission) {
        return {
          ...(orgPermission.permissions as any),
          accessType: 'organization',
        };
      }
    }

    // Check direct user permissions
    const [userPermission] = await db
      .select()
      .from(McpServerPermissionTable)
      .where(and(
        eq(McpServerPermissionTable.mcpServerId, serverId),
        eq(McpServerPermissionTable.userId, userId)
      ))
      .limit(1);

    if (userPermission) {
      return {
        ...(userPermission.permissions as any),
        accessType: 'shared',
      };
    }

    return null;
  }
}