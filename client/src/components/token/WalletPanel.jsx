import React, { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import SpriteIcon from '../ui/SpriteIcon';

function WalletPanel({ tokenInfo }) {
  const { linkWallet, requestWithdrawal, withdrawalHistory, loadWithdrawalHistory } = useGameStore();
  const [walletAddress, setWalletAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  useEffect(() => {
    loadWithdrawalHistory();
  }, []);

  const handleLinkWallet = async () => {
    if (!walletAddress.trim()) return;
    await linkWallet(walletAddress.trim());
    setWalletAddress('');
  };

  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmount, 10);
    if (!amount || amount < 500) return;
    await requestWithdrawal(amount);
    setWithdrawAmount('');
  };

  const tonRate = 0.0001;
  const feeRate = 0.05;
  const estimatedTon = withdrawAmount
    ? ((parseInt(withdrawAmount, 10) || 0) * (1 - feeRate) * tonRate).toFixed(6)
    : '0.000000';

  const statusColors = {
    pending: 'text-yellow-400',
    processing: 'text-blue-400',
    completed: 'text-green-400',
    failed: 'text-red-400',
    rejected: 'text-red-400',
  };

  return (
    <div className="space-y-3">
      {/* Wallet Link */}
      <div className="game-card">
        <h3 className="text-sm font-bold mb-2 flex items-center gap-1">
          <SpriteIcon name="backpack" size={20} /> Wallet TON
        </h3>
        {tokenInfo?.walletLinked ? (
          <div>
            <p className="text-xs text-green-400 mb-1 flex items-center gap-1">
              <SpriteIcon name="medal" size={14} /> Wallet vinculada
            </p>
            <p className="text-xs text-gray-400 font-mono break-all">
              {tokenInfo.walletAddress}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-gray-400 mb-2">
              Vincula tu wallet TON para poder retirar tokens.
            </p>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="EQ... o UQ..."
              className="w-full bg-kingdom-blue border border-gray-600 rounded-lg px-3 py-2 text-sm text-white mb-2"
            />
            <button onClick={handleLinkWallet} className="btn-primary w-full text-sm">
              Vincular Wallet
            </button>
          </div>
        )}
      </div>

      {/* Withdraw */}
      <div className="game-card">
        <h3 className="text-sm font-bold mb-2 flex items-center gap-1">
          <SpriteIcon name="back" size={20} /> Retirar Tokens
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          Minimo: 500 KH | Nivel 5+ | Cuenta de 7+ dias | Fee: 5%
        </p>

        <div className="mb-3">
          <input
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Cantidad de KH Tokens"
            min="500"
            className="w-full bg-kingdom-blue border border-gray-600 rounded-lg px-3 py-2 text-sm text-white mb-1"
          />
          <p className="text-xs text-gray-400">
            Recibirias: <span className="text-purple-400 font-bold">{estimatedTon} TON</span>
          </p>
        </div>

        <button
          onClick={handleWithdraw}
          disabled={!tokenInfo?.walletLinked || (tokenInfo?.balance || 0) < 500}
          className="btn-primary w-full text-sm disabled:opacity-50"
        >
          Solicitar Retiro
        </button>
      </div>

      {/* History */}
      {withdrawalHistory && withdrawalHistory.length > 0 && (
        <div className="game-card">
          <h3 className="text-sm font-bold mb-2 flex items-center gap-1">
            <SpriteIcon name="scroll" size={20} /> Historial de Retiros
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {withdrawalHistory.map((w) => (
              <div key={w.id} className="flex justify-between items-center text-xs border-b border-gray-700 pb-2">
                <div>
                  <p className="font-bold">{w.amount} KH = {w.ton_amount} TON</p>
                  <p className="text-gray-500">{new Date(w.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`font-bold ${statusColors[w.status] || 'text-gray-400'}`}>
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default WalletPanel;
