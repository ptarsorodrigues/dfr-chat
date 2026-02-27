import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

// POST /api/upload - Upload files and create attachment records
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

        // Ensure uploads directory exists
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadsDir, { recursive: true });

        const attachments = [];

        for (const file of files) {
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);

            // Generate unique filename
            const ext = path.extname(file.name);
            const uniqueName = `${randomUUID()}${ext}`;
            const filePath = path.join(uploadsDir, uniqueName);

            // Write file to disk
            await writeFile(filePath, buffer);

            // Create attachment record
            const attachment = await prisma.messageAttachment.create({
                data: {
                    messageId: messageId || 'pending',
                    fileName: file.name,
                    filePath: `/uploads/${uniqueName}`,
                    fileType: file.type || 'application/octet-stream',
                    fileSize: buffer.length,
                },
            });

            attachments.push({
                id: attachment.id,
                fileName: attachment.fileName,
                filePath: attachment.filePath,
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
