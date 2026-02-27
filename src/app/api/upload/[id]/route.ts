import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { readFile } from 'fs/promises';
import path from 'path';

// GET /api/upload/[id] - Download/stream an attachment by ID
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

        const attachment = await prisma.messageAttachment.findUnique({
            where: { id },
        });

        if (!attachment) {
            return NextResponse.json({ success: false, error: 'Arquivo não encontrado' }, { status: 404 });
        }

        const filePath = path.join(process.cwd(), 'public', attachment.filePath);

        try {
            const fileBuffer = await readFile(filePath);

            return new NextResponse(fileBuffer, {
                headers: {
                    'Content-Type': attachment.fileType,
                    'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
                    'Content-Length': String(fileBuffer.length),
                },
            });
        } catch {
            return NextResponse.json({ success: false, error: 'Arquivo não encontrado no disco' }, { status: 404 });
        }
    } catch (error) {
        console.error('Download error:', error);
        return NextResponse.json({ success: false, error: 'Erro ao baixar arquivo' }, { status: 500 });
    }
}
