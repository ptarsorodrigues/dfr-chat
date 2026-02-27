'use client';
import React from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function MessageDetailModal({ message, onClose, api, onRead }: { message: any; onClose: () => void; api: (url: string, options?: RequestInit) => Promise<Response>; onRead?: () => void }) {
    const [msg, setMsg] = React.useState(message);
    const [loading, setLoading] = React.useState(!message?.editHistory);

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
