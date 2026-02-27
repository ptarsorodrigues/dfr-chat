'use client';
import React from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function MessageDetailModal({ message, onClose, api, onRead }: { message: any; onClose: () => void; api: (url: string, options?: RequestInit) => Promise<Response>; onRead?: () => void }) {
    const [msg, setMsg] = React.useState(message);
    const [loading, setLoading] = React.useState(!message?.editHistory);
    const [previewAttachment, setPreviewAttachment] = React.useState<{ id: string; fileName: string; fileType: string; fileSize: number } | null>(null);
    const [previewPos, setPreviewPos] = React.useState({ x: 0, y: 0 });

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
        const token = localStorage.getItem('token');
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

    if (!msg) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
                <div className="modal-header">
                    <h2 className="modal-title">Detalhes da Mensagem</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    {loading ? <div className="loading-spinner" /> : (
                        <>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                                <span className={`badge badge-${msg.prioridade === 'CRITICA' ? 'danger' : msg.prioridade === 'URGENTE' ? 'warning' : 'accent'}`}>{msg.prioridade}</span>
                                <span className="badge badge-accent">{msg.categoria}</span>
                                {msg.edited && <span className="badge badge-warning">ALTERADA</span>}
                                <span className="badge badge-neutral">{msg.status}</span>
                            </div>
                            <div style={{ marginBottom: 16, fontSize: 14, lineHeight: 1.8 }}>
                                <div><strong>De:</strong> {msg.remetente?.name} ({msg.remetente?.role})</div>
                                <div><strong>Data:</strong> {new Date(msg.createdAt).toLocaleString('pt-BR')}</div>
                                {msg.siso && <div><strong>SISO:</strong> {msg.siso}</div>}
                                {msg.paciente && <div><strong>Paciente:</strong> {msg.paciente}</div>}
                                {msg.dataConsulta && <div><strong>Data Consulta:</strong> {new Date(msg.dataConsulta).toLocaleDateString('pt-BR')}</div>}
                                {msg.dataLimite && <div><strong>Data Limite:</strong> {new Date(msg.dataLimite).toLocaleDateString('pt-BR')}</div>}
                            </div>
                            <div className="card" style={{ marginBottom: 16 }}>
                                <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{msg.conteudo}</p>
                            </div>

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
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
