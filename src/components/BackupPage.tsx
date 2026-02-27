'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/lib/ToastContext';

export default function BackupPage() {
    const { api } = useAuth();
    const { showToast } = useToast();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [backups, setBackups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);

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
            // Extract filename from Content-Disposition header to match what's stored in DB
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
        </>
    );
}
