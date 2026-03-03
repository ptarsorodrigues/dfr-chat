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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [thread, setThread] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [groupMembers, setGroupMembers] = React.useState<Record<string, any[]>>({});
    const [selectedMembers, setSelectedMembers] = React.useState<Record<string, string[]>>({});
    const [loadingMembers, setLoadingMembers] = React.useState<Record<string, boolean>>({});

    // Expanded thread message
    const [expandedId, setExpandedId] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!message?.id) return;
        (async () => {
            try {
                const res = await api(`/api/messages/${message.id}`);
                const data = await res.json();
                if (data.success) {
                    setMsg(data.data);
                    setThread(data.thread || []);
                    if (onRead) onRead();
                }
            } catch { /* ignore */ }
            setLoading(false);
        })();
    }, [message?.id, api, onRead]);

    const canDelete = React.useMemo(() => {
        if (!msg || !user) return false;
        return msg.remetenteId === user.id || user.role === 'ADMINISTRADOR' || user.role === 'DIRETORIA';
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
        if (fileType.startsWith('video/')) return '🎬';
        if (fileType.startsWith('audio/')) return '🎵';
        return '📁';
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    // --- Reply / Forward handlers ---

    const resetReplyForward = () => {
        setMode('view');
        setReplyText('');
        setReplyFiles([]);
        setFwdRecipientGroups([]);
        setGroupMembers({});
        setSelectedMembers({});
    };

    const handleReplyFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setReplyFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    };

    const handleReplyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setReplyFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    };

    const removeReplyFile = (index: number) => setReplyFiles(prev => prev.filter((_, i) => i !== index));

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
        setFwdRecipientGroups(prev => isRemoving ? prev.filter(g => g !== group) : [...prev, group]);
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
            return { ...prev, [group]: current.includes(userId) ? current.filter(id => id !== userId) : [...current, userId] };
        });
    };

    const toggleFwdAllMembers = (group: string) => {
        const members = groupMembers[group] || [];
        const selected = selectedMembers[group] || [];
        setSelectedMembers(prev => ({
            ...prev,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [group]: selected.length === members.length ? [] : members.map((m: any) => m.id),
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
        if (!uploadData.success) throw new Error(uploadData.error || 'Erro ao enviar arquivos');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return uploadData.data.map((a: any) => a.id);
    };

    const handleSendReply = async () => {
        if (!replyText.trim()) { showToast('Digite uma resposta', 'error'); return; }
        setSending(true);
        try {
            const attachmentIds = await uploadFiles(replyFiles);
            const res = await api('/api/messages', {
                method: 'POST',
                body: JSON.stringify({
                    conteudo: replyText,
                    prioridade: msg.prioridade || 'NORMAL',
                    categoria: msg.categoria || 'ADMINISTRATIVO',
                    tipo: 'RESPOSTA',
                    parentMessageId: msg.id,
                    recipientUserIds: [msg.remetenteId],
                    recipientGroups: [],
                    attachmentIds,
                }),
            });
            const data = await res.json();
            if (data.success) {
                showToast('Resposta enviada!', 'success');
                resetReplyForward();
                // Reload thread
                const res2 = await api(`/api/messages/${message.id}`);
                const data2 = await res2.json();
                if (data2.success) { setMsg(data2.data); setThread(data2.thread || []); }
                if (onMessageSent) onMessageSent();
            } else {
                showToast(data.error || 'Erro ao enviar resposta', 'error');
            }
        } catch { showToast('Erro ao enviar resposta', 'error'); }
        setSending(false);
    };

    const handleSendForward = async () => {
        if (!replyText.trim()) { showToast('Digite um comentário', 'error'); return; }
        const finalGroups: string[] = [];
        const finalUserIds: string[] = [];
        for (const group of fwdRecipientGroups) {
            const members = groupMembers[group] || [];
            const selected = selectedMembers[group] || [];
            if (members.length === 0 || selected.length === members.length) {
                finalGroups.push(group);
            } else if (selected.length > 0) {
                for (const uid of selected) { if (!finalUserIds.includes(uid)) finalUserIds.push(uid); }
            }
        }
        if (finalGroups.length === 0 && finalUserIds.length === 0) { showToast('Selecione destinatários', 'error'); return; }
        setSending(true);
        try {
            const attachmentIds = await uploadFiles(replyFiles);
            const res = await api('/api/messages', {
                method: 'POST',
                body: JSON.stringify({
                    conteudo: replyText,
                    prioridade: msg.prioridade || 'NORMAL',
                    categoria: msg.categoria || 'ADMINISTRATIVO',
                    tipo: 'ENCAMINHAMENTO',
                    parentMessageId: msg.id,
                    siso: msg.siso || '',
                    paciente: msg.paciente || '',
                    recipientGroups: finalGroups,
                    recipientUserIds: finalUserIds,
                    attachmentIds,
                }),
            });
            const data = await res.json();
            if (data.success) {
                showToast('Mensagem encaminhada!', 'success');
                resetReplyForward();
                const res2 = await api(`/api/messages/${message.id}`);
                const data2 = await res2.json();
                if (data2.success) { setMsg(data2.data); setThread(data2.thread || []); }
                if (onMessageSent) onMessageSent();
            } else {
                showToast(data.error || 'Erro ao encaminhar', 'error');
            }
        } catch { showToast('Erro ao encaminhar', 'error'); }
        setSending(false);
    };

    if (!msg) return null;

    const fileInputId = mode === 'reply' ? 'reply-file-input' : 'forward-file-input';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getTipoLabel = (tipo: string) => {
        if (tipo === 'RESPOSTA') return { icon: '↩️', label: 'Resposta', cls: 'thread-tipo-reply' };
        if (tipo === 'ENCAMINHAMENTO') return { icon: '↪️', label: 'Encaminhada', cls: 'thread-tipo-forward' };
        return { icon: '✉️', label: 'Original', cls: 'thread-tipo-original' };
    };

    const hasThread = thread.length > 1;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 750 }}>
                <div className="modal-header">
                    <h2 className="modal-title">
                        {hasThread ? `💬 Conversa (${thread.length})` : 'Detalhes da Mensagem'}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {canDelete && msg.status !== 'CANCELADA' && (
                            <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteConfirm(true)} title="Remover mensagem">
                                🗑️
                            </button>
                        )}
                        <button className="modal-close" onClick={onClose}>×</button>
                    </div>
                </div>
                <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                    {loading ? <div className="loading-spinner" /> : (
                        <>
                            {/* Delete Confirmation */}
                            {showDeleteConfirm && (
                                <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
                                    <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--danger)' }}>⚠️ Confirmar Remoção</div>
                                    <div style={{ fontSize: 13, marginBottom: 12, color: 'var(--text-secondary)' }}>A mensagem será cancelada e não ficará mais visível.</div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
                                            {deleting ? '⏳...' : '🗑️ Confirmar'}
                                        </button>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Cancelar</button>
                                    </div>
                                </div>
                            )}

                            {/* Thread Timeline */}
                            <div className="thread-timeline">
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {(hasThread ? thread : [msg]).map((m: any, idx: number) => {
                                    const tipo = getTipoLabel(m.tipo || 'ORIGINAL');
                                    const isCurrentMsg = m.id === msg.id;
                                    const isExpanded = expandedId === m.id || isCurrentMsg || !hasThread;
                                    const isCancelled = m.status === 'CANCELADA';

                                    return (
                                        <div
                                            key={m.id}
                                            className={`thread-message ${isCurrentMsg ? 'thread-message-active' : ''} ${isCancelled ? 'thread-message-cancelled' : ''}`}
                                            onClick={() => { if (hasThread && !isCurrentMsg) setExpandedId(expandedId === m.id ? null : m.id); }}
                                            style={{ cursor: hasThread && !isCurrentMsg ? 'pointer' : 'default' }}
                                        >
                                            {/* Thread line connector */}
                                            {hasThread && idx > 0 && (
                                                <div className="thread-connector" />
                                            )}

                                            {/* Header row */}
                                            <div className="thread-msg-header">
                                                <div className="thread-msg-avatar">{m.remetente?.name?.charAt(0)}</div>
                                                <div className="thread-msg-info">
                                                    <div className="thread-msg-sender">
                                                        {m.remetente?.name}
                                                        <span className={`thread-tipo-badge ${tipo.cls}`}>{tipo.icon} {tipo.label}</span>
                                                    </div>
                                                    <div className="thread-msg-time">
                                                        {new Date(m.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                        {m.remetente?.role && <span> • {m.remetente.role}</span>}
                                                    </div>
                                                </div>
                                                {hasThread && !isCurrentMsg && (
                                                    <span className="thread-expand-icon">{isExpanded ? '▼' : '▶'}</span>
                                                )}
                                            </div>

                                            {/* Content — always visible for current, toggleable for others */}
                                            {isExpanded && (
                                                <div className="thread-msg-body">
                                                    {isCancelled && (
                                                        <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8, fontWeight: 600 }}>🚫 Mensagem Removida</div>
                                                    )}
                                                    <p className="thread-msg-content">{m.conteudo}</p>

                                                    {/* Attachments inline */}
                                                    {m.attachments?.length > 0 && (
                                                        <div className="thread-msg-attachments">
                                                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                            {m.attachments.map((att: any) => (
                                                                <button key={att.id} className="thread-attachment-chip" onClick={(e) => { e.stopPropagation(); handleDownload(att); }}>
                                                                    {getFileIcon(att.fileType)} {att.fileName} <span className="thread-att-size">({formatFileSize(att.fileSize)})</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Extra details only for the main message */}
                                                    {isCurrentMsg && (
                                                        <>
                                                            {(msg.siso || msg.paciente || msg.dataConsulta || msg.dataLimite) && (
                                                                <div className="thread-msg-meta-details">
                                                                    {msg.siso && <span>📋 SISO: {msg.siso}</span>}
                                                                    {msg.paciente && <span>🦷 {msg.paciente}</span>}
                                                                    {msg.dataConsulta && <span>📅 Consulta: {new Date(msg.dataConsulta).toLocaleDateString('pt-BR')}</span>}
                                                                    {msg.dataLimite && <span>⏰ Limite: {new Date(msg.dataLimite).toLocaleDateString('pt-BR')}</span>}
                                                                </div>
                                                            )}
                                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                                                                <span className={`badge badge-${msg.prioridade === 'CRITICA' ? 'danger' : msg.prioridade === 'URGENTE' ? 'warning' : 'accent'}`}>{msg.prioridade}</span>
                                                                <span className="badge badge-accent">{msg.categoria}</span>
                                                                {msg.edited && <span className="badge badge-warning">ALTERADA</span>}
                                                            </div>

                                                            {/* Read status */}
                                                            {msg.recipients?.length > 0 && (
                                                                <div style={{ marginTop: 12 }}>
                                                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>📬 Leitura:</div>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                                        {msg.recipients.map((r: any) => (
                                                                            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 6px', background: 'var(--bg-tertiary)', borderRadius: 4 }}>
                                                                                <span>{r.readAt ? '✅' : '⏳'}</span>
                                                                                <span style={{ flex: 1 }}>{r.user?.name || `Grupo: ${r.groupName}`}</span>
                                                                                {r.readAt && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(r.readAt).toLocaleString('pt-BR')}</span>}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {/* Preview when collapsed */}
                                            {!isExpanded && (
                                                <div className="thread-msg-preview">
                                                    {m.conteudo?.substring(0, 100)}{m.conteudo?.length > 100 ? '...' : ''}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Reply / Forward buttons */}
                            {mode === 'view' && msg.status !== 'CANCELADA' && (
                                <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                                    <button className="btn btn-primary" onClick={() => { setMode('reply'); setReplyText(''); setReplyFiles([]); }} style={{ flex: 1 }}>↩️ Responder</button>
                                    <button className="btn btn-secondary" onClick={() => { setMode('forward'); setReplyText(''); setReplyFiles([]); setFwdRecipientGroups([]); setGroupMembers({}); setSelectedMembers({}); }} style={{ flex: 1 }}>↪️ Encaminhar</button>
                                </div>
                            )}

                            {/* Reply Form */}
                            {mode === 'reply' && (
                                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', animation: 'fadeIn 0.2s ease' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <strong style={{ fontSize: 13, color: 'var(--primary)' }}>↩️ Responder para {msg.remetente?.name}</strong>
                                        <button className="btn btn-secondary btn-sm" onClick={resetReplyForward}>Cancelar</button>
                                    </div>
                                    <textarea className="form-textarea" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Digite sua resposta..." style={{ minHeight: 80 }} autoFocus />
                                    <div className="form-group" style={{ marginTop: 8, marginBottom: 8 }}>
                                        <div className="file-upload-zone" style={{ padding: '10px 14px' }}
                                            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                                            onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
                                            onDrop={e => { e.currentTarget.classList.remove('drag-over'); handleReplyFileDrop(e); }}
                                            onClick={() => document.getElementById(fileInputId)?.click()}>
                                            <div className="file-upload-text" style={{ fontSize: 12 }}>📎 Anexar arquivos</div>
                                            <input id={fileInputId} type="file" multiple onChange={handleReplyFileSelect} style={{ display: 'none' }} />
                                        </div>
                                        {replyFiles.length > 0 && (
                                            <div className="file-list" style={{ marginTop: 6 }}>
                                                {replyFiles.map((f, i) => (
                                                    <div key={i} className="file-item">
                                                        <span className="file-item-icon">{f.type.startsWith('image/') ? '🖼️' : '📁'}</span>
                                                        <span className="file-item-name">{f.name}</span>
                                                        <span className="file-item-size">{formatFileSize(f.size)}</span>
                                                        <button type="button" className="file-item-remove" onClick={e => { e.stopPropagation(); removeReplyFile(i); }}>✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button className="btn btn-primary" onClick={handleSendReply} disabled={sending || uploading} style={{ width: '100%' }}>
                                        {uploading ? '⏳ Enviando arquivos...' : sending ? '⏳ Enviando...' : '📤 Enviar Resposta'}
                                    </button>
                                </div>
                            )}

                            {/* Forward Form */}
                            {mode === 'forward' && (
                                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', animation: 'fadeIn 0.2s ease' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <strong style={{ fontSize: 13, color: 'var(--primary)' }}>↪️ Encaminhar Mensagem</strong>
                                        <button className="btn btn-secondary btn-sm" onClick={resetReplyForward}>Cancelar</button>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 10 }}>
                                        <label className="form-label" style={{ fontSize: 12 }}>Destinatários</label>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {ROLES.map(role => (
                                                <button type="button" key={role} className={`badge badge-${fwdRecipientGroups.includes(role) ? 'accent' : 'neutral'}`}
                                                    style={{ cursor: 'pointer', padding: '5px 12px', fontSize: 11 }} onClick={() => toggleFwdGroup(role)}>
                                                    {ROLE_LABELS[role]}
                                                </button>
                                            ))}
                                        </div>
                                        {fwdRecipientGroups.map(group => (
                                            <div key={group} className="member-select-panel" style={{ marginTop: 8 }}>
                                                <div className="member-select-header">
                                                    <span className="member-select-title" style={{ fontSize: 12 }}>👥 {ROLE_LABELS[group as keyof typeof ROLE_LABELS] || group}</span>
                                                    {(groupMembers[group]?.length || 0) > 0 && (
                                                        <button type="button" className="member-select-toggle" onClick={() => toggleFwdAllMembers(group)}>
                                                            {(selectedMembers[group]?.length || 0) === (groupMembers[group]?.length || 0) ? 'Desmarcar' : 'Todos'}
                                                        </button>
                                                    )}
                                                </div>
                                                {loadingMembers[group] ? (
                                                    <div style={{ padding: 6, fontSize: 12, color: 'var(--text-muted)' }}>Carregando...</div>
                                                ) : (
                                                    <div className="member-checkbox-list">
                                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                        {(groupMembers[group] || []).map((member: any) => (
                                                            <label key={member.id} className="member-checkbox">
                                                                <input type="checkbox" checked={(selectedMembers[group] || []).includes(member.id)} onChange={() => toggleFwdMember(group, member.id)} />
                                                                <span className="member-checkbox-name">{member.name}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <textarea className="form-textarea" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Comentário..." style={{ minHeight: 60 }} autoFocus />
                                    <div className="form-group" style={{ marginTop: 8, marginBottom: 8 }}>
                                        <div className="file-upload-zone" style={{ padding: '10px 14px' }}
                                            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                                            onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
                                            onDrop={e => { e.currentTarget.classList.remove('drag-over'); handleReplyFileDrop(e); }}
                                            onClick={() => document.getElementById(fileInputId)?.click()}>
                                            <div className="file-upload-text" style={{ fontSize: 12 }}>📎 Anexar arquivos</div>
                                            <input id={fileInputId} type="file" multiple onChange={handleReplyFileSelect} style={{ display: 'none' }} />
                                        </div>
                                        {replyFiles.length > 0 && (
                                            <div className="file-list" style={{ marginTop: 6 }}>
                                                {replyFiles.map((f, i) => (
                                                    <div key={i} className="file-item">
                                                        <span className="file-item-icon">{f.type.startsWith('image/') ? '🖼️' : '📁'}</span>
                                                        <span className="file-item-name">{f.name}</span>
                                                        <span className="file-item-size">{formatFileSize(f.size)}</span>
                                                        <button type="button" className="file-item-remove" onClick={e => { e.stopPropagation(); removeReplyFile(i); }}>✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button className="btn btn-primary" onClick={handleSendForward} disabled={sending || uploading} style={{ width: '100%' }}>
                                        {uploading ? '⏳ Enviando...' : sending ? '⏳ Encaminhando...' : '↪️ Encaminhar'}
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
