import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest, hashPassword, isAdmin, getClientIP } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { ROLES } from '@/types';

// GET /api/users - List all users (admin only)
export async function GET(request: NextRequest) {
    try {
        const currentUser = getUserFromRequest(request);
        if (!currentUser || !isAdmin(currentUser.role)) {
            return NextResponse.json(
                { success: false, error: 'Acesso restrito ao administrador' },
                { status: 403 }
            );
        }

        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                active: true,
                mustChangePassword: true,
                createdAt: true,
            },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json({ success: true, data: users });
    } catch (error) {
        console.error('List users error:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao listar usuários' },
            { status: 500 }
        );
    }
}

// POST /api/users - Create new user (admin only)
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
        const { name, email, phone, role, password } = body;

        if (!name || !email || !phone || !role || !password) {
            return NextResponse.json(
                { success: false, error: 'Todos os campos são obrigatórios' },
                { status: 400 }
            );
        }

        if (!ROLES.includes(role)) {
            return NextResponse.json(
                { success: false, error: 'Função inválida' },
                { status: 400 }
            );
        }

        if (role === 'ADMINISTRADOR') {
            return NextResponse.json(
                { success: false, error: 'Não é possível criar outro administrador' },
                { status: 400 }
            );
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json(
                { success: false, error: 'Email já cadastrado' },
                { status: 400 }
            );
        }

        const hashedPassword = hashPassword(password);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                phone,
                password: hashedPassword,
                role,
                mustChangePassword: true,
                active: true,
            },
        });

        await createAuditLog({
            userId: currentUser.userId,
            action: 'USER_CREATED',
            entityType: 'USER',
            entityId: user.id,
            details: `Usuário ${name} (${role}) criado`,
            ipAddress: getClientIP(request),
        });

        return NextResponse.json({
            success: true,
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
            },
            message: 'Usuário criado com sucesso',
        });
    } catch (error) {
        console.error('Create user error:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao criar usuário' },
            { status: 500 }
        );
    }
}
