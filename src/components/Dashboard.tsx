'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

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

    const { stats, messagesByCategory, messagesByPriority, readStats } = data;

    // Calculate max for chart scaling
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const catMax = Math.max(1, ...((messagesByCategory || []).map((c: any) => c._count.id)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prioMax = Math.max(1, ...((messagesByPriority || []).map((p: any) => p._count.id)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const readMax = Math.max(1, ...((readStats || []).map((r: any) => r._count.id)));

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
        </>
    );
}
