'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/lib/ToastContext';
import DatePicker from './DatePicker';

export default function BackupPage() {
    const { user, api } = useAuth();
    const { showToast } = useToast();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [backups, setBackups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);

    // Purge state
    const [purgeDateFrom, setPurgeDateFrom] = useState('');
    const [purgeDateTo, setPurgeDateTo] = useState('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [purgePreview, setPurgePreview] = useState<any>(null);
    const [purgeStep, setPurgeStep] = useState<'idle' | 'preview' | 'confirm1' | 'confirm2' | 'purging'>('idle');

    const fetchBackups = useCallback(async () => {
        try {
            const res = await api('/api/backup/import');
            const data = await res.json();
            if (data.success) setBackups(data.data);
        } catch { /* */ }
        setLoading(false);
    }, [api]);

    useEffect(() => { fetchBackups(); }, [fetchBackups]);

    const handleExport = async () => {
        setExporting(true);
        try {
            const res = await api('/api/backup/export');
            const blob = await res.blob();
            const disposition = res.headers.get('Content-Disposition') || '';
            const match = disposition.match(/filename="?([^"]+)"?/);
            const fileName = match?.[1] || `dfrchat-backup-${new Date().toISOString().slice(0, 10)}.json`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Backup exportado com sucesso!', 'success');
            fetchBackups();
        } catch { showToast('Erro ao exportar', 'error'); }
        setExporting(false);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        try {
            const text = await file.text();
            const jsonData = JSON.parse(text);
            const res = await api('/api/backup/import', { method: 'POST', body: JSON.stringify(jsonData) });
            const data = await res.json();
            if (data.success) { showToast(data.message, 'success'); fetchBackups(); }
            else showToast(data.error, 'error');
        } catch { showToast('Arquivo inválido', 'error'); }
        setImporting(false);
        e.target.value = '';
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
    };

    // Purge handlers
    const handlePurgePreview = async () => {
        if (!purgeDateFrom || !purgeDateTo) { showToast('Selecione as datas', 'error'); return; }
        setPurgeStep('preview');
        try {
            const res = await api('/api/messages/purge', {
                method: 'DELETE',
                body: JSON.stringify({ dateFrom: purgeDateFrom, dateTo: purgeDateTo, confirmed: false }),
            });
            const data = await res.json();
            if (data.success && data.preview) {
                setPurgePreview(data.data);
                setPurgeStep('confirm1');
            } else {
                showToast(data.error || 'Erro', 'error');
                setPurgeStep('idle');
            }
        } catch {
            showToast('Erro ao consultar', 'error');
            setPurgeStep('idle');
        }
    };

    const handlePurgeConfirm = async () => {
        if (purgeStep === 'confirm1') {
            setPurgeStep('confirm2');
            return;
        }
        setPurgeStep('purging');
        try {
            const res = await api('/api/messages/purge', {
                method: 'DELETE',
                body: JSON.stringify({ dateFrom: purgeDateFrom, dateTo: purgeDateTo, confirmed: true }),
            });
            const data = await res.json();
            if (data.success) {
                showToast(data.message, 'success');
                setPurgePreview(null);
                setPurgeStep('idle');
                setPurgeDateFrom('');
                setPurgeDateTo('');
            } else {
                showToast(data.error || 'Erro', 'error');
                setPurgeStep('confirm1');
            }
        } catch {
            showToast('Erro ao limpar', 'error');
            setPurgeStep('confirm1');
        }
    };

    const resetPurge = () => {
        setPurgeStep('idle');
        setPurgePreview(null);
    };

    const isAdmin = user?.role === 'ADMINISTRADOR';

    return (
        <>
            <div className="page-header"><div><h1>Backup & Restauração</h1><div className="header-subtitle">Exportar e importar dados do sistema</div></div></div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📤</div>
                    <h3 style={{ marginBottom: 8 }}>Exportar Backup</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Baixe todos os dados em formato JSON</p>
                    <button className="btn btn-primary" onClick={handleExport} disabled={exporting} style={{ width: '100%' }}>
                        {exporting ? 'Exportando...' : '💾 Exportar Agora'}
                    </button>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📥</div>
                    <h3 style={{ marginBottom: 8 }}>Importar Backup</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Restaure dados a partir de um arquivo JSON</p>
                    <label className="btn btn-secondary" style={{ width: '100%', cursor: 'pointer', justifyContent: 'center' }}>
                        {importing ? 'Importando...' : '📂 Selecionar Arquivo'}
                        <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} disabled={importing} />
                    </label>
                </div>
            </div>

            <div className="card">
                <div className="card-header"><h2 className="card-title">Histórico de Backups</h2></div>
                {loading ? <div className="loading-spinner" /> : backups.length === 0 ? (
                    <div className="empty-state"><h3>Nenhum backup realizado</h3></div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead><tr><th>Data</th><th>Tipo</th><th>Arquivo</th><th>Tamanho</th><th>Usuário</th></tr></thead>
                            <tbody>
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {backups.map((b: any) => (
                                    <tr key={b.id}>
                                        <td>{new Date(b.createdAt).toLocaleString('pt-BR')}</td>
                                        <td><span className={`badge ${b.type === 'EXPORT' ? 'badge-accent' : 'badge-success'}`}>{b.type === 'EXPORT' ? '📤 Export' : '📥 Import'}</span></td>
                                        <td style={{ fontSize: 13 }}>{b.fileName}</td>
                                        <td>{formatSize(b.fileSize)}</td>
                                        <td>{b.user?.name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Purge Section — Admin Only */}
            {isAdmin && (
                <div className="card" style={{ marginTop: 24, borderTop: '3px solid var(--danger)' }}>
                    <div className="card-header">
                        <h2 className="card-title" style={{ color: 'var(--danger)' }}>🗑️ Limpeza Permanente</h2>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                        Remove permanentemente mensagens e seus logs de auditoria da base de dados em um período específico.
                        <strong style={{ color: 'var(--danger)' }}> Esta ação é irreversível.</strong>
                    </p>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                        <div style={{ flex: 1, minWidth: 180 }}>
                            <label className="form-label">Data Inicial</label>
                            <DatePicker value={purgeDateFrom} onChange={setPurgeDateFrom} placeholder="Data início" />
                        </div>
                        <div style={{ flex: 1, minWidth: 180 }}>
                            <label className="form-label">Data Final</label>
                            <DatePicker value={purgeDateTo} onChange={setPurgeDateTo} placeholder="Data fim" />
                        </div>
                    </div>

                    {purgeStep === 'idle' && (
                        <button className="btn btn-danger" onClick={handlePurgePreview} disabled={!purgeDateFrom || !purgeDateTo}>
                            🔍 Consultar Período
                        </button>
                    )}

                    {purgeStep === 'preview' && (
                        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>⏳ Consultando...</div>
                    )}

                    {(purgeStep === 'confirm1' || purgeStep === 'confirm2') && purgePreview && (
                        <div style={{
                            background: 'var(--danger-bg)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: 'var(--radius)',
                            padding: 20,
                            animation: 'fadeIn 0.2s ease',
                        }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--danger)', marginBottom: 12 }}>
                                ⚠️ Atenção — Dados a serem removidos:
                            </div>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                                <div style={{ background: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius-sm)', padding: '12px 20px', flex: 1, textAlign: 'center', minWidth: 140 }}>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--danger)' }}>{purgePreview.messageCount}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Mensagens</div>
                                </div>
                                <div style={{ background: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius-sm)', padding: '12px 20px', flex: 1, textAlign: 'center', minWidth: 140 }}>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--danger)' }}>{purgePreview.auditCount}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Logs de Auditoria</div>
                                </div>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                                Período: {new Date(purgePreview.dateFrom).toLocaleDateString('pt-BR')} a {new Date(purgePreview.dateTo).toLocaleDateString('pt-BR')}
                            </div>

                            {purgeStep === 'confirm1' && (
                                <>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--warning)', marginBottom: 10 }}>
                                        🔒 Confirmação 1 de 2 — Tem certeza que deseja remover permanentemente estes dados?
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-danger" onClick={handlePurgeConfirm}>
                                            ⚠️ Sim, desejo remover
                                        </button>
                                        <button className="btn btn-secondary" onClick={resetPurge}>Cancelar</button>
                                    </div>
                                </>
                            )}

                            {purgeStep === 'confirm2' && (
                                <>
                                    <div style={{
                                        fontWeight: 800, fontSize: 14, color: 'var(--danger)', marginBottom: 10,
                                        padding: '10px 14px', background: 'rgba(239, 68, 68, 0.12)', borderRadius: 'var(--radius-sm)',
                                        border: '1px solid rgba(239, 68, 68, 0.4)',
                                    }}>
                                        🚨 Confirmação FINAL (2 de 2) — Esta ação NÃO pode ser desfeita! Os dados serão eliminados permanentemente do banco de dados.
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-danger" onClick={handlePurgeConfirm} style={{ fontWeight: 800 }}>
                                            🗑️ CONFIRMAR EXCLUSÃO PERMANENTE
                                        </button>
                                        <button className="btn btn-secondary" onClick={resetPurge}>Cancelar</button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {purgeStep === 'purging' && (
                        <div style={{ padding: 20, textAlign: 'center' }}>
                            <div className="loading-spinner" />
                            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>Removendo dados permanentemente...</div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
