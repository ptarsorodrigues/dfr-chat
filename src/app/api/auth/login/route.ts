import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword, generateToken, getClientIP } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

// POST /api/auth/login
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { success: false, error: 'Email e senha são obrigatórios' },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user || !user.active) {
            await createAuditLog({
                action: 'LOGIN_FAILED',
                entityType: 'SYSTEM',
                details: `Tentativa de login falhou para: ${email}`,
                ipAddress: getClientIP(request),
            });

            return NextResponse.json(
                { success: false, error: 'Credenciais inválidas' },
                { status: 401 }
            );
        }

        const isValidPassword = verifyPassword(password, user.password);

        if (!isValidPassword) {
            await createAuditLog({
                userId: user.id,
                action: 'LOGIN_FAILED',
                entityType: 'USER',
                entityId: user.id,
                details: 'Senha incorreta',
                ipAddress: getClientIP(request),
            });

            return NextResponse.json(
                { success: false, error: 'Credenciais inválidas' },
                { status: 401 }
            );
        }

        const token = generateToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
        });

        await createAuditLog({
            userId: user.id,
            action: 'LOGIN_SUCCESS',
            entityType: 'USER',
            entityId: user.id,
            details: 'Login realizado com sucesso',
            ipAddress: getClientIP(request),
        });

        return NextResponse.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    mustChangePassword: user.mustChangePassword,
                },
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao fazer login' },
            { status: 500 }
        );
    }
}
