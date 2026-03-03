import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest, getClientIP } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

// DELETE /api/messages/purge - Permanently delete messages in date range (ADMIN ONLY)
export async function DELETE(request: NextRequest) {
    try {
        const currentUser = getUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        // Only ADMINISTRADOR can purge
        if (currentUser.role !== 'ADMINISTRADOR') {
            return NextResponse.json({ success: false, error: 'Apenas o Administrador pode realizar esta operação' }, { status: 403 });
        }

        const body = await request.json();
        const { dateFrom, dateTo, confirmed } = body;

        if (!dateFrom || !dateTo) {
            return NextResponse.json({ success: false, error: 'Data inicial e final são obrigatórias' }, { status: 400 });
        }

        const startDate = new Date(dateFrom);
        const endDate = new Date(dateTo + 'T23:59:59.999Z');

        if (startDate > endDate) {
            return NextResponse.json({ success: false, error: 'Data inicial não pode ser posterior à data final' }, { status: 400 });
        }

        // Count messages in range
        const messageCount = await prisma.message.count({
            where: {
                createdAt: { gte: startDate, lte: endDate },
            },
        });

        // Count related audit logs
        const auditCount = await prisma.auditLog.count({
            where: {
                entityType: 'MESSAGE',
                createdAt: { gte: startDate, lte: endDate },
            },
        });

        // If not confirmed, return preview only
        if (!confirmed) {
            return NextResponse.json({
                success: true,
                preview: true,
                data: {
                    messageCount,
                    auditCount,
                    dateFrom,
                    dateTo,
                },
            });
        }

        // CONFIRMED: Perform permanent deletion

        // 1. Nullify parentMessageId on any child messages outside the date range
        //    so they don't break when parents are deleted
        const messageIds = await prisma.message.findMany({
            where: { createdAt: { gte: startDate, lte: endDate } },
            select: { id: true },
        });
        const idsToDelete = messageIds.map(m => m.id);

        if (idsToDelete.length > 0) {
            // Detach children that are NOT in the deletion set
            await prisma.message.updateMany({
                where: {
                    parentMessageId: { in: idsToDelete },
                    id: { notIn: idsToDelete },
                },
                data: { parentMessageId: null },
            });

            // Also detach children within the set to avoid FK constraint issues during deletion
            await prisma.message.updateMany({
                where: {
                    parentMessageId: { in: idsToDelete },
                    id: { in: idsToDelete },
                },
                data: { parentMessageId: null },
            });
        }

        // 2. Delete audit logs for messages in the range
        const deletedAudits = await prisma.auditLog.deleteMany({
            where: {
                entityType: 'MESSAGE',
                createdAt: { gte: startDate, lte: endDate },
            },
        });

        // 3. Delete messages (cascade handles recipients, attachments, edits, pins)
        const deletedMessages = await prisma.message.deleteMany({
            where: {
                createdAt: { gte: startDate, lte: endDate },
            },
        });

        // 4. Log this purge action (this log itself is NOT in the deleted range)
        await createAuditLog({
            userId: currentUser.userId,
            action: 'MESSAGE_DELETED',
            entityType: 'SYSTEM',
            entityId: 'PURGE',
            details: `Limpeza permanente: ${deletedMessages.count} mensagens e ${deletedAudits.count} logs removidos do período ${new Date(dateFrom).toLocaleDateString('pt-BR')} a ${new Date(dateTo).toLocaleDateString('pt-BR')}`,
            ipAddress: getClientIP(request),
        });

        return NextResponse.json({
            success: true,
            data: {
                deletedMessages: deletedMessages.count,
                deletedAudits: deletedAudits.count,
            },
            message: `${deletedMessages.count} mensagens e ${deletedAudits.count} logs removidos permanentemente`,
        });
    } catch (error) {
        console.error('Purge messages error:', error);
        return NextResponse.json({ success: false, error: 'Erro ao limpar mensagens' }, { status: 500 });
    }
}
