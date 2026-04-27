'use client';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'default';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => cancelRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (!loading) void onConfirm();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, loading, onConfirm, onCancel]);

  const handleTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const focused = document.activeElement;
    if (e.shiftKey) {
      focused === cancelRef.current ? confirmRef.current?.focus() : cancelRef.current?.focus();
    } else {
      focused === confirmRef.current ? cancelRef.current?.focus() : confirmRef.current?.focus();
    }
  };

  if (typeof document === 'undefined') return null;

  const isDestructive = variant === 'destructive';

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onKeyDown={handleTabKey}
          onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(8px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(8px) saturate(1.2)',
          }}
        >
          <motion.div
            initial={{ scale: 0.94, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 10, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{
              width: 420,
              maxWidth: '92vw',
              borderRadius: 16,
              padding: 1,
              background: isDestructive
                ? 'linear-gradient(135deg, rgba(239,68,68,0.5) 0%, rgba(245,158,11,0.3) 50%, rgba(167,139,250,0.3) 100%)'
                : 'linear-gradient(135deg, rgba(245,158,11,0.5) 0%, rgba(6,182,212,0.3) 100%)',
              boxShadow: isDestructive
                ? '0 24px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(239,68,68,0.05), 0 0 48px rgba(239,68,68,0.15)'
                : '0 24px 80px rgba(0,0,0,0.75)',
            }}
          >
            <div style={{
              borderRadius: 15,
              background: 'rgba(12,15,22,0.98)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              padding: '24px 24px 20px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Top accent line */}
              <div style={{
                position: 'absolute',
                top: 0, left: 20, right: 20,
                height: 1,
                background: isDestructive
                  ? 'linear-gradient(90deg, transparent, rgba(239,68,68,0.55), transparent)'
                  : 'linear-gradient(90deg, transparent, rgba(245,158,11,0.55), transparent)',
                pointerEvents: 'none',
              }} />

              {/* Icon + title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: isDestructive ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                  border: `1px solid ${isDestructive ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AlertTriangle size={20} color={isDestructive ? 'rgb(239,68,68)' : 'rgb(245,158,11)'} />
                </div>
                <span style={{
                  fontFamily: 'var(--font-sora)',
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.92)',
                }}>
                  {title}
                </span>
              </div>

              {/* Body */}
              <p style={{
                fontFamily: 'var(--font-sora)',
                fontSize: 13,
                color: 'rgba(255,255,255,0.65)',
                lineHeight: 1.5,
                margin: '0 0 20px',
              }}>
                {message}
              </p>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={onCancel}
                  disabled={loading}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  }}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 8,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.7)',
                    fontFamily: 'var(--font-sora)',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.5 : 1,
                    transition: 'background 160ms, border-color 160ms',
                  }}
                >
                  {cancelLabel}
                </button>

                <motion.button
                  ref={confirmRef}
                  type="button"
                  onClick={() => { if (!loading) void onConfirm(); }}
                  disabled={loading}
                  whileHover={loading ? {} : {
                    scale: 1.02,
                    boxShadow: isDestructive
                      ? '0 6px 20px rgba(239,68,68,0.55), inset 0 1px 0 rgba(255,255,255,0.3)'
                      : '0 6px 20px rgba(245,158,11,0.55), inset 0 1px 0 rgba(255,255,255,0.3)',
                  }}
                  whileTap={loading ? {} : { scale: 0.97 }}
                  style={{
                    minWidth: 100,
                    padding: '9px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: isDestructive
                      ? 'linear-gradient(180deg, rgb(248,113,113) 0%, rgb(239,68,68) 100%)'
                      : 'linear-gradient(180deg, rgb(251,191,36) 0%, rgb(245,158,11) 100%)',
                    color: 'rgb(10,10,10)',
                    fontFamily: 'var(--font-sora)',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: isDestructive
                      ? '0 4px 14px rgba(239,68,68,0.4), inset 0 1px 0 rgba(255,255,255,0.3)'
                      : '0 4px 14px rgba(245,158,11,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
                    opacity: loading ? 0.8 : 1,
                  }}
                >
                  {loading ? (
                    <>
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.7, ease: 'linear', repeat: Infinity }}
                        style={{ display: 'inline-flex' }}
                      >
                        <Loader2 size={12} />
                      </motion.span>
                      Deleting…
                    </>
                  ) : confirmLabel}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
