'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import MessageDetailModal from './MessageDetailModal';

export default function Dashboard() {
    const { api } = useAuth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [selectedMsg, setSelectedMsg] = useState<any>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await api('/api/dashboard');
                const json = await res.json();
                if (json.success) setData(json.data);
            } catch { /* ignore */ }
            setLoading(false);
        })();
    }, [api]);

    if (loading) return <div className="loading-overlay"><div className="loading-spinner" /></div>;
    if (!data) return <div className="empty-state"><h3>Erro ao carregar dashboard</h3></div>;

    const { stats, recentMessages } = data;

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>Dashboard</h1>
                    <div className="header-subtitle">Visão geral das mensagens</div>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card accent">
                    <div className="stat-icon">📨</div>
                    <div className="stat-value">{stats.totalMessages}</div>
                    <div className="stat-label">Total de Mensagens</div>
                </div>
                <div className="stat-card danger">
                    <div className="stat-icon">📩</div>
                    <div className="stat-value">{stats.unreadMessages}</div>
                    <div className="stat-label">Não Lidas</div>
                </div>
                <div className="stat-card warning">
                    <div className="stat-icon">⚡</div>
                    <div className="stat-value">{stats.urgentMessages}</div>
                    <div className="stat-label">Urgentes</div>
                </div>
                <div className="stat-card success">
                    <div className="stat-icon">👥</div>
                    <div className="stat-value">{stats.activeUsers}</div>
                    <div className="stat-label">Usuários Ativos</div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Mensagens Recentes</h2>
                </div>
                {recentMessages?.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📭</div>
                        <h3>Nenhuma mensagem ainda</h3>
                        <p>As mensagens recebidas aparecerão aqui</p>
                    </div>
                ) : (
                    <div className="message-list">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {recentMessages?.map((msg: any) => {
                            const isUnread = msg.recipients?.[0]?.readAt === null;
                            const prioClass = msg.prioridade === 'CRITICA' ? 'critical' : msg.prioridade === 'URGENTE' ? 'urgent' : '';
                            return (
                                <div key={msg.id} className={`message-card ${isUnread ? 'unread' : ''} ${prioClass} ${msg.edited ? 'edited' : ''}`}
                                    onClick={() => setSelectedMsg(msg)} style={{ cursor: 'pointer' }}>
                                    <div className="message-avatar">{msg.remetente?.name?.charAt(0)}</div>
                                    <div className="message-content">
                                        <div className="message-header">
                                            <span className="message-sender">{msg.remetente?.name}</span>
                                            <span className="message-time">{new Date(msg.createdAt).toLocaleDateString('pt-BR')}</span>
                                        </div>
                                        <div className="message-preview">{msg.conteudo?.substring(0, 100)}</div>
                                        <div className="message-meta">
                                            <span className={`badge badge-${msg.prioridade === 'CRITICA' ? 'danger' : msg.prioridade === 'URGENTE' ? 'warning' : 'neutral'}`}>
                                                {msg.prioridade}
                                            </span>
                                            <span className="badge badge-accent">{msg.categoria}</span>
                                            {msg.paciente && <span className="badge badge-neutral">🦷 {msg.paciente}</span>}
                                            {msg._count?.attachments > 0 && <span className="badge badge-neutral">📎 {msg._count.attachments}</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}
