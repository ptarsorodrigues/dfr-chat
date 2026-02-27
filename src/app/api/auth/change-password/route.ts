import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest, hashPassword, verifyPassword, getClientIP } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

// POST /api/auth/change-password
export async function POST(request: NextRequest) {
    try {
        const currentUser = getUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json(
                { success: false, error: 'Não autorizado' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { success: false, error: 'Senha atual e nova senha são obrigatórias' },
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { success: false, error: 'A nova senha deve ter pelo menos 6 caracteres' },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: currentUser.userId },
        });

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Usuário não encontrado' },
                { status: 404 }
            );
        }

        const isValidPassword = verifyPassword(currentPassword, user.password);
        if (!isValidPassword) {
            return NextResponse.json(
                { success: false, error: 'Senha atual incorreta' },
                { status: 400 }
            );
        }

        const hashedPassword = hashPassword(newPassword);

        await prisma.user.update({
            where: { id: currentUser.userId },
            data: {
                password: hashedPassword,
                mustChangePassword: false,
            },
        });

        await createAuditLog({
            userId: currentUser.userId,
            action: 'PASSWORD_CHANGED',
            entityType: 'USER',
            entityId: currentUser.userId,
            details: 'Senha alterada pelo usuário',
            ipAddress: getClientIP(request),
        });

        return NextResponse.json({
            success: true,
            message: 'Senha alterada com sucesso',
        });
    } catch (error) {
        console.error('Change password error:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao alterar senha' },
            { status: 500 }
        );
    }
}
