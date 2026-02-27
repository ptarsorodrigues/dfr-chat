import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest, isAdmin, getClientIP } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

// GET /api/backup/history - List backup history
export async function GET(request: NextRequest) {
    try {
        const currentUser = getUserFromRequest(request);
        if (!currentUser || !isAdmin(currentUser.role)) {
            return NextResponse.json(
                { success: false, error: 'Acesso restrito ao administrador' },
                { status: 403 }
            );
        }

        const backups = await prisma.backup.findMany({
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ success: true, data: backups });
    } catch (error) {
        console.error('Backup history error:', error);
        return NextResponse.json({ success: false, error: 'Erro ao listar backups' }, { status: 500 });
    }
}

// POST /api/backup/import - Import data from JSON
export async function POST(request: NextRequest) {
    try {
        const currentUser = getUserFromRequest(request);
        if (!currentUser || !isAdmin(currentUser.role)) {
            return NextResponse.json(
                { success: false, error: 'Acesso restrito ao administrador' },
                { status: 403 }
            );
        }

        const body = await request.json();

        if (!body.version || !body.data) {
            return NextResponse.json(
                { success: false, error: 'Arquivo de backup inválido' },
                { status: 400 }
            );
        }

        const { data } = body;
        let importedCount = 0;

        // Import messages (merge mode - skip existing)
        if (data.messages) {
            for (const msg of data.messages) {
                const exists = await prisma.message.findUnique({ where: { id: msg.id } });
                if (!exists) {
                    try {
                        await prisma.message.create({
                            data: {
                                id: msg.id,
                                siso: msg.siso,
                                paciente: msg.paciente,
                                dentistaId: msg.dentistaId,
                                dataConsulta: msg.dataConsulta ? new Date(msg.dataConsulta) : null,
                                dataLimite: msg.dataLimite ? new Date(msg.dataLimite) : null,
                                conteudo: msg.conteudo,
                                prioridade: msg.prioridade,
                                categoria: msg.categoria,
                                status: msg.status,
                                edited: msg.edited,
                                remetenteId: msg.remetenteId,
                                createdAt: new Date(msg.createdAt),
                                updatedAt: new Date(msg.updatedAt),
                            },
                        });
                        importedCount++;
                    } catch {
                        // Skip messages that can't be imported (e.g., foreign key issues)
                    }
                }
            }
        }

        await prisma.backup.create({
            data: {
                userId: currentUser.userId,
                fileName: `import-${new Date().toISOString().replace(/[:.]/g, '-')}`,
                fileSize: JSON.stringify(body).length,
                type: 'IMPORT',
            },
        });

        await createAuditLog({
            userId: currentUser.userId,
            action: 'BACKUP_IMPORTED',
            entityType: 'BACKUP',
            details: `Backup importado: ${importedCount} mensagens restauradas`,
            ipAddress: getClientIP(request),
        });

        return NextResponse.json({
            success: true,
            message: `Backup importado com sucesso. ${importedCount} registros restaurados.`,
        });
    } catch (error) {
        console.error('Import error:', error);
        return NextResponse.json({ success: false, error: 'Erro ao importar backup' }, { status: 500 });
    }
}
