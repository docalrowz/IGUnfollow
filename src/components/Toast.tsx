import React from 'react';

interface ToastProps {
    show?: boolean;
    style?: 'success' | 'error' | 'warning' | 'info';
    message: string;
    onClose?: () => void;
}

export const Toast = ({ show = false, style = 'info', message, onClose }: ToastProps) => (
    <div
        className={`toast ${show ? 'show' : ''} ${style}`}
        role={style === 'error' ? 'alert' : 'status'}
        aria-live={style === 'error' ? 'assertive' : 'polite'}
        aria-atomic='true'
    >
        <p className='toast__message'>{message}</p>
        <button
            type='button'
            className='toast__close-button'
            onClick={onClose}
            aria-label='Dismiss notification'
        >
            &times;
        </button>
    </div>
);
