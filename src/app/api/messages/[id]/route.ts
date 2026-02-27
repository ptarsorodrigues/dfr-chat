import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest, isAdminOrDiretoria, getClientIP } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

// GET /api/messages/[id] - Get message details + mark as read
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

        const message = await prisma.message.findUnique({
            where: { id },
            include: {
                remetente: {
                    select: { id: true, name: true, role: true, email: true, phone: true },
                },
                recipients: {
                    include: {
                        user: { select: { id: true, name: true, role: true } },
                    },
                },
                attachments: true,
                editHistory: {
                    include: {
                        user: { select: { id: true, name: true } },
                    },
                    orderBy: { editedAt: 'desc' },
                },
            },
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

        return NextResponse.json({ success: true, data: message });
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

// DELETE /api/messages/[id] - Delete message (admin/diretoria only)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const currentUser = getUserFromRequest(request);
        if (!currentUser || !isAdminOrDiretoria(currentUser.role)) {
            return NextResponse.json(
                { success: false, error: 'Acesso restrito a administrador/diretoria' },
                { status: 403 }
            );
        }

        const { id } = await params;

        const message = await prisma.message.findUnique({ where: { id } });
        if (!message) {
            return NextResponse.json({ success: false, error: 'Mensagem não encontrada' }, { status: 404 });
        }

        await prisma.message.update({
            where: { id },
            data: { status: 'CANCELADA' },
        });

        await createAuditLog({
            userId: currentUser.userId,
            action: 'MESSAGE_DELETED',
            entityType: 'MESSAGE',
            entityId: id,
            details: `Mensagem cancelada por ${currentUser.name}`,
            ipAddress: getClientIP(request),
        });

        return NextResponse.json({
            success: true,
            message: 'Mensagem cancelada com sucesso',
        });
    } catch (error) {
        console.error('Delete message error:', error);
        return NextResponse.json({ success: false, error: 'Erro ao cancelar mensagem' }, { status: 500 });
    }
}
