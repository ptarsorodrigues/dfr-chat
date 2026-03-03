import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest, isAdminOrDiretoria, getClientIP } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

// GET /api/messages/[id] - Get message details + thread + mark as read
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const currentUser = getUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const { id } = await params;

        const messageInclude = {
            remetente: {
                select: { id: true, name: true, role: true, email: true, phone: true },
            },
            cancelledBy: {
                select: { id: true, name: true, role: true },
            },
            recipients: {
                include: {
                    user: { select: { id: true, name: true, role: true } },
                },
            },
            attachments: {
                select: { id: true, fileName: true, fileType: true, fileSize: true, filePath: true },
            },
            editHistory: {
                include: {
                    user: { select: { id: true, name: true } },
                },
                orderBy: { editedAt: 'desc' as const },
            },
        };

        const message = await prisma.message.findUnique({
            where: { id },
            include: messageInclude,
        });

        if (!message) {
            return NextResponse.json({ success: false, error: 'Mensagem não encontrada' }, { status: 404 });
        }

        // Mark as read for this user
        const recipient = message.recipients.find(
            (r) => r.userId === currentUser.userId || r.groupName === currentUser.role
        );

        if (recipient && !recipient.readAt) {
            await prisma.messageRecipient.update({
                where: { id: recipient.id },
                data: { readAt: new Date() },
            });

            await createAuditLog({
                userId: currentUser.userId,
                action: 'MESSAGE_READ',
                entityType: 'MESSAGE',
                entityId: id,
                details: `Mensagem lida por ${currentUser.name}`,
                ipAddress: getClientIP(request),
            });
        }

        // Find root of the thread
        let rootId = message.id;
        let current = message;
        while (current.parentMessageId) {
            rootId = current.parentMessageId;
            const parent = await prisma.message.findUnique({
                where: { id: current.parentMessageId },
                select: { id: true, parentMessageId: true },
            });
            if (!parent) break;
            current = parent as typeof current;
        }

        // Get all messages in this thread (root + all descendants)
        const threadMessages = await prisma.message.findMany({
            where: {
                OR: [
                    { id: rootId },
                    { parentMessageId: rootId },
                    // Also get messages whose parent is in the thread (2nd level)
                ],
            },
            include: {
                remetente: {
                    select: { id: true, name: true, role: true, email: true, phone: true },
                },
                attachments: {
                    select: { id: true, fileName: true, fileType: true, fileSize: true },
                },
                recipients: {
                    include: {
                        user: { select: { id: true, name: true, role: true } },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        // If thread has more levels, fetch recursively
        const allIds = new Set(threadMessages.map(m => m.id));
        let hasMore = true;
        while (hasMore) {
            const deeper = await prisma.message.findMany({
                where: {
                    parentMessageId: { in: Array.from(allIds) },
                    id: { notIn: Array.from(allIds) },
                },
                include: {
                    remetente: {
                        select: { id: true, name: true, role: true, email: true, phone: true },
                    },
                    attachments: {
                        select: { id: true, fileName: true, fileType: true, fileSize: true },
                    },
                    recipients: {
                        include: {
                            user: { select: { id: true, name: true, role: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'asc' },
            });
            if (deeper.length === 0) {
                hasMore = false;
            } else {
                deeper.forEach(m => {
                    allIds.add(m.id);
                    threadMessages.push(m);
                });
            }
        }

        // Sort all by creation date
        threadMessages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        return NextResponse.json({
            success: true,
            data: message,
            thread: threadMessages,
        });
    } catch (error) {
        console.error('Get message error:', error);
        return NextResponse.json({ success: false, error: 'Erro ao carregar mensagem' }, { status: 500 });
    }
}

// PUT /api/messages/[id] - Edit message
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const currentUser = getUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const { id } = await params;

        const message = await prisma.message.findUnique({ where: { id } });
        if (!message) {
            return NextResponse.json({ success: false, error: 'Mensagem não encontrada' }, { status: 404 });
        }

        // Check permissions: author or admin/diretoria
        const isAuthor = message.remetenteId === currentUser.userId;
        const hasPrivilege = isAdminOrDiretoria(currentUser.role);

        if (!isAuthor && !hasPrivilege) {
            return NextResponse.json(
                { success: false, error: 'Sem permissão para editar esta mensagem' },
                { status: 403 }
            );
        }

        // Check deadline
        const now = new Date();
        const deadline = message.dataLimite || message.dataConsulta;
        if (deadline && deadline < now) {
            return NextResponse.json(
                { success: false, error: 'Não é possível editar: data limite ou consulta já passou' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { conteudo, siso, paciente, dentistaId, dataConsulta, dataLimite, prioridade, categoria } = body;

        // Save edit history
        if (conteudo && conteudo !== message.conteudo) {
            await prisma.messageEdit.create({
                data: {
                    messageId: id,
                    userId: currentUser.userId,
                    previousContent: message.conteudo,
                    newContent: conteudo,
                    fieldChanged: 'conteudo',
                },
            });
        }

        const updated = await prisma.message.update({
            where: { id },
            data: {
                ...(conteudo && { conteudo }),
                ...(siso !== undefined && { siso: siso || null }),
                ...(paciente !== undefined && { paciente: paciente || null }),
                ...(dentistaId !== undefined && { dentistaId: dentistaId || null }),
                ...(dataConsulta !== undefined && { dataConsulta: dataConsulta ? new Date(dataConsulta) : null }),
                ...(dataLimite !== undefined && { dataLimite: dataLimite ? new Date(dataLimite) : null }),
                ...(prioridade && { prioridade }),
                ...(categoria && { categoria }),
                edited: true,
            },
            include: {
                remetente: { select: { id: true, name: true, role: true } },
                recipients: true,
                attachments: true,
            },
        });

        await createAuditLog({
            userId: currentUser.userId,
            action: 'MESSAGE_EDITED',
            entityType: 'MESSAGE',
            entityId: id,
            details: `Mensagem editada por ${currentUser.name} (${hasPrivilege && !isAuthor ? 'privilégio admin/diretoria' : 'autor'})`,
            ipAddress: getClientIP(request),
        });

        return NextResponse.json({
            success: true,
            data: updated,
            message: 'Mensagem atualizada com sucesso',
        });
    } catch (error) {
        console.error('Edit message error:', error);
        return NextResponse.json({ success: false, error: 'Erro ao editar mensagem' }, { status: 500 });
    }
}

// DELETE /api/messages/[id] - Cancel message (author, admin, or diretoria)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const currentUser = getUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json(
                { success: false, error: 'Não autorizado' },
                { status: 401 }
            );
        }

        const { id } = await params;

        const message = await prisma.message.findUnique({ where: { id } });
        if (!message) {
            return NextResponse.json({ success: false, error: 'Mensagem não encontrada' }, { status: 404 });
        }

        // Check permissions: author can remove own message, admin/diretoria can remove any
        const isAuthor = message.remetenteId === currentUser.userId;
        const hasPrivilege = isAdminOrDiretoria(currentUser.role);

        if (!isAuthor && !hasPrivilege) {
            return NextResponse.json(
                { success: false, error: 'Sem permissão para remover esta mensagem. Apenas o autor, administradores e diretores podem remover.' },
                { status: 403 }
            );
        }

        const now = new Date();

        // Cancel the target message
        await prisma.message.update({
            where: { id },
            data: {
                status: 'CANCELADA',
                cancelledById: currentUser.userId,
                cancelledAt: now,
            },
        });

        // Cascade: cancel all descendant messages (replies & forwards)
        const descendantIds: string[] = [];
        let currentBatch = [id];
        while (currentBatch.length > 0) {
            const children = await prisma.message.findMany({
                where: {
                    parentMessageId: { in: currentBatch },
                    status: { not: 'CANCELADA' },
                },
                select: { id: true },
            });
            const childIds = children.map(c => c.id);
            if (childIds.length === 0) break;
            descendantIds.push(...childIds);
            currentBatch = childIds;
        }

        if (descendantIds.length > 0) {
            await prisma.message.updateMany({
                where: { id: { in: descendantIds } },
                data: {
                    status: 'CANCELADA',
                    cancelledById: currentUser.userId,
                    cancelledAt: now,
                },
            });
        }

        const totalCancelled = 1 + descendantIds.length;
        const roleLabel = hasPrivilege && !isAuthor
            ? `privilégio ${currentUser.role.toLowerCase()}`
            : 'autor';

        await createAuditLog({
            userId: currentUser.userId,
            action: 'MESSAGE_DELETED',
            entityType: 'MESSAGE',
            entityId: id,
            details: `Mensagem cancelada por ${currentUser.name} (${roleLabel}) em ${now.toLocaleString('pt-BR')}${totalCancelled > 1 ? ` — ${totalCancelled - 1} mensagens relacionadas também canceladas` : ''}`,
            ipAddress: getClientIP(request),
        });

        return NextResponse.json({
            success: true,
            message: totalCancelled > 1
                ? `Mensagem e ${totalCancelled - 1} resposta(s)/encaminhamento(s) removidos`
                : 'Mensagem removida com sucesso',
        });
    } catch (error) {
        console.error('Delete message error:', error);
        return NextResponse.json({ success: false, error: 'Erro ao remover mensagem' }, { status: 500 });
    }
}
