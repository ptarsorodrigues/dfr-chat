import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/upload/[id] - Download/stream an attachment by ID from database
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

        if (!attachment.fileData) {
            return NextResponse.json({ success: false, error: 'Dados do arquivo não disponíveis' }, { status: 404 });
        }

        // Determine if we should show inline (for preview) or as attachment
        const isPreview = request.nextUrl.searchParams.get('preview') === 'true';
        const disposition = isPreview
            ? `inline; filename="${encodeURIComponent(attachment.fileName)}"`
            : `attachment; filename="${encodeURIComponent(attachment.fileName)}"`;

        return new NextResponse(attachment.fileData, {
            headers: {
                'Content-Type': attachment.fileType,
                'Content-Disposition': disposition,
                'Content-Length': String(attachment.fileSize),
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('Download error:', error);
        return NextResponse.json({ success: false, error: 'Erro ao baixar arquivo' }, { status: 500 });
    }
}
