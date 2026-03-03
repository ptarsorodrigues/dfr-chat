'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/lib/ToastContext';
import { ROLES, ROLE_LABELS } from '@/types';
import MessageDetailModal from './MessageDetailModal';
import DatePicker from './DatePicker';

function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function MessagesPage() {
    const { api, user } = useAuth();
    const { showToast } = useToast();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [messages, setMessages] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'received' | 'sent'>('received');
    const [showCompose, setShowCompose] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [viewMsg, setViewMsg] = useState<any>(null);
    const [filters, setFilters] = useState({ search: '', prioridade: '', categoria: '', siso: '', paciente: '' });

    // File upload state
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);

    // Group member selection state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [groupMembers, setGroupMembers] = useState<Record<string, any[]>>({});
    const [selectedMembers, setSelectedMembers] = useState<Record<string, string[]>>({});
    const [loadingMembers, setLoadingMembers] = useState<Record<string, boolean>>({});

    // Compose state — date fields default to today
    const [form, setForm] = useState({
        conteudo: '', siso: '', paciente: '', dentistaId: '', dataConsulta: getTodayStr(), dataLimite: getTodayStr(),
        prioridade: 'NORMAL', categoria: 'ADMINISTRATIVO', recipientGroups: [] as string[], recipientUserIds: [] as string[],
    });

    const fetchMessages = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (tab === 'sent') params.set('sent', 'true');
            if (filters.search) params.set('search', filters.search);
            if (filters.prioridade) params.set('prioridade', filters.prioridade);
            if (filters.categoria) params.set('categoria', filters.categoria);
            if (filters.siso) params.set('siso', filters.siso);
            if (filters.paciente) params.set('paciente', filters.paciente);
            const res = await api(`/api/messages?${params}`);
            const data = await res.json();
            if (data.success) setMessages(data.data.messages);
        } catch { /* ignore */ }
        setLoading(false);
    }, [api, tab, filters]);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await api('/api/users');
            const data = await res.json();
            if (data.success) setUsers(data.data);
        } catch { /* ignore */ }
    }, [api]);

    useEffect(() => { fetchMessages(); }, [fetchMessages]);
    useEffect(() => { if (user?.role === 'ADMINISTRADOR') fetchUsers(); }, [fetchUsers, user]);

    // Fetch members when a group is selected
    const fetchGroupMembers = useCallback(async (role: string) => {
        setLoadingMembers(prev => ({ ...prev, [role]: true }));
        try {
            const res = await api(`/api/users/by-role?roles=${role}`);
            const data = await res.json();
            if (data.success) {
                setGroupMembers(prev => ({ ...prev, [role]: data.data }));
                // Default: all members selected
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setSelectedMembers(prev => ({ ...prev, [role]: data.data.map((u: any) => u.id) }));
            } else {
                showToast(data.error || 'Erro ao buscar membros do grupo', 'error');
            }
        } catch {
            showToast('Erro ao buscar membros do grupo', 'error');
        }
        setLoadingMembers(prev => ({ ...prev, [role]: false }));
    }, [api, showToast]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            let attachmentIds: string[] = [];

            // Upload files first if any
            if (files.length > 0) {
                setUploading(true);
                const formData = new FormData();
                files.forEach(f => formData.append('files', f));

                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('dfr-token')}`,
                    },
                    body: formData,
                });
                const uploadData = await uploadRes.json();
                setUploading(false);

                if (!uploadData.success) {
                    showToast(uploadData.error || 'Erro ao enviar arquivos', 'error');
                    return;
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                attachmentIds = uploadData.data.map((a: any) => a.id);
            }

            // Build final recipient lists based on member selections
            const finalGroups: string[] = [];
            const finalUserIds: string[] = [...form.recipientUserIds];

            for (const group of form.recipientGroups) {
                const members = groupMembers[group] || [];
                const selected = selectedMembers[group] || [];

                if (members.length === 0 || selected.length === members.length) {
                    // All selected or no members loaded → send to entire group
                    finalGroups.push(group);
                } else if (selected.length > 0) {
                    // Specific members selected → send to individual users
                    for (const uid of selected) {
                        if (!finalUserIds.includes(uid)) {
                            finalUserIds.push(uid);
                        }
                    }
                }
                // If selected.length === 0, skip this group entirely
            }

            const sendForm = { ...form, recipientGroups: finalGroups, recipientUserIds: finalUserIds };

            const res = await api('/api/messages', {
                method: 'POST',
                body: JSON.stringify({ ...sendForm, attachmentIds }),
            });
            const data = await res.json();
            if (data.success) {
                showToast('Mensagem enviada!', 'success');
                setShowCompose(false);
                setForm({ conteudo: '', siso: '', paciente: '', dentistaId: '', dataConsulta: getTodayStr(), dataLimite: getTodayStr(), prioridade: 'NORMAL', categoria: 'ADMINISTRATIVO', recipientGroups: [], recipientUserIds: [] });
                setFiles([]);
                setGroupMembers({});
                setSelectedMembers({});
                fetchMessages();
            } else showToast(data.error, 'error');
        } catch { showToast('Erro ao enviar', 'error'); }
    };

    const openMessage = (msg: unknown) => {
        setViewMsg(msg);
    };

    const toggleGroup = (group: string) => {
        const isRemoving = form.recipientGroups.includes(group);
        setForm(f => ({
            ...f,
            recipientGroups: isRemoving
                ? f.recipientGroups.filter(g => g !== group)
                : [...f.recipientGroups, group],
        }));
        if (isRemoving) {
            // Clean up member data for this group
            setGroupMembers(prev => { const n = { ...prev }; delete n[group]; return n; });
            setSelectedMembers(prev => { const n = { ...prev }; delete n[group]; return n; });
        } else {
            // Fetch members for the newly selected group
            fetchGroupMembers(group);
        }
    };

    const toggleMember = (group: string, userId: string) => {
        setSelectedMembers(prev => {
            const current = prev[group] || [];
            const updated = current.includes(userId)
                ? current.filter(id => id !== userId)
                : [...current, userId];
            return { ...prev, [group]: updated };
        });
    };

    const toggleAllMembers = (group: string) => {
        const members = groupMembers[group] || [];
        const selected = selectedMembers[group] || [];
        const allSelected = selected.length === members.length;
        setSelectedMembers(prev => ({
            ...prev,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [group]: allSelected ? [] : members.map((m: any) => m.id),
        }));
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const dropped = Array.from(e.dataTransfer.files);
        setFiles(prev => [...prev, ...dropped]);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>Mensagens</h1>
                    <div className="header-subtitle">Comunicação interna da clínica</div>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCompose(true)}>✉️ Nova Mensagem</button>
            </div>

            <div className="tabs">
                <button className={`tab ${tab === 'received' ? 'active' : ''}`} onClick={() => setTab('received')}>📥 Recebidas</button>
                <button className={`tab ${tab === 'sent' ? 'active' : ''}`} onClick={() => setTab('sent')}>📤 Enviadas</button>
            </div>

            <div className="filter-bar">
                <input className="form-input" placeholder="🔍 Buscar..." value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
                <select className="form-select" value={filters.prioridade} onChange={e => setFilters(f => ({ ...f, prioridade: e.target.value }))}>
                    <option value="">Prioridade</option>
                    <option value="NORMAL">Normal</option>
                    <option value="URGENTE">Importante</option>
                    <option value="CRITICA">Crítica</option>
                </select>
                <select className="form-select" value={filters.categoria} onChange={e => setFilters(f => ({ ...f, categoria: e.target.value }))}>
                    <option value="">Categoria</option>
                    <option value="CLINICO">Clínico</option>
                    <option value="ADMINISTRATIVO">Administrativo</option>
                    <option value="FINANCEIRO">Financeiro</option>
                </select>
                <input className="form-input" placeholder="SISO" value={filters.siso} onChange={e => setFilters(f => ({ ...f, siso: e.target.value }))} style={{ maxWidth: 120 }} />
                <input className="form-input" placeholder="Paciente" value={filters.paciente} onChange={e => setFilters(f => ({ ...f, paciente: e.target.value }))} style={{ maxWidth: 160 }} />
            </div>

            {loading ? <div className="loading-overlay"><div className="loading-spinner" /></div> : messages.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">📭</div><h3>Nenhuma mensagem</h3><p>Não há mensagens para exibir</p></div>
            ) : (
                <div className="message-list">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {messages.map((msg: any) => {
                        const isUnread = msg.recipients?.some((r: { userId: string | undefined; groupName: string | undefined; readAt: null }) => (r.userId === user?.id || r.groupName === user?.role) && r.readAt === null);
                        const prioClass = msg.prioridade === 'CRITICA' ? 'critical' : msg.prioridade === 'URGENTE' ? 'urgent' : '';
                        return (
                            <div key={msg.id} className={`message-card ${isUnread ? 'unread' : ''} ${prioClass} ${msg.edited ? 'edited' : ''}`} onClick={() => openMessage(msg)} style={{ cursor: 'pointer' }}>
                                <div className="message-avatar">{msg.remetente?.name?.charAt(0)}</div>
                                <div className="message-content">
                                    <div className="message-header">
                                        <span className="message-sender">{msg.remetente?.name} <span className={`badge-role badge-${msg.remetente?.role}`}>{msg.remetente?.role}</span></span>
                                        <span className="message-time">{new Date(msg.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="message-preview">{msg.conteudo?.substring(0, 120)}</div>
                                    <div className="message-meta">
                                        <span className={`badge badge-${msg.prioridade === 'CRITICA' ? 'danger' : msg.prioridade === 'URGENTE' ? 'warning' : 'neutral'}`}>{msg.prioridade}</span>
                                        <span className="badge badge-accent">{msg.categoria}</span>
                                        {msg.paciente && <span className="badge badge-neutral">🦷 {msg.paciente}</span>}
                                        {msg.siso && <span className="badge badge-neutral">📋 {msg.siso}</span>}
                                        {msg.attachments?.length > 0 && <span className="badge badge-neutral">📎 {msg.attachments.length}</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Compose Modal */}
            {showCompose && (
                <div className="modal-overlay" onClick={() => setShowCompose(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">✉️ Nova Mensagem</h2>
                            <button className="modal-close" onClick={() => setShowCompose(false)}>×</button>
                        </div>
                        <form onSubmit={handleSend}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">SISO (código paciente)</label>
                                        <input className="form-input" value={form.siso} onChange={e => setForm(f => ({ ...f, siso: e.target.value }))} placeholder="Opcional" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Paciente</label>
                                        <input className="form-input" value={form.paciente} onChange={e => setForm(f => ({ ...f, paciente: e.target.value }))} placeholder="Opcional" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Prioridade</label>
                                        <select className="form-select" value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}>
                                            <option value="NORMAL">Normal</option>
                                            <option value="URGENTE">Importante</option>
                                            <option value="CRITICA">Crítica</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Categoria</label>
                                        <select className="form-select" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                                            <option value="CLINICO">Clínico</option>
                                            <option value="ADMINISTRATIVO">Administrativo</option>
                                            <option value="FINANCEIRO">Financeiro</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Data Consulta</label>
                                        <DatePicker value={form.dataConsulta} onChange={v => setForm(f => ({ ...f, dataConsulta: v }))} placeholder="Selecione a data" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Data Limite</label>
                                        <DatePicker value={form.dataLimite} onChange={v => setForm(f => ({ ...f, dataLimite: v }))} placeholder="Selecione a data" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Destinatários (grupos)</label>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {ROLES.map(role => (
                                            <button type="button" key={role} className={`badge badge-${form.recipientGroups.includes(role) ? 'accent' : 'neutral'}`}
                                                style={{ cursor: 'pointer', padding: '6px 14px' }} onClick={() => toggleGroup(role)}>
                                                {ROLE_LABELS[role]}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Member selection panels for each selected group */}
                                    {form.recipientGroups.map(group => (
                                        <div key={group} className="member-select-panel">
                                            <div className="member-select-header">
                                                <span className="member-select-title">👥 Membros — {ROLE_LABELS[group as keyof typeof ROLE_LABELS] || group}</span>
                                                {(groupMembers[group]?.length || 0) > 0 && (
                                                    <button type="button" className="member-select-toggle" onClick={() => toggleAllMembers(group)}>
                                                        {(selectedMembers[group]?.length || 0) === (groupMembers[group]?.length || 0) ? 'Desmarcar todos' : 'Selecionar todos'}
                                                    </button>
                                                )}
                                            </div>
                                            {loadingMembers[group] ? (
                                                <div style={{ padding: '8px 0', fontSize: 13, color: 'var(--text-muted)' }}>Carregando membros...</div>
                                            ) : (groupMembers[group]?.length || 0) === 0 ? (
                                                <div style={{ padding: '8px 0', fontSize: 13, color: 'var(--text-muted)' }}>Nenhum membro ativo neste grupo</div>
                                            ) : (
                                                <div className="member-checkbox-list">
                                                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                    {groupMembers[group].map((member: any) => (
                                                        <label key={member.id} className="member-checkbox">
                                                            <input
                                                                type="checkbox"
                                                                checked={(selectedMembers[group] || []).includes(member.id)}
                                                                onChange={() => toggleMember(group, member.id)}
                                                            />
                                                            <span className="member-checkbox-name">{member.name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                            {(groupMembers[group]?.length || 0) > 0 && (
                                                <div className="member-select-count">
                                                    {(selectedMembers[group]?.length || 0)} de {groupMembers[group]?.length || 0} selecionados
                                                    {(selectedMembers[group]?.length || 0) === (groupMembers[group]?.length || 0) && (
                                                        <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 11 }}>(grupo inteiro)</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Conteúdo *</label>
                                    <textarea className="form-textarea" value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))} placeholder="Digite sua mensagem..." required />
                                </div>

                                {/* File Upload Section */}
                                <div className="form-group">
                                    <label className="form-label">📎 Anexos</label>
                                    <div
                                        className="file-upload-zone"
                                        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                                        onDragLeave={e => { e.currentTarget.classList.remove('drag-over'); }}
                                        onDrop={e => { e.currentTarget.classList.remove('drag-over'); handleFileDrop(e); }}
                                        onClick={() => document.getElementById('file-input')?.click()}
                                    >
                                        <div className="file-upload-icon">📁</div>
                                        <div className="file-upload-text">Arraste arquivos aqui ou clique para selecionar</div>
                                        <div className="file-upload-hint">Qualquer tipo de arquivo • Máx. 10MB por arquivo</div>
                                        <input
                                            id="file-input"
                                            type="file"
                                            multiple
                                            onChange={handleFileSelect}
                                            style={{ display: 'none' }}
                                        />
                                    </div>
                                    {files.length > 0 && (
                                        <div className="file-list">
                                            {files.map((f, i) => (
                                                <div key={i} className="file-item">
                                                    <span className="file-item-icon">
                                                        {f.type.startsWith('image/') ? '🖼️' : f.type === 'application/pdf' ? '📄' : '📁'}
                                                    </span>
                                                    <span className="file-item-name">{f.name}</span>
                                                    <span className="file-item-size">{formatFileSize(f.size)}</span>
                                                    <button type="button" className="file-item-remove" onClick={(e) => { e.stopPropagation(); removeFile(i); }}>✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCompose(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={uploading}>
                                    {uploading ? '⏳ Enviando arquivos...' : '📤 Enviar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Message Modal */}
            {viewMsg && (
                <MessageDetailModal message={viewMsg} onClose={() => setViewMsg(null)} api={api} onRead={fetchMessages} onMessageSent={fetchMessages} />
            )}
        </>
    );
}
