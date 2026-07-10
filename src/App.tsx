import React, { useState, useEffect } from "react";
import { 
  Receipt, History, FileText, Database, Settings as SettingsIcon, 
  LogOut, Shield, Clock, Landmark, LayoutDashboard, Activity, HeartPulse,
  UserCheck, UserX
} from "lucide-react";
import { User, ClinicSettings } from "./types";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import TreatmentDesk from "./components/TreatmentDesk";
import BillingDesk from "./components/BillingDesk";
import BillHistory from "./components/BillHistory";
import PrescriptionModule from "./components/PrescriptionModule";
import SettingsPage from "./components/SettingsPage";
import DataManager from "./DataManager";
import { supabase } from "./supabaseClient";
import "./ReceiptPrint.css";

type ActiveTabType = "dashboard" | "treatment_desk" | "billing" | "history" | "prescriptions" | "prescription_history" | "backup" | "settings";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTabType>("dashboard");
  const [activePatient, setActivePatient] = useState<{ name: string; phone: string }>({ name: "", phone: "" });
  
  // Real-time ticking clock
  const [currentTime, setCurrentTime] = useState<string>("");

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
        setSettings(data);
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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans select-none antialiased">
      
      {/* 1. TOP WINDOW HEADER */}
      <header className="bg-blue-800 text-white border-b border-blue-900 flex flex-col md:flex-row md:items-center justify-between px-6 py-3 shadow-md">
        
        {/* Left Side Branding */}
        <div className="flex items-center space-x-3.5">
          <div className="bg-white text-blue-800 p-1.5 font-bold rounded-lg shrink-0 flex items-center justify-center shadow-inner">
            <HeartPulse className="w-5 h-5 text-blue-800" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-lg tracking-tight text-white leading-none">{settings.clinic_name}</h1>
              <span className="bg-blue-900 text-blue-100 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                Active Desk
              </span>
            </div>
            <p className="text-[10px] text-blue-100/80 mt-0.5 tracking-wide truncate max-w-[400px]">
              {settings.address}
            </p>
          </div>
        </div>

        {/* Right Side Metadata */}
        <div className="flex items-center space-x-4 mt-3 md:mt-0 self-end md:self-auto">
          {/* Operator Tag */}
          <div className="flex items-center space-x-2 bg-blue-900/60 border border-blue-700/50 px-3 py-1.5 rounded-md text-xs font-medium">
            <Shield className="w-3.5 h-3.5 text-blue-200" />
            <span className="text-blue-100">{user.name}</span>
          </div>

          {/* live clock */}
          <div className="hidden sm:flex items-center space-x-2 text-blue-100 text-xs bg-blue-950/40 px-3 py-1.5 rounded-md border border-blue-700/30">
            <Clock className="w-3.5 h-3.5 text-blue-300" />
            <span className="font-mono">{currentTime}</span>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="bg-red-700 hover:bg-red-800 border border-red-800 text-white px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-colors shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>

      </header>

      {/* 2. MAIN APPLICATION CONTENT CHASSIS */}
      <div className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-5 gap-6">
        
        {/* Global Patient Tracker */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all shrink-0">
          <div className="flex items-center space-x-3.5 w-full sm:w-auto">
            <div className={`p-2.5 rounded-lg shrink-0 flex items-center justify-center transition-colors ${
              activePatient.name ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-blue-50 text-blue-800 border border-blue-100"
            }`}>
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 sm:flex-initial">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Patient Session</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase ${
                  activePatient.name 
                    ? "bg-emerald-100 text-emerald-800" 
                    : "bg-amber-100 text-amber-800 animate-pulse"
                }`}>
                  {activePatient.name ? "Active" : "Ready / Enter Below"}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {activePatient.name 
                  ? `Patient: ${activePatient.name} ${activePatient.phone ? `(${activePatient.phone})` : ""}`
                  : "Enter details once to sync across Billing Desk & Prescription modules."}
              </p>
            </div>
          </div>

          {/* Inline Inputs for One-Time Entry */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto sm:flex-1 sm:max-w-xl justify-end">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Patient Full Name..."
                value={activePatient.name}
                onChange={(e) => setActivePatient({ ...activePatient, name: e.target.value })}
                className="w-full bg-white border border-gray-300 px-3 py-1.5 pl-8 text-xs text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all placeholder-gray-400 font-medium"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-[11px]">👤</span>
            </div>
            
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Mobile Number..."
                value={activePatient.phone}
                onChange={(e) => setActivePatient({ ...activePatient, phone: e.target.value })}
                className="w-full bg-white border border-gray-300 px-3 py-1.5 pl-8 text-xs text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all placeholder-gray-400 font-medium"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-[11px]">📞</span>
            </div>

            {activePatient.name && (
              <button
                type="button"
                onClick={() => setActivePatient({ name: "", phone: "" })}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors flex items-center justify-center gap-1 cursor-pointer shrink-0 border border-gray-200"
                title="Clear active patient session"
              >
                <UserX className="w-3.5 h-3.5 text-gray-500" />
                <span className="sm:hidden md:inline">Clear</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row gap-6">
          
          {/* Sidebar Navigation */}
          <nav className="w-full md:w-60 flex flex-col gap-1.5 shrink-0 bg-white p-4 rounded-lg border border-gray-200 shadow-sm h-fit">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2.5 mb-1.5 block">
            Clinical System
          </span>

          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full text-left font-bold px-3.5 py-2.5 text-xs tracking-wide flex items-center space-x-2.5 transition-all rounded-md cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-blue-800 text-white shadow-md font-bold"
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
                ? "bg-blue-800 text-white shadow-md font-bold"
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
            onClick={() => setActiveTab("billing")}
            className={`w-full text-left font-bold px-3.5 py-2.5 text-xs tracking-wide flex items-center space-x-2.5 transition-all rounded-md cursor-pointer ${
              activeTab === "billing"
                ? "bg-blue-800 text-white shadow-md font-bold"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <Receipt className={`w-4 h-4 shrink-0 ${activeTab === "billing" ? "text-white" : "text-gray-400"}`} />
            <span>Billing Desk</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`w-full text-left font-bold px-3.5 py-2.5 text-xs tracking-wide flex items-center space-x-2.5 transition-all rounded-md cursor-pointer ${
              activeTab === "history"
                ? "bg-blue-800 text-white shadow-md font-bold"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <History className={`w-4 h-4 shrink-0 ${activeTab === "history" ? "text-white" : "text-gray-400"}`} />
            <span>Bill History</span>
          </button>

          <div className="border-t border-gray-100 my-2"></div>

          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2.5 mb-1.5 block">
            E-Prescriptions
          </span>

          <button
            onClick={() => setActiveTab("prescriptions")}
            className={`w-full text-left font-bold px-3.5 py-2.5 text-xs tracking-wide flex items-center space-x-2.5 transition-all rounded-md cursor-pointer ${
              activeTab === "prescriptions"
                ? "bg-blue-800 text-white shadow-md font-bold"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <FileText className={`w-4 h-4 shrink-0 ${activeTab === "prescriptions" ? "text-white" : "text-gray-400"}`} />
            <span>Prescriptions</span>
          </button>

          <button
            onClick={() => setActiveTab("prescription_history")}
            className={`w-full text-left font-bold px-3.5 py-2.5 text-xs tracking-wide flex items-center space-x-2.5 transition-all rounded-md cursor-pointer ${
              activeTab === "prescription_history"
                ? "bg-blue-800 text-white shadow-md font-bold"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <History className={`w-4 h-4 shrink-0 ${activeTab === "prescription_history" ? "text-white" : "text-gray-400"}`} />
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
                ? "bg-blue-800 text-white shadow-md font-bold"
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
                ? "bg-blue-800 text-white shadow-md font-bold"
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
              onNavigate={(tab) => setActiveTab(tab)} 
            />
          )}
          {activeTab === "treatment_desk" && (
            <TreatmentDesk 
              settings={settings} 
              activePatient={activePatient}
              onActivePatientChange={setActivePatient}
            />
          )}
          {activeTab === "billing" && (
            <BillingDesk 
              settings={settings} 
              activePatient={activePatient}
              onActivePatientChange={setActivePatient}
            />
          )}
          {activeTab === "history" && <BillHistory settings={settings} />}
          {activeTab === "prescriptions" && (
            <PrescriptionModule 
              settings={settings} 
              initialTab="create" 
              activePatient={activePatient}
              onActivePatientChange={setActivePatient}
            />
          )}
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
