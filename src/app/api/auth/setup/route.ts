import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

// POST /api/auth/setup - Create admin account (first time only)
export async function POST(request: NextRequest) {
    try {
        const existingAdmin = await prisma.user.findFirst({
            where: { role: 'ADMINISTRADOR' },
        });

        if (existingAdmin) {
            return NextResponse.json(
                { success: false, error: 'Administrador já cadastrado' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { name, email, phone, password } = body;

        if (!name || !email || !phone || !password) {
            return NextResponse.json(
                { success: false, error: 'Todos os campos são obrigatórios' },
                { status: 400 }
            );
        }

        const hashedPassword = hashPassword(password);

        const admin = await prisma.user.create({
            data: {
                name,
                email,
                phone,
                password: hashedPassword,
                role: 'ADMINISTRADOR',
                mustChangePassword: false,
                active: true,
            },
        });

        await createAuditLog({
            userId: admin.id,
            action: 'USER_CREATED',
            entityType: 'USER',
            entityId: admin.id,
            details: 'Conta de administrador criada (setup inicial)',
        });

        return NextResponse.json({
            success: true,
            message: 'Administrador criado com sucesso',
        });
    } catch (error) {
        console.error('Setup error:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao criar administrador' },
            { status: 500 }
        );
    }
}

// GET /api/auth/setup - Check if admin exists
export async function GET() {
    try {
        const existingAdmin = await prisma.user.findFirst({
            where: { role: 'ADMINISTRADOR' },
        });

        return NextResponse.json({
            success: true,
            data: { adminExists: !!existingAdmin },
        });
    } catch (error) {
        console.error('Setup check error:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao verificar setup' },
            { status: 500 }
        );
    }
}
