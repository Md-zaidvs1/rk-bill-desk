import React, { useState, useEffect } from "react";
import { 
  Receipt, History, FileText, Database, Settings as SettingsIcon, 
  LogOut, Shield, Clock, Landmark, LayoutDashboard, Activity, HeartPulse,
  UserCheck, UserX, Check, Search, Trash2, Printer, ShieldCheck,
  ChevronDown, ChevronUp
} from "lucide-react";
import { User, ClinicSettings, Bill } from "./types";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import TreatmentDesk from "./components/TreatmentDesk";
import BillingDesk from "./components/BillingDesk";
import BillHistory from "./components/BillHistory";
import PrescriptionModule from "./components/PrescriptionModule";
import SettingsPage from "./components/SettingsPage";
import DataManager from "./DataManager";
import { triggerThermalBillPrint } from "./services/printBridge";
import RKDentalLogo from "./components/RKDentalLogo";
import { supabase, seedDefaultUsers } from "./supabaseClient";

type ActiveTabType = "dashboard" | "treatment_desk" | "billing" | "history" | "prescriptions" | "prescription_history" | "backup" | "settings";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTabType>("dashboard");
  const [activePatient, setActivePatient] = useState<{ name: string; phone: string }>({ name: "", phone: "" });
  
  // Real-time ticking clock
  const [currentTime, setCurrentTime] = useState<string>("");

  // Seed default users (receptionist and doctor) into remote database if configured
  useEffect(() => {
    seedDefaultUsers();
  }, []);

  useEffect(() => {
    // Ticking clock matching classic desktop taskbar style
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check local storage for persistent session
  useEffect(() => {
    const savedUser = localStorage.getItem("rk_bill_desk_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem("rk_bill_desk_user");
      }
    }
  }, []);

  // Fetch clinic settings
  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .eq("id", "config")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      if (data) {
        const extraJson = localStorage.getItem("rk_bill_desk_extra_settings");
        let extra = {};
        if (extraJson) {
          try {
            extra = JSON.parse(extraJson);
          } catch (e) {
            console.error("Error parsing extra settings:", e);
          }
        }
        setSettings({ ...data, ...extra });
      }
    } catch (err) {
      console.error("Error loading clinic profile settings from cloud database:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  // Automated background evening backup routine
  useEffect(() => {
    if (!user) return;

    const runEveningBackup = async () => {
      try {
        const now = new Date();
        const hour = now.getHours();
        
        // We consider "evening" to be after 5:00 PM (17:00)
        if (hour >= 17) {
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, "0");
          const day = String(now.getDate()).padStart(2, "0");
          const dateString = `${year}-${month}-${day}`;
          const backupKey = `rk_daily_backup_${dateString}`;
          
          // Check if today's evening backup already exists in localStorage
          if (!localStorage.getItem(backupKey)) {
            console.log("[Auto-Backup] Triggers silent evening backup for date:", dateString);
            
            // Gather all tables
            const [settingsRes, usersRes, billsRes, itemsRes, presRes] = await Promise.all([
              supabase.from("settings").select("*"),
              supabase.from("users").select("*"),
              supabase.from("bills").select("*"),
              supabase.from("bill_items").select("*"),
              supabase.from("prescriptions").select("*")
            ]);
            
            const backupData = {
              version: "2.0-cloud-auto",
              timestamp: now.toISOString(),
              tables: {
                settings: settingsRes.data || [],
                users: usersRes.data || [],
                bills: billsRes.data || [],
                bill_items: itemsRes.data || [],
                prescriptions: presRes.data || []
              }
            };
            
            // Store frozen state to localStorage freeze
            localStorage.setItem(backupKey, JSON.stringify(backupData));
            
            // Also attempt to push to daily_backups table in cloud database silently
            try {
              await supabase.from("daily_backups").insert([{
                backup_date: dateString,
                created_at: now.toISOString(),
                payload: JSON.stringify(backupData)
              }]);
            } catch (err) {
              // Silently catch table-not-exist or network errors so UI doesn't stutter
              console.warn("[Auto-Backup] Cloud table insertion bypassed/failed:", err);
            }
            
            console.log("[Auto-Backup] Silent evening backup freeze completed successfully.");
          }
        }
      } catch (err) {
        console.error("[Auto-Backup] Silent evening backup error:", err);
      }
    };

    // Run on mount (after a 5-second delay to prioritize main page load speed)
    const timeout = setTimeout(runEveningBackup, 5000);
    // Also check every 30 minutes to capture when the app is left open until evening
    const interval = setInterval(runEveningBackup, 30 * 60 * 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [user]);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem("rk_bill_desk_user", JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("rk_bill_desk_user");
  };

  const handleSettingsUpdate = (updatedSettings: ClinicSettings) => {
    setSettings(updatedSettings);
  };

  const handleRestoreComplete = () => {
    fetchSettings();
  };

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="text-center font-sans text-sm text-gray-500 flex flex-col items-center space-y-3">
          <span className="animate-spin inline-block w-8 h-8 border-4 border-blue-800 border-t-transparent rounded-full"></span>
          <span className="font-semibold text-blue-800">Initializing RK Clinical Database Engine...</span>
        </div>
      </div>
    );
  }

  if (user.role === "receptionist") {
    return (
      <ReceptionistConsole
        user={user}
        settings={settings}
        onLogout={handleLogout}
        currentTime={currentTime}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans select-none antialiased">
      
      {/* 1. PREMIUM TOP WINDOW HEADER WITH GOLD LOGO */}
      <header className="bg-[#0b091a] text-white border-b-2 border-amber-500/25 flex flex-col md:flex-row md:items-center justify-between px-6 py-3.5 shadow-xl shrink-0 animate-fade-in">
        
        {/* Left Side Branding with Gold Logo */}
        <div className="flex items-center space-x-4">
          <RKDentalLogo className="w-12 h-12" />
          <div className="border-l border-white/10 pl-4 py-0.5">
            <div className="flex items-center space-x-2.5">
              <h1 className="font-extrabold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 leading-none">
                {settings.clinic_name}
              </h1>
              <span className="bg-violet-900/80 text-amber-200 border border-amber-500/30 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
                RK Bill Desk
              </span>
            </div>
            <p className="text-[10px] text-zinc-400/90 font-medium mt-1 tracking-wide truncate max-w-[400px]">
              General and Cosmetic Dentistry • {settings.address}
            </p>
          </div>
        </div>

        {/* Right Side Metadata */}
        <div className="flex items-center space-x-4 mt-3 md:mt-0 self-end md:self-auto">
          {/* Operator Tag */}
          <div className="flex items-center space-x-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-semibold">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full inline-block animate-pulse"></span>
            <span className="text-zinc-200">Doctor: <strong className="text-amber-200">{user.name}</strong></span>
          </div>

          {/* live clock */}
          <div className="hidden sm:flex items-center space-x-2 text-zinc-300 text-xs bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
            <Clock className="w-3.5 h-3.5 text-amber-300" />
            <span className="font-mono">{currentTime}</span>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="bg-red-600/90 hover:bg-red-700 text-white border border-red-700/50 px-4 py-1.5 rounded-lg text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer flex items-center space-x-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>

      </header>

      {/* 2. MAIN APPLICATION CONTENT CHASSIS */}
      <div className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-5 gap-6">

        <div className="flex-1 flex flex-col md:flex-row gap-6">
          
          {/* Sidebar Navigation */}
          <nav className="w-full md:w-60 flex flex-col gap-1.5 shrink-0 bg-white p-4 rounded-lg border border-gray-200 shadow-sm h-fit">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2.5 mb-1.5 block">
              Clinical Workspace
            </span>

            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full text-left font-bold px-3.5 py-2.5 text-xs tracking-wide flex items-center space-x-2.5 transition-all rounded-md cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-violet-800 text-white shadow-md font-bold"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === "dashboard" ? "text-white" : "text-gray-400"}`} />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab("treatment_desk")}
              className={`w-full text-left font-bold px-3.5 py-2.5 text-xs tracking-wide flex items-center space-x-2.5 transition-all rounded-md cursor-pointer ${
                activeTab === "treatment_desk"
                  ? "bg-violet-800 text-white shadow-md font-bold"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Activity className={`w-4 h-4 shrink-0 ${activeTab === "treatment_desk" ? "text-white" : "text-gray-400"}`} />
              <span className="flex items-center gap-1.5">
                <span>Treatment Desk</span>
                <span className="bg-emerald-500 w-1.5 h-1.5 rounded-full inline-block animate-pulse"></span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`w-full text-left font-bold px-3.5 py-2.5 text-xs tracking-wide flex items-center space-x-2.5 transition-all rounded-md cursor-pointer ${
                activeTab === "history"
                  ? "bg-violet-800 text-white shadow-md font-bold"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <History className={`w-4 h-4 shrink-0 ${activeTab === "history" ? "text-white" : "text-gray-400"}`} />
              <span>Bill History</span>
            </button>

            <button
              onClick={() => setActiveTab("prescription_history")}
              className={`w-full text-left font-bold px-3.5 py-2.5 text-xs tracking-wide flex items-center space-x-2.5 transition-all rounded-md cursor-pointer ${
                activeTab === "prescription_history"
                  ? "bg-violet-800 text-white shadow-md font-bold"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <FileText className={`w-4 h-4 shrink-0 ${activeTab === "prescription_history" ? "text-white" : "text-gray-400"}`} />
              <span>Prescription History</span>
            </button>

            <div className="border-t border-gray-100 my-2"></div>

            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2.5 mb-1.5 block">
              System Admin
            </span>

            <button
              onClick={() => setActiveTab("backup")}
              className={`w-full text-left font-bold px-3.5 py-2.5 text-xs tracking-wide flex items-center space-x-2.5 transition-all rounded-md cursor-pointer ${
                activeTab === "backup"
                  ? "bg-violet-800 text-white shadow-md font-bold"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Database className={`w-4 h-4 shrink-0 ${activeTab === "backup" ? "text-white" : "text-gray-400"}`} />
              <span>Data Manager</span>
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full text-left font-bold px-3.5 py-2.5 text-xs tracking-wide flex items-center space-x-2.5 transition-all rounded-md cursor-pointer ${
                activeTab === "settings"
                  ? "bg-violet-800 text-white shadow-md font-bold"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <SettingsIcon className={`w-4 h-4 shrink-0 ${activeTab === "settings" ? "text-white" : "text-gray-400"}`} />
              <span>Settings</span>
            </button>

            <div className="mt-8 pt-4 border-t border-gray-100 px-2">
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block animate-pulse"></span>
                <span className="text-[9px] text-gray-400 font-mono font-bold uppercase tracking-wide">
                  SQLITE SECURE LINK
                </span>
              </div>
              <span className="text-[9px] text-gray-400 font-mono block mt-0.5 truncate">
                File: rk-bill-desk.db
              </span>
            </div>
          </nav>

        {/* Dynamic Display Panels */}
        <main className="flex-1 min-w-0">
          {activeTab === "dashboard" && (
            <Dashboard 
              settings={settings} 
              onNavigate={(tab) => {
                // Map legacy navigation redirects if any
                if (tab === "billing") {
                  setActiveTab("treatment_desk");
                } else if (tab === "prescriptions") {
                  setActiveTab("prescription_history");
                } else {
                  setActiveTab(tab as ActiveTabType);
                }
              }} 
            />
          )}
          {activeTab === "treatment_desk" && (
            <TreatmentDesk 
              settings={settings} 
              activePatient={activePatient}
              onActivePatientChange={setActivePatient}
            />
          )}
          {activeTab === "history" && <BillHistory settings={settings} />}
          {activeTab === "prescription_history" && (
            <PrescriptionModule 
              settings={settings} 
              initialTab="history" 
              activePatient={activePatient}
              onActivePatientChange={setActivePatient}
            />
          )}
          {activeTab === "backup" && <DataManager onRestoreSuccess={handleRestoreComplete} />}
          {activeTab === "settings" && (
            <SettingsPage
              settings={settings}
              user={user}
              onSettingsUpdate={handleSettingsUpdate}
              onUserUpdate={(updatedUser) => {
                setUser(updatedUser);
                localStorage.setItem("rk_bill_desk_user", JSON.stringify(updatedUser));
              }}
            />
          )}
        </main>

        </div>
      </div>

      {/* 3. WINDOW STATUS FOOTER */}
      <footer className="bg-white border-t border-gray-200 px-6 py-2 text-[10px] text-gray-500 font-mono flex flex-col sm:flex-row justify-between items-center mt-auto shadow-inner">
        <div>RK Bill Desk © 2026 | Professional Dental Clinic Suite</div>
        <div className="mt-1 sm:mt-0 flex items-center space-x-1">
          <Activity className="w-3 h-3 text-blue-800 shrink-0" />
          <span>Operator: {user.name} | Connection: stand-alone SQLITE</span>
        </div>
      </footer>

    </div>
  );
}

interface ReceptionistConsoleProps {
  user: User;
  settings: ClinicSettings;
  onLogout: () => void;
  currentTime: string;
}

function ReceptionistConsole({ user, settings, onLogout, currentTime }: ReceptionistConsoleProps) {
  const [pendingBills, setPendingBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBillForPrint, setSelectedBillForPrint] = useState<Bill | null>(null);

  // Filters State
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "week" | "custom">("today");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Expanded details state
  const [expandedBillId, setExpandedBillId] = useState<number | null>(null);
  const [expandedPrescription, setExpandedPrescription] = useState<any>(null);
  const [loadingPrescriptionId, setLoadingPrescriptionId] = useState<number | null>(null);

  const fetchPendingBills = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all bills permanently
      const { data, error: err } = await supabase
        .from("bills")
        .select("*, bill_items(*)")
        .order("id", { ascending: false });

      if (err) {
        throw new Error(err.message);
      }

      const mapped = (data || []).map((b: any) => ({
        ...b,
        items: b.bill_items || b.items || []
      }));

      setPendingBills(mapped);
    } catch (err: any) {
      setError(err.message || "Failed to fetch clinical print queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingBills();
  }, []);

  const handleMarkAsPrinted = async (id: number) => {
    try {
      const { error: err } = await supabase
        .from("bills")
        .update({ printed: true })
        .eq("id", id);

      if (err) {
        throw new Error(err.message);
      }

      // Keep permanently in list, just update status
      setPendingBills(prev => prev.map(b => b.id === id ? { ...b, printed: true } : b));
    } catch (err: any) {
      alert(err.message || "Failed to mark bill as printed.");
    }
  };

  const handleDelete = async (id: number, billNumber: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to permanently delete bill ${billNumber}? This action is irreversible.`);
    if (!confirmDelete) return;

    try {
      const { error: err } = await supabase
        .from("bills")
        .delete()
        .eq("id", id);

      if (err) {
        throw new Error(err.message);
      }

      setPendingBills(prev => prev.filter(b => b.id !== id));
      if (expandedBillId === id) {
        setExpandedBillId(null);
        setExpandedPrescription(null);
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete bill.");
    }
  };

  const handleToggleExpand = async (bill: Bill) => {
    if (expandedBillId === bill.id) {
      setExpandedBillId(null);
      setExpandedPrescription(null);
      return;
    }

    setExpandedBillId(bill.id);
    setExpandedPrescription(null);
    setLoadingPrescriptionId(bill.id);

    try {
      // Try to find prescription for this patient on this exact date
      let { data, error: err } = await supabase
        .from("prescriptions")
        .select("*")
        .ilike("patient_name", bill.patient_name.trim())
        .eq("date", bill.date);

      if (!err && data && data.length > 0) {
        setExpandedPrescription({
          ...data[0],
          medicines: typeof data[0].medicines === "string" ? JSON.parse(data[0].medicines) : data[0].medicines
        });
      } else {
        // Fallback: try finding most recent prescription for this patient
        let { data: dataAlt, error: errAlt } = await supabase
          .from("prescriptions")
          .select("*")
          .ilike("patient_name", bill.patient_name.trim())
          .order("id", { ascending: false })
          .limit(1);

        if (!errAlt && dataAlt && dataAlt.length > 0) {
          setExpandedPrescription({
            ...dataAlt[0],
            medicines: typeof dataAlt[0].medicines === "string" ? JSON.parse(dataAlt[0].medicines) : dataAlt[0].medicines
          });
        }
      }
    } catch (e) {
      console.error("Error fetching prescription for expanded view:", e);
    } finally {
      setLoadingPrescriptionId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Helper date generators for timezone-safe local filtering
  const getTodayDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getYesterdayDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const isThisWeek = (dateStr: string) => {
    const billDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find Monday of the current week
    const currentDay = today.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    billDate.setHours(12, 0, 0, 0);
    return billDate >= monday && billDate <= sunday;
  };

  // Combined searching, status, and date filtering
  const filteredBills = pendingBills.filter(b => {
    // 1. Search Query filter
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const matchSearch = (
        b.patient_name.toLowerCase().includes(q) ||
        (b.patient_mobile && b.patient_mobile.toLowerCase().includes(q)) ||
        b.bill_number.toLowerCase().includes(q)
      );
      if (!matchSearch) return false;
    }

    // 3. Date filter
    const billDate = b.date;
    const todayStr = getTodayDateStr();
    const yesterdayStr = getYesterdayDateStr();

    if (dateFilter === "today") {
      if (billDate !== todayStr) return false;
    } else if (dateFilter === "yesterday") {
      if (billDate !== yesterdayStr) return false;
    } else if (dateFilter === "week") {
      if (!isThisWeek(billDate)) return false;
    } else if (dateFilter === "custom") {
      if (startDate && billDate < startDate) return false;
      if (endDate && billDate > endDate) return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-zinc-50/50 text-zinc-900 flex flex-col font-sans select-none antialiased">
      {/* HEADER */}
      <header className="bg-white border-b border-violet-100 flex flex-col md:flex-row md:items-center justify-between px-6 py-4 shadow-sm shrink-0">
        <div className="flex items-center space-x-3.5">
          <div className="bg-violet-600 text-white p-2 font-bold rounded-xl shrink-0 flex items-center justify-center shadow-md shadow-violet-600/15">
            <HeartPulse className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="font-black text-lg tracking-tight text-violet-950 leading-none">RK Bill Desk</h1>
              <span className="bg-violet-100 text-violet-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-violet-200 uppercase tracking-wider">
                Receptionist Mode
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 font-medium mt-1">
              Clinical Workspace & Thermal Receipt Print Console • {settings.clinic_name}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 mt-3 md:mt-0 self-end md:self-auto">
          {/* Operator */}
          <div className="flex items-center space-x-2 bg-zinc-100 border border-zinc-200/60 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-700">
            <span className="w-1.5 h-1.5 bg-violet-600 rounded-full inline-block animate-pulse"></span>
            <span>{user.name}</span>
          </div>

          {/* Clock */}
          <div className="hidden sm:flex items-center space-x-2 text-zinc-500 text-xs bg-zinc-100/50 px-3 py-1.5 rounded-lg border border-zinc-200/50">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-mono font-medium">{currentTime}</span>
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-950 px-4 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-all shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5 text-zinc-300" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* CLINICAL CONSOLE WORKSPACE */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-violet-950 tracking-tight flex items-center gap-2">
              <span>Receptionist Print Console</span>
              <span className="bg-violet-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-sm shadow-violet-600/20">
                {pendingBills.length} TOTAL BILLS
              </span>
            </h2>
            <p className="text-xs text-zinc-500 mt-1 font-medium">
              Review patient charts, print clinical prescription and billing details, and manage records
            </p>
          </div>

          <button
            onClick={fetchPendingBills}
            className="bg-white hover:bg-zinc-50 border border-zinc-200 font-bold px-4 py-2 rounded-lg text-xs text-zinc-700 flex items-center gap-1.5 cursor-pointer transition-all shadow-sm shrink-0 animate-in fade-in duration-200"
          >
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>Refresh Workspace</span>
          </button>
        </div>

        {/* SEARCH BOX */}
        <div className="bg-white border border-violet-100/80 rounded-xl p-4 shadow-sm">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400 pointer-events-none">
              <Search className="w-4 h-4 text-zinc-400" />
            </span>
            <input
              type="text"
              placeholder="Search patients by Name, Mobile Number, or Bill Number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 pl-10 pr-4 py-2.5 text-sm text-zinc-950 focus:outline-none focus:ring-4 focus:ring-violet-600/10 focus:border-violet-600 focus:bg-white rounded-lg transition-all placeholder-zinc-400 font-medium"
            />
          </div>
        </div>

        {/* FILTERS BAR */}
        <div className="bg-white border border-zinc-200/80 rounded-xl p-4 md:p-5 shadow-sm space-y-4">
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block mb-2 font-mono">Date Filter Range</label>
            <div className="flex bg-zinc-100 p-1 rounded-lg border border-zinc-200/60 w-fit flex-wrap gap-1 font-semibold text-zinc-750">
              <button
                onClick={() => setDateFilter("today")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all uppercase tracking-wider ${
                  dateFilter === "today"
                    ? "bg-white text-violet-750 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setDateFilter("yesterday")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all uppercase tracking-wider ${
                  dateFilter === "yesterday"
                    ? "bg-white text-violet-750 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Yesterday
              </button>
              <button
                onClick={() => setDateFilter("week")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all uppercase tracking-wider ${
                  dateFilter === "week"
                    ? "bg-white text-violet-750 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setDateFilter("custom")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all uppercase tracking-wider ${
                  dateFilter === "custom"
                    ? "bg-white text-violet-750 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          {/* Custom Date Picker Inputs */}
          {dateFilter === "custom" && (
            <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-zinc-500 font-semibold">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-zinc-50 border border-zinc-200 px-2.5 py-1.5 rounded-md text-xs font-medium text-zinc-850 focus:outline-none focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600"
                />
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-zinc-500 font-semibold">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-zinc-50 border border-zinc-200 px-2.5 py-1.5 rounded-md text-xs font-medium text-zinc-850 focus:outline-none focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600"
                />
              </div>
            </div>
          )}
        </div>

        {/* CLINICAL PATIENT RECORD LIST */}
        {loading ? (
          <div className="bg-white border border-zinc-150 rounded-xl p-12 text-center shadow-sm flex flex-col items-center justify-center space-y-3">
            <span className="animate-spin inline-block w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full"></span>
            <p className="text-xs font-semibold text-violet-950 uppercase tracking-wider">Scanning Clinical Database...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center shadow-sm">
            <div className="text-red-600 font-bold text-sm">Error Loading Queue</div>
            <p className="text-xs text-red-800/80 mt-1 font-medium">{error}</p>
            <button
              onClick={fetchPendingBills}
              className="mt-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg"
            >
              Retry Connection
            </button>
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="bg-white border border-zinc-150 rounded-xl p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-violet-50 text-violet-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-violet-100">
              <ShieldCheck className="w-8 h-8 text-violet-600" />
            </div>
            <h3 className="text-sm font-bold text-violet-950 uppercase tracking-wide">No Records Found</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed font-medium">
              No bills match your current search queries or filter selections. Adjust your filters or wait for the doctor to generate new transactions.
            </p>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-200">
            {filteredBills.map(bill => (
              <div 
                key={bill.id} 
                className={`bg-white border rounded-xl p-5 flex flex-col transition-all shadow-sm ${
                  expandedBillId === bill.id 
                    ? "border-violet-400 shadow-md ring-4 ring-violet-50" 
                    : "border-zinc-200/80 hover:border-violet-200/80 hover:shadow-md hover:shadow-violet-600/5"
                }`}
              >
                {/* Core Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                  {/* Details block */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-violet-700 bg-violet-50 border border-violet-100 px-2.5 py-0.5 rounded-md">
                        {bill.bill_number}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono font-semibold uppercase tracking-wider">
                        {bill.date} • {bill.time}
                      </span>
                      
                      {/* Status Badges */}
                      {bill.printed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Printed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          Pending
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-base font-black text-zinc-900 leading-tight">
                      {bill.patient_name}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 font-medium">
                      <span>Mobile: <strong className="text-zinc-700">{bill.patient_mobile || "N/A"}</strong></span>
                      <span>•</span>
                      <span>Payment Method: <strong className="text-zinc-700 uppercase font-bold">{bill.payment_method}</strong></span>
                    </div>
                  </div>

                  {/* Actions & Price block */}
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-4 border-t border-zinc-100 sm:border-0 pt-4 sm:pt-0 shrink-0">
                    <div className="sm:text-right">
                      <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider block font-mono">Grand Total</span>
                      <span className="text-xl font-black text-violet-950 font-sans tracking-tight">
                        {formatCurrency(bill.grand_total)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* VIEW COMPLETE CHART / PATIENT DETAILS */}
                      <button
                        onClick={() => handleToggleExpand(bill)}
                        className={`font-bold py-2 px-3 rounded-lg text-xs tracking-wider uppercase flex items-center justify-center gap-1 h-9 shrink-0 border transition-all cursor-pointer ${
                          expandedBillId === bill.id
                            ? "bg-zinc-100 text-zinc-800 border-zinc-300"
                            : "bg-white hover:bg-violet-50 text-violet-700 border-violet-200"
                        }`}
                        title="Expand patient clinical sheet details"
                      >
                        {expandedBillId === bill.id ? (
                          <>
                            <ChevronUp className="w-4 h-4" />
                            <span>Collapse</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" />
                            <span>View Chart</span>
                          </>
                        )}
                      </button>

                      {/* VIEW & PRINT SLIP */}
                      <button
                        onClick={() => triggerThermalBillPrint(bill, settings)}
                        className="bg-violet-600 hover:bg-violet-700 text-white font-bold py-2 px-4 rounded-lg text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 shadow-sm shadow-violet-600/10 hover:shadow-md transition-all cursor-pointer h-9 shrink-0"
                      >
                        <Printer className="w-4 h-4 text-white" />
                        <span>View & Print</span>
                      </button>

                      {/* DELETE */}
                      <button
                        onClick={() => handleDelete(bill.id, bill.bill_number)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/60 font-bold py-2 px-3 rounded-lg text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all h-9 shrink-0 cursor-pointer"
                        title="Permanently Delete Bill"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Detailed View (Bento Grid Style) */}
                {expandedBillId === bill.id && (
                  <div className="mt-4 pt-4 border-t border-zinc-150 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Treatments Column */}
                      <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200/60 flex flex-col justify-between">
                        <div>
                          <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 mb-2.5 flex items-center gap-1.5 font-mono">
                            <HeartPulse className="w-3.5 h-3.5 text-violet-600" />
                            <span>Treatment Details</span>
                          </h4>
                          <div className="divide-y divide-zinc-200/60">
                            {(bill.items || bill.bill_items || []).map((item: any, idx: number) => (
                              <div key={idx} className="py-2.5 flex justify-between items-center text-xs">
                                <span className="font-semibold text-zinc-800">{item.treatment_name || "Dental Checkup"}</span>
                                <span className="font-bold font-mono text-zinc-900">{formatCurrency(Number(item.amount || 0))}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-zinc-200 flex justify-between items-center text-xs">
                          <span className="font-bold text-zinc-500">Summary Due:</span>
                          <span className="font-extrabold text-sm text-violet-900 font-mono bg-violet-50/80 px-2 py-0.5 rounded border border-violet-100">
                            {formatCurrency(bill.grand_total)}
                          </span>
                        </div>
                      </div>

                      {/* Prescription Column */}
                      <div className="bg-violet-50/45 rounded-lg p-4 border border-violet-100/80">
                        <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-violet-700 mb-2.5 flex items-center gap-1.5 font-mono">
                          <FileText className="w-3.5 h-3.5 text-violet-600" />
                          <span>Clinical Prescription (Rx)</span>
                        </h4>
                        {loadingPrescriptionId === bill.id ? (
                          <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                            <span className="animate-spin inline-block w-4 h-4 border-2 border-violet-600 border-t-transparent rounded-full"></span>
                            <span className="text-[10px] text-violet-800 font-semibold tracking-wider uppercase font-mono">Retrieving Prescription...</span>
                          </div>
                        ) : expandedPrescription ? (
                          <div className="space-y-3">
                            {expandedPrescription.doctor_notes && (
                              <div className="text-xs">
                                <span className="font-bold text-zinc-500 block mb-1">Doctor Diagnosis / Notes:</span>
                                <div className="text-zinc-800 bg-white/90 rounded p-2.5 border border-zinc-200/60 whitespace-pre-wrap leading-relaxed text-xs">
                                  {expandedPrescription.doctor_notes}
                                </div>
                              </div>
                            )}
                            
                            {expandedPrescription.medicines && expandedPrescription.medicines.length > 0 ? (
                              <div className="space-y-2">
                                <span className="font-bold text-zinc-500 block text-xs">Prescribed Medications:</span>
                                <div className="divide-y divide-zinc-200/40 bg-white/90 rounded-md border border-zinc-200/60 p-2 space-y-1.5">
                                  {expandedPrescription.medicines.map((med: any, idx: number) => (
                                    <div key={idx} className="text-xs pb-1.5 last:pb-0 last:border-0 leading-normal">
                                      <div className="font-bold text-zinc-900">{idx + 1}. {med.name}</div>
                                      <div className="text-zinc-500 pl-3 mt-0.5 space-y-0.5">
                                        <div className="font-medium text-[11px]">
                                          {med.dosage && <span className="text-zinc-700">Dosage: <strong className="text-zinc-900 font-semibold">{med.dosage}</strong> </span>}
                                          {med.frequency && <span className="text-zinc-400">|</span>}
                                          {med.frequency && <span className="text-zinc-700"> Freq: <strong className="text-zinc-900 font-semibold">{med.frequency}</strong> </span>}
                                          {med.duration && <span className="text-zinc-400">|</span>}
                                          {med.duration && <span className="text-zinc-700"> Dur: <strong className="text-zinc-900 font-semibold">{med.duration}</strong></span>}
                                        </div>
                                        {med.instructions && (
                                          <div className="italic text-zinc-600 text-[10.5px] bg-zinc-50/50 p-1 rounded mt-1 border border-zinc-100">
                                            Instructions: {med.instructions}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-zinc-400 italic">No medicines prescribed in this session.</p>
                            )}
                          </div>
                        ) : (
                          <div className="py-6 text-center text-zinc-400 italic text-xs">
                            No prescription found for this patient session.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-zinc-150 px-6 py-3.5 text-[10px] text-zinc-400 font-mono flex flex-col sm:flex-row justify-between items-center shrink-0 mt-auto shadow-inner">
        <div>RK Bill Desk • Clinical Receptionist Workspace v1.1</div>
        <div className="mt-1 sm:mt-0 flex items-center space-x-1.5">
          <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block animate-pulse"></span>
          <span>Operator: {user.name} | Connection: live</span>
        </div>
      </footer>

    </div>
  );
}
