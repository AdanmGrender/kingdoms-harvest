/**
 * WithdrawalPanel: Full-screen 2-step KH Token withdrawal panel with OTP verification.
 * Step 1 — enter amount, request OTP via Telegram bot.
 * Step 2 — enter 6-digit OTP, confirm withdrawal.
 */
import { useState, useEffect, useCallback } from 'react';
import useGameStore from '../../store/gameStore';

const FEE_RATE = 0.05;
const TON_RATE = 0.0001;
const MIN_AMOUNT = 500;

function formatCountdown(expiresAt) {
  const ms = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const totalSecs = Math.ceil(ms / 1000);
  const mm = Math.floor(totalSecs / 60).toString().padStart(2, '0');
  const ss = (totalSecs % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function truncateAddress(address) {
  if (!address) return '';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

function statusBadge(status) {
  const map = {
    pending:    { color: '#fde047', label: 'Pendiente' },
    processing: { color: '#93c5fd', label: 'Procesando' },
    completed:  { color: '#4ade80', label: 'Completado' },
    failed:     { color: '#f87171', label: 'Fallido' },
  };
  const { color, label } = map[status] || { color: '#9ca3af', label: status };
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}
    >
      {label}
    </span>
  );
}

// ─── Step 1: Amount entry ────────────────────────────────────────────────────

function AmountStep({ tokenInfo, onOTPSent }) {
  const requestWithdrawalOTP = useGameStore((s) => s.requestWithdrawalOTP);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const numAmount = Number(amount) || 0;
  const net = numAmount * (1 - FEE_RATE);
  const fee = numAmount * FEE_RATE;
  const ton = (net * TON_RATE).toFixed(4);
  const canSubmit = numAmount >= MIN_AMOUNT && tokenInfo?.walletLinked && !loading;

  const handleRequest = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    const result = await requestWithdrawalOTP(numAmount);
    setLoading(false);
    if (result) onOTPSent();
  }, [canSubmit, numAmount, requestWithdrawalOTP, onOTPSent]);

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* Balance & wallet info card */}
      <div
        className="rounded-xl p-3 flex flex-col gap-1"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,215,0,0.15)' }}
      >
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-xs">Balance actual</span>
          <span className="text-yellow-400 font-bold text-sm">
            {tokenInfo?.balance ?? 0} KH
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-xs">Wallet TON</span>
          <span className="text-gray-300 text-xs font-mono">
            {tokenInfo?.walletLinked
              ? truncateAddress(tokenInfo.walletAddress)
              : <span className="text-red-400">No vinculada</span>}
          </span>
        </div>
      </div>

      {/* Minimum note */}
      <p className="text-gray-500 text-[11px]">Retiro mínimo: {MIN_AMOUNT} KH</p>

      {/* Amount input */}
      <div>
        <label className="text-gray-400 text-xs mb-1 block">Cantidad a retirar (KH)</label>
        <input
          type="number"
          min={MIN_AMOUNT}
          placeholder={String(MIN_AMOUNT)}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 rounded text-white px-3 py-2 text-sm outline-none focus:border-yellow-600"
        />
      </div>

      {/* Fee preview */}
      {numAmount >= MIN_AMOUNT && (
        <div
          className="rounded-lg px-3 py-2 text-xs flex flex-col gap-1"
          style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}
        >
          <div className="flex justify-between">
            <span className="text-gray-400">Fee 5%:</span>
            <span className="text-gray-300">{fee.toFixed(0)} KH</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Neto:</span>
            <span className="text-gray-300">{net.toFixed(0)} KH</span>
          </div>
          <div className="flex justify-between font-bold">
            <span className="text-yellow-400">Recibirás:</span>
            <span className="text-yellow-400">{ton} TON</span>
          </div>
        </div>
      )}

      {/* Wallet not linked warning */}
      {!tokenInfo?.walletLinked && (
        <p className="text-red-400 text-xs text-center">
          Primero vinculá tu wallet TON desde Ajustes
        </p>
      )}

      {/* CTA */}
      <button
        onClick={handleRequest}
        disabled={!canSubmit}
        className="w-full py-3 rounded-xl text-sm font-bold transition-opacity"
        style={{
          background: canSubmit
            ? 'linear-gradient(135deg, #b8860b, #ffd700)'
            : 'linear-gradient(135deg, #5a4a1a, #7a6a2a)',
          color: '#1a1a2e',
          opacity: canSubmit ? 1 : 0.6,
        }}
      >
        {loading ? 'Enviando…' : '📱 Enviar código por Telegram'}
      </button>
    </div>
  );
}

// ─── Step 2: OTP entry ───────────────────────────────────────────────────────

