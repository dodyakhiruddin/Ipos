import React, { useState, useEffect, useCallback } from 'react';
import {
  Store,
  HardDrive,
  Database,
  Settings,
  Radio,
  Gauge,
  FileText,
  ShoppingCart,
  Zap,
  Wrench,
  CreditCard,
  Wallet,
  HandCoins,
  Scale,
  BarChart3,
  BookOpen,
  ArrowLeftRight,
  CheckCircle2,
  AlertCircle,
  Info,
  Wifi,
  Plane,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react';
import {
  AppState,
  Customer,
  DocPreviewData,
  InventoryItem,
  OcrTargetMode,
  PosCartItem,
  PpobMode,
  PurchaseOrder,
  PurchaseRecord,
  PurchaseReturn,
  SalesOrder,
  SalesReturn,
  ServiceTicket,
  SessionUser,
  SettingsTab,
  StoreSettings,
  Supplier,
  TabId,
  ToastMessage,
  TransactionRecord,
  UserAccount,
  WalletAccount,
} from './types/ipos';
import {
  ACTIVE_DB_STORAGE_KEY,
  DB_LIST_STORAGE_KEY,
  createDefaultState,
  createSupabaseClientSafe,
  deleteStateFromIndexedDBForDb,
  discoverAllTenantDatabaseNames,
  evaluateImportItems,
  formatRp,
  generateInvoiceId,
  getDefaultUsersSeed,
  getEffectiveItemPrice,
  getWalletNameById,
  loadSavedSupabaseConfig,
  loadStateFromIndexedDBForDb,
  normalizeAppState,
  normalizeOrderItems,
  pullStateFromSupabase,
  pushStateToSupabase,
  saveStateToIndexedDBForDb,
} from './utils/storage';
import { DatabaseSelectModal, LoginModal } from './components/DatabaseAndLoginModals';
import { DashboardView } from './components/DashboardView';
import { MasterDataView } from './components/MasterDataView';
import { PembelianView } from './components/PembelianView';
import { KasirPosView } from './components/KasirPosView';
import { PpobView } from './components/PpobView';
import { ServiceHpView } from './components/ServiceHpView';
import { VoucherAssemblyView } from './components/VoucherAssemblyView';
import { SumberDanaView } from './components/SumberDanaView';
import { UtangPiutangView } from './components/UtangPiutangView';
import {
  AkuntansiView,
  LaporanView,
  PetunjukView,
} from './components/AkuntansiLaporanPetunjukView';
import {
  DocPreviewModal,
  OcrScannerModal,
  ReceiptModal,
  SettingsModal,
} from './components/Modals';

const TAB_LABELS: Record<TabId, string> = {
  dashboard: 'Dashboard',
  masterdata: 'Master Data',
  pembelian: 'Pembelian',
  kasir: 'Penjualan',
  ppob: 'Transaksi PPOB',
  servicehp: 'Service HP',
  cetakvoucher: 'Pembuatan Voucher Fisik',
  sumberdana: 'Sumber Dana',
  utangpiutang: 'Utang & Piutang',
  akuntansi: 'Akutansi',
  laporan: 'Laporan',
  petunjuk: 'Petunjuk & Penggunaan',
};

export default function App() {
  const [availableDatabases, setAvailableDatabases] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DB_LIST_STORAGE_KEY) || 'null');
      return Array.isArray(saved) && saved.length > 0 ? saved : ['GROSIRDONET', 'DONETCABANG2'];
    } catch {
      return ['GROSIRDONET', 'DONETCABANG2'];
    }
  });

  const [activeDatabaseName, setActiveDatabaseName] = useState<string>(() => {
    const saved = localStorage.getItem(ACTIVE_DB_STORAGE_KEY);
    return saved || 'GROSIRDONET';
  });

  const [appState, setAppState] = useState<AppState>(() => createDefaultState('GROSIRDONET'));
  const [currentUser, setCurrentUser] = useState<SessionUser>({
    username: 'ADMIN',
    rawUsername: 'admin',
    role: 'ADMIN',
    location: 'UTM',
  });

  // Modals & Navigation
  const [dbModalOpen, setDbModalOpen] = useState(true);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginUsers, setLoginUsers] = useState<UserAccount[]>(getDefaultUsersSeed);
  const [pendingDbForLogin, setPendingDbForLogin] = useState(activeDatabaseName);

  const [openTabs, setOpenTabs] = useState<TabId[]>(['dashboard']);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [ppobMode, setPpobMode] = useState<PpobMode>('pulsa');

  // Shared Cart & Modals
  const [posCart, setPosCart] = useState<PosCartItem[]>([]);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');

  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrMode, setOcrMode] = useState<OcrTargetMode>('ppob');
  const [ocrPembelianPrefill, setOcrPembelianPrefill] = useState<{
    qty: number;
    cost: number;
    key: number;
  } | null>(null);
  const [ocrPosQuery, setOcrPosQuery] = useState<{ text: string; key: number } | null>(null);
  const [ocrPpobPrefill, setOcrPpobPrefill] = useState<{
    target: string;
    desc: string;
    modal: number;
    sell: number;
    key: number;
  } | null>(null);

  const [receiptTrx, setReceiptTrx] = useState<TransactionRecord | null>(null);
  const [receiptServiceTicket, setReceiptServiceTicket] = useState<ServiceTicket | null>(null);
  const [docPreview, setDocPreview] = useState<DocPreviewData | null>(null);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [clockText, setClockText] = useState(() => new Date().toLocaleTimeString('id-ID'));
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  const showToast = useCallback((msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  }, []);

  // Load initial tenant DB (update-safe: IndexedDB -> localStorage backup -> Supabase Cloud)
  useEffect(() => {
    const boot = async () => {
      const discovered = await discoverAllTenantDatabaseNames();
      const mergedDbList = Array.from(new Set([...availableDatabases, ...discovered]));
      if (mergedDbList.length !== availableDatabases.length) {
        setAvailableDatabases(mergedDbList);
      }

      const validDb = mergedDbList.includes(activeDatabaseName)
        ? activeDatabaseName
        : mergedDbList[0];
      setActiveDatabaseName(validDb);

      let saved = await loadStateFromIndexedDBForDb(validDb);
      if (!saved) {
        const sbCfg = loadSavedSupabaseConfig();
        if (sbCfg) {
          const client = createSupabaseClientSafe(sbCfg.url, sbCfg.key);
          if (client) {
            saved = await pullStateFromSupabase(client, validDb);
          }
        }
      }

      const normalized = normalizeAppState(saved, validDb);
      setAppState(normalized);
      await saveStateToIndexedDBForDb(validDb, normalized);
    };
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep localStorage DB list synced
  useEffect(() => {
    try {
      localStorage.setItem(DB_LIST_STORAGE_KEY, JSON.stringify(availableDatabases));
      localStorage.setItem(ACTIVE_DB_STORAGE_KEY, activeDatabaseName);
    } catch {
      // ignore
    }
  }, [availableDatabases, activeDatabaseName]);

  // Document title sync
  useEffect(() => {
    document.title = `Menu Utama - iPos 5 Web Edition [${activeDatabaseName}]`;
  }, [activeDatabaseName]);

  // Clock & network status
  useEffect(() => {
    const timer = setInterval(() => {
      setClockText(new Date().toLocaleTimeString('id-ID'));
      setIsOnline(navigator.onLine);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const persistState = useCallback(
    async (nextState: AppState, dbNameOverride?: string) => {
      const dbKey = dbNameOverride || activeDatabaseName;
      setAppState(nextState);
      await saveStateToIndexedDBForDb(dbKey, nextState);
      const sbClient = createSupabaseClientSafe(
        nextState.settings.supabaseUrl,
        nextState.settings.supabaseKey
      );
      if (sbClient) {
        pushStateToSupabase(sbClient, dbKey, nextState);
      }
    },
    [activeDatabaseName]
  );

  const switchTab = useCallback((tabId: TabId, mode?: PpobMode) => {
    setOpenTabs((prev) => (prev.includes(tabId) ? prev : [...prev, tabId]));
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    if (tabId === 'ppob' && mode) {
      setPpobMode(mode);
    }
  }, []);

  const closeMdiTab = (e: React.MouseEvent, tabId: TabId) => {
    e.stopPropagation();
    if (tabId === 'dashboard') return;
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t !== tabId);
      if (activeTab === tabId) {
        setActiveTab(next[next.length - 1] || 'dashboard');
      }
      return next;
    });
  };

  // Global keyboard shortcuts (F2, F3, F4)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        switchTab('kasir');
      } else if (e.key === 'F3') {
        e.preventDefault();
        switchTab('kasir');
        setItemPickerOpen(true);
      } else if (e.key === 'F4') {
        e.preventDefault();
        setOcrMode('ppob');
        setOcrOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [switchTab]);

  // =========================================================================
  // DATABASE & LOGIN HANDLERS
  // =========================================================================
  const handleSelectDbForLogin = async (dbName: string) => {
    const candidate = await loadStateFromIndexedDBForDb(dbName);
    const users =
      candidate && Array.isArray(candidate.users) && candidate.users.length > 0
        ? candidate.users
        : getDefaultUsersSeed();
    setPendingDbForLogin(dbName);
    setLoginUsers(users);
    setDbModalOpen(false);
    setLoginModalOpen(true);
  };

  const handleOpenLoginForActive = async () => {
    const candidate = await loadStateFromIndexedDBForDb(activeDatabaseName);
    const users =
      candidate && Array.isArray(candidate.users) && candidate.users.length > 0
        ? candidate.users
        : appState.users;
    setPendingDbForLogin(activeDatabaseName);
    setLoginUsers(users);
    setLoginModalOpen(true);
  };

  const handleLoginSuccess = async (account: UserAccount) => {
    setActiveDatabaseName(pendingDbForLogin);
    let saved = await loadStateFromIndexedDBForDb(pendingDbForLogin);
    if (!saved) {
      const sbCfg = loadSavedSupabaseConfig() ||
        (appState.settings.supabaseUrl && appState.settings.supabaseKey
          ? { url: appState.settings.supabaseUrl, key: appState.settings.supabaseKey }
          : null);
      if (sbCfg) {
        const client = createSupabaseClientSafe(sbCfg.url, sbCfg.key);
        if (client) {
          saved = await pullStateFromSupabase(client, pendingDbForLogin);
        }
      }
    }
    const loaded = normalizeAppState(saved, pendingDbForLogin);
    setAppState(loaded);
    await saveStateToIndexedDBForDb(pendingDbForLogin, loaded);
    setCurrentUser({
      username: account.username.toUpperCase(),
      rawUsername: account.username,
      role: account.role || 'KASIR',
      location: account.location || 'UTM',
    });
    setPosCart([]);
    setLoginModalOpen(false);
    showToast(
      `Berhasil login ke [${pendingDbForLogin}] sebagai ${account.username.toUpperCase()} (${account.role})`,
      'success'
    );
  };

  const handleCreateDatabase = async (newName: string): Promise<boolean> => {
    if (availableDatabases.includes(newName)) {
      showToast(`Database [${newName}] sudah ada!`, 'error');
      return false;
    }
    setAvailableDatabases((prev) => [...prev, newName]);
    showToast(`Database baru [${newName}] berhasil dibuat!`, 'success');
    return true;
  };

  const handleRenameDatabase = async (oldName: string, newName: string): Promise<boolean> => {
    if (newName !== oldName && availableDatabases.includes(newName)) {
      showToast(`Nama database [${newName}] sudah digunakan!`, 'error');
      return false;
    }
    const oldData = await loadStateFromIndexedDBForDb(oldName);
    if (oldData) {
      const normalized = normalizeAppState(oldData, newName);
      await saveStateToIndexedDBForDb(newName, normalized);
      if (newName !== oldName) await deleteStateFromIndexedDBForDb(oldName);
    }
    setAvailableDatabases((prev) => prev.map((d) => (d === oldName ? newName : d)));
    if (activeDatabaseName === oldName) {
      setActiveDatabaseName(newName);
    }
    showToast(`Database diubah menjadi [${newName}]!`, 'success');
    return true;
  };

  const handleDeleteDatabase = async (dbName: string): Promise<boolean> => {
    if (availableDatabases.length <= 1) {
      showToast('Minimal harus tersisa 1 database!', 'error');
      return false;
    }
    if (dbName === activeDatabaseName) {
      showToast(
        `Database [${dbName}] sedang aktif dipakai! Masuk ke database lain terlebih dahulu sebelum menghapus.`,
        'error'
      );
      return false;
    }
    await deleteStateFromIndexedDBForDb(dbName);
    setAvailableDatabases((prev) => prev.filter((d) => d !== dbName));
    showToast(`Database [${dbName}] berhasil dihapus!`, 'info');
    return true;
  };

  // =========================================================================
  // MASTER DATA HANDLERS
  // =========================================================================
  const handleSaveItem = async (item: InventoryItem, editIdx: number) => {
    const nextItems = [...appState.items];
    if (editIdx >= 0) nextItems[editIdx] = item;
    else nextItems.unshift(item);
    await persistState({ ...appState, items: nextItems });
    showToast(`Data barang ${item.name} tersimpan!`, 'success');
  };

  const handleImportItems = async (imported: InventoryItem[], replaceExisting: boolean) => {
    const nextCategories = [...appState.categories];
    const nextLedger = [...appState.stockLedger];
    const nowIso = new Date().toISOString();

    const evalRes = evaluateImportItems(appState.items, imported, replaceExisting);
    evalRes.appliedItems.forEach((imp) => {
      if (imp.category && !nextCategories.includes(imp.category)) {
        nextCategories.push(imp.category);
      }
      if (imp.stock > 0) {
        nextLedger.unshift({
          date: nowIso,
          ref: 'IMPORT-BARANG',
          code: imp.code,
          name: imp.name,
          type: 'IMPORT BARANG',
          inQty: imp.stock,
          outQty: 0,
          balance: imp.stock,
        });
      }
    });

    await persistState({
      ...appState,
      categories: nextCategories,
      items: evalRes.nextItems,
      stockLedger: nextLedger,
    });
    showToast(
      `Import selesai! ${evalRes.addedCount} baru, ${evalRes.updatedCount} update modal/harga, ${evalRes.skippedCount} duplikat dilewati.`,
      'success'
    );
  };

  const handleDeleteItem = async (idx: number) => {
    const nextItems = [...appState.items];
    nextItems.splice(idx, 1);
    await persistState({ ...appState, items: nextItems });
    showToast('Barang dihapus dari Master Data.', 'info');
  };

  const handleAddCategory = async (cat: string) => {
    if (appState.categories.includes(cat)) return;
    await persistState({ ...appState, categories: [...appState.categories, cat] });
  };

  const handleRemoveCategory = async (cat: string) => {
    await persistState({
      ...appState,
      categories: appState.categories.filter((c) => c !== cat),
    });
  };

  const handleSaveSupplier = async (sup: Supplier, editIdx: number) => {
    const next = [...appState.suppliers];
    if (editIdx >= 0) next[editIdx] = sup;
    else next.push(sup);
    await persistState({ ...appState, suppliers: next });
    showToast('Supplier berhasil disimpan!', 'success');
  };

  const handleDeleteSupplier = async (idx: number) => {
    const next = [...appState.suppliers];
    next.splice(idx, 1);
    await persistState({ ...appState, suppliers: next });
    showToast('Supplier dihapus.', 'info');
  };

  const handleSaveCustomer = async (cust: Customer, editIdx: number) => {
    const next = [...appState.customers];
    if (editIdx >= 0) next[editIdx] = cust;
    else next.push(cust);
    await persistState({ ...appState, customers: next });
    showToast('Data pelanggan tersimpan!', 'success');
  };

  const handleDeleteCustomer = async (idx: number) => {
    const next = [...appState.customers];
    next.splice(idx, 1);
    await persistState({ ...appState, customers: next });
    showToast('Pelanggan dihapus.', 'info');
  };

  // =========================================================================
  // PEMBELIAN (PO, PEMBELIAN, RETUR, DEPOSIT)
  // =========================================================================
  const handleSavePo = async (po: PurchaseOrder, editIdx: number) => {
    const next = [...appState.purchaseOrders];
    if (editIdx >= 0) next[editIdx] = po;
    else next.unshift(po);
    await persistState({ ...appState, purchaseOrders: next });
    showToast(`Pesanan Pembelian ${po.id} (${po.items.length} item) berhasil disimpan!`, 'success');
  };

  const handleDeletePo = async (idx: number) => {
    const next = [...appState.purchaseOrders];
    const removed = next.splice(idx, 1)[0];
    await persistState({ ...appState, purchaseOrders: next });
    showToast(`Pesanan ${removed.id} berhasil dihapus!`, 'info');
  };

  const handleSavePurchase = async (rec: PurchaseRecord, editIdx: number) => {
    const nextItems = appState.items.map((it) => ({ ...it }));
    const nextWallets = { ...appState.wallets };
    const nextLedger = [...appState.stockLedger];
    const nextDebts = [...appState.debtsReceivables];
    const nextPos = appState.purchaseOrders.map((p) => ({ ...p }));
    const nextPurchases = [...appState.purchaseRecords];

    // Rollback old record if editing
    if (editIdx >= 0 && nextPurchases[editIdx]) {
      const old = nextPurchases[editIdx];
      const oldItems = normalizeOrderItems(old);
      let oldTotal = 0;
      oldItems.forEach((oi) => {
        oldTotal += Number(oi.subtotal) || oi.qty * oi.cost;
        const mOld = nextItems.find((i) => i.code === oi.code);
        if (mOld) mOld.stock = Math.max(0, (Number(mOld.stock) || 0) - (Number(oi.qty) || 0));
      });
      if (!old.isTempo && old.sourceWallet && nextWallets[old.sourceWallet] !== undefined) {
        nextWallets[old.sourceWallet] += oldTotal;
      }
    }

    rec.items.forEach((di) => {
      const it = nextItems.find((i) => i.code === di.code);
      if (it) {
        it.stock = (Number(it.stock) || 0) + di.qty;
        it.cost = di.cost;
        nextLedger.unshift({
          date: new Date().toISOString(),
          ref: rec.id,
          code: it.code,
          name: it.name,
          type: editIdx >= 0 ? 'EDIT BELI' : 'PEMBELIAN',
          inQty: di.qty,
          outQty: 0,
          balance: it.stock,
        });
      }
    });

    if (rec.isTempo) {
      if (editIdx < 0) {
        nextDebts.unshift({
          id: rec.id.replace('BLI', 'UTG'),
          type: 'UTANG',
          date: new Date().toISOString(),
          dueDate: rec.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          party: rec.supplier,
          description: `Kulakan Faktur ${rec.id} (${rec.items.map((x) => `${x.name} x${x.qty}`).join(', ')})`,
          totalAmount: rec.total,
          paidAmount: 0,
          status: 'BELUM_LUNAS',
          payments: [],
        });
      }
    } else if (nextWallets[rec.sourceWallet] !== undefined) {
      nextWallets[rec.sourceWallet] -= rec.total;
    }

    if (rec.poRef) {
      const poObj = nextPos.find((p) => p.id === rec.poRef);
      if (poObj) poObj.status = 'SELESAI';
    }

    if (editIdx >= 0) nextPurchases[editIdx] = rec;
    else nextPurchases.unshift(rec);

    await persistState({
      ...appState,
      items: nextItems,
      wallets: nextWallets,
      stockLedger: nextLedger,
      debtsReceivables: nextDebts,
      purchaseOrders: nextPos,
      purchaseRecords: nextPurchases,
    });
    showToast(`Faktur Pembelian ${rec.id} (${rec.items.length} produk) berhasil disimpan!`, 'success');
  };

  const handleDeletePurchase = async (idx: number) => {
    const nextPurchases = [...appState.purchaseRecords];
    const old = nextPurchases.splice(idx, 1)[0];
    if (!old) return;
    const nextItems = appState.items.map((it) => ({ ...it }));
    const nextWallets = { ...appState.wallets };

    const oldItems = normalizeOrderItems(old);
    let oldTotal = 0;
    oldItems.forEach((oi) => {
      oldTotal += Number(oi.subtotal) || oi.qty * oi.cost;
      const mOld = nextItems.find((i) => i.code === oi.code);
      if (mOld) mOld.stock = Math.max(0, (Number(mOld.stock) || 0) - (Number(oi.qty) || 0));
    });
    if (!old.isTempo && old.sourceWallet && nextWallets[old.sourceWallet] !== undefined) {
      nextWallets[old.sourceWallet] += oldTotal;
    }

    await persistState({
      ...appState,
      items: nextItems,
      wallets: nextWallets,
      purchaseRecords: nextPurchases,
    });
    showToast(`Transaksi Pembelian ${old.id} dihapus & stok/saldo dikembalikan!`, 'info');
  };

  const handleSaveReturn = async (ret: PurchaseReturn, editIdx: number): Promise<boolean> => {
    const nextItems = appState.items.map((it) => ({ ...it }));
    const nextWallets = { ...appState.wallets };
    const nextLedger = [...appState.stockLedger];
    const nextReturns = [...appState.purchaseReturns];

    if (editIdx >= 0 && nextReturns[editIdx]) {
      const old = nextReturns[editIdx];
      const mOld = nextItems.find((i) => i.code === old.itemCode);
      if (mOld) mOld.stock = (Number(mOld.stock) || 0) + (Number(old.qty) || 0);
      if (old.wallet !== 'POTONG_UTANG' && nextWallets[old.wallet] !== undefined) {
        nextWallets[old.wallet] -= Number(old.total) || 0;
      }
    }

    const it = nextItems.find((i) => i.code === ret.itemCode);
    if (!it) return false;
    if (it.stock < ret.qty) {
      showToast(`Stok ${it.name} hanya tersisa ${it.stock} PCS!`, 'error');
      return false;
    }

    it.stock = Math.max(0, (Number(it.stock) || 0) - ret.qty);
    if (ret.wallet !== 'POTONG_UTANG' && nextWallets[ret.wallet] !== undefined) {
      nextWallets[ret.wallet] += ret.total;
    }

    nextLedger.unshift({
      date: new Date().toISOString(),
      ref: ret.id,
      code: it.code,
      name: it.name,
      type: editIdx >= 0 ? 'EDIT RETUR' : 'RETUR BELI',
      inQty: 0,
      outQty: ret.qty,
      balance: it.stock,
    });

    if (editIdx >= 0) nextReturns[editIdx] = ret;
    else nextReturns.unshift(ret);

    await persistState({
      ...appState,
      items: nextItems,
      wallets: nextWallets,
      stockLedger: nextLedger,
      purchaseReturns: nextReturns,
    });
    showToast(`Retur Pembelian ${ret.id} berhasil disimpan!`, 'success');
    return true;
  };

  const handleDeleteReturn = async (idx: number) => {
    const nextReturns = [...appState.purchaseReturns];
    const old = nextReturns.splice(idx, 1)[0];
    if (!old) return;
    const nextItems = appState.items.map((it) => ({ ...it }));
    const nextWallets = { ...appState.wallets };

    const mOld = nextItems.find((i) => i.code === old.itemCode);
    if (mOld) mOld.stock = (Number(mOld.stock) || 0) + (Number(old.qty) || 0);
    if (old.wallet !== 'POTONG_UTANG' && nextWallets[old.wallet] !== undefined) {
      nextWallets[old.wallet] -= Number(old.total) || 0;
    }
    await persistState({
      ...appState,
      items: nextItems,
      wallets: nextWallets,
      purchaseReturns: nextReturns,
    });
    showToast(`Retur Pembelian ${old.id} dihapus & stok/saldo dipulihkan!`, 'info');
  };

  const handleDepositWallet = async (
    target: string,
    amount: number,
    src: string,
    note: string
  ) => {
    if (amount <= 0) return;
    const nextWallets = { ...appState.wallets };
    if (src !== 'MODAL_OWNER' && nextWallets[src] !== undefined) {
      nextWallets[src] -= amount;
    }
    nextWallets[target] = (Number(nextWallets[target]) || 0) + amount;
    const nextTransfers = [
      {
        date: new Date().toISOString(),
        from: getWalletNameById(src, appState.walletList),
        to: getWalletNameById(target, appState.walletList),
        amount,
        note: note.trim() || 'Deposit Saldo Agen',
      },
      ...appState.fundTransfers,
    ];
    await persistState({ ...appState, wallets: nextWallets, fundTransfers: nextTransfers });
    showToast(
      `Deposit ${formatRp(amount)} ke ${getWalletNameById(target, appState.walletList)} berhasil!`,
      'success'
    );
  };

  // =========================================================================
  // PENJUALAN (PO PENJUALAN, KASIR POS TAMBAH/EDIT, RETUR PENJUALAN)
  // =========================================================================
  const handleSaveSalesPo = async (so: SalesOrder, editIdx: number) => {
    const next = [...appState.salesOrders];
    if (editIdx >= 0) next[editIdx] = so;
    else next.unshift(so);
    await persistState({ ...appState, salesOrders: next });
    showToast(`Pesanan Penjualan ${so.id} (${so.items.length} item) berhasil disimpan!`, 'success');
  };

  const handleDeleteSalesPo = async (idx: number) => {
    const next = [...appState.salesOrders];
    const removed = next.splice(idx, 1)[0];
    await persistState({ ...appState, salesOrders: next });
    if (removed) showToast(`Pesanan ${removed.id} berhasil dihapus!`, 'info');
  };

  const handleSaveSale = async (params: {
    editingTrxId: string | null;
    invoiceNo: string;
    soRef: string;
    date: string;
    customer: string;
    payWallet: string;
    cashPaid: number;
    cart: PosCartItem[];
  }): Promise<boolean> => {
    if (params.cart.length === 0) return false;
    const nextItems = appState.items.map((it) => ({ ...it }));
    const nextWallets = { ...appState.wallets };
    const nextLedger = [...appState.stockLedger];
    const nextDebts = [...appState.debtsReceivables];
    const nextSos = appState.salesOrders.map((s) => ({ ...s }));
    let nextTransactions = [...appState.transactions];

    // Rollback transaksi lama jika mode Edit Penjualan
    if (params.editingTrxId) {
      const oldTrx = nextTransactions.find((t) => t.id === params.editingTrxId);
      if (oldTrx) {
        if (oldTrx.paymentMethod && nextWallets[oldTrx.paymentMethod] !== undefined) {
          nextWallets[oldTrx.paymentMethod] -= oldTrx.total;
        }
        oldTrx.items.forEach((oi) => {
          if (oi.code) {
            const mOld = nextItems.find((x) => x.code === oi.code);
            if (mOld) mOld.stock += oi.qty;
          }
        });
      }
    }

    const timePart = new Date().toTimeString().slice(0, 8);
    const trxDateIso = params.date
      ? new Date(`${params.date}T${timePart}`).toISOString()
      : new Date().toISOString();

    let total = 0;
    let totalModal = 0;
    const soldItems = params.cart.map((c) => {
      const it = nextItems.find((x) => x.code === c.code);
      const unitPrice = it
        ? getEffectiveItemPrice(it, params.customer, appState.customers)
        : c.cost;
      const unitCost = Number(it?.cost ?? c.cost) || 0;
      total += unitPrice * c.qty;
      totalModal += unitCost * c.qty;
      if (it) {
        it.stock = Math.max(0, it.stock - c.qty);
        nextLedger.unshift({
          date: trxDateIso,
          ref: params.invoiceNo,
          code: it.code,
          name: it.name,
          type: params.editingTrxId ? 'EDIT JUAL' : 'PENJUALAN',
          inQty: 0,
          outQty: c.qty,
          balance: it.stock,
        });
      }
      return { code: c.code, name: c.name, qty: c.qty, price: unitPrice };
    });

    if (params.payWallet === 'PIUTANG_TEMPO') {
      if (!params.editingTrxId) {
        nextDebts.unshift({
          id: params.invoiceNo.replace('JUA', 'PIU'),
          type: 'PIUTANG',
          date: trxDateIso,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          party: params.customer,
          description: `Penjualan Kasir ${params.invoiceNo}`,
          totalAmount: total,
          paidAmount: 0,
          status: 'BELUM_LUNAS',
          payments: [],
        });
      }
    } else if (nextWallets[params.payWallet] !== undefined) {
      nextWallets[params.payWallet] += total;
    }

    if (params.soRef) {
      const soObj = nextSos.find((s) => s.id === params.soRef);
      if (soObj) soObj.status = 'SELESAI';
    }

    const trx: TransactionRecord = {
      id: params.invoiceNo,
      soRef: params.soRef || undefined,
      date: trxDateIso,
      module: 'POS',
      description: `Penjualan Kasir (${soldItems.map((i) => `${i.name} x${i.qty}`).join(', ')})`,
      customer: params.customer,
      modal: totalModal,
      total,
      profit: total - totalModal,
      paymentMethod: params.payWallet,
      cashPaid: params.payWallet === 'PIUTANG_TEMPO' ? 0 : params.cashPaid,
      changeAmount:
        params.payWallet === 'PIUTANG_TEMPO' ? 0 : Math.max(0, params.cashPaid - total),
      items: soldItems,
    };

    if (params.editingTrxId) {
      nextTransactions = nextTransactions.map((t) =>
        t.id === params.editingTrxId ? trx : t
      );
    } else {
      nextTransactions = [trx, ...nextTransactions];
    }

    await persistState({
      ...appState,
      items: nextItems,
      wallets: nextWallets,
      stockLedger: nextLedger,
      debtsReceivables: nextDebts,
      salesOrders: nextSos,
      transactions: nextTransactions,
    });
    setReceiptServiceTicket(null);
    setReceiptTrx(trx);
    showToast(
      params.editingTrxId
        ? `Transaksi ${params.invoiceNo} berhasil diperbarui!`
        : `Transaksi ${params.invoiceNo} berhasil disimpan!`,
      'success'
    );
    return true;
  };

  const handleSaveSalesReturn = async (ret: SalesReturn, editIdx: number): Promise<boolean> => {
    const nextItems = appState.items.map((it) => ({ ...it }));
    const nextWallets = { ...appState.wallets };
    const nextLedger = [...appState.stockLedger];
    const nextReturns = [...appState.salesReturns];

    if (editIdx >= 0 && nextReturns[editIdx]) {
      const old = nextReturns[editIdx];
      const mOld = nextItems.find((i) => i.code === old.itemCode);
      if (mOld) mOld.stock = Math.max(0, (Number(mOld.stock) || 0) - (Number(old.qty) || 0));
      if (old.wallet !== 'POTONG_PIUTANG' && nextWallets[old.wallet] !== undefined) {
        nextWallets[old.wallet] += Number(old.total) || 0;
      }
    }

    const it = nextItems.find((i) => i.code === ret.itemCode);
    if (!it) return false;

    it.stock = (Number(it.stock) || 0) + ret.qty;
    if (ret.wallet !== 'POTONG_PIUTANG' && nextWallets[ret.wallet] !== undefined) {
      nextWallets[ret.wallet] -= ret.total;
    }

    nextLedger.unshift({
      date: new Date().toISOString(),
      ref: ret.id,
      code: it.code,
      name: it.name,
      type: editIdx >= 0 ? 'EDIT RETUR JUAL' : 'RETUR JUAL',
      inQty: ret.qty,
      outQty: 0,
      balance: it.stock,
    });

    if (editIdx >= 0) nextReturns[editIdx] = ret;
    else nextReturns.unshift(ret);

    await persistState({
      ...appState,
      items: nextItems,
      wallets: nextWallets,
      stockLedger: nextLedger,
      salesReturns: nextReturns,
    });
    showToast(`Retur Penjualan ${ret.id} berhasil disimpan!`, 'success');
    return true;
  };

  const handleDeleteSalesReturn = async (idx: number) => {
    const nextReturns = [...appState.salesReturns];
    const old = nextReturns.splice(idx, 1)[0];
    if (!old) return;
    const nextItems = appState.items.map((it) => ({ ...it }));
    const nextWallets = { ...appState.wallets };

    const mOld = nextItems.find((i) => i.code === old.itemCode);
    if (mOld) mOld.stock = Math.max(0, (Number(mOld.stock) || 0) - (Number(old.qty) || 0));
    if (old.wallet !== 'POTONG_PIUTANG' && nextWallets[old.wallet] !== undefined) {
      nextWallets[old.wallet] += Number(old.total) || 0;
    }

    await persistState({
      ...appState,
      items: nextItems,
      wallets: nextWallets,
      salesReturns: nextReturns,
    });
    showToast(`Retur Penjualan ${old.id} dihapus & stok/saldo disesuaikan!`, 'info');
  };

  // =========================================================================
  // PPOB & BRILINK
  // =========================================================================
  const handleSubmitPpob = async (params: {
    mode: PpobMode;
    provider: string;
    target: string;
    prodDesc: string;
    customer: string;
    srcWallet: string;
    dstWallet: string;
    modal: number;
    sell: number;
  }) => {
    const nextWallets = { ...appState.wallets };
    const nextDebts = [...appState.debtsReceivables];

    if (nextWallets[params.srcWallet] !== undefined) {
      nextWallets[params.srcWallet] -= params.modal;
    }
    const trxId = generateInvoiceId(
      params.mode === 'transfer' || params.mode === 'tarik' ? 'BRI' : 'PPB'
    );

    if (params.dstWallet === 'PIUTANG_TEMPO') {
      nextDebts.unshift({
        id: trxId.replace(/^(BRI|PPB)/, 'PIU'),
        type: 'PIUTANG',
        date: new Date().toISOString(),
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        party: params.customer,
        description: `${params.provider} - ${params.prodDesc} (${params.target})`,
        totalAmount: params.sell,
        paidAmount: 0,
        status: 'BELUM_LUNAS',
        payments: [],
      });
    } else if (nextWallets[params.dstWallet] !== undefined) {
      nextWallets[params.dstWallet] += params.sell;
    }

    const trx: TransactionRecord = {
      id: trxId,
      date: new Date().toISOString(),
      module: params.mode === 'transfer' || params.mode === 'tarik' ? 'BRILINK' : 'PPOB',
      description: `${params.provider} - ${params.prodDesc} ke ${params.target}`,
      customer: params.customer,
      modal: params.modal,
      total: params.sell,
      profit: params.sell - params.modal,
      paymentMethod: params.dstWallet,
      items: [
        {
          name: `${params.provider} (${params.prodDesc}) - ${params.target}`,
          qty: 1,
          price: params.sell,
        },
      ],
    };

    await persistState({
      ...appState,
      wallets: nextWallets,
      debtsReceivables: nextDebts,
      transactions: [trx, ...appState.transactions],
    });
    setReceiptServiceTicket(null);
    setReceiptTrx(trx);
    showToast(`Transaksi ${trxId} berhasil diproses!`, 'success');
  };

  // =========================================================================
  // SERVICE HP
  // =========================================================================
  const handleCreateServiceTicket = async (ticket: ServiceTicket) => {
    await persistState({
      ...appState,
      serviceTickets: [ticket, ...appState.serviceTickets],
    });
    setReceiptTrx(null);
    setReceiptServiceTicket(ticket);
    showToast(`Tanda terima ${ticket.id} tersimpan & siap dicetak!`, 'success');
  };

  const handleCompleteServiceTicket = async (params: {
    ticketId: string;
    partCode: string;
    partQty: number;
    modal: number;
    sell: number;
    dstWallet: string;
    dueDate: string;
  }): Promise<boolean> => {
    const nextTickets = appState.serviceTickets.map((t) => ({ ...t }));
    const t = nextTickets.find((x) => x.id === params.ticketId);
    if (!t) return false;

    const nextItems = appState.items.map((it) => ({ ...it }));
    const nextWallets = { ...appState.wallets };
    const nextLedger = [...appState.stockLedger];
    const nextDebts = [...appState.debtsReceivables];

    if (params.partCode && params.partQty > 0) {
      const it = nextItems.find((x) => x.code === params.partCode);
      if (it) {
        if (it.stock < params.partQty) {
          showToast(`Stok sparepart ${it.name} hanya tersisa ${it.stock}!`, 'error');
          return false;
        }
        it.stock = Math.max(0, it.stock - params.partQty);
        nextLedger.unshift({
          date: new Date().toISOString(),
          ref: t.id,
          code: it.code,
          name: it.name,
          type: 'SERVICE HP',
          inQty: 0,
          outQty: params.partQty,
          balance: it.stock,
        });
      }
    }

    t.status = 'SELESAI';
    t.sparepartCode = params.partCode;
    t.sparepartQty = params.partQty;
    t.cost = params.modal;
    t.price = params.sell;
    t.destWallet = params.dstWallet;

    if (params.dstWallet === 'PIUTANG_TEMPO') {
      nextDebts.unshift({
        id: t.id.replace('SRV', 'PIU'),
        type: 'PIUTANG',
        date: new Date().toISOString(),
        dueDate: params.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        party: t.customer,
        description: `Service HP ${t.device} (${t.issue})`,
        totalAmount: params.sell,
        paidAmount: 0,
        status: 'BELUM_LUNAS',
        payments: [],
      });
    } else if (nextWallets[params.dstWallet] !== undefined) {
      nextWallets[params.dstWallet] += params.sell;
    }

    const trx: TransactionRecord = {
      id: t.id,
      date: new Date().toISOString(),
      module: 'SERVICE',
      description: `Service HP ${t.device} - ${t.issue}`,
      customer: t.customer,
      modal: params.modal,
      total: params.sell,
      profit: params.sell - params.modal,
      paymentMethod: params.dstWallet,
      items: [{ name: `Jasa Service ${t.device}`, qty: 1, price: params.sell }],
    };

    await persistState({
      ...appState,
      serviceTickets: nextTickets,
      items: nextItems,
      wallets: nextWallets,
      stockLedger: nextLedger,
      debtsReceivables: nextDebts,
      transactions: [trx, ...appState.transactions],
    });
    setReceiptServiceTicket(null);
    setReceiptTrx(trx);
    showToast(`Tiket Service ${t.id} selesai & dibukukan!`, 'success');
    return true;
  };

  const handleDeleteServiceTicket = async (ticketId: string) => {
    await persistState({
      ...appState,
      serviceTickets: appState.serviceTickets.filter((t) => t.id !== ticketId),
    });
    showToast(`Tiket Service ${ticketId} dibatalkan.`, 'info');
  };

  // =========================================================================
  // PERAKITAN VOUCHER FISIK (WITH STOCK LEDGER AUDIT!)
  // =========================================================================
  const handleAssembleVoucher = async (params: {
    zeroCode: string;
    targetCode: string;
    qty: number;
    injectCost: number;
    srcWallet: string;
  }): Promise<boolean> => {
    if (params.zeroCode === params.targetCode) {
      showToast('Bahan baku Voucher Zero dan produk tujuan harus berbeda!', 'error');
      return false;
    }
    const nextItems = appState.items.map((it) => ({ ...it }));
    const zeroIt = nextItems.find((i) => i.code === params.zeroCode);
    const targetIt = nextItems.find((i) => i.code === params.targetCode);
    if (!zeroIt || !targetIt) return false;
    if (zeroIt.stock < params.qty) {
      showToast(`Stok bahan baku ${zeroIt.name} tidak cukup!`, 'error');
      return false;
    }

    const totalInject = params.qty * params.injectCost;
    const totalModal = totalInject + params.qty * zeroIt.cost;
    const nextWallets = { ...appState.wallets };
    if (nextWallets[params.srcWallet] !== undefined) {
      nextWallets[params.srcWallet] -= totalInject;
    }

    zeroIt.stock -= params.qty;
    targetIt.stock += params.qty;
    targetIt.cost = params.injectCost + zeroIt.cost;

    const refId = generateInvoiceId('VCR');
    const nowIso = new Date().toISOString();
    const nextLedger = [
      {
        date: nowIso,
        ref: refId,
        code: targetIt.code,
        name: targetIt.name,
        type: 'RAKIT VOUCHER (+)',
        inQty: params.qty,
        outQty: 0,
        balance: targetIt.stock,
      },
      {
        date: nowIso,
        ref: refId,
        code: zeroIt.code,
        name: zeroIt.name,
        type: 'RAKIT VOUCHER (-)',
        inQty: 0,
        outQty: params.qty,
        balance: zeroIt.stock,
      },
      ...appState.stockLedger,
    ];

    await persistState({
      ...appState,
      items: nextItems,
      wallets: nextWallets,
      stockLedger: nextLedger,
      voucherProductions: [
        { date: nowIso, targetName: targetIt.name, qty: params.qty, totalModal },
        ...appState.voucherProductions,
      ],
    });
    showToast(`Berhasil merakit ${params.qty} PCS ${targetIt.name}!`, 'success');
    return true;
  };

  // =========================================================================
  // SUMBER DANA & MUTASI
  // =========================================================================
  const handleSaveWallet = async (
    wallet: WalletAccount,
    balance: number,
    isEdit: boolean
  ): Promise<boolean> => {
    const nextList = [...appState.walletList];
    const nextWallets = { ...appState.wallets };
    if (isEdit) {
      const idx = nextList.findIndex((x) => x.id === wallet.id);
      if (idx >= 0) nextList[idx] = wallet;
      nextWallets[wallet.id] = balance;
    } else {
      if (nextList.some((x) => x.id === wallet.id)) {
        showToast('Kode akun sudah digunakan!', 'error');
        return false;
      }
      nextList.push(wallet);
      nextWallets[wallet.id] = balance;
    }
    await persistState({ ...appState, walletList: nextList, wallets: nextWallets });
    showToast('Sumber dana berhasil disimpan!', 'success');
    return true;
  };

  const handleDeleteWallet = async (walletId: string) => {
    if (appState.walletList.length <= 1) return;
    const nextWallets = { ...appState.wallets };
    delete nextWallets[walletId];
    await persistState({
      ...appState,
      walletList: appState.walletList.filter((w) => w.id !== walletId),
      wallets: nextWallets,
    });
    showToast('Sumber dana dihapus.', 'info');
  };

  const handleMutateFunds = async (
    from: string,
    to: string,
    amount: number,
    note: string
  ): Promise<boolean> => {
    if (from === to || amount <= 0) {
      showToast('Pilih sumber dan tujuan dana yang berbeda!', 'error');
      return false;
    }
    const nextWallets = { ...appState.wallets };
    if (nextWallets[from] !== undefined) nextWallets[from] -= amount;
    if (nextWallets[to] !== undefined) nextWallets[to] += amount;

    await persistState({
      ...appState,
      wallets: nextWallets,
      fundTransfers: [
        {
          date: new Date().toISOString(),
          from: getWalletNameById(from, appState.walletList),
          to: getWalletNameById(to, appState.walletList),
          amount,
          note: note.trim() || 'Mutasi Antar Sumber Dana',
        },
        ...appState.fundTransfers,
      ],
    });
    showToast(`Mutasi saldo ${formatRp(amount)} berhasil!`, 'success');
    return true;
  };

  // =========================================================================
  // UTANG & PIUTANG
  // =========================================================================
  const handleCreateDebt = async (params: {
    type: 'PIUTANG' | 'UTANG';
    dueDate: string;
    party: string;
    amount: number;
    wallet: string;
    desc: string;
  }) => {
    const nextWallets = { ...appState.wallets };
    if (params.wallet !== 'NONE' && nextWallets[params.wallet] !== undefined) {
      if (params.type === 'PIUTANG') nextWallets[params.wallet] -= params.amount;
      else nextWallets[params.wallet] += params.amount;
    }
    await persistState({
      ...appState,
      wallets: nextWallets,
      debtsReceivables: [
        {
          id: generateInvoiceId(params.type === 'PIUTANG' ? 'PIU' : 'UTG'),
          type: params.type,
          date: new Date().toISOString(),
          dueDate: params.dueDate,
          party: params.party,
          description: params.desc,
          totalAmount: params.amount,
          paidAmount: 0,
          status: 'BELUM_LUNAS',
          payments: [],
        },
        ...appState.debtsReceivables,
      ],
    });
    showToast(`Catatan ${params.type} berhasil disimpan!`, 'success');
  };

  const handlePayDebt = async (params: {
    recordId: string;
    payAmount: number;
    wallet: string;
    note: string;
  }) => {
    const nextDebts = appState.debtsReceivables.map((x) => ({
      ...x,
      payments: [...(x.payments || [])],
    }));
    const rec = nextDebts.find((x) => x.id === params.recordId);
    if (!rec) return;

    rec.paidAmount += params.payAmount;
    if (rec.paidAmount >= rec.totalAmount) {
      rec.paidAmount = rec.totalAmount;
      rec.status = 'LUNAS';
    }
    rec.payments.push({
      date: new Date().toISOString(),
      amount: params.payAmount,
      wallet: params.wallet,
      note: params.note,
    });

    const nextWallets = { ...appState.wallets };
    if (nextWallets[params.wallet] !== undefined) {
      if (rec.type === 'PIUTANG') nextWallets[params.wallet] += params.payAmount;
      else nextWallets[params.wallet] -= params.payAmount;
    }

    await persistState({ ...appState, debtsReceivables: nextDebts, wallets: nextWallets });
    showToast(`Pembayaran ${rec.id} sebesar ${formatRp(params.payAmount)} berhasil!`, 'success');
  };

  const handleDeleteDebt = async (recordId: string) => {
    await persistState({
      ...appState,
      debtsReceivables: appState.debtsReceivables.filter((d) => d.id !== recordId),
    });
    showToast(`Catatan ${recordId} dihapus.`, 'info');
  };

  // =========================================================================
  // EDIT & DELETE TRANSAKSI (DENGAN ROLLBACK SALDO & STOK)
  // =========================================================================
  const handleEditTransaction = async (updated: TransactionRecord) => {
    const old = appState.transactions.find((t) => t.id === updated.id);
    const nextWallets = { ...appState.wallets };
    if (old && old.paymentMethod && nextWallets[old.paymentMethod] !== undefined) {
      const diffTotal = updated.total - old.total;
      nextWallets[old.paymentMethod] += diffTotal;
    }
    await persistState({
      ...appState,
      wallets: nextWallets,
      transactions: appState.transactions.map((t) => (t.id === updated.id ? updated : t)),
    });
    showToast('Transaksi berhasil diperbarui!', 'success');
  };

  const handleDeleteTransaction = async (trxId: string) => {
    const target = appState.transactions.find((t) => t.id === trxId);
    const nextWallets = { ...appState.wallets };
    const nextItems = appState.items.map((it) => ({ ...it }));

    if (target) {
      if (target.paymentMethod && nextWallets[target.paymentMethod] !== undefined) {
        nextWallets[target.paymentMethod] -= target.total;
      }
      if (target.module === 'POS' && Array.isArray(target.items)) {
        target.items.forEach((ti) => {
          if (ti.code) {
            const m = nextItems.find((i) => i.code === ti.code);
            if (m) m.stock += ti.qty;
          }
        });
      }
    }

    await persistState({
      ...appState,
      wallets: nextWallets,
      items: nextItems,
      transactions: appState.transactions.filter((t) => t.id !== trxId),
    });
    showToast(`Transaksi ${trxId} dihapus & saldo/stok dikembalikan!`, 'info');
  };

  // =========================================================================
  // SETTINGS, USERS, BACKUP & TUTUP BUKU
  // =========================================================================
  const handleSaveSettings = async (settings: StoreSettings) => {
    await persistState({ ...appState, settings });
    showToast('Pengaturan sistem berhasil disimpan!', 'success');
  };

  const handleSaveUser = async (user: UserAccount, origUsername: string) => {
    const nextUsers = [...appState.users];
    if (origUsername) {
      const idx = nextUsers.findIndex((u) => u.username === origUsername);
      if (idx >= 0) nextUsers[idx] = user;
    } else {
      nextUsers.push(user);
    }
    await persistState({ ...appState, users: nextUsers });
    showToast('Akun user tersimpan!', 'success');
  };

  const handleDeleteUser = async (idx: number) => {
    const nextUsers = [...appState.users];
    nextUsers.splice(idx, 1);
    await persistState({ ...appState, users: nextUsers });
  };

  const handleSyncSupabase = async () => {
    const sbClient = createSupabaseClientSafe(
      appState.settings.supabaseUrl,
      appState.settings.supabaseKey
    );
    if (!sbClient) {
      showToast('Isi URL dan Anon Key Supabase terlebih dahulu!', 'error');
      return;
    }
    const ok = await pushStateToSupabase(sbClient, activeDatabaseName, appState);
    showToast(
      ok ? 'Sinkronisasi ke Supabase Cloud selesai!' : 'Gagal sinkronisasi ke Supabase (periksa tabel donet_cell_state).',
      ok ? 'success' : 'error'
    );
  };

  const handlePullSupabase = async () => {
    const sbClient = createSupabaseClientSafe(
      appState.settings.supabaseUrl,
      appState.settings.supabaseKey
    );
    if (!sbClient) {
      showToast('Isi URL dan Anon Key Supabase terlebih dahulu!', 'error');
      return;
    }
    const cloudData = await pullStateFromSupabase(sbClient, activeDatabaseName);
    if (!cloudData) {
      showToast(`Belum ada data backup untuk [${activeDatabaseName}] di Supabase Cloud.`, 'error');
      return;
    }
    const normalized = normalizeAppState(cloudData, activeDatabaseName);
    setAppState(normalized);
    await saveStateToIndexedDBForDb(activeDatabaseName, normalized);
    showToast(`Data [${activeDatabaseName}] berhasil dipulihkan dari Supabase Cloud!`, 'success');
  };

  const handleImportBackupJson = async (parsed: Partial<AppState>) => {
    const normalized = normalizeAppState(parsed, activeDatabaseName);
    setPosCart([]);
    await persistState(normalized);
    showToast(`Data dari file JSON berhasil dipulihkan ke [${activeDatabaseName}]!`, 'success');
  };

  const handleExecuteTutupBuku = async () => {
    const nowIso = new Date().toISOString();
    const nextDebts = appState.debtsReceivables
      .filter((d) => Number(d.totalAmount) - Number(d.paidAmount) > 0 && d.status !== 'LUNAS')
      .map((d) => ({
        ...d,
        date: nowIso,
        totalAmount: Math.max(0, (Number(d.totalAmount) || 0) - (Number(d.paidAmount) || 0)),
        paidAmount: 0,
        status: 'BELUM_LUNAS' as const,
        payments: [],
      }));

    const nextLedger = appState.items.map((it) => ({
      date: nowIso,
      ref: 'SALDO-AWAL',
      code: it.code,
      name: it.name,
      type: 'STOK AWAL',
      inQty: Number(it.stock) || 0,
      outQty: 0,
      balance: Number(it.stock) || 0,
    }));

    setPosCart([]);
    await persistState({
      ...appState,
      transactions: [],
      purchaseOrders: [],
      purchaseRecords: [],
      purchaseReturns: [],
      voucherProductions: [],
      fundTransfers: [],
      serviceTickets: [],
      debtsReceivables: nextDebts,
      stockLedger: nextLedger,
    });
    showToast(
      'Tutup buku selesai! Riwayat transaksi dikosongkan, saldo kas, stok barang & sisa utang/piutang dipertahankan.',
      'success'
    );
  };

  const handleApplyOcr = (data: {
    mode: OcrTargetMode;
    provider: string;
    target: string;
    amount: number;
    qty: number;
    desc: string;
  }) => {
    if (data.mode === 'pembelian') {
      switchTab('pembelian');
      setOcrPembelianPrefill({ qty: data.qty || 1, cost: data.amount || 0, key: Date.now() });
    } else if (data.mode === 'pos') {
      switchTab('kasir');
      setOcrPosQuery({ text: data.target || data.desc, key: Date.now() });
    } else {
      switchTab('ppob');
      setOcrPpobPrefill({
        target: data.target,
        desc: data.desc,
        modal: data.amount,
        sell: data.amount + 3000,
        key: Date.now(),
      });
    }
    showToast('Hasil scan OCR diterapkan ke form!', 'success');
  };

  const supabaseConnected = Boolean(
    appState.settings.supabaseUrl && appState.settings.supabaseKey
  );

  const sidebarNav: { tab: TabId; label: string; icon: React.ReactNode }[] = [
    { tab: 'dashboard', label: 'Dashboard', icon: <Gauge className="w-4 h-4 text-amber-400" /> },
    { tab: 'masterdata', label: 'Master data', icon: <Database className="w-4 h-4 text-orange-300" /> },
    { tab: 'pembelian', label: 'Pembelian', icon: <FileText className="w-4 h-4 text-indigo-300" /> },
    { tab: 'kasir', label: 'Penjualan', icon: <ShoppingCart className="w-4 h-4 text-emerald-400" /> },
    { tab: 'ppob', label: 'Transaksi PPOB', icon: <Zap className="w-4 h-4 text-yellow-400" /> },
    { tab: 'servicehp', label: 'Service HP', icon: <Wrench className="w-4 h-4 text-rose-400" /> },
    { tab: 'cetakvoucher', label: 'Pembuatan Voucher Fisik', icon: <CreditCard className="w-4 h-4 text-cyan-300" /> },
    { tab: 'sumberdana', label: 'Sumber Dana', icon: <Wallet className="w-4 h-4 text-teal-300" /> },
    { tab: 'utangpiutang', label: 'Utang & Piutang', icon: <HandCoins className="w-4 h-4 text-amber-300" /> },
    { tab: 'akuntansi', label: 'Akutansi', icon: <Scale className="w-4 h-4 text-purple-300" /> },
    { tab: 'laporan', label: 'Laporan', icon: <BarChart3 className="w-4 h-4 text-sky-300" /> },
  ];

  return (
    <div className="h-[100dvh] w-screen flex flex-col text-slate-800 overflow-hidden">
      {/* TOP WINDOW BAR */}
      <header className="ipos-topbar px-2.5 sm:px-3 py-1.5 flex items-center justify-between select-none shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden ipos-btn p-1.5 rounded text-slate-700 shrink-0"
            aria-label="Buka Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="hidden sm:flex items-center gap-1.5 bg-[#005aa7] text-white px-2.5 py-0.5 rounded shadow-sm font-bold text-xs tracking-wide shrink-0">
            <Store className="w-3.5 h-3.5" />
            <span>iPos 5</span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-black text-sm sm:text-base tracking-tight">
              <span className="text-[#005aa7]">DONET</span>{' '}
              <span className="text-[#e67300]">CELL</span>
            </span>
            <span className="hidden sm:inline text-slate-400">|</span>
            <span className="hidden sm:inline font-semibold text-slate-700 text-xs truncate">
              BRILink &amp; Konter POS [{activeDatabaseName}]
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 text-xs shrink-0">
          <div
            className="hidden lg:flex items-center gap-1.5 bg-sky-50 border border-sky-300 text-sky-800 px-2.5 py-0.5 rounded font-medium"
            title="Penyimpanan Lokal Browser (IndexedDB) Aktif"
          >
            <HardDrive className="w-3.5 h-3.5 text-sky-600" />
            <span>Lokal PC Sinkron</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setSettingsTab('supabase');
              setSettingsOpen(true);
            }}
            className={`flex items-center gap-1 border px-2 py-0.5 rounded font-medium text-[11px] sm:text-xs transition cursor-pointer ${
              supabaseConnected
                ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800'
                : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800'
            }`}
          >
            <span className="sm:hidden">{supabaseConnected ? 'Cloud' : 'Lokal'}</span>
            <span className="hidden sm:inline">
              {supabaseConnected ? 'Supabase Cloud Aktif' : 'Mode Offline (Lokal)'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDbModalOpen(true)}
            className="ipos-btn px-2 sm:px-2.5 py-1 rounded flex items-center gap-1 font-semibold text-sky-800"
            title="Ganti Database / Login Ulang"
          >
            <Database className="w-3.5 h-3.5 text-sky-600" />
            <span className="hidden sm:inline">{activeDatabaseName}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSettingsTab('general');
              setSettingsOpen(true);
            }}
            className="ipos-btn px-2 py-1 rounded flex items-center gap-1 text-slate-700"
            title="Pengaturan Sistem, User & Cloud"
          >
            <Settings className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden lg:inline">Pengaturan</span>
          </button>
        </div>
      </header>

      {/* MOBILE SLIDE-OVER DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="ipos-sidebar relative w-64 max-w-[82vw] flex flex-col justify-between z-10 shadow-2xl h-full">
            <div className="overflow-y-auto flex-1">
              <div className="p-3 border-b border-slate-700/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-sky-500 flex items-center justify-center text-white font-extrabold shadow shrink-0">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-amber-400 leading-tight">
                      DONET CELL
                    </div>
                    <div className="text-[10px] text-sky-300">
                      iPos 5 &middot; {activeDatabaseName}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-slate-300 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-2 space-y-0.5 text-xs">
                {sidebarNav.map((item) => (
                  <button
                    key={item.tab}
                    type="button"
                    onClick={() => switchTab(item.tab)}
                    className={`ipos-sidebar-item w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer ${
                      activeTab === item.tab ? 'active' : ''
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setSettingsTab('general');
                    setSettingsOpen(true);
                  }}
                  className="ipos-sidebar-item w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-slate-300 shrink-0" />
                  <span className="truncate">Pengaturan dan lainnya</span>
                </button>

                <button
                  type="button"
                  onClick={() => switchTab('petunjuk')}
                  className={`ipos-sidebar-item w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer ${
                    activeTab === 'petunjuk' ? 'active' : ''
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-lime-300 shrink-0" />
                  <span className="truncate">Petunjuk dan pengunaan</span>
                </button>
              </div>
            </div>

            <div className="p-3 border-t border-slate-700/80 bg-[#0c1b33] text-[11px] text-slate-300 flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <div className="w-6 h-6 rounded-full bg-sky-700 flex items-center justify-center text-white font-bold shrink-0">
                  {currentUser.username.charAt(0)}
                </div>
                <div className="truncate">
                  <div className="font-semibold text-white">User: {currentUser.username}</div>
                  <div className="text-[10px] text-slate-400">
                    {currentUser.role} &middot; {currentUser.location}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleOpenLoginForActive();
                }}
                className="text-slate-300 hover:text-amber-300 p-1"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN WORKSPACE */}
      <div className="flex flex-1 overflow-hidden">
        {/* DESKTOP LEFT SIDEBAR */}
        <aside className="hidden md:flex ipos-sidebar w-56 flex-col justify-between shrink-0 z-20 shadow-lg">
          <div className="overflow-y-auto flex-1">
            <div className="p-3 border-b border-slate-700/80 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-sky-500 flex items-center justify-center text-white font-extrabold shadow shrink-0">
                <Radio className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <div className="font-bold text-sm text-amber-400 leading-tight truncate">
                  DONET CELL
                </div>
                <div className="text-[10px] text-sky-300 truncate">
                  iPos 5 &middot; {activeDatabaseName}
                </div>
              </div>
            </div>

            <div className="py-2 space-y-0.5 text-xs">
              {sidebarNav.map((item) => (
                <button
                  key={item.tab}
                  type="button"
                  onClick={() => switchTab(item.tab)}
                  className={`ipos-sidebar-item w-full flex items-center gap-3 px-3.5 py-2 text-left cursor-pointer ${
                    activeTab === item.tab ? 'active' : ''
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setSettingsTab('general');
                  setSettingsOpen(true);
                }}
                className="ipos-sidebar-item w-full flex items-center gap-3 px-3.5 py-2 text-left cursor-pointer"
              >
                <Settings className="w-4 h-4 text-slate-300 shrink-0" />
                <span className="truncate">Pengaturan dan lainnya</span>
              </button>

              <button
                type="button"
                onClick={() => switchTab('petunjuk')}
                className={`ipos-sidebar-item w-full flex items-center gap-3 px-3.5 py-2 text-left cursor-pointer ${
                  activeTab === 'petunjuk' ? 'active' : ''
                }`}
              >
                <BookOpen className="w-4 h-4 text-lime-300 shrink-0" />
                <span className="truncate">Petunjuk dan pengunaan</span>
              </button>
            </div>
          </div>

          <div className="p-2.5 border-t border-slate-700/80 bg-[#0c1b33] text-[11px] text-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <div className="w-6 h-6 rounded-full bg-sky-700 flex items-center justify-center text-white font-bold shrink-0">
                {currentUser.username.charAt(0)}
              </div>
              <div className="truncate">
                <div className="font-semibold text-white">User: {currentUser.username}</div>
                <div className="text-[10px] text-slate-400">
                  Role: <span className="text-sky-300 font-semibold">{currentUser.role}</span> &middot;{' '}
                  {currentUser.location}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenLoginForActive}
              className="text-slate-400 hover:text-amber-300 p-1 cursor-pointer"
              title="Ganti User / Login Ulang"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>

        {/* RIGHT WORKSPACE */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="bg-[#d0e1f2] border-b border-[#b5cbe2] px-2 pt-1.5 flex items-center gap-1 overflow-x-auto shrink-0">
            {openTabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => switchTab(t)}
                className={`ipos-tab px-2.5 sm:px-3 py-1 rounded-t text-xs flex items-center gap-1.5 sm:gap-2 shrink-0 cursor-pointer ${
                  activeTab === t ? 'active' : ''
                }`}
              >
                <span>{TAB_LABELS[t]}</span>
                {t !== 'dashboard' && (
                  <span
                    onClick={(e) => closeMdiTab(e, t)}
                    className="hover:text-red-600 font-bold ml-1"
                  >
                    &times;
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto ipos-workspace relative">
            {activeTab === 'dashboard' && (
              <DashboardView
                appState={appState}
                activeDatabaseName={activeDatabaseName}
                onSwitchTab={switchTab}
                onOpenSettings={(t) => {
                  setSettingsTab(t);
                  setSettingsOpen(true);
                }}
                onOpenOcr={(m) => {
                  setOcrMode(m);
                  setOcrOpen(true);
                }}
              />
            )}

            {activeTab === 'masterdata' && (
              <MasterDataView
                appState={appState}
                onSaveItem={handleSaveItem}
                onImportItems={handleImportItems}
                onDeleteItem={handleDeleteItem}
                onAddCategory={handleAddCategory}
                onRemoveCategory={handleRemoveCategory}
                onSaveSupplier={handleSaveSupplier}
                onDeleteSupplier={handleDeleteSupplier}
                onSaveCustomer={handleSaveCustomer}
                onDeleteCustomer={handleDeleteCustomer}
                onShowToast={showToast}
              />
            )}

            {activeTab === 'pembelian' && (
              <PembelianView
                appState={appState}
                ocrPrefill={ocrPembelianPrefill}
                onOpenOcr={() => {
                  setOcrMode('pembelian');
                  setOcrOpen(true);
                }}
                onSavePo={handleSavePo}
                onDeletePo={handleDeletePo}
                onSavePurchase={handleSavePurchase}
                onDeletePurchase={handleDeletePurchase}
                onSaveReturn={handleSaveReturn}
                onDeleteReturn={handleDeleteReturn}
                onDepositWallet={handleDepositWallet}
                onPreviewDocument={setDocPreview}
                onShowToast={showToast}
              />
            )}

            {activeTab === 'kasir' && (
              <KasirPosView
                appState={appState}
                posCart={posCart}
                setPosCart={setPosCart}
                itemPickerOpen={itemPickerOpen}
                setItemPickerOpen={setItemPickerOpen}
                ocrQuery={ocrPosQuery}
                onOpenOcr={() => {
                  setOcrMode('pos');
                  setOcrOpen(true);
                }}
                onSaveSalesPo={handleSaveSalesPo}
                onDeleteSalesPo={handleDeleteSalesPo}
                onSaveSale={handleSaveSale}
                onDeleteSale={handleDeleteTransaction}
                onSaveSalesReturn={handleSaveSalesReturn}
                onDeleteSalesReturn={handleDeleteSalesReturn}
                onReprintReceipt={(trx) => {
                  setReceiptServiceTicket(null);
                  setReceiptTrx(trx);
                }}
                onPreviewDocument={setDocPreview}
                onShowToast={showToast}
              />
            )}

            {activeTab === 'ppob' && (
              <PpobView
                appState={appState}
                mode={ppobMode}
                setMode={setPpobMode}
                ocrPrefill={ocrPpobPrefill}
                onOpenOcr={() => {
                  setOcrMode('ppob');
                  setOcrOpen(true);
                }}
                onSubmitPpob={handleSubmitPpob}
              />
            )}

            {activeTab === 'servicehp' && (
              <ServiceHpView
                appState={appState}
                onCreateTicket={handleCreateServiceTicket}
                onCompleteTicket={handleCompleteServiceTicket}
                onDeleteTicket={handleDeleteServiceTicket}
                onPrintTicket={(ticket) => {
                  setReceiptTrx(null);
                  setReceiptServiceTicket(ticket);
                }}
              />
            )}

            {activeTab === 'cetakvoucher' && (
              <VoucherAssemblyView
                appState={appState}
                onAssembleVoucher={handleAssembleVoucher}
              />
            )}

            {activeTab === 'sumberdana' && (
              <SumberDanaView
                appState={appState}
                onGoToMasterData={() => switchTab('masterdata')}
                onSaveWallet={handleSaveWallet}
                onDeleteWallet={handleDeleteWallet}
                onMutateFunds={handleMutateFunds}
              />
            )}

            {activeTab === 'utangpiutang' && (
              <UtangPiutangView
                appState={appState}
                onCreateDebt={handleCreateDebt}
                onPayDebt={handlePayDebt}
                onDeleteDebt={handleDeleteDebt}
              />
            )}

            {activeTab === 'akuntansi' && <AkuntansiView appState={appState} />}

            {activeTab === 'laporan' && (
              <LaporanView
                appState={appState}
                activeDatabaseName={activeDatabaseName}
                onReprintReceipt={(trx) => {
                  setReceiptServiceTicket(null);
                  setReceiptTrx(trx);
                }}
                onEditTransaction={handleEditTransaction}
                onDeleteTransaction={handleDeleteTransaction}
              />
            )}

            {activeTab === 'petunjuk' && <PetunjukView />}
          </div>
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden bg-[#102442] text-slate-200 border-t border-slate-700 grid grid-cols-5 shrink-0 select-none z-30">
        {[
          { tab: 'dashboard' as TabId, label: 'Home', icon: <Gauge className="w-4 h-4" /> },
          { tab: 'kasir' as TabId, label: 'Penjualan', icon: <ShoppingCart className="w-4 h-4" /> },
          { tab: 'ppob' as TabId, label: 'PPOB', icon: <Zap className="w-4 h-4" /> },
          { tab: 'masterdata' as TabId, label: 'Barang', icon: <Database className="w-4 h-4" /> },
        ].map((item) => (
          <button
            key={item.tab}
            type="button"
            onClick={() => switchTab(item.tab)}
            className={`py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
              activeTab === item.tab ? 'text-amber-400 bg-white/10' : 'text-slate-300'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-300"
        >
          <Menu className="w-4 h-4" />
          <span>Menu</span>
        </button>
      </nav>

      {/* DESKTOP BOTTOM STATUS BAR */}
      <footer className="hidden md:flex bg-[#e3eef9] border-t border-[#b5cbe2] px-3 py-1 text-[11px] text-slate-700 items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 font-semibold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" /> Siap
          </span>
          <span className="flex items-center gap-1">
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-sky-600" /> Online (Terhubung)
              </>
            ) : (
              <>
                <Plane className="w-3.5 h-3.5 text-amber-600" /> Offline (Lokal PC)
              </>
            )}
          </span>
          <span className="hidden sm:inline text-slate-500">|</span>
          <span className="hidden sm:flex items-center gap-1 text-slate-600">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-700" /> Auto-Scan Nota, POS &amp; PPOB: Aktif
          </span>
        </div>
        <div className="font-mono tabular-nums">{clockText}</div>
      </footer>

      {/* MODALS */}
      <DatabaseSelectModal
        open={dbModalOpen}
        availableDatabases={availableDatabases}
        activeDatabaseName={activeDatabaseName}
        onClose={() => setDbModalOpen(false)}
        onSelectDatabase={handleSelectDbForLogin}
        onCreateDatabase={handleCreateDatabase}
        onRenameDatabase={handleRenameDatabase}
        onDeleteDatabase={handleDeleteDatabase}
      />

      <LoginModal
        open={loginModalOpen}
        dbName={pendingDbForLogin}
        users={loginUsers}
        onClose={() => setLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <OcrScannerModal
        open={ocrOpen}
        initialMode={ocrMode}
        onClose={() => setOcrOpen(false)}
        onApply={handleApplyOcr}
        onShowToast={showToast}
      />

      <SettingsModal
        open={settingsOpen}
        initialTab={settingsTab}
        appState={appState}
        activeDatabaseName={activeDatabaseName}
        currentUser={currentUser}
        onClose={() => setSettingsOpen(false)}
        onSaveSettings={handleSaveSettings}
        onSaveUser={handleSaveUser}
        onDeleteUser={handleDeleteUser}
        onSyncSupabase={handleSyncSupabase}
        onPullSupabase={handlePullSupabase}
        onImportBackupJson={handleImportBackupJson}
        onExecuteTutupBuku={handleExecuteTutupBuku}
        onShowToast={showToast}
      />

      <ReceiptModal
        appState={appState}
        receiptTrx={receiptTrx}
        receiptServiceTicket={receiptServiceTicket}
        onClose={() => {
          setReceiptTrx(null);
          setReceiptServiceTicket(null);
        }}
        onShowToast={showToast}
      />

      <DocPreviewModal
        appState={appState}
        doc={docPreview}
        username={currentUser.username}
        onClose={() => setDocPreview(null)}
        onShowToast={showToast}
      />

      {/* TOAST NOTIFICATIONS */}
      <div className="fixed bottom-16 md:bottom-8 right-3 sm:right-4 z-[80] space-y-2 pointer-events-none max-w-[92vw]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-3.5 py-2 rounded shadow-lg border text-xs font-semibold flex items-center gap-2 pointer-events-auto transition-all ${
              t.type === 'success'
                ? 'bg-emerald-700 border-emerald-900 text-white'
                : t.type === 'error'
                ? 'bg-red-700 border-red-950 text-white'
                : 'bg-slate-800 border-slate-950 text-white'
            }`}
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            ) : t.type === 'error' ? (
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Info className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
