import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  User, 
  CreditCard, 
  History, 
  ShieldCheck, 
  CheckCircle, 
  X, 
  Copy, 
  Check as CheckIcon, 
  Info,
  Loader2,
  Clock,
  Sparkles,
  RefreshCw,
  Trash2,
  PlusCircle,
  ShieldAlert,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, Platform } from './types';
import { PLATFORMS, getPlayerName, INITIAL_TRANSACTIONS } from './utils';
import { 
  rtdb, 
  db, 
  syncBalanceToFirebase, 
  syncTransactionsToFirebase, 
  clearTransactionsInFirebase 
} from './firebase';
import { ref, onValue } from 'firebase/database';

export default function App() {
  // Shared balance state connected directly to Firebase
  const [walletBalance, setWalletBalance] = useState<number>(25000);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);

  // Client Application form states
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(PLATFORMS[0]);
  const [playerId, setPlayerId] = useState<string>('');
  const [depositAmount, setDepositAmount] = useState<string>('5000'); 
  
  // Real-time name checking simulation states
  const [isCheckingName, setIsCheckingName] = useState<boolean>(false);
  const [detectedPlayerName, setDetectedPlayerName] = useState<string>('');

  // Dialog / Modal states
  const [pendingConfirmTx, setPendingConfirmTx] = useState<{ amount: number; accountId: string } | null>(null);
  const [itemName, setItemName] = useState<string>('');
  const [successReceipt, setSuccessReceipt] = useState<(Transaction & { itemName?: string }) | null>(null);
  
  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isProcessingTx, setIsProcessingTx] = useState<boolean>(false);

  // Real-time synchronization with Firebase Realtime Database
  useEffect(() => {
    // 1. Sync & listen to wallet balance
    const balanceRef = ref(rtdb, 'mobicash/balance');
    const unsubscribeBalance = onValue(balanceRef, (snapshot) => {
      setIsFirebaseConnected(true);
      if (snapshot.exists()) {
        setWalletBalance(Number(snapshot.val()));
      } else {
        // Initialize with default 25,000 EGP if empty in Firebase
        syncBalanceToFirebase(25000);
        setWalletBalance(25000);
      }
    }, (error) => {
      console.warn('Firebase balance connection failed, falling back to local storage:', error);
      setIsFirebaseConnected(false);
    });

    // 2. Sync & listen to transaction logs
    const transactionsRef = ref(rtdb, 'mobicash/transactions');
    const unsubscribeTransactions = onValue(transactionsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (Array.isArray(data)) {
          setTransactions(data);
        } else if (data && typeof data === 'object') {
          setTransactions(Object.values(data));
        } else {
          setTransactions([]);
        }
      } else {
        // Initialize with default mock transactions if empty in Firebase
        syncTransactionsToFirebase(INITIAL_TRANSACTIONS);
        setTransactions(INITIAL_TRANSACTIONS);
      }
    }, (error) => {
      console.warn('Firebase transactions connection failed:', error);
    });

    return () => {
      unsubscribeBalance();
      unsubscribeTransactions();
    };
  }, []);

  // Sync state to local storage as fallback
  useEffect(() => {
    localStorage.setItem('mobicash_balance', walletBalance.toString());
  }, [walletBalance]);

  useEffect(() => {
    if (transactions.length > 0) {
      localStorage.setItem('mobicash_transactions', JSON.stringify(transactions));
    }
  }, [transactions]);

  // Trigger real-time player name lookup when ID changes
  useEffect(() => {
    if (playerId.trim().length >= 4) {
      setIsCheckingName(true);
      const timer = setTimeout(() => {
        const name = getPlayerName(playerId);
        setDetectedPlayerName(name);
        setIsCheckingName(false);
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setDetectedPlayerName('');
      setIsCheckingName(false);
    }
  }, [playerId]);

  // Show auto-dismiss toast helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Copy transaction ID
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    showToast('تم نسخ رقم العملية بنجاح', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Submission handler on the client portal
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerId || !depositAmount) {
      showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
      return;
    }

    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('يرجى إدخال مبلغ صحيح', 'error');
      return;
    }

    if (amountNum < selectedPlatform.minDeposit) {
      showToast(`الحد الأدنى للشحن في هذه المنصة هو ${selectedPlatform.minDeposit} ج.م`, 'error');
      return;
    }

    // Direct Insufficient Funds Check!
    if (amountNum > walletBalance) {
      showToast('خطأ: رصيد المحفظة غير كافٍ لإجراء هذه العملية! (Insufficient Funds)', 'error');
      return;
    }

    // Trigger Double-Confirmation Modal and set default item name
    setItemName(`شحن رصيد حساب ${selectedPlatform.name}`);
    setPendingConfirmTx({
      amount: amountNum,
      accountId: playerId.trim()
    });
  };

  // Complete transfer once confirmation prompt is accepted
  const executeConfirmedTransfer = () => {
    if (!pendingConfirmTx) return;
    const { amount, accountId } = pendingConfirmTx;

    if (amount > walletBalance) {
      showToast('خطأ: رصيد المحفظة غير كافٍ لإجراء هذه العملية! (Insufficient Funds)', 'error');
      setPendingConfirmTx(null);
      return;
    }

    setIsProcessingTx(true);

    const newTxId = 'TX' + Math.floor(100000 + Math.random() * 900000) + 'MC';
    const finalPlayerName = detectedPlayerName || getPlayerName(accountId);

    const remainingBalance = walletBalance - amount;
    const previousBalance = walletBalance;

    const newTransaction: Transaction = {
      id: newTxId,
      amount: amount,
      accountId: accountId,
      platformId: selectedPlatform.id,
      platformName: selectedPlatform.name,
      playerName: finalPlayerName,
      date: new Date().toISOString().split('T')[0],
      type: 'deposit',
      status: 'success',
      previousBalance: previousBalance,
      remainingBalance: remainingBalance
    };

    // Simulate transfer transaction processing
    setTimeout(() => {
      try {
        const updatedTransactions = [newTransaction, ...transactions];
        
        // Push both to Realtime Database & Firestore (asynchronous, non-blocking)
        syncBalanceToFirebase(remainingBalance).catch((err) => console.warn(err));
        syncTransactionsToFirebase(updatedTransactions).catch((err) => console.warn(err));

        setWalletBalance(remainingBalance);
        setTransactions(updatedTransactions);
        
        // Show detailed receipt
        setSuccessReceipt({
          ...newTransaction,
          itemName: itemName.trim() || `شحن رصيد ${selectedPlatform.name}`
        });

        // Reset form
        setPlayerId('');
        setPendingConfirmTx(null);
        showToast('تم إرسال وتأكيد التحويل بنجاح فوري!', 'success');
      } catch (err) {
        showToast('حدث خطأ أثناء معالجة البيانات', 'error');
      } finally {
        setIsProcessingTx(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-gray-100 flex flex-col items-center justify-center p-0 md:p-6 antialiased font-sans" dir="rtl">
      
      {/* Toast Notification Banner */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 16, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-4 z-50 px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold max-w-sm border ${
              toast.type === 'success' ? 'bg-emerald-500/95 border-emerald-400 text-white' :
              toast.type === 'error' ? 'bg-rose-500/95 border-rose-400 text-white' :
              'bg-blue-600/95 border-blue-500 text-white'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 shrink-0" />}
            {toast.type === 'error' && <Info className="w-5 h-5 shrink-0" />}
            {toast.type === 'info' && <RefreshCw className="w-5 h-5 shrink-0 animate-spin" />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main App Canvas - Smartphone Simulation Style */}
      <div className="w-full max-w-md bg-slate-950 md:rounded-[2.8rem] md:shadow-2xl md:border-8 md:border-slate-800 min-h-screen md:min-h-[850px] flex flex-col relative overflow-hidden">
        
        {/* Phone Notch */}
        <div className="hidden md:flex justify-center w-full absolute top-0 z-30">
          <div className="w-36 h-6 bg-slate-800 rounded-b-2xl"></div>
        </div>

        {/* Scrollable Main Area */}
        <div className="flex-1 flex flex-col overflow-y-auto pb-24">
          
          {/* Main Top Header Branding Section */}
          <div className="bg-gradient-to-b from-blue-700 to-indigo-900 text-white px-6 pt-12 pb-8 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
            
            {/* Ambient Background glows */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-white rounded-full blur-3xl"></div>
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-400 rounded-full blur-3xl"></div>
            </div>

            {/* Profile Line */}
            <div className="flex justify-between items-center mb-5 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/25">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-black tracking-tight">موبي كاش</h1>
                  <span className="text-[9px] text-blue-200 block">منظومة شحن فوري مؤمنة</span>
                </div>
              </div>
            </div>

            {/* Live Wallet Balance */}
            <div className="relative z-10 bg-slate-950/40 backdrop-blur-lg border border-white/10 p-4.5 rounded-2xl flex justify-between items-center">
              <div>
                <p className="text-blue-100 text-[11px] mb-0.5">رصيد محفظة موبي كاش الحالي</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black font-mono tracking-tight text-white">
                    {walletBalance.toLocaleString('en-US')}
                  </span>
                  <span className="text-blue-200 text-xs font-bold">ج.م</span>
                </div>
              </div>
              
              <div className="text-left flex flex-col items-end gap-1">
                <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/20 text-[9px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  {isFirebaseConnected ? 'متصل بالشبكة' : 'جاري الاتصال...'}
                </div>
                <span className="text-[8px] text-gray-400 font-mono">ID: admin-1930b</span>
              </div>
            </div>
          </div>

          {/* Dynamic Render based on Active Tab */}
          <div className="flex-1 px-6 -mt-6 space-y-5">
            
            {/* Active Info Banner */}
                <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 shadow-xl flex gap-3 items-center">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4.5 h-4.5 text-blue-400 animate-bounce" />
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-black text-white">بوابة شحن الحسابات المباشرة</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">اختر المنصة، أدخل الـ ID وحدد قيمة التحويل لتشحن فوريًا.</p>
                  </div>
                </div>

                {/* Form Selection Platform & Inputs */}
                <section className="bg-slate-900/60 border border-slate-800/85 rounded-3xl p-5 shadow-inner space-y-4">
                  
                  <div className="flex items-center justify-between mb-1 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4.5 bg-blue-500 rounded-full"></div>
                      <h2 className="text-sm font-black text-white">تفاصيل شحن الحساب فوريًا</h2>
                    </div>
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-lg border border-blue-500/20 font-bold">معتمد</span>
                  </div>

                  {/* MegaPari and WowBit ONLY as requested */}
                  <div className="mb-4">
                    <label className="block text-[11px] font-bold text-gray-400 mb-2 mr-1">
                      اختر المنصة المعتمدة للتحويل الفوري:
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {PLATFORMS.map((platform) => {
                        const isSelected = selectedPlatform.id === platform.id;
                        return (
                          <button
                            key={platform.id}
                            type="button"
                            onClick={() => setSelectedPlatform(platform)}
                            className={`py-3.5 px-2 rounded-2xl border text-center transition-all active:scale-95 cursor-pointer text-xs font-black flex flex-col items-center gap-1.5 justify-center ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-600/15 text-blue-400 shadow-md shadow-blue-500/5'
                                : 'border-slate-800 bg-slate-950 text-gray-500 hover:bg-slate-900'
                            }`}
                          >
                            <span className="text-xs font-bold">{platform.name}</span>
                            <span className="text-[8px] font-mono opacity-50">قناة شحن مفعلة</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    
                    {/* Player ID Field */}
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1.5 mr-1">
                        رقم حساب اللاعب (ID)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={playerId}
                          onChange={(e) => setPlayerId(e.target.value.replace(/\D/g, ''))}
                          placeholder="مثال: 882341 أو 123456"
                          className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blue-500 rounded-2xl py-3.5 px-4 pr-11 text-left font-bold text-white placeholder:text-gray-700 outline-none transition-all font-mono text-sm"
                          required
                        />
                        <User className="absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-500" />
                      </div>

                      {/* Real-time Dynamic Player Name Verification Box */}
                      <div className="mt-1.5 min-h-[34px] flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800/80">
                        {isCheckingName ? (
                          <div className="flex items-center gap-2 text-[10px] text-blue-400">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>جاري التحقق التلقائي...</span>
                          </div>
                        ) : playerId.trim().length >= 4 ? (
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-1 text-[10px] text-right">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span className="text-gray-500">الاسم المكتشف:</span>
                              <span className="text-emerald-400 font-extrabold">{detectedPlayerName}</span>
                            </div>
                            <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-black border border-emerald-500/20">موثق</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[9px] text-gray-500">
                            <Info className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                            <span>أدخل المعرف لتوليد وعرض اسم اللاعب فوريًا</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Amount Field */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5 mr-1">
                        <label className="block text-xs font-bold text-gray-400">
                          مبلغ الشحن المطلوب (ج.م)
                        </label>
                        <span className="text-[9px] font-black text-amber-500">الحد الأدنى: {selectedPlatform.minDeposit} ج.م</span>
                      </div>
                      
                      <div className="relative">
                        <input
                          type="number"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blue-500 rounded-2xl py-3.5 px-4 pr-11 text-left font-bold text-white placeholder:text-gray-700 outline-none transition-all font-mono text-sm"
                          required
                        />
                        <CreditCard className="absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-500" />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">ج.م</span>
                      </div>

                      {/* Speed presets */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5 justify-end">
                        {['150', '500', '2000', '5000', '10000', '25000'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setDepositAmount(preset)}
                            className={`text-[10px] font-black px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                              depositAmount === preset 
                                ? 'bg-blue-600 text-white border-blue-500' 
                                : 'bg-slate-950 text-gray-400 border-slate-850 hover:bg-slate-900'
                            }`}
                          >
                            {parseInt(preset).toLocaleString()} ج.م
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Submit action button */}
                    <button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-4 font-black text-sm shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                    >
                      <span>تأكيد الشحن الفوري والناجح</span>
                    </button>
                  </form>
                </section>

                {/* Guide to Test IDs */}
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-xs text-gray-400 space-y-2">
                  <span className="font-bold text-gray-200 block">💡 دليل معرفات اللاعبين التجريبية لمشاهدة الأسماء المتغيرة:</span>
                  <div className="grid grid-cols-2 gap-2 mt-1 font-mono text-[9.5px]">
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-850">
                      <span className="text-blue-400 font-bold">882341</span>
                      <div className="text-gray-500 text-[10px]">مروان عبد العزيز الجبالي</div>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-850">
                      <span className="text-blue-400 font-bold">123456</span>
                      <div className="text-gray-500 text-[10px]">أحمد محمد العشري</div>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-850">
                      <span className="text-blue-400 font-bold">991203</span>
                      <div className="text-gray-500 text-[10px]">كريم حسام المنشاوي</div>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-850">
                      <span className="text-blue-400 font-bold">112233</span>
                      <div className="text-gray-500 text-[10px]">يوسف صلاح الدين رضوان</div>
                    </div>
                  </div>
                </div>

                {/* Completed Transactions Section */}
                <section className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-black text-gray-300">سجل العمليات المكتملة المتزامنة</h2>
                    <span className="text-[10px] text-gray-500 font-bold">العدد: {transactions.length}</span>
                  </div>

                  <div className="space-y-2.5">
                    {transactions.length === 0 ? (
                      <div className="text-center py-8 text-xs text-gray-500 bg-slate-900/40 rounded-2xl border border-slate-800/60">
                        لا توجد عمليات مسجلة حاليًا.
                      </div>
                    ) : (
                      transactions.map((tx) => {
                        const isWalletCharge = tx.type === 'wallet_charge';
                        return (
                          <div key={tx.id} className={`bg-slate-900 p-4 rounded-2xl flex flex-col gap-3 border ${isWalletCharge ? 'border-emerald-500/20' : 'border-slate-800/60'} shadow-sm`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 ${isWalletCharge ? 'bg-emerald-500/10' : 'bg-rose-500/10'} rounded-full flex items-center justify-center shrink-0`}>
                                  {isWalletCharge ? (
                                    <PlusCircle className="w-4.5 h-4.5 text-emerald-400" />
                                  ) : (
                                    <CheckIcon className="w-4.5 h-4.5 text-emerald-400" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-extrabold text-gray-200 text-xs">
                                    {tx.platformName} <span className="font-mono text-gray-500 text-[10px]">{tx.accountId !== 'SYSTEM' && `(ID: ${tx.accountId})`}</span>
                                  </p>
                                  <p className="text-[10px] text-gray-500 font-medium">{tx.playerName} • {tx.date}</p>
                                </div>
                              </div>
                              
                              <div className="text-left shrink-0">
                                <p className={`font-black text-xs ${isWalletCharge ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {isWalletCharge ? '+' : '-'}
                                  {tx.amount.toLocaleString('en-US')} ج.م
                                </p>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full inline-block mt-1 border ${
                                  isWalletCharge 
                                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                                    : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                }`}>
                                  ناجحة
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

          </div>
        </div>

        {/* Bottom Navigation Simulation Bar */}
        <nav className="fixed bottom-0 left-0 w-full bg-slate-900 border-t border-slate-800/80 px-8 py-4 flex justify-around items-center z-20">
          <a 
            href="/" 
            className="flex flex-col items-center gap-1 text-blue-500 hover:text-blue-400"
          >
            <Wallet className="w-6 h-6" />
            <span className="text-[10px] font-bold">بوابة العميل</span>
          </a>
          <button onClick={() => showToast('الحماية المتقدمة نشطة ومؤمنة بالكامل بالشبكة السحابية الآمنة', 'success')} className="flex flex-col items-center gap-1 text-gray-500 hover:text-gray-300 cursor-pointer">
            <ShieldCheck className="w-6 h-6" />
            <span className="text-[10px] font-medium">الأمان</span>
          </button>
          <button onClick={() => showToast('وكيل رقم: 494006 - متصل ومؤمن بالشبكة السحابية الآمنة', 'info')} className="flex flex-col items-center gap-1 text-gray-500 hover:text-gray-300 cursor-pointer">
            <User className="w-6 h-6" />
            <span className="text-[10px] font-medium">الحساب</span>
          </button>
        </nav>

        {/* Double-Confirmation Transfer Dialog */}
        <AnimatePresence>
          {pendingConfirmTx && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 25 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-sm p-6 overflow-hidden relative shadow-2xl text-right"
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-blue-500"></div>
                
                <button 
                  onClick={() => setPendingConfirmTx(null)}
                  className="absolute left-4 top-4 text-gray-400 hover:text-white bg-slate-800 p-2 rounded-full cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="text-center my-4">
                  <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-blue-500/30">
                    <ShieldAlert className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-black text-blue-400">تأكيد عملية التحويل</h3>
                  <p className="text-gray-400 text-[11px] mt-1">يرجى تأكيد تفاصيل العملية وإدخال اسم السلعة لإتمام الشحن</p>
                </div>

                <div className="space-y-2.5 bg-slate-950/80 p-4.5 rounded-2xl border border-slate-800 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">المنصة:</span>
                    <span className="font-extrabold text-white">{selectedPlatform.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">معرف اللاعب:</span>
                    <span className="font-mono font-bold text-gray-200">{pendingConfirmTx.accountId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">اسم اللاعب:</span>
                    <span className="font-bold text-emerald-400">{detectedPlayerName || getPlayerName(pendingConfirmTx.accountId)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">القيمة المالية للتحويل:</span>
                    <span className="font-black text-white">{pendingConfirmTx.amount.toLocaleString()} ج.م</span>
                  </div>
                  
                  <hr className="border-slate-800 my-2" />

                  {/* PROMPT: Ask for the item name before confirming */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-amber-400">
                      اسم السلعة / الخدمة المطلوبة:
                    </label>
                    <input
                      type="text"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      placeholder="مثال: شحن رصيد ألعاب، باقة، عملات"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-white outline-none font-bold"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-5">
                  <button
                    onClick={() => setPendingConfirmTx(null)}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl cursor-pointer text-xs transition-colors"
                  >
                    إلغاء وتراجع
                  </button>
                  <button
                    onClick={executeConfirmedTransfer}
                    disabled={isProcessingTx || !itemName.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl cursor-pointer text-xs transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {isProcessingTx ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <span>تأكيد وشحن الآن</span>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Polished Detailed Receipt Modal Overlay */}
        <AnimatePresence>
          {successReceipt && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 25 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-sm p-6 overflow-hidden relative shadow-2xl text-right"
              >
                {/* Visual success receipts color code */}
                <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
                
                <button 
                  onClick={() => setSuccessReceipt(null)}
                  className="absolute left-4 top-4 text-gray-400 hover:text-white bg-slate-800 p-2 rounded-full cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="text-center my-4">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-500/30">
                    <CheckCircle2 className="w-9 h-9 text-emerald-400 animate-pulse" />
                  </div>
                  <h3 className="text-lg font-black text-emerald-400">إيصال تأكيد شحن السلعة</h3>
                  <p className="text-gray-400 text-[10px] mt-1">تم توثيق وتأكيد العملية وإتمام التحويل بنجاح فوري</p>
                </div>

                <div className="space-y-2.5 bg-slate-950/80 p-4.5 rounded-2xl border border-slate-800 text-xs font-medium">
                  <div className="flex justify-between">
                    <span className="text-gray-500">اسم السلعة / الخدمة:</span>
                    <span className="font-extrabold text-amber-400">{successReceipt.itemName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">المنصة المعتمدة:</span>
                    <span className="font-extrabold text-blue-400">{successReceipt.platformName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">رقم حساب اللاعب:</span>
                    <span className="font-mono font-bold text-gray-200">{successReceipt.accountId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">اسم اللاعب الموثق:</span>
                    <span className="font-bold text-emerald-400">{successReceipt.playerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">قيمة التحويل:</span>
                    <span className="font-black text-white">{successReceipt.amount.toLocaleString()} ج.م</span>
                  </div>
                  {successReceipt.previousBalance !== undefined && (
                    <div className="flex justify-between text-gray-450 border-t border-slate-800/40 pt-1.5 text-[11px]">
                      <span>الرصيد قبل الشحن (Y):</span>
                      <span className="font-mono font-bold text-gray-300">{successReceipt.previousBalance.toLocaleString()} ج.م</span>
                    </div>
                  )}
                  {successReceipt.remainingBalance !== undefined && (
                    <div className="flex justify-between text-blue-300 font-bold text-[11px]">
                      <span>الرصيد المتبقي فوريًا (X):</span>
                      <span className="font-mono text-emerald-400">{successReceipt.remainingBalance.toLocaleString()} ج.م</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">حالة العملية:</span>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">ناجحة ومسجلة</span>
                  </div>
                  
                  <hr className="border-slate-800 my-2" />
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-[10px]">رقم المرجع (Ref ID):</span>
                    <button 
                      onClick={() => handleCopyId(successReceipt.id)}
                      className="font-mono text-[11px] text-gray-300 flex items-center gap-1 hover:text-white"
                      title="نسخ رقم المعاملة"
                    >
                      <span>{successReceipt.id}</span>
                      {copiedId === successReceipt.id ? (
                        <CheckIcon className="w-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setSuccessReceipt(null)}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl py-3.5 mt-5 cursor-pointer transition-colors text-xs"
                >
                  إغلاق ومتابعة العمليات الأخرى
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
