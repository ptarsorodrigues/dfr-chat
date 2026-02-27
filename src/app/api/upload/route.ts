import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// POST /api/upload - Upload files and store in database
export async function POST(request: NextRequest) {
    try {
        const currentUser = getUserFromRequest(request);
        if (!currentUser) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const formData = await request.formData();
        const files = formData.getAll('files') as File[];
        const messageId = formData.get('messageId') as string | null;

        if (!files || files.length === 0) {
            return NextResponse.json({ success: false, error: 'Nenhum arquivo enviado' }, { status: 400 });
        }

        const attachments = [];

        for (const file of files) {
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);

            // Create attachment record with file data stored in database
            const attachment = await prisma.messageAttachment.create({
                data: {
                    messageId: messageId || 'pending',
                    fileName: file.name,
                    filePath: `/api/upload/${Date.now()}`, // Will be updated with actual ID
                    fileType: file.type || 'application/octet-stream',
                    fileSize: buffer.length,
                    fileData: buffer,
                },
            });

            // Update filePath to point to the download endpoint
            await prisma.messageAttachment.update({
                where: { id: attachment.id },
                data: { filePath: `/api/upload/${attachment.id}` },
            });

            attachments.push({
                id: attachment.id,
                fileName: attachment.fileName,
                filePath: `/api/upload/${attachment.id}`,
                fileType: attachment.fileType,
                fileSize: attachment.fileSize,
            });
        }

        return NextResponse.json({
            success: true,
            data: attachments,
            message: `${attachments.length} arquivo(s) enviado(s)`,
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ success: false, error: 'Erro ao fazer upload' }, { status: 500 });
    }
}
