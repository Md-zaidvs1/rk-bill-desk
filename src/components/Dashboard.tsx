import React, { useState, useEffect } from "react";
import { 
  TrendingUp, Users, FileText, Receipt, 
  ArrowRight, ShieldCheck, Plus, Calendar, Clock, Sparkles
} from "lucide-react";
import { Bill, Prescription, ClinicSettings } from "../types";
import { supabase } from "../supabaseClient";

interface DashboardProps {
  settings: ClinicSettings;
  onNavigate: (tab: "billing" | "history" | "prescriptions" | "prescription_history" | "backup" | "settings") => void;
}

export default function Dashboard({ settings, onNavigate }: DashboardProps) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [billsQuery, presQuery] = await Promise.all([
          supabase.from("bills").select("*, bill_items(*)"),
          supabase.from("prescriptions").select("*")
        ]);

        if (billsQuery.error) throw new Error(billsQuery.error.message);
        if (presQuery.error) throw new Error(presQuery.error.message);

        const mappedBills = (billsQuery.data || []).map((b: any) => ({
          ...b,
          items: b.bill_items || b.items || []
        }));

        const formattedPres = (presQuery.data || []).map((p: any) => ({
          ...p,
          medicines: typeof p.medicines === "string" ? JSON.parse(p.medicines) : p.medicines
        }));

        setBills(mappedBills);
        setPrescriptions(formattedPres);
      } catch (err) {
        console.error("Error loading dashboard data from cloud database:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Calculate statistics
  const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  
  const todayBills = bills.filter(b => b.date === todayStr);
  const todayRevenue = todayBills.reduce((acc, b) => acc + b.grand_total, 0);
  const todayCount = todayBills.length;
  
  const todayPrescriptionsCount = prescriptions.filter(p => p.date === todayStr).length;
  const totalPatientsCount = new Set([
    ...bills.map(b => b.patient_name.toLowerCase().trim()),
    ...prescriptions.map(p => p.patient_name.toLowerCase().trim())
  ]).size;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-900 text-white p-6 rounded-lg shadow-md border border-blue-950">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Welcome to RK Bill Desk</h2>
            <p className="text-blue-100 text-xs mt-1 font-medium">
              Clinical Administration & Patient Record System | Professional Dental Suite
            </p>
            <div className="flex items-center space-x-4 mt-3 text-xs text-blue-200">
              <span className="flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Session Date: {new Date().toLocaleDateString("en-IN", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </span>
            </div>
          </div>
          <div className="bg-blue-950/40 border border-blue-700/30 px-4 py-3 rounded-md text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-blue-300 block">Registered Clinic</span>
            <span className="text-sm font-bold block">{settings.clinic_name}</span>
            <span className="text-[10px] text-blue-200/80 block mt-0.5">{settings.phone}</span>
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Revenue */}
        <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Today's Revenue</span>
            <span className="text-2xl font-extrabold text-blue-800 font-sans block">
              {loading ? "..." : formatCurrency(todayRevenue)}
            </span>
            <span className="text-[10px] text-gray-500 block">From {todayCount} generated bills</span>
          </div>
          <div className="bg-blue-50 p-3 rounded-md border border-blue-100 text-blue-800">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Total Patients */}
        <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Unique Patients</span>
            <span className="text-2xl font-extrabold text-gray-900 block">
              {loading ? "..." : totalPatientsCount}
            </span>
            <span className="text-[10px] text-gray-500 block">Registered in database</span>
          </div>
          <div className="bg-gray-50 p-3 rounded-md border border-gray-100 text-gray-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Today's Bills */}
        <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Bills Created</span>
            <span className="text-2xl font-extrabold text-blue-800 font-sans block">
              {loading ? "..." : todayCount}
            </span>
            <span className="text-[10px] text-gray-500 block">Today's billing desk</span>
          </div>
          <div className="bg-blue-50/50 p-3 rounded-md border border-blue-50 text-blue-700">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        {/* Today's Prescriptions */}
        <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Prescriptions</span>
            <span className="text-2xl font-extrabold text-gray-900 block">
              {loading ? "..." : todayPrescriptionsCount}
            </span>
            <span className="text-[10px] text-gray-500 block">Dispensary tickets today</span>
          </div>
          <div className="bg-gray-50 p-3 rounded-md border border-gray-100 text-gray-600">
            <FileText className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: Shortcuts + Recent Records */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Quick Actions Panel */}
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900 text-sm pb-2 border-b border-gray-100 tracking-tight">
            Quick Actions
          </h3>
          
          <div className="grid grid-cols-1 gap-2.5">
            <button
              onClick={() => onNavigate("billing")}
              className="flex items-center justify-between p-3.5 text-left border border-gray-200 rounded-md hover:border-blue-800 hover:bg-blue-50/20 group transition-all cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div className="bg-blue-50 text-blue-800 p-2 rounded-md group-hover:bg-blue-100 transition-colors">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-xs text-gray-800 block">Open Billing Desk</span>
                  <span className="text-[10px] text-gray-500">Generate invoice & treat patients</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-800 group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              onClick={() => onNavigate("prescriptions")}
              className="flex items-center justify-between p-3.5 text-left border border-gray-200 rounded-md hover:border-blue-800 hover:bg-blue-50/20 group transition-all cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div className="bg-emerald-50 text-emerald-800 p-2 rounded-md group-hover:bg-emerald-100 transition-colors">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-xs text-gray-800 block">Write Prescription</span>
                  <span className="text-[10px] text-gray-500">Prescribe drugs and dental advice</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-800 group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              onClick={() => onNavigate("settings")}
              className="flex items-center justify-between p-3.5 text-left border border-gray-200 rounded-md hover:border-blue-800 hover:bg-blue-50/20 group transition-all cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div className="bg-gray-100 text-gray-700 p-2 rounded-md group-hover:bg-gray-200 transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </div>
                <div>
                  <span className="font-bold text-xs text-gray-800 block">Configure Settings</span>
                  <span className="text-[10px] text-gray-500">Clinic info and doctor profile</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-800 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-100 p-3.5 rounded-md flex items-start space-x-2.5">
            <ShieldCheck className="w-5 h-5 text-blue-800 shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-900 leading-normal">
              <strong>Patient Confidentiality</strong>: All prescription drug charts and invoice receipts are strictly encrypted locally in the standalone offline secure sandbox.
            </div>
          </div>
        </div>

        {/* Recent Bills (Middle Col) */}
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm tracking-tight">Recent Invoices</h3>
            <button 
              onClick={() => onNavigate("history")} 
              className="text-[10px] font-bold text-blue-850 hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-gray-400 font-mono">Loading invoices...</div>
          ) : bills.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">No invoices generated yet today.</div>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {bills.slice(0, 5).map((bill) => (
                <div key={bill.id} className="p-2.5 border border-gray-100 hover:bg-gray-50/70 rounded flex items-center justify-between text-xs transition-colors">
                  <div>
                    <span className="font-bold text-gray-800 block truncate max-w-[140px]">{bill.patient_name}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{bill.bill_number} • {bill.time}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-blue-800 font-sans block">{formatCurrency(bill.grand_total)}</span>
                    <span className="text-[9px] bg-blue-50 text-blue-750 px-1 py-0.5 font-bold uppercase rounded-sm border border-blue-100/30">
                      {bill.payment_method}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Prescriptions (Right Col) */}
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm tracking-tight">Recent Prescriptions</h3>
            <button 
              onClick={() => onNavigate("prescription_history")} 
              className="text-[10px] font-bold text-blue-850 hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-gray-400 font-mono">Loading medical charts...</div>
          ) : prescriptions.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">No prescriptions written yet today.</div>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {prescriptions.slice(0, 5).map((pres) => (
                <div key={pres.id} className="p-2.5 border border-gray-100 hover:bg-gray-50/70 rounded flex items-center justify-between text-xs transition-colors">
                  <div>
                    <span className="font-bold text-gray-800 block truncate max-w-[150px]">{pres.patient_name}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{pres.date} • {pres.patient_mobile || "No Mobile"}</span>
                  </div>
                  <div className="text-right text-[10px] font-semibold text-gray-500">
                    {pres.medicines?.length || 0} Med(s)
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