function OTPStep({ onClose }) {
  const withdrawalOTP = useGameStore((s) => s.withdrawalOTP);
  const requestWithdrawal = useGameStore((s) => s.requestWithdrawal);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState('');

  // Live countdown ticker
  useEffect(() => {
    if (!withdrawalOTP?.expiresAt) return;
    const tick = () => setCountdown(formatCountdown(withdrawalOTP.expiresAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [withdrawalOTP?.expiresAt]);

  const handleOTPChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val.length <= 6) setOtp(val);
  };

  const handleConfirm = useCallback(async () => {
    if (otp.length !== 6 || loading || !withdrawalOTP) return;
    setLoading(true);
    const result = await requestWithdrawal(withdrawalOTP.amount, withdrawalOTP.otpId, otp);
    setLoading(false);
    if (result) onClose();
  }, [otp, loading, withdrawalOTP, requestWithdrawal, onClose]);

  const handleCancel = () => {
    useGameStore.setState({ withdrawalOTP: null });
  };

  if (!withdrawalOTP) return null;

  const canConfirm = otp.length === 6 && !loading;

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* Pending withdrawal summary */}
      <div
        className="rounded-xl p-3 text-center"
        style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.2)' }}
      >
        <p className="text-gray-400 text-xs mb-1">Retiro pendiente</p>
        <p className="text-yellow-400 font-bold text-xl"
          style={{ fontFamily: 'MedievalSharp, serif' }}>
          {withdrawalOTP.amount} KH
        </p>
      </div>

      {/* Countdown */}
      <div className="text-center">
        <p className="text-gray-500 text-xs">Expira: <span className="text-white font-mono">{countdown}</span></p>
      </div>

      {/* OTP input */}
      <div>
        <label className="text-gray-400 text-xs mb-1 block text-center">
          Ingresá el código de 6 dígitos enviado a Telegram
        </label>
        <input
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={6}
          placeholder="000000"
          value={otp}
          onChange={handleOTPChange}
          className="w-full bg-gray-800 border border-gray-600 rounded text-white px-3 py-3 text-center text-2xl font-mono tracking-widest outline-none focus:border-yellow-500"
          autoFocus
        />
      </div>

      {/* Confirm button */}
      <button
        onClick={handleConfirm}
        disabled={!canConfirm}
        className="w-full py-3 rounded-xl text-sm font-bold transition-opacity"
        style={{
          background: canConfirm
            ? 'linear-gradient(135deg, #b8860b, #ffd700)'
            : 'linear-gradient(135deg, #5a4a1a, #7a6a2a)',
          color: '#1a1a2e',
          opacity: canConfirm ? 1 : 0.6,
        }}
      >
        {loading ? 'Procesando…' : '✅ Confirmar retiro'}
      </button>

      {/* Cancel link */}
      <button
        onClick={handleCancel}
        className="w-full py-2 rounded-xl text-sm text-gray-400 hover:text-gray-200 transition-colors"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        ← Cancelar
      </button>
    </div>
  );
}

// ─── Historial tab ───────────────────────────────────────────────────────────

function HistoryTab({ withdrawalHistory }) {
  if (!withdrawalHistory.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 text-sm gap-2">
        <span className="text-4xl">📭</span>
        <p>Sin retiros aún</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-4">
      {withdrawalHistory.map((item, idx) => (
        <div
          key={item.id ?? idx}
          className="rounded-xl px-3 py-3 flex flex-col gap-1"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex justify-between items-center">
            <span className="text-yellow-400 font-bold text-sm">{item.amount ?? item.kh_amount} KH</span>
            {statusBadge(item.status)}
          </div>
          {item.ton_amount != null && (
            <p className="text-gray-400 text-xs">{Number(item.ton_amount).toFixed(4)} TON</p>
          )}
          <p className="text-gray-600 text-[10px]">
            {item.created_at
              ? new Date(item.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })
              : '—'}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Main panel ─────────────────────────────────────────────────────────────

export default function WithdrawalPanel({ onClose }) {
  const tokenInfo         = useGameStore((s) => s.tokenInfo);
  const withdrawalHistory = useGameStore((s) => s.withdrawalHistory);
  const withdrawalOTP     = useGameStore((s) => s.withdrawalOTP);
  const loadTokenInfo         = useGameStore((s) => s.loadTokenInfo);
  const loadWithdrawalHistory = useGameStore((s) => s.loadWithdrawalHistory);

  const [activeTab, setActiveTab] = useState('withdraw');

  useEffect(() => {
    loadTokenInfo();
    loadWithdrawalHistory();
  }, [loadTokenInfo, loadWithdrawalHistory]);

  // When an OTP arrives, automatically keep the withdraw tab active
  useEffect(() => {
    if (withdrawalOTP) setActiveTab('withdraw');
  }, [withdrawalOTP]);

  const tabBtn = (id, label) => (
    <button
      key={id}
      onClick={() => setActiveTab(id)}
      className="flex-1 py-2 text-xs font-bold transition-colors"
      style={{
        color: activeTab === id ? '#ffd700' : '#9ca3af',
        borderBottom: activeTab === id ? '2px solid #ffd700' : '2px solid transparent',
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(22,33,62,0.97)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-yellow-900/30 flex-shrink-0"
        style={{ background: 'rgba(22,33,62,0.98)' }}
      >
        <h2
          className="text-yellow-400 font-bold text-base"
          style={{ fontFamily: 'MedievalSharp, serif' }}
        >
          💰 Retiro KH Tokens
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 text-2xl leading-none px-2 hover:text-white transition-colors"
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-yellow-900/30 flex-shrink-0"
        style={{ background: 'rgba(22,33,62,0.98)' }}>
        {tabBtn('withdraw', '💸 Retirar')}
        {tabBtn('history',  '📋 Historial')}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'withdraw' && (
          withdrawalOTP
            ? <OTPStep onClose={onClose} />
            : <AmountStep tokenInfo={tokenInfo} onOTPSent={() => {}} />
        )}
        {activeTab === 'history' && (
          <HistoryTab withdrawalHistory={withdrawalHistory} />
        )}
      </div>
    </div>
  );
}
