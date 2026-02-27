import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest, hashPassword, isAdmin, getClientIP } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { ROLES } from '@/types';

// PUT /api/users/[id] - Update user
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const currentUser = getUserFromRequest(request);
        if (!currentUser || !isAdmin(currentUser.role)) {
            return NextResponse.json(
                { success: false, error: 'Acesso restrito ao administrador' },
                { status: 403 }
            );
        }

        const { id } = await params;
        const body = await request.json();
        const { name, email, phone, role } = body;

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Usuário não encontrado' },
                { status: 404 }
            );
        }

        if (role && !ROLES.includes(role)) {
            return NextResponse.json(
                { success: false, error: 'Função inválida' },
                { status: 400 }
            );
        }

        if (email && email !== user.email) {
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) {
                return NextResponse.json(
                    { success: false, error: 'Email já está em uso' },
                    { status: 400 }
                );
            }
        }

        const updated = await prisma.user.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(email && { email }),
                ...(phone && { phone }),
                ...(role && user.role !== 'ADMINISTRADOR' && { role }),
            },
        });

        await createAuditLog({
            userId: currentUser.userId,
            action: 'USER_UPDATED',
            entityType: 'USER',
            entityId: id,
            details: `Usuário ${updated.name} atualizado`,
            ipAddress: getClientIP(request),
        });

        return NextResponse.json({
            success: true,
            data: {
                id: updated.id,
                name: updated.name,
                email: updated.email,
                phone: updated.phone,
                role: updated.role,
                active: updated.active,
            },
        });
    } catch (error) {
        console.error('Update user error:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao atualizar usuário' },
            { status: 500 }
        );
    }
}

// DELETE /api/users/[id] - Deactivate user
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const currentUser = getUserFromRequest(request);
        if (!currentUser || !isAdmin(currentUser.role)) {
            return NextResponse.json(
                { success: false, error: 'Acesso restrito ao administrador' },
                { status: 403 }
            );
        }

        const { id } = await params;

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Usuário não encontrado' },
                { status: 404 }
            );
        }

        if (user.role === 'ADMINISTRADOR') {
            return NextResponse.json(
                { success: false, error: 'Não é possível desativar o administrador' },
                { status: 400 }
            );
        }

        // Check for active messages
        const activeMessages = await prisma.messageRecipient.findFirst({
            where: {
                userId: id,
                message: {
                    status: 'ATIVA',
                    OR: [
                        { dataLimite: { gte: new Date() } },
                        { dataLimite: null },
                    ],
                },
                readAt: null,
            },
        });

        if (activeMessages) {
            return NextResponse.json(
                { success: false, error: 'Usuário possui mensagens ativas não lidas. Não é possível desativar.' },
                { status: 400 }
            );
        }

        await prisma.user.update({
            where: { id },
            data: { active: false },
        });

        await createAuditLog({
            userId: currentUser.userId,
            action: 'USER_DEACTIVATED',
            entityType: 'USER',
            entityId: id,
            details: `Usuário ${user.name} desativado`,
            ipAddress: getClientIP(request),
        });

        return NextResponse.json({
            success: true,
            message: 'Usuário desativado com sucesso',
        });
    } catch (error) {
        console.error('Delete user error:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao desativar usuário' },
            { status: 500 }
        );
    }
}

// PATCH /api/users/[id] - Reset password
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const currentUser = getUserFromRequest(request);
        if (!currentUser || !isAdmin(currentUser.role)) {
            return NextResponse.json(
                { success: false, error: 'Acesso restrito ao administrador' },
                { status: 403 }
            );
        }

        const { id } = await params;
        const body = await request.json();
        const { newPassword } = body;

        if (!newPassword) {
            return NextResponse.json(
                { success: false, error: 'Nova senha é obrigatória' },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Usuário não encontrado' },
                { status: 404 }
            );
        }

        const hashedPassword = hashPassword(newPassword);

        await prisma.user.update({
            where: { id },
            data: {
                password: hashedPassword,
                mustChangePassword: true,
            },
        });

        await createAuditLog({
            userId: currentUser.userId,
            action: 'PASSWORD_RESET',
            entityType: 'USER',
            entityId: id,
            details: `Senha do usuário ${user.name} resetada pelo administrador`,
            ipAddress: getClientIP(request),
        });

        return NextResponse.json({
            success: true,
            message: 'Senha resetada com sucesso. O usuário deverá alterar no próximo login.',
        });
    } catch (error) {
        console.error('Reset password error:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao resetar senha' },
            { status: 500 }
        );
    }
}
