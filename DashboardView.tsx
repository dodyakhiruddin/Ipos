import React from 'react';
import {
  Store,
  Phone,
  Globe,
  Edit3,
  Wifi,
  Smartphone,
  Wallet,
  TrendingUp,
  Coins,
  Landmark,
  ArrowLeftRight,
  HandCoins,
  Camera,
  LayoutGrid,
  Gauge,
  Database,
  FileText,
  ShoppingCart,
  Zap,
  Wrench,
  CreditCard,
  Scale,
  BarChart3,
  BookOpen,
  ShieldCheck,
  Receipt,
  ChevronRight,
} from 'lucide-react';
import { AppState, PpobMode, TabId } from '../types/ipos';
import {
  formatRp,
  getPhysicalStockItems,
  getTotalPhysicalStockAssetValue,
} from '../utils/storage';

interface DashboardViewProps {
  appState: AppState;
  activeDatabaseName: string;
  onSwitchTab: (tab: TabId, ppobMode?: PpobMode) => void;
  onOpenSettings: (tab: 'general') => void;
  onOpenOcr: (mode: 'ppob') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  appState,
  activeDatabaseName,
  onSwitchTab,
  onOpenSettings,
  onOpenOcr,
}) => {
  const physicalItems = getPhysicalStockItems(appState.items);
  const assetVal = getTotalPhysicalStockAssetValue(appState.items);
  const walletTotal = appState.walletList.reduce(
    (sum, w) => sum + (Number(appState.wallets[w.id]) || 0),
    0
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayProfit = appState.transactions
    .filter((t) => (t.date || '').slice(0, 10) === todayStr)
    .reduce((sum, t) => sum + (Number(t.profit) || 0), 0);

  const lastTrx = appState.transactions[0];

  const layananList: {
    label: string;
    icon: React.ReactNode;
    tab: TabId;
    mode?: PpobMode;
  }[] = [
    {
      label: 'Pulsa & Paket Data',
      icon: <Smartphone className="w-3.5 h-3.5 text-amber-400" />,
      tab: 'ppob',
      mode: 'pulsa',
    },
    {
      label: 'Token Listrik',
      icon: <Zap className="w-3.5 h-3.5 text-amber-400" />,
      tab: 'ppob',
      mode: 'ewallet',
    },
    {
      label: 'Pembayaran BPJS',
      icon: <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />,
      tab: 'ppob',
      mode: 'ewallet',
    },
    {
      label: 'Top Up E-Wallet',
      icon: <Wallet className="w-3.5 h-3.5 text-amber-400" />,
      tab: 'ppob',
      mode: 'ewallet',
    },
    {
      label: 'Transfer Antar Bank',
      icon: <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />,
      tab: 'ppob',
      mode: 'transfer',
    },
    {
      label: 'Pembayaran Tagihan',
      icon: <Receipt className="w-3.5 h-3.5 text-amber-400" />,
      tab: 'ppob',
      mode: 'ewallet',
    },
    {
      label: 'Service HP',
      icon: <Wrench className="w-3.5 h-3.5 text-amber-400" />,
      tab: 'servicehp',
    },
  ];

  const shortcutItems: { tab: TabId; label: string; icon: React.ReactNode }[] = [
    { tab: 'dashboard', label: 'Dashboard', icon: <Gauge className="w-5 h-5 text-amber-500" /> },
    { tab: 'masterdata', label: 'Master Data', icon: <Database className="w-5 h-5 text-orange-600" /> },
    { tab: 'pembelian', label: 'Pembelian', icon: <FileText className="w-5 h-5 text-indigo-600" /> },
    { tab: 'kasir', label: 'Penjualan', icon: <ShoppingCart className="w-5 h-5 text-emerald-600" /> },
    { tab: 'ppob', label: 'Transaksi PPOB', icon: <Zap className="w-5 h-5 text-yellow-500" /> },
    { tab: 'servicehp', label: 'Service HP', icon: <Wrench className="w-5 h-5 text-rose-600" /> },
    { tab: 'cetakvoucher', label: 'Pembuatan Voucher Fisik', icon: <CreditCard className="w-5 h-5 text-cyan-600" /> },
    { tab: 'sumberdana', label: 'Sumber Dana', icon: <Wallet className="w-5 h-5 text-teal-600" /> },
    { tab: 'utangpiutang', label: 'Utang & Piutang', icon: <HandCoins className="w-5 h-5 text-amber-600" /> },
    { tab: 'akuntansi', label: 'Akutansi', icon: <Scale className="w-5 h-5 text-purple-600" /> },
    { tab: 'laporan', label: 'Laporan', icon: <BarChart3 className="w-5 h-5 text-sky-600" /> },
    { tab: 'petunjuk', label: 'Petunjuk', icon: <BookOpen className="w-5 h-5 text-lime-600" /> },
  ];

  return (
    <div className="min-h-full p-4 sm:p-6 flex flex-col justify-between">
      <div className="max-w-6xl mx-auto w-full my-auto space-y-4">
        {/* HEADER BRANDING DONET CELL */}
        <div className="text-center pt-1 pb-1">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight drop-shadow-sm">
            <span className="text-[#005aa7]">DONET</span>{' '}
            <span className="text-[#e67300]">CELL</span>
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-600 mt-1">
            Dashboard BRILink &middot; Transfer Antar Bank &middot; Layanan Pulsa &amp; Data
          </p>
        </div>

        {/* STORE PROFILE BAR */}
        <div className="ipos-panel rounded-xl p-3.5 sm:p-4 bg-gradient-to-r from-white via-sky-50/40 to-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#005aa7] text-white flex items-center justify-center shadow shrink-0">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base sm:text-lg font-extrabold text-[#0c2d57]">
                {appState.settings.storeName || `DONET CELL [${activeDatabaseName}]`}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                {appState.settings.storeAddress || '-'}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 mt-1">
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-[#005aa7]" /> Telp/WA:{' '}
                  {appState.settings.storePhone || '-'}
                </span>
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3 text-[#e67300]" />{' '}
                  {appState.settings.storeWebsite || '-'}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenSettings('general')}
            className="ipos-btn px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-slate-700 shrink-0 whitespace-nowrap"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#005aa7]" /> Edit Profil Toko
          </button>
        </div>

        {/* SHOWCASE BANNER DONET CELL & BRILINK + PAPAN LAYANAN */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Papan Layanan DONET CELL (Royal Blue + Orange Border) */}
          <div className="lg:col-span-4 rounded-xl bg-gradient-to-b from-[#004e98] to-[#00346b] border-2 border-[#f97316] text-white p-3.5 shadow-md flex flex-col justify-between">
            <div>
              <div className="text-center border-b border-orange-400/50 pb-2 mb-2.5">
                <div className="text-xs font-semibold tracking-wider text-sky-200 uppercase">
                  Layanan Konter &amp; Agen
                </div>
                <div className="text-lg font-black tracking-wide text-white">
                  LAYANAN <span className="text-[#fb923c]">DONET CELL</span>
                </div>
              </div>
              <div className="space-y-1">
                {layananList.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => onSwitchTab(item.tab, item.mode)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-[#f97316] text-left text-xs font-semibold transition cursor-pointer group"
                  >
                    <span className="flex items-center gap-2">
                      <span className="group-hover:text-white">{item.icon}</span>
                      <span>{item.label}</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-70 group-hover:translate-x-0.5 transition" />
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-white/15 flex items-center justify-between text-[11px] text-sky-100">
              <span className="font-bold text-orange-300">BRILink Resmi</span>
              <span>Melayani Dengan Sepenuh Hati</span>
            </div>
          </div>

          {/* Visual Counter Showcase DONET CELL x BRILink */}
          <div className="lg:col-span-8 rounded-xl overflow-hidden border border-[#005aa7]/30 shadow-md relative bg-[#004488] flex flex-col justify-between min-h-[250px]">
            <img
              src="/assets/aistudio/image_2e695a0e.png"
              alt="Konter DONET CELL & Agen BRILink"
              className="w-full h-full object-cover object-center absolute inset-0"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#061f3e]/95 via-[#061f3e]/35 to-[#061f3e]/75" />

            {/* Top Banner Strip */}
            <div className="relative z-10 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-2">
              <div className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow flex items-center gap-2">
                <span className="font-black text-sm sm:text-base tracking-tight">
                  <span className="text-[#005aa7]">DONET</span>{' '}
                  <span className="text-[#e67300]">CELL</span>
                </span>
                <span className="hidden sm:inline text-[11px] text-slate-600 font-semibold border-l border-slate-300 pl-2">
                  Pulsa &bull; Data &bull; Service &bull; Transfer
                </span>
              </div>
              <div className="bg-[#00529c]/95 border border-orange-400/70 text-white px-3 py-1.5 rounded-lg shadow text-right">
                <div className="text-xs sm:text-sm font-black tracking-wide">
                  <span className="text-white">BRI</span>
                  <span className="text-[#fb923c]">Link</span>
                </div>
                <div className="text-[10px] text-sky-100">
                  Transaksi Lebih Mudah, Dekat Dengan Anda
                </div>
              </div>
            </div>

            {/* Bottom Action Overlay */}
            <div className="relative z-10 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div className="text-white">
                <div className="text-xs font-bold uppercase tracking-wider text-orange-300">
                  Operasional Harian &bull; {activeDatabaseName}
                </div>
                <div className="text-base sm:text-lg font-extrabold leading-snug">
                  Pusat Transaksi Konter, Grosir Voucher &amp; Agen BRILink
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onSwitchTab('kasir')}
                  className="bg-[#f97316] hover:bg-[#ea580c] text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer transition"
                >
                  <ShoppingCart className="w-3.5 h-3.5" /> Kasir Penjualan (F2)
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchTab('ppob', 'transfer')}
                  className="bg-[#005aa7] hover:bg-[#004687] border border-sky-300/40 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Landmark className="w-3.5 h-3.5" /> Transfer BRILink
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 3 SUMMARY OPERATIONAL PANELS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className="lg:col-span-4 ipos-panel rounded-xl p-4 flex flex-col justify-between bg-gradient-to-b from-white to-sky-50/70">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-sky-800 tracking-wide">Produk Digital</span>
                <Wifi className="w-4 h-4 text-sky-600" />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => onSwitchTab('ppob', 'pulsa')}
                  className="text-left rounded-lg p-3 text-white bg-gradient-to-br from-rose-500 to-red-600 shadow hover:scale-[1.02] transition cursor-pointer"
                >
                  <div className="text-[11px] opacity-90">Pulsa Telkomsel</div>
                  <div className="text-lg font-extrabold font-mono">25rb</div>
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchTab('ppob', 'pulsa')}
                  className="text-left rounded-lg p-3 text-slate-900 bg-gradient-to-br from-amber-300 to-yellow-500 shadow hover:scale-[1.02] transition cursor-pointer"
                >
                  <div className="text-[11px] font-semibold">Kuota Data</div>
                  <div className="text-lg font-extrabold font-mono">10GB</div>
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchTab('ppob', 'pulsa')}
                  className="text-left rounded-lg p-3 text-white bg-gradient-to-br from-blue-500 to-indigo-600 shadow hover:scale-[1.02] transition cursor-pointer"
                >
                  <div className="text-[11px] opacity-90">Pulsa XL</div>
                  <div className="text-lg font-extrabold font-mono">20rb</div>
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchTab('ppob', 'ewallet')}
                  className="text-left rounded-lg p-3 text-white bg-gradient-to-br from-pink-500 to-rose-600 shadow hover:scale-[1.02] transition cursor-pointer"
                >
                  <div className="text-[11px] opacity-90">Dana / OVO</div>
                  <div className="text-lg font-extrabold font-mono">50rb</div>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSwitchTab('masterdata')}
              className="mt-4 w-full ipos-btn-primary py-2 rounded font-semibold text-xs shadow flex items-center justify-center gap-2"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Stok Barang Fisik ({physicalItems.length} Item)</span>
            </button>
          </div>

          <div className="lg:col-span-4 ipos-panel rounded-xl p-4 flex flex-col justify-between bg-gradient-to-b from-white to-emerald-50/70">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-emerald-800 tracking-wide">
                  Keuangan &amp; Saldo
                </span>
                <Wallet className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="bg-[#0b2545] text-white rounded-lg p-3.5 shadow-inner mb-3">
                <div className="text-[11px] text-sky-300">Total Gabungan Kas &amp; Saldo</div>
                <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-0.5 tabular-nums">
                  Rp {formatRp(walletTotal + assetVal)}
                </div>
                <div className="text-[10.5px] text-slate-300 mt-1">
                  Kas + Rek BRILink + Server Pulsa + Aset Barang Fisik (
                  <span className="text-amber-300 font-mono">{formatRp(assetVal)}</span>)
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-emerald-800">
                    Laba Bersih Hari Ini
                  </div>
                  <div className="text-lg font-extrabold font-mono text-emerald-700 tabular-nums">
                    Rp {formatRp(todayProfit)}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSwitchTab('sumberdana')}
              className="mt-4 w-full ipos-btn-success py-2 rounded font-semibold text-xs shadow flex items-center justify-center gap-2"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Kelola Sumber Dana &amp; Mutasi</span>
            </button>
          </div>

          <div className="lg:col-span-4 ipos-panel rounded-xl p-4 flex flex-col justify-between bg-gradient-to-b from-white to-amber-50/70">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-blue-800 tracking-wide">Agen BRILink</span>
                <Landmark className="w-4 h-4 text-blue-700" />
              </div>
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <button
                  type="button"
                  onClick={() => onSwitchTab('ppob', 'transfer')}
                  className="ipos-btn p-2.5 rounded-lg text-left hover:border-blue-500"
                >
                  <ArrowLeftRight className="w-4 h-4 text-blue-700 mb-1" />
                  <div className="font-bold text-xs text-slate-800">Transfer Bank</div>
                  <div className="text-[10px] text-slate-500">BRI, BCA, Mandiri, BNI</div>
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchTab('ppob', 'tarik')}
                  className="ipos-btn p-2.5 rounded-lg text-left hover:border-emerald-500"
                >
                  <HandCoins className="w-4 h-4 text-emerald-700 mb-1" />
                  <div className="font-bold text-xs text-slate-800">Tarik Tunai</div>
                  <div className="text-[10px] text-slate-500">EDC / Kartu ATM / PKH</div>
                </button>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                  <span>Transaksi Terakhir</span>
                  <span className="font-mono font-semibold text-sky-700">{lastTrx?.id || '-'}</span>
                </div>
                <div className="font-extrabold font-mono text-sm text-slate-900 tabular-nums">
                  Rp {formatRp(lastTrx?.total || 0)}
                </div>
                <div className="text-[11px] text-slate-600 truncate mt-0.5">
                  {lastTrx?.description || 'Belum ada transaksi'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenOcr('ppob')}
              className="mt-4 w-full ipos-btn py-2 rounded font-semibold text-xs shadow flex items-center justify-center gap-2 text-sky-900 border-sky-300 bg-sky-50 hover:bg-sky-100"
            >
              <Camera className="w-3.5 h-3.5 text-sky-600" />
              <span>Auto-Scan Bukti Transfer / Nota</span>
            </button>
          </div>
        </div>

        {/* MENU UTAMA SISTEM IPOS 5 */}
        <div className="ipos-panel rounded-xl p-3">
          <div className="text-[11px] font-bold text-slate-500 mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5 text-sky-600" /> Menu Utama Sistem iPos 5
            </span>
            <span className="text-[11px] font-normal text-slate-500">
              Tekan <b>F2</b> Penjualan &middot; <b>F3</b> Cari Barang &middot; <b>F4</b> Scan Nota/Struk
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
            {shortcutItems.map((item) => (
              <button
                key={item.tab}
                type="button"
                onClick={() => onSwitchTab(item.tab)}
                className="ipos-btn p-2.5 rounded flex flex-col items-center gap-1.5 text-center"
              >
                {item.icon}
                <span className="font-semibold text-[11.5px] leading-tight">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
