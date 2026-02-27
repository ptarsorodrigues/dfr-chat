import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest, isAdmin, getClientIP } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

// GET /api/backup/export - Export all data as JSON
export async function GET(request: NextRequest) {
    try {
        const currentUser = getUserFromRequest(request);
        if (!currentUser || !isAdmin(currentUser.role)) {
            return NextResponse.json(
                { success: false, error: 'Acesso restrito ao administrador' },
                { status: 403 }
            );
        }

        const [users, messages, recipients, attachments, editHistory, auditLogs, pinnedMessages] =
            await Promise.all([
                prisma.user.findMany({
                    select: {
                        id: true, name: true, email: true, phone: true,
                        role: true, active: true, mustChangePassword: true, createdAt: true,
                    },
                }),
                prisma.message.findMany({
                    include: {
                        recipients: true,
                        attachments: { select: { id: true, fileName: true, fileType: true, fileSize: true } },
                        editHistory: true,
                    },
                }),
                prisma.messageRecipient.count(),
                prisma.messageAttachment.count(),
                prisma.messageEdit.count(),
                prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 }),
                prisma.pinnedMessage.findMany(),
            ]);

        const backupData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            exportedBy: currentUser.name,
            stats: {
                users: users.length,
                messages: messages.length,
                recipients,
                attachments,
                editHistory,
                auditLogs: auditLogs.length,
                pinnedMessages: pinnedMessages.length,
            },
            data: { users, messages, auditLogs, pinnedMessages },
        };

        // Record backup in DB
        const jsonString = JSON.stringify(backupData, null, 2);
        const fileName = `dfrchat-backup-${new Date().toISOString().slice(0, 10)}.json`;

        await prisma.backup.create({
            data: {
                userId: currentUser.userId,
                fileName,
                fileSize: Buffer.byteLength(jsonString, 'utf8'),
                type: 'EXPORT',
            },
        });

        await createAuditLog({
            userId: currentUser.userId,
            action: 'BACKUP_EXPORTED',
            entityType: 'BACKUP',
            details: `Backup exportado: ${fileName}`,
            ipAddress: getClientIP(request),
        });

        return new NextResponse(jsonString, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        });
    } catch (error) {
        console.error('Export error:', error);
        return NextResponse.json({ success: false, error: 'Erro ao exportar dados' }, { status: 500 });
    }
}
