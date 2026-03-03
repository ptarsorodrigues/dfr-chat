import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/users/by-role?roles=DENTISTA,ASB - List active users by role(s)
export async function GET(request: NextRequest) {
    try {
        const currentUser = getUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const rolesParam = searchParams.get('roles') || '';
        const roles = rolesParam.split(',').map(r => r.trim()).filter(Boolean);

        if (roles.length === 0) {
            return NextResponse.json({ success: false, error: 'Informe pelo menos um grupo (role)' }, { status: 400 });
        }

        const users = await prisma.user.findMany({
            where: {
                role: { in: roles },
                active: true,
            },
            select: {
                id: true,
                name: true,
                role: true,
            },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json({ success: true, data: users });
    } catch (error) {
        console.error('Users by role error:', error);
        return NextResponse.json({ success: false, error: 'Erro ao buscar usuários' }, { status: 500 });
    }
}
