import React, { useState, useEffect } from 'react';
import { Camera, Send, Info } from 'lucide-react';
import { AppState, PpobMode } from '../types/ipos';
import { formatRp, getWalletNameById } from '../utils/storage';

const PPOB_CONFIG: Record<
  PpobMode,
  { providers: string[]; presets: { desc: string; modal: number; sell: number }[] }
> = {
  pulsa: {
    providers: ['Telkomsel', 'Indosat Ooredoo', 'XL Axiata', 'Tri (3)', 'Smartfren', 'Axis'],
    presets: [
      { desc: 'Pulsa 10.000', modal: 10200, sell: 12000 },
      { desc: 'Pulsa 20.000', modal: 20100, sell: 22000 },
      { desc: 'Pulsa 25.000', modal: 24900, sell: 27000 },
      { desc: 'Pulsa 50.000', modal: 49500, sell: 52000 },
      { desc: 'Kuota Data 5GB', modal: 18000, sell: 22000 },
      { desc: 'Kuota Data 10GB', modal: 28000, sell: 33000 },
    ],
  },
  transfer: {
    providers: [
      'Transfer Sesama BRI',
      'Transfer BCA',
      'Transfer Mandiri',
      'Transfer BNI',
      'Transfer SeaBank / Jago',
    ],
    presets: [
      { desc: 'Transfer Rp 100.000', modal: 100000, sell: 103000 },
      { desc: 'Transfer Rp 500.000', modal: 500000, sell: 505000 },
      { desc: 'Transfer Rp 1.000.000', modal: 1000000, sell: 1005000 },
      { desc: 'Transfer Rp 2.500.000', modal: 2500000, sell: 2510000 },
    ],
  },
  tarik: {
    providers: [
      'Tarik Tunai Kartu BRI / EDC',
      'Tarik Tunai Kartu Bank Lain',
      'Tarik Tunai Bansos / PKH',
      'Tarik Tunai QRIS',
    ],
    presets: [
      { desc: 'Tarik Tunai Rp 200.000', modal: 200000, sell: 203000 },
      { desc: 'Tarik Tunai Rp 500.000', modal: 500000, sell: 505000 },
      { desc: 'Tarik Tunai Rp 1.000.000', modal: 1000000, sell: 1005000 },
      { desc: 'Tarik Tunai Rp 2.000.000', modal: 2000000, sell: 2010000 },
    ],
  },
  ewallet: {
    providers: ['TopUp DANA', 'TopUp OVO', 'TopUp GoPay', 'TopUp ShopeePay', 'Token Listrik PLN'],
    presets: [
      { desc: 'TopUp / Token 20.000', modal: 20100, sell: 22500 },
      { desc: 'TopUp / Token 50.000', modal: 50100, sell: 52500 },
      { desc: 'TopUp / Token 100.000', modal: 100100, sell: 103000 },
      { desc: 'TopUp / Token 200.000', modal: 200100, sell: 203000 },
    ],
  },
};

interface PpobViewProps {
  appState: AppState;
  mode: PpobMode;
  setMode: (m: PpobMode) => void;
  ocrPrefill?: { target: string; desc: string; modal: number; sell: number; key: number } | null;
  onOpenOcr: () => void;
  onSubmitPpob: (params: {
    mode: PpobMode;
    provider: string;
    target: string;
    prodDesc: string;
    customer: string;
    srcWallet: string;
    dstWallet: string;
    modal: number;
    sell: number;
  }) => Promise<void>;
}

