'use client';
import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/lib/ToastContext';
import { ROLES, ROLE_LABELS } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function MessageDetailModal({ message, onClose, api, onRead, onMessageSent }: { message: any; onClose: () => void; api: (url: string, options?: RequestInit) => Promise<Response>; onRead?: () => void; onMessageSent?: () => void }) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [msg, setMsg] = React.useState(message);
    const [loading, setLoading] = React.useState(!message?.editHistory);
    const [previewAttachment, setPreviewAttachment] = React.useState<{ id: string; fileName: string; fileType: string; fileSize: number } | null>(null);
    const [previewPos, setPreviewPos] = React.useState({ x: 0, y: 0 });
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);

    // Reply/Forward state
    const [mode, setMode] = React.useState<'view' | 'reply' | 'forward'>('view');
    const [replyText, setReplyText] = React.useState('');
    const [replyFiles, setReplyFiles] = React.useState<File[]>([]);
    const [sending, setSending] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);

    // Forward recipient state
    const [fwdRecipientGroups, setFwdRecipientGroups] = React.useState<string[]>([]);
    const [fwdRecipientUserIds, setFwdRecipientUserIds] = React.useState<string[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [groupMembers, setGroupMembers] = React.useState<Record<string, any[]>>({});
    const [selectedMembers, setSelectedMembers] = React.useState<Record<string, string[]>>({});
    const [loadingMembers, setLoadingMembers] = React.useState<Record<string, boolean>>({});

    React.useEffect(() => {
        if (!message?.id) return;
        (async () => {
            try {
                const res = await api(`/api/messages/${message.id}`);
                const data = await res.json();
                if (data.success) {
                    setMsg(data.data);
                    if (onRead) onRead();
                }
            } catch { /* ignore */ }
            setLoading(false);
        })();
    }, [message?.id, api, onRead]);

    // Check if user can delete this message
    const canDelete = React.useMemo(() => {
        if (!msg || !user) return false;
        const isAuthor = msg.remetenteId === user.id;
        const isPrivileged = user.role === 'ADMINISTRADOR' || user.role === 'DIRETORIA';
        return isAuthor || isPrivileged;
    }, [msg, user]);

    const handleDelete = async () => {
        if (!msg?.id) return;
        setDeleting(true);
        try {
            const res = await api(`/api/messages/${msg.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showToast('Mensagem removida com sucesso', 'success');
                if (onRead) onRead();
                onClose();
            } else {
                showToast(data.error || 'Erro ao remover mensagem', 'error');
            }
        } catch {
            showToast('Erro ao remover mensagem', 'error');
        }
        setDeleting(false);
        setShowDeleteConfirm(false);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAttachmentHover = (e: React.MouseEvent, attachment: any) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setPreviewPos({ x: rect.right + 12, y: rect.top });
        setPreviewAttachment(attachment);
    };

    const handleAttachmentLeave = () => {
        setPreviewAttachment(null);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleDownload = async (attachment: any) => {
        const token = localStorage.getItem('dfr-token');
        const res = await fetch(`/api/upload/${attachment.id}`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.fileName;
        a.click();
        URL.revokeObjectURL(url);
    };

    const getFileIcon = (fileType: string) => {
        if (fileType.startsWith('image/')) return '🖼️';
        if (fileType === 'application/pdf') return '📄';
        if (fileType.includes('word') || fileType.includes('document')) return '📝';
        if (fileType.includes('sheet') || fileType.includes('excel')) return '📊';
        if (fileType.includes('presentation') || fileType.includes('powerpoint')) return '📑';
        if (fileType.startsWith('video/')) return '🎬';
        if (fileType.startsWith('audio/')) return '🎵';
        if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('compressed')) return '📦';
        return '📁';
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const isImageType = (fileType: string) => fileType.startsWith('image/');
    const isPdfType = (fileType: string) => fileType === 'application/pdf';

    // --- Thread content parser & renderer ---

    const renderThreadedContent = (content: string) => {
        if (!content) return null;

        // Parse content into segments: direct text, quoted headers, and quoted lines
        const lines = content.split('\n');
        interface Segment {
            type: 'text' | 'header' | 'quoted' | 'forward-header';
            content: string;
            depth: number;
        }
        const segments: Segment[] = [];

        for (const line of lines) {
            // Check for forward tag
            const forwardMatch = line.match(/^\[Encaminhada\]\s*(.*)/);
            if (forwardMatch) {
                segments.push({ type: 'forward-header', content: forwardMatch[1] || '', depth: 0 });
                continue;
            }

            // Check for quoted header: --- Mensagem original de X em Y ---
            const headerMatch = line.match(/^---\s*Mensagem original de (.+?) em (.+?)\s*---$/);
            if (headerMatch) {
                segments.push({ type: 'header', content: `${headerMatch[1]} • ${headerMatch[2]}`, depth: 1 });
                continue;
            }

            // Check for quoted lines (count depth by leading > characters)
            const quoteMatch = line.match(/^((?:>\s*)+)(.*)/);
            if (quoteMatch) {
                const depth = (quoteMatch[1].match(/>/g) || []).length;
                const text = quoteMatch[2];

                // Check if this quoted line is itself a header
                const innerHeader = text.match(/^---\s*Mensagem original de (.+?) em (.+?)\s*---$/);
                if (innerHeader) {
                    segments.push({ type: 'header', content: `${innerHeader[1]} • ${innerHeader[2]}`, depth: depth + 1 });
                } else {
                    segments.push({ type: 'quoted', content: text, depth });
                }
                continue;
            }

            // Regular text
            segments.push({ type: 'text', content: line, depth: 0 });
        }

        // Group consecutive segments of the same type and depth
        interface Block {
            type: 'text' | 'header' | 'quoted' | 'forward-header';
            lines: string[];
            depth: number;
        }
        const blocks: Block[] = [];
        let currentBlock: Block | null = null;

        for (const seg of segments) {
            if (seg.type === 'header' || seg.type === 'forward-header') {
                // Headers are always their own block
                blocks.push({ type: seg.type, lines: [seg.content], depth: seg.depth });
                currentBlock = null;
            } else if (currentBlock && currentBlock.type === seg.type && currentBlock.depth === seg.depth) {
                currentBlock.lines.push(seg.content);
            } else {
                currentBlock = { type: seg.type, lines: [seg.content], depth: seg.depth };
                blocks.push(currentBlock);
            }
        }

        // Check if content has any thread structure
        const hasThreads = blocks.some(b => b.type !== 'text');

        if (!hasThreads) {
            return (
                <div className="card" style={{ marginBottom: 16 }}>
                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{content}</p>
                </div>
            );
        }

        return (
            <div className="thread-container" style={{ marginBottom: 16 }}>
                {blocks.map((block, i) => {
                    if (block.type === 'forward-header') {
                        return (
                            <div key={i} className="thread-forward-tag">
                                ↪️ Encaminhada
                            </div>
                        );
                    }
                    if (block.type === 'header') {
                        return (
                            <div key={i} className="thread-quote-header" style={{ marginLeft: Math.min((block.depth - 1) * 16, 48) }}>
                                <span className="thread-quote-icon">💬</span>
                                <span className="thread-quote-sender">{block.lines[0]}</span>
                            </div>
                        );
                    }
                    if (block.type === 'quoted') {
                        return (
                            <div key={i} className="thread-quoted-block" style={{ marginLeft: Math.min(block.depth * 16, 64) }}>
                                <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0 }}>
                                    {block.lines.join('\n')}
                                </p>
                            </div>
                        );
                    }
                    // text
                    const text = block.lines.join('\n').trim();
                    if (!text) return null;
                    return (
                        <div key={i} className="thread-direct-text">
                            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0 }}>
                                {text}
                            </p>
                        </div>
                    );
                })}
            </div>
        );
    };

    // --- Reply / Forward handlers ---

    const resetReplyForward = () => {
        setMode('view');
        setReplyText('');
        setReplyFiles([]);
        setFwdRecipientGroups([]);
        setFwdRecipientUserIds([]);
        setGroupMembers({});
        setSelectedMembers({});
    };

    const handleStartReply = () => {
        setMode('reply');
        setReplyText('');
        setReplyFiles([]);
    };

    const handleStartForward = () => {
        setMode('forward');
        setReplyText('');
        setReplyFiles([]);
        setFwdRecipientGroups([]);
        setFwdRecipientUserIds([]);
        setGroupMembers({});
        setSelectedMembers({});
    };

    const handleReplyFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const dropped = Array.from(e.dataTransfer.files);
        setReplyFiles(prev => [...prev, ...dropped]);
    };

    const handleReplyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setReplyFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeReplyFile = (index: number) => {
        setReplyFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Forward recipient management
    const fetchGroupMembers = React.useCallback(async (role: string) => {
        setLoadingMembers(prev => ({ ...prev, [role]: true }));
        try {
            const res = await api(`/api/users/by-role?roles=${role}`);
            const data = await res.json();
            if (data.success) {
                setGroupMembers(prev => ({ ...prev, [role]: data.data }));
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setSelectedMembers(prev => ({ ...prev, [role]: data.data.map((u: any) => u.id) }));
            }
        } catch { /* ignore */ }
        setLoadingMembers(prev => ({ ...prev, [role]: false }));
    }, [api]);

    const toggleFwdGroup = (group: string) => {
        const isRemoving = fwdRecipientGroups.includes(group);
        setFwdRecipientGroups(prev =>
            isRemoving ? prev.filter(g => g !== group) : [...prev, group]
        );
        if (isRemoving) {
            setGroupMembers(prev => { const n = { ...prev }; delete n[group]; return n; });
            setSelectedMembers(prev => { const n = { ...prev }; delete n[group]; return n; });
        } else {
            fetchGroupMembers(group);
        }
    };

    const toggleFwdMember = (group: string, userId: string) => {
        setSelectedMembers(prev => {
            const current = prev[group] || [];
            const updated = current.includes(userId)
                ? current.filter(id => id !== userId)
                : [...current, userId];
            return { ...prev, [group]: updated };
        });
    };

    const toggleFwdAllMembers = (group: string) => {
        const members = groupMembers[group] || [];
        const selected = selectedMembers[group] || [];
        const allSelected = selected.length === members.length;
        setSelectedMembers(prev => ({
            ...prev,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [group]: allSelected ? [] : members.map((m: any) => m.id),
        }));
    };

    const uploadFiles = async (filesToUpload: File[]): Promise<string[]> => {
        if (filesToUpload.length === 0) return [];
        setUploading(true);
        const formData = new FormData();
        filesToUpload.forEach(f => formData.append('files', f));
        const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('dfr-token')}` },
            body: formData,
        });
        const uploadData = await uploadRes.json();
        setUploading(false);
        if (!uploadData.success) {
            throw new Error(uploadData.error || 'Erro ao enviar arquivos');
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return uploadData.data.map((a: any) => a.id);
    };

    const buildQuotedContent = (originalMsg: typeof msg, newText: string) => {
        const senderName = originalMsg.remetente?.name || 'Desconhecido';
        const date = new Date(originalMsg.createdAt).toLocaleString('pt-BR');
        const originalContent = originalMsg.conteudo || '';
        const quotedLines = originalContent.split('\n').map((line: string) => `> ${line}`).join('\n');
        return `${newText}\n\n--- Mensagem original de ${senderName} em ${date} ---\n${quotedLines}`;
    };

    const handleSendReply = async () => {
        if (!replyText.trim()) {
            showToast('Digite uma resposta', 'error');
            return;
        }
        setSending(true);
        try {
            const attachmentIds = await uploadFiles(replyFiles);
            const content = buildQuotedContent(msg, replyText);
            const res = await api('/api/messages', {
                method: 'POST',
                body: JSON.stringify({
                    conteudo: content,
                    prioridade: msg.prioridade || 'NORMAL',
                    categoria: msg.categoria || 'ADMINISTRATIVO',
                    recipientUserIds: [msg.remetenteId],
                    recipientGroups: [],
                    attachmentIds,
                }),
            });
            const data = await res.json();
            if (data.success) {
                showToast('Resposta enviada com sucesso!', 'success');
                resetReplyForward();
                if (onMessageSent) onMessageSent();
            } else {
                showToast(data.error || 'Erro ao enviar resposta', 'error');
            }
        } catch {
            showToast('Erro ao enviar resposta', 'error');
        }
        setSending(false);
    };

    const handleSendForward = async () => {
        if (!replyText.trim()) {
            showToast('Digite um comentário para o encaminhamento', 'error');
            return;
        }

        // Build final recipient lists
        const finalGroups: string[] = [];
        const finalUserIds: string[] = [...fwdRecipientUserIds];
        for (const group of fwdRecipientGroups) {
            const members = groupMembers[group] || [];
            const selected = selectedMembers[group] || [];
            if (members.length === 0 || selected.length === members.length) {
                finalGroups.push(group);
            } else if (selected.length > 0) {
                for (const uid of selected) {
                    if (!finalUserIds.includes(uid)) finalUserIds.push(uid);
                }
            }
        }

        if (finalGroups.length === 0 && finalUserIds.length === 0) {
            showToast('Selecione pelo menos um destinatário', 'error');
            return;
        }

        setSending(true);
        try {
            const attachmentIds = await uploadFiles(replyFiles);
            const content = buildQuotedContent(msg, `[Encaminhada] ${replyText}`);
            const res = await api('/api/messages', {
                method: 'POST',
                body: JSON.stringify({
                    conteudo: content,
                    prioridade: msg.prioridade || 'NORMAL',
                    categoria: msg.categoria || 'ADMINISTRATIVO',
                    siso: msg.siso || '',
                    paciente: msg.paciente || '',
                    recipientGroups: finalGroups,
                    recipientUserIds: finalUserIds,
                    attachmentIds,
                }),
            });
            const data = await res.json();
            if (data.success) {
                showToast('Mensagem encaminhada com sucesso!', 'success');
                resetReplyForward();
                if (onMessageSent) onMessageSent();
            } else {
                showToast(data.error || 'Erro ao encaminhar', 'error');
            }
        } catch {
            showToast('Erro ao encaminhar mensagem', 'error');
        }
        setSending(false);
    };

    if (!msg) return null;

    const fileInputId = mode === 'reply' ? 'reply-file-input' : 'forward-file-input';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
                <div className="modal-header">
                    <h2 className="modal-title">Detalhes da Mensagem</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {canDelete && msg.status !== 'CANCELADA' && (
                            <button
                                className="btn btn-danger btn-sm"
                                onClick={() => setShowDeleteConfirm(true)}
                                title="Remover mensagem"
                            >
                                🗑️ Remover
                            </button>
                        )}
                        <button className="modal-close" onClick={onClose}>×</button>
                    </div>
                </div>
                <div className="modal-body">
                    {loading ? <div className="loading-spinner" /> : (
                        <>
                            {/* Delete Confirmation Dialog */}
                            {showDeleteConfirm && (
                                <div style={{
                                    background: 'var(--danger-bg)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: 'var(--radius)',
                                    padding: 16,
                                    marginBottom: 16,
                                    animation: 'fadeIn 0.2s ease',
                                }}>
                                    <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--danger)' }}>
                                        ⚠️ Confirmar Remoção
                                    </div>
                                    <div style={{ fontSize: 13, marginBottom: 12, color: 'var(--text-secondary)' }}>
                                        Esta ação irá cancelar a mensagem. Ela não será mais visível para os destinatários, mas permanecerá registrada no log de auditoria.
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
                                            {deleting ? '⏳ Removendo...' : '🗑️ Confirmar Remoção'}
                                        </button>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Cancelled message notice */}
                            {msg.status === 'CANCELADA' && (
                                <div style={{
                                    background: 'var(--danger-bg)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    borderRadius: 'var(--radius)',
                                    padding: 12,
                                    marginBottom: 16,
                                    fontSize: 13,
                                }}>
                                    <span style={{ color: 'var(--danger)', fontWeight: 700 }}>🚫 Mensagem Removida</span>
                                    {msg.cancelledBy && (
                                        <span style={{ color: 'var(--text-secondary)' }}> por {msg.cancelledBy.name}</span>
                                    )}
                                    {msg.cancelledAt && (
                                        <span style={{ color: 'var(--text-muted)' }}> em {new Date(msg.cancelledAt).toLocaleString('pt-BR')}</span>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                                <span className={`badge badge-${msg.prioridade === 'CRITICA' ? 'danger' : msg.prioridade === 'URGENTE' ? 'warning' : 'accent'}`}>{msg.prioridade}</span>
                                <span className="badge badge-accent">{msg.categoria}</span>
                                {msg.edited && <span className="badge badge-warning">ALTERADA</span>}
                                <span className={`badge badge-${msg.status === 'CANCELADA' ? 'danger' : 'neutral'}`}>{msg.status}</span>
                            </div>
                            <div style={{ marginBottom: 16, fontSize: 14, lineHeight: 1.8 }}>
                                <div><strong>De:</strong> {msg.remetente?.name} ({msg.remetente?.role})</div>
                                <div><strong>Data:</strong> {new Date(msg.createdAt).toLocaleString('pt-BR')}</div>
                                {msg.siso && <div><strong>SISO:</strong> {msg.siso}</div>}
                                {msg.paciente && <div><strong>Paciente:</strong> {msg.paciente}</div>}
                                {msg.dataConsulta && <div><strong>Data Consulta:</strong> {new Date(msg.dataConsulta).toLocaleDateString('pt-BR')}</div>}
                                {msg.dataLimite && <div><strong>Data Limite:</strong> {new Date(msg.dataLimite).toLocaleDateString('pt-BR')}</div>}
                            </div>
                            {renderThreadedContent(msg.conteudo)}

                            {/* Attachments Section */}
                            {msg.attachments?.length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                    <strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>📎 Anexos ({msg.attachments.length}):</strong>
                                    <div className="attachment-list">
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        {msg.attachments.map((att: any) => (
                                            <div
                                                key={att.id}
                                                className="attachment-item"
                                                onMouseEnter={(e) => handleAttachmentHover(e, att)}
                                                onMouseLeave={handleAttachmentLeave}
                                                onClick={() => handleDownload(att)}
                                            >
                                                <span className="attachment-icon">{getFileIcon(att.fileType)}</span>
                                                <span className="attachment-name">{att.fileName}</span>
                                                <span className="attachment-size">{formatFileSize(att.fileSize)}</span>
                                                <span className="attachment-download">⬇️</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Hover Preview Tooltip */}
                            {previewAttachment && (
                                <div
                                    className="attachment-preview-tooltip"
                                    style={{
                                        position: 'fixed',
                                        left: Math.min(previewPos.x, window.innerWidth - 340),
                                        top: Math.min(previewPos.y, window.innerHeight - 300),
                                    }}
                                >
                                    {isImageType(previewAttachment.fileType) ? (
                                        <img
                                            src={`/api/upload/${previewAttachment.id}?preview=true`}
                                            alt={previewAttachment.fileName}
                                            className="preview-image"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    ) : isPdfType(previewAttachment.fileType) ? (
                                        <div className="preview-file-info">
                                            <div className="preview-file-icon">📄</div>
                                            <div className="preview-file-name">{previewAttachment.fileName}</div>
                                            <div className="preview-file-detail">{formatFileSize(previewAttachment.fileSize)}</div>
                                            <div className="preview-file-detail">Clique para baixar</div>
                                        </div>
                                    ) : (
                                        <div className="preview-file-info">
                                            <div className="preview-file-icon">{getFileIcon(previewAttachment.fileType)}</div>
                                            <div className="preview-file-name">{previewAttachment.fileName}</div>
                                            <div className="preview-file-detail">{formatFileSize(previewAttachment.fileSize)}</div>
                                            <div className="preview-file-detail">Clique para baixar</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {msg.recipients?.length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                    <strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>📬 Status de Leitura:</strong>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        {msg.recipients.map((r: any) => (
                                            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                                                <span>{r.readAt ? '✅' : '⏳'}</span>
                                                <span style={{ flex: 1 }}>{r.user?.name || `Grupo: ${r.groupName}`}</span>
                                                {r.readAt && <span className="badge badge-success" style={{ fontSize: 10 }}>{new Date(r.readAt).toLocaleString('pt-BR')}</span>}
                                                {!r.readAt && <span className="badge badge-warning" style={{ fontSize: 10 }}>Não lida</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {msg.editHistory?.length > 0 && (
                                <div>
                                    <strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>📝 Histórico de Edições:</strong>
                                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                    {msg.editHistory.map((edit: any) => (
                                        <div key={edit.id} className="card" style={{ padding: 12, marginBottom: 8, fontSize: 13 }}>
                                            <div><strong>{edit.user?.name}</strong> — {new Date(edit.editedAt).toLocaleString('pt-BR')}</div>
                                            <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>Conteúdo anterior: {edit.previousContent?.substring(0, 150)}...</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Reply / Forward action buttons */}
                            {mode === 'view' && msg.status !== 'CANCELADA' && (
                                <div style={{
                                    display: 'flex',
                                    gap: 10,
                                    marginTop: 20,
                                    paddingTop: 16,
                                    borderTop: '1px solid var(--border)',
                                }}>
                                    <button className="btn btn-primary" onClick={handleStartReply} style={{ flex: 1 }}>
                                        ↩️ Responder
                                    </button>
                                    <button className="btn btn-secondary" onClick={handleStartForward} style={{ flex: 1 }}>
                                        ↪️ Encaminhar
                                    </button>
                                </div>
                            )}

                            {/* Reply Form */}
                            {mode === 'reply' && (
                                <div style={{
                                    marginTop: 20,
                                    paddingTop: 16,
                                    borderTop: '1px solid var(--border)',
                                    animation: 'fadeIn 0.2s ease',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <strong style={{ fontSize: 14, color: 'var(--primary)' }}>↩️ Responder para {msg.remetente?.name}</strong>
                                        <button className="btn btn-secondary btn-sm" onClick={resetReplyForward}>Cancelar</button>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: 12 }}>
                                        <textarea
                                            className="form-textarea"
                                            value={replyText}
                                            onChange={e => setReplyText(e.target.value)}
                                            placeholder="Digite sua resposta..."
                                            style={{ minHeight: 100 }}
                                            autoFocus
                                        />
                                    </div>

                                    {/* File upload for reply */}
                                    <div className="form-group" style={{ marginBottom: 12 }}>
                                        <label className="form-label" style={{ fontSize: 12 }}>📎 Anexos</label>
                                        <div
                                            className="file-upload-zone"
                                            style={{ padding: '12px 16px' }}
                                            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                                            onDragLeave={e => { e.currentTarget.classList.remove('drag-over'); }}
                                            onDrop={e => { e.currentTarget.classList.remove('drag-over'); handleReplyFileDrop(e); }}
                                            onClick={() => document.getElementById(fileInputId)?.click()}
                                        >
                                            <div className="file-upload-text" style={{ fontSize: 12 }}>Arraste arquivos ou clique para selecionar</div>
                                            <input
                                                id={fileInputId}
                                                type="file"
                                                multiple
                                                onChange={handleReplyFileSelect}
                                                style={{ display: 'none' }}
                                            />
                                        </div>
                                        {replyFiles.length > 0 && (
                                            <div className="file-list" style={{ marginTop: 8 }}>
                                                {replyFiles.map((f, i) => (
                                                    <div key={i} className="file-item">
                                                        <span className="file-item-icon">
                                                            {f.type.startsWith('image/') ? '🖼️' : f.type === 'application/pdf' ? '📄' : '📁'}
                                                        </span>
                                                        <span className="file-item-name">{f.name}</span>
                                                        <span className="file-item-size">{formatFileSize(f.size)}</span>
                                                        <button type="button" className="file-item-remove" onClick={(e) => { e.stopPropagation(); removeReplyFile(i); }}>✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        className="btn btn-primary"
                                        onClick={handleSendReply}
                                        disabled={sending || uploading}
                                        style={{ width: '100%' }}
                                    >
                                        {uploading ? '⏳ Enviando arquivos...' : sending ? '⏳ Enviando resposta...' : '📤 Enviar Resposta'}
                                    </button>
                                </div>
                            )}

                            {/* Forward Form */}
                            {mode === 'forward' && (
                                <div style={{
                                    marginTop: 20,
                                    paddingTop: 16,
                                    borderTop: '1px solid var(--border)',
                                    animation: 'fadeIn 0.2s ease',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <strong style={{ fontSize: 14, color: 'var(--primary)' }}>↪️ Encaminhar Mensagem</strong>
                                        <button className="btn btn-secondary btn-sm" onClick={resetReplyForward}>Cancelar</button>
                                    </div>

                                    {/* Recipient groups */}
                                    <div className="form-group" style={{ marginBottom: 12 }}>
                                        <label className="form-label" style={{ fontSize: 12 }}>Destinatários (grupos)</label>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {ROLES.map(role => (
                                                <button
                                                    type="button"
                                                    key={role}
                                                    className={`badge badge-${fwdRecipientGroups.includes(role) ? 'accent' : 'neutral'}`}
                                                    style={{ cursor: 'pointer', padding: '5px 12px', fontSize: 11 }}
                                                    onClick={() => toggleFwdGroup(role)}
                                                >
                                                    {ROLE_LABELS[role]}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Member selection for each selected group */}
                                        {fwdRecipientGroups.map(group => (
                                            <div key={group} className="member-select-panel" style={{ marginTop: 8 }}>
                                                <div className="member-select-header">
                                                    <span className="member-select-title" style={{ fontSize: 12 }}>👥 {ROLE_LABELS[group as keyof typeof ROLE_LABELS] || group}</span>
                                                    {(groupMembers[group]?.length || 0) > 0 && (
                                                        <button type="button" className="member-select-toggle" onClick={() => toggleFwdAllMembers(group)}>
                                                            {(selectedMembers[group]?.length || 0) === (groupMembers[group]?.length || 0) ? 'Desmarcar todos' : 'Selecionar todos'}
                                                        </button>
                                                    )}
                                                </div>
                                                {loadingMembers[group] ? (
                                                    <div style={{ padding: '6px 0', fontSize: 12, color: 'var(--text-muted)' }}>Carregando...</div>
                                                ) : (groupMembers[group]?.length || 0) === 0 ? (
                                                    <div style={{ padding: '6px 0', fontSize: 12, color: 'var(--text-muted)' }}>Nenhum membro ativo</div>
                                                ) : (
                                                    <div className="member-checkbox-list">
                                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                        {groupMembers[group].map((member: any) => (
                                                            <label key={member.id} className="member-checkbox">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={(selectedMembers[group] || []).includes(member.id)}
                                                                    onChange={() => toggleFwdMember(group, member.id)}
                                                                />
                                                                <span className="member-checkbox-name">{member.name}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                                {(groupMembers[group]?.length || 0) > 0 && (
                                                    <div className="member-select-count" style={{ fontSize: 11 }}>
                                                        {(selectedMembers[group]?.length || 0)} de {groupMembers[group]?.length || 0} selecionados
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Comment */}
                                    <div className="form-group" style={{ marginBottom: 12 }}>
                                        <label className="form-label" style={{ fontSize: 12 }}>Comentário</label>
                                        <textarea
                                            className="form-textarea"
                                            value={replyText}
                                            onChange={e => setReplyText(e.target.value)}
                                            placeholder="Adicione um comentário ao encaminhamento..."
                                            style={{ minHeight: 80 }}
                                            autoFocus
                                        />
                                    </div>

                                    {/* File upload for forward */}
                                    <div className="form-group" style={{ marginBottom: 12 }}>
                                        <label className="form-label" style={{ fontSize: 12 }}>📎 Anexos</label>
                                        <div
                                            className="file-upload-zone"
                                            style={{ padding: '12px 16px' }}
                                            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                                            onDragLeave={e => { e.currentTarget.classList.remove('drag-over'); }}
                                            onDrop={e => { e.currentTarget.classList.remove('drag-over'); handleReplyFileDrop(e); }}
                                            onClick={() => document.getElementById(fileInputId)?.click()}
                                        >
                                            <div className="file-upload-text" style={{ fontSize: 12 }}>Arraste arquivos ou clique para selecionar</div>
                                            <input
                                                id={fileInputId}
                                                type="file"
                                                multiple
                                                onChange={handleReplyFileSelect}
                                                style={{ display: 'none' }}
                                            />
                                        </div>
                                        {replyFiles.length > 0 && (
                                            <div className="file-list" style={{ marginTop: 8 }}>
                                                {replyFiles.map((f, i) => (
                                                    <div key={i} className="file-item">
                                                        <span className="file-item-icon">
                                                            {f.type.startsWith('image/') ? '🖼️' : f.type === 'application/pdf' ? '📄' : '📁'}
                                                        </span>
                                                        <span className="file-item-name">{f.name}</span>
                                                        <span className="file-item-size">{formatFileSize(f.size)}</span>
                                                        <button type="button" className="file-item-remove" onClick={(e) => { e.stopPropagation(); removeReplyFile(i); }}>✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        className="btn btn-primary"
                                        onClick={handleSendForward}
                                        disabled={sending || uploading}
                                        style={{ width: '100%' }}
                                    >
                                        {uploading ? '⏳ Enviando arquivos...' : sending ? '⏳ Encaminhando...' : '↪️ Encaminhar Mensagem'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
