import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../game/EventBridge', () => ({ default: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }));
vi.mock('../services/socketService', () => ({ connectSocket: vi.fn() }));

import useGameStore from '../store/gameStore';
import WithdrawalPanel from '../components/overlay/WithdrawalPanel';

const FUTURE = new Date(Date.now() + 5 * 60 * 1000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    tokenInfo: { balance: 2000, walletLinked: true, walletAddress: 'EQAbcdef123456' },
    withdrawalHistory: [],
    withdrawalOTP: null,
    player: { telegram_id: 1, level: 5, display_name: 'T', xp: 0 },
    requestWithdrawalOTP: vi.fn(),
    requestWithdrawal: vi.fn(),
  });
});

describe('WithdrawalPanel — Step 1 (amount entry)', () => {
  it('renders the amount input field', () => {
    render(<WithdrawalPanel onClose={() => {}} />);
    expect(screen.getByPlaceholderText('500')).toBeInTheDocument();
  });

  it('renders the "Enviar código" button', () => {
    render(<WithdrawalPanel onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /enviar código/i })).toBeInTheDocument();
  });

  it('"Enviar código" button is disabled when no amount entered', () => {
    render(<WithdrawalPanel onClose={() => {}} />);
    const btn = screen.getByRole('button', { name: /enviar código/i });
    expect(btn).toBeDisabled();
  });

  it('shows current KH balance', () => {
    render(<WithdrawalPanel onClose={() => {}} />);
    expect(screen.getByText(/2000 KH/i)).toBeInTheDocument();
  });

  it('shows "No vinculada" warning when wallet not linked', () => {
    useGameStore.setState({
      tokenInfo: { balance: 2000, walletLinked: false, walletAddress: null },
    });
    render(<WithdrawalPanel onClose={() => {}} />);
    expect(screen.getByText(/no vinculada/i)).toBeInTheDocument();
  });

  it('shows fee preview when amount >= 500', async () => {
    render(<WithdrawalPanel onClose={() => {}} />);
    const input = screen.getByPlaceholderText('500');
    await userEvent.type(input, '1000');
    expect(screen.getByText(/recibirás/i)).toBeInTheDocument();
    expect(screen.getByText(/0\.0950 TON/i)).toBeInTheDocument();
  });
});

describe('WithdrawalPanel — Step 2 (OTP entry)', () => {
  beforeEach(() => {
    useGameStore.setState({
      withdrawalOTP: { otpId: 42, expiresAt: FUTURE, amount: 1000 },
    });
  });

  it('renders the OTP input when withdrawalOTP is set', () => {
    render(<WithdrawalPanel onClose={() => {}} />);
    // OTP step shows a digit input — maxLength 6
    const inputs = screen.getAllByRole('textbox');
    const otpInput = inputs.find((el) => el.getAttribute('inputmode') === 'numeric' || el.getAttribute('maxlength') === '6' || el.placeholder === '');
    expect(otpInput || screen.getByPlaceholderText(/código/i)).toBeTruthy();
  });

  it('renders the "Confirmar retiro" button in OTP step', () => {
    render(<WithdrawalPanel onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /confirmar retiro/i })).toBeInTheDocument();
  });

  it('renders the pending amount in OTP step', () => {
    render(<WithdrawalPanel onClose={() => {}} />);
    expect(screen.getByText(/1000 KH/i)).toBeInTheDocument();
  });

  it('renders a live countdown timer', () => {
    render(<WithdrawalPanel onClose={() => {}} />);
    // Countdown shows MM:SS format
    expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
  });
});

describe('WithdrawalPanel — History tab', () => {
  it('shows empty state when no withdrawal history', async () => {
    render(<WithdrawalPanel onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /historial/i }));
    expect(screen.getByText(/Sin retiros aún/i)).toBeInTheDocument();
  });

  it('renders withdrawal history items', async () => {
    useGameStore.setState({
      withdrawalHistory: [
        { id: 1, amount: 500, ton_amount: '0.0475', status: 'completed', created_at: new Date().toISOString() },
      ],
    });
    render(<WithdrawalPanel onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /historial/i }));
    expect(screen.getByText(/500 KH/i)).toBeInTheDocument();
    expect(screen.getByText(/Completado/i)).toBeInTheDocument();
  });
});
