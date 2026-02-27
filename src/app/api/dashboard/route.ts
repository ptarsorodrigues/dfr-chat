import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/dashboard - Dashboard statistics
export async function GET(request: NextRequest) {
    try {
        const currentUser = getUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const [
            totalMessages,
            unreadMessages,
            urgentMessages,
            criticalMessages,
            totalUsers,
            activeUsers,
            recentMessages,
            readStats,
            messagesByCategory,
            messagesByPriority,
        ] = await Promise.all([
            // Total messages for user
            prisma.message.count({
                where: {
                    status: 'ATIVA',
                    recipients: {
                        some: {
                            OR: [
                                { userId: currentUser.userId },
                                { groupName: currentUser.role },
                            ],
                        },
                    },
                },
            }),
            // Unread messages
            prisma.messageRecipient.count({
                where: {
                    OR: [
                        { userId: currentUser.userId },
                        { groupName: currentUser.role },
                    ],
                    readAt: null,
                    message: { status: 'ATIVA' },
                },
            }),
            // Urgent messages unread
            prisma.messageRecipient.count({
                where: {
                    OR: [
                        { userId: currentUser.userId },
                        { groupName: currentUser.role },
                    ],
                    readAt: null,
                    message: { status: 'ATIVA', prioridade: 'URGENTE' },
                },
            }),
            // Critical messages unread
            prisma.messageRecipient.count({
                where: {
                    OR: [
                        { userId: currentUser.userId },
                        { groupName: currentUser.role },
                    ],
                    readAt: null,
                    message: { status: 'ATIVA', prioridade: 'CRITICA' },
                },
            }),
            // Total users
            prisma.user.count(),
            // Active users
            prisma.user.count({ where: { active: true } }),
            // Recent messages (last 10)
            prisma.message.findMany({
                where: {
                    status: 'ATIVA',
                    recipients: {
                        some: {
                            OR: [
                                { userId: currentUser.userId },
                                { groupName: currentUser.role },
                            ],
                        },
                    },
                },
                include: {
                    remetente: { select: { id: true, name: true, role: true } },
                    recipients: {
                        where: {
                            OR: [
                                { userId: currentUser.userId },
                                { groupName: currentUser.role },
                            ],
                        },
                        select: { readAt: true },
                    },
                    _count: { select: { attachments: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
            // Read rate
            prisma.messageRecipient.groupBy({
                by: ['groupName'],
                _count: { id: true },
                where: {
                    readAt: { not: null },
                    groupName: { not: null },
                },
            }),
            // Messages by category
            prisma.message.groupBy({
                by: ['categoria'],
                _count: { id: true },
                where: { status: 'ATIVA' },
            }),
            // Messages by priority
            prisma.message.groupBy({
                by: ['prioridade'],
                _count: { id: true },
                where: { status: 'ATIVA' },
            }),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                stats: {
                    totalMessages,
                    unreadMessages,
                    urgentMessages,
                    criticalMessages,
                    totalUsers,
                    activeUsers,
                },
                recentMessages,
                readStats,
                messagesByCategory,
                messagesByPriority,
            },
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        return NextResponse.json({ success: false, error: 'Erro ao carregar dashboard' }, { status: 500 });
    }
}
