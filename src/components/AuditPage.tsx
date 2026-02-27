'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import DatePicker from './DatePicker';

export default function AuditPage() {
    const { api } = useAuth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ action: '', entityType: '', dateFrom: '', dateTo: '' });
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '30' });
            if (filters.action) params.set('action', filters.action);
            if (filters.entityType) params.set('entityType', filters.entityType);
            if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
            if (filters.dateTo) params.set('dateTo', filters.dateTo);
            const res = await api(`/api/audit-log?${params}`);
            const data = await res.json();
            if (data.success) {
                setLogs(data.data.logs);
                setTotalPages(data.data.pagination.totalPages);
            }
        } catch { /* */ }
        setLoading(false);
    }, [api, page, filters]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const actionIcons: Record<string, string> = {
        MESSAGE_CREATED: '📨', MESSAGE_READ: '👁️', MESSAGE_EDITED: '✏️',
        MESSAGE_DELETED: '🗑️', USER_CREATED: '👤', USER_UPDATED: '✏️',
        USER_DEACTIVATED: '🚫', PASSWORD_RESET: '🔑', PASSWORD_CHANGED: '🔐',
        LOGIN_SUCCESS: '✅', LOGIN_FAILED: '❌', BACKUP_EXPORTED: '📤', BACKUP_IMPORTED: '📥',
    };

    const actionTexts: Record<string, string> = {
        MESSAGE_CREATED: 'Mensagem criada', MESSAGE_READ: 'Mensagem lida', MESSAGE_EDITED: 'Mensagem editada',
        MESSAGE_DELETED: 'Mensagem excluída', USER_CREATED: 'Usuário criado', USER_UPDATED: 'Usuário atualizado',
        USER_DEACTIVATED: 'Usuário desativado', PASSWORD_RESET: 'Senha resetada', PASSWORD_CHANGED: 'Senha alterada',
        LOGIN_SUCCESS: 'Login realizado', LOGIN_FAILED: 'Login falhou', BACKUP_EXPORTED: 'Backup exportado', BACKUP_IMPORTED: 'Backup importado',
    };

    return (
        <>
            <div className="page-header"><div><h1>Logs de Auditoria</h1><div className="header-subtitle">Registro completo de atividades</div></div></div>
            <div className="filter-bar">
                <select className="form-select" value={filters.action} onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}>
                    <option value="">Todas ações</option>
                    {Object.keys(actionTexts).map(a => <option key={a} value={a}>{actionTexts[a]}</option>)}
                </select>
                <select className="form-select" value={filters.entityType} onChange={e => setFilters(f => ({ ...f, entityType: e.target.value }))}>
                    <option value="">Todos tipos</option>
                    <option value="MESSAGE">Mensagem</option><option value="USER">Usuário</option><option value="SYSTEM">Sistema</option><option value="BACKUP">Backup</option>
                </select>
                <DatePicker value={filters.dateFrom} onChange={v => setFilters(f => ({ ...f, dateFrom: v }))} placeholder="Data início" />
                <DatePicker value={filters.dateTo} onChange={v => setFilters(f => ({ ...f, dateTo: v }))} placeholder="Data fim" />
            </div>

            {loading ? <div className="loading-overlay"><div className="loading-spinner" /></div> : (
                <div className="card">
                    {logs.length === 0 ? <div className="empty-state"><h3>Nenhum log encontrado</h3></div> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {logs.map((log: any) => (
                                <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                                    <div style={{ fontSize: 20, marginTop: 2 }}>{actionIcons[log.action] || '📋'}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{actionTexts[log.action] || log.action}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            {log.user?.name || 'Sistema'} • {new Date(log.createdAt).toLocaleString('pt-BR')}
                                            {log.ipAddress && log.ipAddress !== 'unknown' && ` • IP: ${log.ipAddress}`}
                                        </div>
                                        {log.details && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{log.details}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Anterior</button>
                            <span style={{ fontSize: 13, color: 'var(--text-muted)', padding: '6px 12px' }}>{page} / {totalPages}</span>
                            <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima →</button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
