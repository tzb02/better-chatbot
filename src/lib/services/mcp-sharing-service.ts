import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/pg/db.pg';
import { McpServerPermissionTable, OrganizationMemberTable, McpServerTable } from '@/lib/db/pg/schema.pg';

export class McpSharingService {
  static async shareMcpServerWithOrganization(
    serverId: string,
    organizationId: string,
    grantedBy: string
  ) {
    // Check if user has permission to share
    const [server] = await db
      .select()
      .from(McpServerTable)
      .where(eq(McpServerTable.id, serverId))
      .limit(1);

    if (!server) {
      throw new Error('MCP server not found');
    }

    if (server.userId !== grantedBy) {
      throw new Error('Not authorized to share this server');
    }

    // Check if user is part of the organization
    const [member] = await db
      .select()
      .from(OrganizationMemberTable)
      .where(and(
        eq(OrganizationMemberTable.organizationId, organizationId),
        eq(OrganizationMemberTable.userId, grantedBy)
      ))
      .limit(1);

    if (!member) {
      throw new Error('User is not a member of this organization');
    }

    // Create organization permission
    const [permission] = await db
      .insert(McpServerPermissionTable)
      .values({
        mcpServerId: serverId,
        organizationId,
        permissionType: 'shared_org',
        permissions: {
          canUse: true,
          canEdit: false,
          canDelete: false,
          canShare: false,
        },
        grantedBy,
      })
      .returning();

    return permission;
  }

  static async shareMcpServerWithUser(
    serverId: string,
    targetUserId: string,
    grantedBy: string
  ) {
    // Check if user has permission to share
    const [server] = await db
      .select()
      .from(McpServerTable)
      .where(eq(McpServerTable.id, serverId))
      .limit(1);

    if (!server) {
      throw new Error('MCP server not found');
    }

    if (server.userId !== grantedBy) {
      throw new Error('Not authorized to share this server');
    }

    // Create user permission
    const [permission] = await db
      .insert(McpServerPermissionTable)
      .values({
        mcpServerId: serverId,
        userId: targetUserId,
        permissionType: 'shared_user',
        permissions: {
          canUse: true,
          canEdit: false,
          canDelete: false,
          canShare: false,
        },
        grantedBy,
      })
      .returning();

    return permission;
  }

  static async getOrganizationMcpServers(organizationId: string, userId: string) {
    // Check if user is member of organization
    const [member] = await db
      .select()
      .from(OrganizationMemberTable)
      .where(and(
        eq(OrganizationMemberTable.organizationId, organizationId),
        eq(OrganizationMemberTable.userId, userId)
      ))
      .limit(1);

    if (!member) {
      return [];
    }

    // Get all MCP servers shared with the organization
    const permissions = await db
      .select({
        permission: McpServerPermissionTable,
        server: McpServerTable,
      })
      .from(McpServerPermissionTable)
      .innerJoin(McpServerTable, eq(McpServerPermissionTable.mcpServerId, McpServerTable.id))
      .where(eq(McpServerPermissionTable.organizationId, organizationId));

    // Filter based on user permissions
    return permissions.filter(permission => {
      // Organization members can use shared servers
      return (permission.permission.permissions as any).canUse;
    });
  }

  static async getUserSharedMcpServers(userId: string) {
    // Get all MCP servers shared with the user
    const permissions = await db
      .select({
        permission: McpServerPermissionTable,
        server: McpServerTable,
      })
      .from(McpServerPermissionTable)
      .innerJoin(McpServerTable, eq(McpServerPermissionTable.mcpServerId, McpServerTable.id))
      .where(eq(McpServerPermissionTable.userId, userId));

    return permissions.filter(permission => {
      return (permission.permission.permissions as any).canUse;
    });
  }

  static async revokeMcpServerSharing(permissionId: string, revokedBy: string) {
    // Check if user has permission to revoke
    const [permission] = await db
      .select()
      .from(McpServerPermissionTable)
      .where(eq(McpServerPermissionTable.id, permissionId))
      .limit(1);

    if (!permission) {
      throw new Error('Permission not found');
    }

    // Check if revoker is the original granter or server owner
    const [server] = await db
      .select()
      .from(McpServerTable)
      .where(eq(McpServerTable.id, permission.mcpServerId))
      .limit(1);

    if (permission.grantedBy !== revokedBy && server?.userId !== revokedBy) {
      throw new Error('Not authorized to revoke this permission');
    }

    // Delete the permission
    await db
      .delete(McpServerPermissionTable)
      .where(eq(McpServerPermissionTable.id, permissionId));

    return true;
  }

  static async updateMcpServerPermissions(
    permissionId: string,
    updates: Partial<{
      canUse: boolean;
      canEdit: boolean;
      canDelete: boolean;
      canShare: boolean;
    }>,
    updatedBy: string
  ) {
    // Check if user has permission to update
    const [permission] = await db
      .select()
      .from(McpServerPermissionTable)
      .where(eq(McpServerPermissionTable.id, permissionId))
      .limit(1);

    if (!permission) {
      throw new Error('Permission not found');
    }

    // Check if updater is the original granter or server owner
    const [server] = await db
      .select()
      .from(McpServerTable)
      .where(eq(McpServerTable.id, permission.mcpServerId))
      .limit(1);

    if (permission.grantedBy !== updatedBy && server?.userId !== updatedBy) {
      throw new Error('Not authorized to update this permission');
    }

    // Update permissions
    await db
      .update(McpServerPermissionTable)
      .set({
        permissions: {
          ...(permission.permissions as any),
          ...updates,
        },
        grantedAt: new Date(),
      })
      .where(eq(McpServerPermissionTable.id, permissionId));

    return true;
  }
}