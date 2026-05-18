import { useState, useMemo } from 'react';
import { ChevronLeft, Wallet, Gift, History } from 'lucide-react';
import { db } from '../services/firebase'; 
import { doc, updateDoc } from 'firebase/firestore'; 
import { translations } from '../utils/translations';
import '../styles/Cashback.css';

interface CashbackProps {
  setLocalView: (v: string) => void;
  balance: number;
  setBalance: React.Dispatch<React.SetStateAction<number>>;
  symbol: string;
  globalLang: string;
  bookings: Record<string, unknown>[];
}

export const Cashback = ({ setLocalView, balance, setBalance, symbol, globalLang, bookings = [] }: CashbackProps) => {
  const [isClaiming, setIsClaiming] = useState(false);
  const t = translations[globalLang || 'en'];

  // 1. 过滤出待领取的订单 (已完成且未领取)
  const pendingOrders = useMemo(() => {
    if (!bookings || !Array.isArray(bookings)) return [];
    return bookings.filter((b) => b.status === 'past' && b.cashbackClaimed !== true);
  }, [bookings]);

  // 计算待领取总额
  const totalPendingAmount = useMemo(() => {
    return pendingOrders.reduce((sum: number, b) => {
      const amount = Number(b.cashbackAmount) || (Number(b.price) * 0.05) || 0;
      return sum + amount;
    }, 0);
  }, [pendingOrders]);

  // 历史记录
  const recentTransactions = useMemo(() => {
    if (!bookings || !Array.isArray(bookings)) return [];
    return bookings.filter((b) => b.status === 'past');
  }, [bookings]);

  // --- 核心修复：点击领取功能 ---
  const handleClaim = async () => {
    // 如果没有待领取的钱，直接返回
    if (totalPendingAmount <= 0) {
      alert("No pending rewards to claim!");
      return;
    }
   
    setIsClaiming(true);
    try {
      // 在 Firebase 中更新所有相关订单的状态
      const updatePromises = pendingOrders.map((order) => {
        const orderRef = doc(db, "Booking", order.id as string);
        return updateDoc(orderRef, { cashbackClaimed: true });
      });

      await Promise.all(updatePromises);

      // 更新前端显示的余额
      setBalance((prev: number) => prev + totalPendingAmount);
      alert(`Success! You've claimed ${symbol} ${totalPendingAmount.toFixed(2)}`);
    } catch (error) {
      console.error("Error updating cashback:", error);
      alert("Failed to claim. Please try again.");
    } finally {
      setIsClaiming(false);
    }
  };

  const handleWithdraw = () => {
    if (balance <= 0) return;
    const confirmExchange = window.confirm(`Exchange ${symbol}${balance.toFixed(2)} for a cash coupon?`);
    if (confirmExchange) {
      setBalance(0);
      alert("Success! Your coupon is ready.");
      setLocalView('main');
    }
  };

  return (
    <div className="cashback-container fade-in">
      {/* 头部 */}
      <div className="sub-page-header">
        <ChevronLeft onClick={() => setLocalView('main')} className="back-icon" />
        <span>{t.cashback || 'Cashback Rewards'}</span>
      </div>

      <div className="cashback-body">
        {/* 余额大卡片 */}
        <div className="ui-card balance-hero">
          <div className="balance-info">
            <p className="label">Available Balance</p>
            <h1 className="amount">{symbol} {Number(balance).toFixed(2)}</h1>
          </div>
          <div className="wallet-illustration">
             <Wallet size={48} color="#7b2cbf" />
          </div>
        </div>

        {/* 任务领取区域 - 修复了点击逻辑 */}
        <div className="ui-card">
          <h3 className="ui-card-title">Pending Rewards</h3>
          <div 
            className="ui-row clickable" 
            style={{ cursor: totalPendingAmount > 0 ? 'pointer' : 'default' }}
            onClick={!isClaiming ? handleClaim : undefined}
          >
            <Gift size={20} color="#7b2cbf" />
            <div className="row-content">
              <span className="row-title">Travel Reward</span>
              <p className="row-desc">
                {totalPendingAmount > 0 
                  ? `Claim your ${symbol} ${totalPendingAmount.toFixed(2)} bonus` 
                  : "No rewards available"}
              </p>
            </div>
            {/* 按钮状态根据 totalPendingAmount 自动切换颜色 */}
            <span 
              className="claim-btn" 
              style={{ 
                background: totalPendingAmount > 0 ? '#7b2cbf' : '#ccc',
                opacity: isClaiming ? 0.7 : 1
              }}
            >
              {isClaiming ? '...' : 'Claim'}
            </span>
          </div>
        </div>

        {/* 历史记录记录 */}
        <div className="ui-card">
          <h3 className="ui-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} /> Recent Transactions
          </h3>
          
          {recentTransactions.length === 0 ? (
            <div className="ui-row no-click" style={{ justifyContent: 'center', color: '#999' }}>
              <span>No transactions yet</span>
            </div>
          ) : (
            recentTransactions.map((b) => {
              const displayAmount = Number(b.cashbackAmount) || (Number(b.price) * 0.05) || 0;
              return (
                <div key={b.id as string} className="ui-row no-click">
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="row-title" style={{ fontSize: '14px' }}>{(b.name as string) || (b.hotelName as string)}</span>
                    <span style={{ fontSize: '11px', color: b.cashbackClaimed ? '#22c55e' : '#888' }}>
                      {b.cashbackClaimed ? 'CLAIMED' : 'PAST'}
                    </span>
                  </div>
                  <span className={`ui-val ${b.cashbackClaimed ? '' : 'positive'}`}>
                    +{symbol} {displayAmount.toFixed(2)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <button 
          className={`ui-logout-btn ${balance <= 0 ? 'disabled' : ''}`} 
          style={{ 
            marginTop: '20px', 
            background: balance > 0 ? '#7b2cbf' : '#ccc',
            width: '100%',
            padding: '15px',
            borderRadius: '12px',
            color: 'white',
            border: 'none',
            fontWeight: 'bold'
          }}
          disabled={balance <= 0}
          onClick={handleWithdraw}
        >
          CONVERT TO COUPON
        </button>
      </div>
    </div>
  );
};
