'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import MessageDetailModal from './MessageDetailModal';

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
}

function formatDate() {
    return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const CATEGORY_LABELS: Record<string, string> = {
    CLINICO: 'Clínico',
    ADMINISTRATIVO: 'Administrativo',
    FINANCEIRO: 'Financeiro',
};

const CATEGORY_COLORS: Record<string, string> = {
    CLINICO: '#06b6d4',
    ADMINISTRATIVO: '#3b82f6',
    FINANCEIRO: '#10b981',
};

const PRIORITY_LABELS: Record<string, string> = {
    NORMAL: 'Normal',
    URGENTE: 'Urgente',
    CRITICA: 'Crítica',
};

const PRIORITY_COLORS: Record<string, string> = {
    NORMAL: '#06b6d4',
    URGENTE: '#f59e0b',
    CRITICA: '#ef4444',
};

export default function Dashboard({ onNavigate }: { onNavigate?: (page: string) => void }) {
    const { api, user } = useAuth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [viewMsg, setViewMsg] = useState<any>(null);
    const [showAllMessages, setShowAllMessages] = useState(false);

    const fetchDashboard = async () => {
        try {
            const res = await api('/api/dashboard');
            const json = await res.json();
            if (json.success) setData(json.data);
        } catch { /* ignore */ }
        setLoading(false);
    };

    useEffect(() => {
        fetchDashboard();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [api]);

    if (loading) return <div className="loading-overlay"><div className="loading-spinner" /></div>;
    if (!data) return <div className="empty-state"><h3>Erro ao carregar dashboard</h3></div>;

    const { stats, messagesByCategory, messagesByPriority, readStats, directedMessages } = data;

    // Calculate max for chart scaling
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const catMax = Math.max(1, ...((messagesByCategory || []).map((c: any) => c._count.id)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prioMax = Math.max(1, ...((messagesByPriority || []).map((p: any) => p._count.id)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const readMax = Math.max(1, ...((readStats || []).map((r: any) => r._count.id)));

    // Process directed messages
    const allDirected = directedMessages || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unreadCount = allDirected.filter((m: any) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        m.recipients?.some((r: any) => r.readAt === null)
    ).length;
    const displayedMessages = showAllMessages ? allDirected : allDirected.slice(0, 10);

    return (
        <>
            {/* Greeting */}
            <div className="dashboard-greeting">
                <div>
                    <h1 className="greeting-title">{getGreeting()}, {user?.name?.split(' ')[0]} 👋</h1>
                    <p className="greeting-date">{formatDate()}</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card accent" onClick={() => onNavigate?.('messages')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon">📨</div>
                    <div className="stat-value">{stats.totalMessages}</div>
                    <div className="stat-label">Total de Mensagens</div>
                </div>
                <div className="stat-card danger" onClick={() => onNavigate?.('messages')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon">📩</div>
                    <div className="stat-value">{stats.unreadMessages}</div>
                    <div className="stat-label">Não Lidas</div>
                </div>
                <div className="stat-card warning" onClick={() => onNavigate?.('messages')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon">⚡</div>
                    <div className="stat-value">{stats.urgentMessages}</div>
                    <div className="stat-label">Urgentes</div>
                </div>
                <div className="stat-card" style={{ cursor: 'pointer', borderTop: '3px solid #ef4444' }} onClick={() => onNavigate?.('messages')}>
                    <div className="stat-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>🚨</div>
                    <div className="stat-value">{stats.criticalMessages}</div>
                    <div className="stat-label">Críticas</div>
                </div>
                <div className="stat-card success" onClick={() => onNavigate?.('users')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon">👥</div>
                    <div className="stat-value">{stats.activeUsers}</div>
                    <div className="stat-label">Usuários Ativos</div>
                </div>
            </div>

            {/* Directed Messages Feed */}
            <div className="card dashboard-message-feed">
                <div className="dashboard-feed-header">
                    <div className="dashboard-feed-title">
                        📬 Mensagens Direcionadas
                        {unreadCount > 0 && <span className="dashboard-feed-count">{unreadCount} não lida{unreadCount > 1 ? 's' : ''}</span>}
                    </div>
                </div>

                {allDirected.length === 0 ? (
                    <div className="dashboard-feed-empty">
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                        Nenhuma mensagem direcionada
                    </div>
                ) : (
                    <>
                        <div className="dashboard-msg-list">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {displayedMessages.map((msg: any) => {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const isUnread = msg.recipients?.some((r: any) => r.readAt === null);
                                const prioClass =
                                    msg.prioridade === 'CRITICA' ? 'prio-critica' :
                                        msg.prioridade === 'URGENTE' ? 'prio-urgente' : '';

                                return (
                                    <div
                                        key={msg.id}
                                        className={`dashboard-msg-card ${isUnread ? 'unread' : ''} ${prioClass}`}
                                        onClick={() => setViewMsg(msg)}
                                    >
                                        <div className="dashboard-msg-avatar">
                                            {msg.remetente?.name?.charAt(0)}
                                        </div>
                                        <div className="dashboard-msg-body">
                                            <div className="dashboard-msg-top">
                                                <span className="dashboard-msg-sender">
                                                    {msg.remetente?.name}
                                                    <span className={`badge-role badge-${msg.remetente?.role}`} style={{ marginLeft: 6, fontSize: 10 }}>{msg.remetente?.role}</span>
                                                </span>
                                                <span className="dashboard-msg-time">
                                                    {isUnread && <span className="dashboard-msg-unread-dot" />}
                                                    {new Date(msg.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="dashboard-msg-preview">{msg.conteudo?.substring(0, 120)}</div>
                                            <div className="dashboard-msg-meta">
                                                <span className={`badge badge-${msg.prioridade === 'CRITICA' ? 'danger' : msg.prioridade === 'URGENTE' ? 'warning' : 'neutral'}`}>{msg.prioridade}</span>
                                                <span className="badge badge-accent">{msg.categoria}</span>
                                                {msg.paciente && <span className="badge badge-neutral">🦷 {msg.paciente}</span>}
                                                {isUnread && <span className="badge badge-warning">Não lida</span>}
                                                {msg._count?.attachments > 0 && <span className="badge badge-neutral">📎 {msg._count.attachments}</span>}
                                                {msg._count?.editHistory > 0 && <span className="badge badge-warning" style={{ fontSize: 10 }}>ALTERADA</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {allDirected.length > 10 && !showAllMessages && (
                            <div className="dashboard-feed-more">
                                <button onClick={() => setShowAllMessages(true)}>
                                    Ver todas ({allDirected.length} mensagens)
                                </button>
                            </div>
                        )}
                        {showAllMessages && allDirected.length > 10 && (
                            <div className="dashboard-feed-more">
                                <button onClick={() => setShowAllMessages(false)}>
                                    Mostrar menos
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Charts Row */}
            <div className="dashboard-charts">
                {/* Messages by Category */}
                <div className="card dashboard-chart-card">
                    <div className="card-header">
                        <h2 className="card-title">📊 Mensagens por Categoria</h2>
                    </div>
                    {(messagesByCategory && messagesByCategory.length > 0) ? (
                        <div className="chart-bars">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {messagesByCategory.map((cat: any) => (
                                <div key={cat.categoria} className="chart-bar-row">
                                    <span className="chart-bar-label">{CATEGORY_LABELS[cat.categoria] || cat.categoria}</span>
                                    <div className="chart-bar-track">
                                        <div
                                            className="chart-bar-fill"
                                            style={{
                                                width: `${(cat._count.id / catMax) * 100}%`,
                                                background: CATEGORY_COLORS[cat.categoria] || 'var(--accent)',
                                            }}
                                        />
                                    </div>
                                    <span className="chart-bar-value">{cat._count.id}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="chart-empty">Nenhuma mensagem registrada</p>
                    )}
                </div>

                {/* Messages by Priority */}
                <div className="card dashboard-chart-card">
                    <div className="card-header">
                        <h2 className="card-title">🎯 Mensagens por Prioridade</h2>
                    </div>
                    {(messagesByPriority && messagesByPriority.length > 0) ? (
                        <div className="chart-bars">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {messagesByPriority.map((prio: any) => (
                                <div key={prio.prioridade} className="chart-bar-row">
                                    <span className="chart-bar-label">{PRIORITY_LABELS[prio.prioridade] || prio.prioridade}</span>
                                    <div className="chart-bar-track">
                                        <div
                                            className="chart-bar-fill"
                                            style={{
                                                width: `${(prio._count.id / prioMax) * 100}%`,
                                                background: PRIORITY_COLORS[prio.prioridade] || 'var(--accent)',
                                            }}
                                        />
                                    </div>
                                    <span className="chart-bar-value">{prio._count.id}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="chart-empty">Nenhuma mensagem registrada</p>
                    )}
                </div>
            </div>

            {/* Read Rate by Group */}
            {readStats && readStats.length > 0 && (
                <div className="card" style={{ marginBottom: 24 }}>
                    <div className="card-header">
                        <h2 className="card-title">✅ Leituras por Grupo</h2>
                    </div>
                    <div className="chart-bars">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {readStats.map((rs: any) => (
                            <div key={rs.groupName} className="chart-bar-row">
                                <span className="chart-bar-label">{rs.groupName}</span>
                                <div className="chart-bar-track">
                                    <div
                                        className="chart-bar-fill"
                                        style={{
                                            width: `${(rs._count.id / readMax) * 100}%`,
                                            background: 'var(--success)',
                                        }}
                                    />
                                </div>
                                <span className="chart-bar-value">{rs._count.id}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Quick Actions */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">⚡ Ações Rápidas</h2>
                </div>
                <div className="quick-actions">
                    <button className="quick-action-btn" onClick={() => onNavigate?.('messages')}>
                        <span className="quick-action-icon">✉️</span>
                        <span className="quick-action-text">Ver Mensagens</span>
                    </button>
                    <button className="quick-action-btn" onClick={() => onNavigate?.('messages')}>
                        <span className="quick-action-icon">📩</span>
                        <span className="quick-action-text">Não Lidas ({stats.unreadMessages})</span>
                    </button>
                    {user?.role === 'ADMINISTRADOR' && (
                        <>
                            <button className="quick-action-btn" onClick={() => onNavigate?.('users')}>
                                <span className="quick-action-icon">👥</span>
                                <span className="quick-action-text">Gerenciar Usuários</span>
                            </button>
                            <button className="quick-action-btn" onClick={() => onNavigate?.('audit')}>
                                <span className="quick-action-icon">📋</span>
                                <span className="quick-action-text">Ver Logs</span>
                            </button>
                            <button className="quick-action-btn" onClick={() => onNavigate?.('backup')}>
                                <span className="quick-action-icon">💾</span>
                                <span className="quick-action-text">Backup</span>
                            </button>
                        </>
                    )}
                    <button className="quick-action-btn" onClick={() => onNavigate?.('profile')}>
                        <span className="quick-action-icon">👤</span>
                        <span className="quick-action-text">Meu Perfil</span>
                    </button>
                </div>
            </div>

            {/* View Message Modal */}
            {viewMsg && (
                <MessageDetailModal message={viewMsg} onClose={() => { setViewMsg(null); fetchDashboard(); }} api={api} onRead={() => { fetchDashboard(); }} />
            )}
        </>
    );
}
