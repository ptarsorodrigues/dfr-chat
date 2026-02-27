'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/lib/ToastContext';
import { ROLES, ROLE_LABELS } from '@/types';
import MessageDetailModal from './MessageDetailModal';

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

    // Compose state
    const [form, setForm] = useState({
        conteudo: '', siso: '', paciente: '', dentistaId: '', dataConsulta: '', dataLimite: '',
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

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await api('/api/messages', { method: 'POST', body: JSON.stringify(form) });
            const data = await res.json();
            if (data.success) {
                showToast('Mensagem enviada!', 'success');
                setShowCompose(false);
                setForm({ conteudo: '', siso: '', paciente: '', dentistaId: '', dataConsulta: '', dataLimite: '', prioridade: 'NORMAL', categoria: 'ADMINISTRATIVO', recipientGroups: [], recipientUserIds: [] });
                fetchMessages();
            } else showToast(data.error, 'error');
        } catch { showToast('Erro ao enviar', 'error'); }
    };

    const openMessage = (msg: unknown) => {
        setViewMsg(msg);
    };

    const toggleGroup = (group: string) => {
        setForm(f => ({
            ...f,
            recipientGroups: f.recipientGroups.includes(group)
                ? f.recipientGroups.filter(g => g !== group)
                : [...f.recipientGroups, group],
        }));
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
                    <option value="URGENTE">Urgente</option>
                    <option value="CRITICA">Crítica</option>
                </select>
                <select className="form-select" value={filters.categoria} onChange={e => setFilters(f => ({ ...f, categoria: e.target.value }))}>
                    <option value="">Categoria</option>
                    <option value="CLINICO">Clínico</option>
                    <option value="ADMINISTRATIVO">Administrativo</option>
                    <option value="FINANCEIRO">Financeiro</option>
                    <option value="URGENCIA">Urgência</option>
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
                                            <option value="URGENTE">Urgente</option>
                                            <option value="CRITICA">Crítica</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Categoria</label>
                                        <select className="form-select" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                                            <option value="CLINICO">Clínico</option>
                                            <option value="ADMINISTRATIVO">Administrativo</option>
                                            <option value="FINANCEIRO">Financeiro</option>
                                            <option value="URGENCIA">Urgência</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Data Consulta</label>
                                        <div className="date-input-wrapper">
                                            <input className="form-input" type="date" value={form.dataConsulta} onChange={e => setForm(f => ({ ...f, dataConsulta: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Data Limite</label>
                                        <div className="date-input-wrapper">
                                            <input className="form-input" type="date" value={form.dataLimite} onChange={e => setForm(f => ({ ...f, dataLimite: e.target.value }))} />
                                        </div>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Destinatários (grupos)</label>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {ROLES.filter(r => r !== 'ADMINISTRADOR').map(role => (
                                            <button type="button" key={role} className={`badge badge-${form.recipientGroups.includes(role) ? 'accent' : 'neutral'}`}
                                                style={{ cursor: 'pointer', padding: '6px 14px' }} onClick={() => toggleGroup(role)}>
                                                {ROLE_LABELS[role]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Conteúdo *</label>
                                    <textarea className="form-textarea" value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))} placeholder="Digite sua mensagem..." required />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCompose(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">📤 Enviar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Message Modal */}
            {viewMsg && (
                <MessageDetailModal message={viewMsg} onClose={() => setViewMsg(null)} api={api} onRead={fetchMessages} />
            )}
        </>
    );
}
