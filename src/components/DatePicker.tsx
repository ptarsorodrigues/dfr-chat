'use client';
import React, { useState, useRef, useEffect } from 'react';

interface DatePickerProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function DatePicker({ value, onChange, placeholder = 'Selecione a data' }: DatePickerProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const today = new Date();
    const selected = value ? new Date(value + 'T12:00:00') : null;
    const [viewYear, setViewYear] = useState(selected?.getFullYear() || today.getFullYear());
    const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const days: Array<{ day: number; current: boolean; date: string }> = [];

    // Previous month filler
    for (let i = firstDay - 1; i >= 0; i--) {
        const d = prevMonthDays - i;
        const m = viewMonth === 0 ? 11 : viewMonth - 1;
        const y = viewMonth === 0 ? viewYear - 1 : viewYear;
        days.push({ day: d, current: false, date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
        days.push({ day: d, current: true, date: `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }

    // Next month filler
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
        const m = viewMonth === 11 ? 0 : viewMonth + 1;
        const y = viewMonth === 11 ? viewYear + 1 : viewYear;
        days.push({ day: d, current: false, date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };

    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    const selectDate = (date: string) => {
        onChange(date);
        setOpen(false);
    };

    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const displayValue = selected
        ? selected.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';

    return (
        <div className="datepicker" ref={ref}>
            <div className="datepicker-input" onClick={() => setOpen(!open)}>
                <span className="datepicker-icon">📅</span>
                <input
                    type="text"
                    className="form-input"
                    value={displayValue}
                    placeholder={placeholder}
                    readOnly
                    style={{ cursor: 'pointer', paddingLeft: 38 }}
                />
                {value && (
                    <button className="datepicker-clear" onClick={e => { e.stopPropagation(); onChange(''); }} title="Limpar">×</button>
                )}
            </div>

            {open && (
                <div className="datepicker-dropdown">
                    <div className="datepicker-header">
                        <button type="button" className="datepicker-nav" onClick={prevMonth}>◀</button>
                        <span className="datepicker-title">{MONTHS_PT[viewMonth]} {viewYear}</span>
                        <button type="button" className="datepicker-nav" onClick={nextMonth}>▶</button>
                    </div>
                    <div className="datepicker-weekdays">
                        {WEEKDAYS.map(d => <div key={d} className="datepicker-weekday">{d}</div>)}
                    </div>
                    <div className="datepicker-days">
                        {days.map((d, i) => (
                            <button
                                type="button"
                                key={i}
                                className={`datepicker-day${d.current ? '' : ' other'}${d.date === value ? ' selected' : ''}${d.date === todayStr ? ' today' : ''}`}
                                onClick={() => selectDate(d.date)}
                            >
                                {d.day}
                            </button>
                        ))}
                    </div>
                    <div className="datepicker-footer">
                        <button type="button" className="datepicker-today-btn" onClick={() => { selectDate(todayStr); setViewMonth(today.getMonth()); setViewYear(today.getFullYear()); }}>
                            Hoje
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