export const PpobView: React.FC<PpobViewProps> = ({
  appState,
  mode,
  setMode,
  ocrPrefill,
  onOpenOcr,
  onSubmitPpob,
}) => {
  const cfg = PPOB_CONFIG[mode];
  const [provider, setProvider] = useState(cfg.providers[0]);
  const [targetNumber, setTargetNumber] = useState('');
  const [prodDesc, setProdDesc] = useState(cfg.presets[0].desc);
  const [customerName, setCustomerName] = useState('');
  const [srcWallet, setSrcWallet] = useState('SALDO_PULSA');
  const [dstWallet, setDstWallet] = useState('KAS_TOKO');
  const [modalAmount, setModalAmount] = useState(cfg.presets[0].modal);
  const [sellAmount, setSellAmount] = useState(cfg.presets[0].sell);

  useEffect(() => {
    const c = PPOB_CONFIG[mode];
    setProvider(c.providers[0]);
    setProdDesc(c.presets[0].desc);
    setModalAmount(c.presets[0].modal);
    setSellAmount(c.presets[0].sell);
    if (mode === 'transfer') {
      setSrcWallet(appState.wallets['SALDO_BRILINK'] !== undefined ? 'SALDO_BRILINK' : appState.walletList[0]?.id || '');
      setDstWallet(appState.wallets['KAS_TOKO'] !== undefined ? 'KAS_TOKO' : appState.walletList[0]?.id || '');
    } else if (mode === 'tarik') {
      setSrcWallet(appState.wallets['KAS_TOKO'] !== undefined ? 'KAS_TOKO' : appState.walletList[0]?.id || '');
      setDstWallet(appState.wallets['SALDO_BRILINK'] !== undefined ? 'SALDO_BRILINK' : appState.walletList[0]?.id || '');
    } else {
      setSrcWallet(appState.wallets['SALDO_PULSA'] !== undefined ? 'SALDO_PULSA' : appState.walletList[0]?.id || '');
      setDstWallet(appState.wallets['KAS_TOKO'] !== undefined ? 'KAS_TOKO' : appState.walletList[0]?.id || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (ocrPrefill) {
      setTargetNumber(ocrPrefill.target);
      setProdDesc(ocrPrefill.desc);
      setModalAmount(ocrPrefill.modal);
      setSellAmount(ocrPrefill.sell);
    }
  }, [ocrPrefill?.key]);

  const profit = sellAmount - modalAmount;
  const recentLoket = appState.transactions
    .filter((t) => t.module === 'PPOB' || t.module === 'BRILINK')
    .slice(0, 6);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmitPpob({
      mode,
      provider,
      target: targetNumber.trim(),
      prodDesc: prodDesc.trim(),
      customer: customerName.trim() || 'Pelanggan Umum',
      srcWallet,
      dstWallet,
      modal: modalAmount,
      sell: sellAmount,
    });
    setTargetNumber('');
  };

  return (
    <div className="p-3 sm:p-4 max-w-6xl mx-auto space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="ipos-panel rounded-lg p-3">
          <div className="text-slate-500 font-bold">Saldo Rekening BRILink</div>
          <div className="text-lg font-extrabold font-mono text-blue-800 tabular-nums mt-0.5">
            Rp {formatRp(appState.wallets['SALDO_BRILINK'] || 0)}
          </div>
        </div>
        <div className="ipos-panel rounded-lg p-3">
          <div className="text-slate-500 font-bold">Deposit Server Pulsa &amp; PPOB</div>
          <div className="text-lg font-extrabold font-mono text-purple-800 tabular-nums mt-0.5">
            Rp {formatRp(appState.wallets['SALDO_PULSA'] || 0)}
          </div>
        </div>
        <div className="ipos-panel rounded-lg p-3">
          <div className="text-slate-500 font-bold">Kas Tunai Laci Toko</div>
          <div className="text-lg font-extrabold font-mono text-emerald-800 tabular-nums mt-0.5">
            Rp {formatRp(appState.wallets['KAS_TOKO'] || 0)}
          </div>
        </div>
      </div>

      <div className="ipos-panel rounded-lg overflow-hidden">
        <div className="ipos-panel-header px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(
              [
                ['pulsa', 'Pulsa & Paket Data'],
                ['transfer', 'Transfer Bank (BRILink)'],
                ['tarik', 'Tarik Tunai ATM/PKH'],
                ['ewallet', 'E-Wallet & Token PLN'],
              ] as [PpobMode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`ipos-tab px-3 py-1 rounded-t font-bold whitespace-nowrap ${
                  mode === m ? 'active' : ''
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onOpenOcr}
            className="ipos-btn px-2.5 py-1 rounded text-xs font-bold text-sky-800 flex items-center gap-1"
          >
            <Camera className="w-3.5 h-3.5" /> Scan Bukti Transfer
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
          <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold mb-1">Provider / Bank Layanan</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold"
                >
                  {cfg.providers.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">No. HP / Rekening / ID Pelanggan</label>
                <input
                  type="text"
                  value={targetNumber}
                  onChange={(e) => setTargetNumber(e.target.value)}
                  required
                  placeholder="0812xxxx / No. Rek Tujuan"
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold mb-1">Uraian Produk / Nominal</label>
                <input
                  type="text"
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Nama Pelanggan / Pengirim</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Pelanggan Umum"
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold mb-1">Sumber Saldo Keluar (Modal)</label>
                <select
                  value={srcWallet}
                  onChange={(e) => setSrcWallet(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
                >
                  {appState.walletList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatRp(appState.wallets[w.id] || 0)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Tujuan Uang Masuk (Bayar)</label>
                <select
                  value={dstWallet}
                  onChange={(e) => setDstWallet(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
                >
                  {appState.walletList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatRp(appState.wallets[w.id] || 0)})
                    </option>
                  ))}
                  <option value="PIUTANG_TEMPO">TEMPO / KASBON (MASUK PIUTANG)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block font-bold mb-1">Modal / Pokok (Rp)</label>
                <input
                  type="number"
                  value={modalAmount}
                  onChange={(e) => setModalAmount(Number(e.target.value))}
                  required
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Harga Jual / Total (Rp)</label>
                <input
                  type="number"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(Number(e.target.value))}
                  required
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-blue-800"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Fee / Laba Bersih</label>
                <div className="bg-emerald-50 border border-emerald-300 rounded px-2.5 py-1.5 font-mono font-extrabold text-emerald-700 tabular-nums">
                  {formatRp(profit)}
                </div>
              </div>
            </div>

            <div className="bg-sky-50 border border-sky-200 rounded p-2 text-[11px] text-sky-900 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>
                <b>Jurnal Otomatis:</b> Saldo <b>{getWalletNameById(srcWallet, appState.walletList)}</b> berkurang{' '}
                <b>{formatRp(modalAmount)}</b>, dan <b>{getWalletNameById(dstWallet, appState.walletList)}</b> bertambah{' '}
                <b>{formatRp(sellAmount)}</b>.
              </span>
            </div>

            <button
              type="submit"
              className="w-full ipos-btn-primary py-2 rounded font-bold shadow flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Proses Transaksi &amp; Cetak Struk
            </button>
          </form>

          <div className="lg:col-span-5 space-y-3">
            <div>
              <div className="font-bold text-slate-700 mb-1.5">Pilihan Nominal Cepat:</div>
              <div className="grid grid-cols-2 gap-2">
                {cfg.presets.map((pr) => (
                  <button
                    key={pr.desc}
                    type="button"
                    onClick={() => {
                      setProdDesc(pr.desc);
                      setModalAmount(pr.modal);
                      setSellAmount(pr.sell);
                    }}
                    className="ipos-btn p-2 rounded text-left"
                  >
                    <div className="font-bold text-slate-800">{pr.desc}</div>
                    <div className="text-[11px] font-mono text-blue-800 font-bold">
                      Jual: {formatRp(pr.sell)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="font-bold text-slate-700 mb-1.5">Transaksi Loket Terakhir:</div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {recentLoket.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white border border-slate-200 rounded p-2 flex items-center justify-between"
                  >
                    <div className="truncate pr-2">
                      <div className="font-bold text-slate-800 truncate">{t.description}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {t.id} &middot; {t.customer}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-blue-800">{formatRp(t.total)}</div>
                      <div className="text-[10px] font-mono text-emerald-700">
                        +{formatRp(t.profit)}
                      </div>
                    </div>
                  </div>
                ))}
                {recentLoket.length === 0 && (
                  <div className="text-slate-400 italic">Belum ada riwayat loket.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
