import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest, getClientIP } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

// GET /api/messages - List messages for current user
export async function GET(request: NextRequest) {
    try {
        const currentUser = getUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const dentista = searchParams.get('dentista') || '';
        const siso = searchParams.get('siso') || '';
        const paciente = searchParams.get('paciente') || '';
        const prioridade = searchParams.get('prioridade') || '';
        const categoria = searchParams.get('categoria') || '';
        const status = searchParams.get('status') || 'ATIVA';
        const dateFrom = searchParams.get('dateFrom') || '';
        const dateTo = searchParams.get('dateTo') || '';
        const sent = searchParams.get('sent') === 'true';

        const skip = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};

        if (sent) {
            where.remetenteId = currentUser.userId;
        } else {
            where.recipients = {
                some: {
                    OR: [
                        { userId: currentUser.userId },
                        { groupName: currentUser.role },
                    ],
                },
            };
        }

        if (status) where.status = status;
        if (prioridade) where.prioridade = prioridade;
        if (categoria) where.categoria = categoria;
        if (siso) where.siso = { contains: siso };
        if (paciente) where.paciente = { contains: paciente };
        if (dentista) where.dentistaId = dentista;
        if (search) where.conteudo = { contains: search };
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = new Date(dateFrom);
            if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59');
        }

        const [messages, total] = await Promise.all([
            prisma.message.findMany({
                where,
                include: {
                    remetente: {
                        select: { id: true, name: true, role: true, email: true, phone: true },
                    },
                    recipients: {
                        include: {
                            user: {
                                select: { id: true, name: true, role: true },
                            },
                        },
                    },
                    attachments: {
                        select: { id: true, fileName: true, fileType: true, fileSize: true },
                    },
                    _count: { select: { editHistory: true } },
                },
                orderBy: [
                    { prioridade: 'desc' },
                    { createdAt: 'desc' },
                ],
                skip,
                take: limit,
            }),
            prisma.message.count({ where }),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                messages,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            },
        });
    } catch (error) {
        console.error('List messages error:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao listar mensagens' },
            { status: 500 }
        );
    }
}

// POST /api/messages - Create message
export async function POST(request: NextRequest) {
    try {
        const currentUser = getUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const {
            siso,
            paciente,
            dentistaId,
            dataConsulta,
            dataLimite,
            conteudo,
            prioridade = 'NORMAL',
            categoria = 'ADMINISTRATIVO',
            recipientUserIds = [],
            recipientGroups = [],
            attachmentIds = [],
        } = body;

        if (!conteudo) {
            return NextResponse.json(
                { success: false, error: 'Conteúdo é obrigatório' },
                { status: 400 }
            );
        }

        if (recipientUserIds.length === 0 && recipientGroups.length === 0 && !dentistaId) {
            return NextResponse.json(
                { success: false, error: 'Selecione pelo menos um destinatário' },
                { status: 400 }
            );
        }

        // Build recipient entries (avoid duplicates)
        const recipientEntries: Array<{ userId: string | null; groupName: string | null }> = [];
        const addedUserIds = new Set<string>();
        const addedGroups = new Set<string>();

        // Add individual user recipients
        for (const uid of recipientUserIds) {
            if (!addedUserIds.has(uid)) {
                recipientEntries.push({ userId: uid, groupName: null });
                addedUserIds.add(uid);
            }
        }

        // Add group recipients
        for (const gn of recipientGroups) {
            if (!addedGroups.has(gn)) {
                recipientEntries.push({ userId: null, groupName: gn });
                addedGroups.add(gn);
            }
        }

        // Add specific dentist if set and not already included
        if (dentistaId && !addedUserIds.has(dentistaId)) {
            recipientEntries.push({ userId: dentistaId, groupName: null });
            addedUserIds.add(dentistaId);
        }

        const message = await prisma.message.create({
            data: {
                siso: siso || null,
                paciente: paciente || null,
                dentistaId: dentistaId || null,
                dataConsulta: dataConsulta ? new Date(dataConsulta) : null,
                dataLimite: dataLimite ? new Date(dataLimite) : null,
                conteudo,
                prioridade,
                categoria,
                remetenteId: currentUser.userId,
                recipients: {
                    create: recipientEntries,
                },
            },
            include: {
                remetente: { select: { id: true, name: true, role: true } },
                recipients: true,
                attachments: true,
            },
        });

        // Link uploaded attachments to this message
        if (attachmentIds && attachmentIds.length > 0) {
            await prisma.messageAttachment.updateMany({
                where: { id: { in: attachmentIds } },
                data: { messageId: message.id },
            });
        }

        await createAuditLog({
            userId: currentUser.userId,
            action: 'MESSAGE_CREATED',
            entityType: 'MESSAGE',
            entityId: message.id,
            details: `Mensagem criada - Prioridade: ${prioridade}, Categoria: ${categoria}`,
            ipAddress: getClientIP(request),
        });

        return NextResponse.json({
            success: true,
            data: message,
            message: 'Mensagem enviada com sucesso',
        });
    } catch (error) {
        console.error('Create message error:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao criar mensagem' },
            { status: 500 }
        );
    }
}
