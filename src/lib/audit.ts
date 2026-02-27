import prisma from './prisma';

export type AuditAction =
    | 'MESSAGE_CREATED'
    | 'MESSAGE_READ'
    | 'MESSAGE_EDITED'
    | 'MESSAGE_DELETED'
    | 'MESSAGE_PINNED'
    | 'MESSAGE_UNPINNED'
    | 'USER_CREATED'
    | 'USER_UPDATED'
    | 'USER_DEACTIVATED'
    | 'USER_ACTIVATED'
    | 'PASSWORD_RESET'
    | 'PASSWORD_CHANGED'
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'BACKUP_EXPORTED'
    | 'BACKUP_IMPORTED'
    | 'ATTACHMENT_UPLOADED'
    | 'ATTACHMENT_DOWNLOADED';

export type EntityType = 'MESSAGE' | 'USER' | 'SYSTEM' | 'BACKUP' | 'ATTACHMENT';

export async function createAuditLog(params: {
    userId?: string;
    action: AuditAction;
    entityType: EntityType;
    entityId?: string;
    details?: string;
    ipAddress?: string;
}) {
    return prisma.auditLog.create({
        data: {
            userId: params.userId || null,
            action: params.action,
            entityType: params.entityType,
            entityId: params.entityId || null,
            details: params.details || null,
            ipAddress: params.ipAddress || null,
        },
    });
}
