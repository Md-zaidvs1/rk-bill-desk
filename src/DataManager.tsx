import React, { useState, useRef } from "react";
import { Download, Upload, ShieldAlert, CheckCircle, Database, AlertTriangle, HardDriveDownload, FolderSync, ShieldCheck, Cloud } from "lucide-react";
import { supabase } from "./supabaseClient";

interface DataManagerProps {
  onRestoreSuccess: () => void;
}

export default function DataManager({ onRestoreSuccess }: DataManagerProps) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download complete DB backup as JSON
  const handleExportBackup = async () => {
    setExporting(true);
    setError(null);
    setSuccess(null);

    try {
      // Gather all cloud table data in parallel
      const [settingsRes, usersRes, billsRes, itemsRes, presRes] = await Promise.all([
        supabase.from("settings").select("*"),
        supabase.from("users").select("*"),
        supabase.from("bills").select("*"),
        supabase.from("bill_items").select("*"),
        supabase.from("prescriptions").select("*")
      ]);

      if (settingsRes.error) throw new Error(settingsRes.error.message);
      if (usersRes.error) throw new Error(usersRes.error.message);
      if (billsRes.error) throw new Error(billsRes.error.message);
      if (itemsRes.error) throw new Error(itemsRes.error.message);
      if (presRes.error) throw new Error(presRes.error.message);

      const backupData = {
        version: "2.0-cloud",
        timestamp: new Date().toISOString(),
        tables: {
          settings: settingsRes.data || [],
          users: usersRes.data || [],
          bills: billsRes.data || [],
          bill_items: itemsRes.data || [],
          prescriptions: presRes.data || []
        }
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const dateString = `${year}-${month}-${day}`;
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `RK_Cloud_Backup_${dateString}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSuccess("Database backup aggregate compiled and saved to downloads disk successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to compile cloud backup. Ensure you have active internet connection.");
    } finally {
      setExporting(false);
    }
  };

  // Handle backup file uploads (Restore)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);

    const confirmRestore = window.confirm(
      "CRITICAL DATABASE RESTORE NOTICE:\n\nThis will completely OVERWRITE and PURGE all current cloud patient bills, prescriptions, treatment items, settings, and logins.\n\nAre you sure you want to proceed?"
    );
    if (!confirmRestore) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setImporting(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonContent = JSON.parse(event.target?.result as string);
        
        if (!jsonContent || typeof jsonContent !== "object") {
          throw new Error("Invalid file format. Please upload a valid JSON backup.");
        }
        
        const tables = jsonContent.tables;
        if (!tables) {
          throw new Error("Invalid backup schema. 'tables' root attribute is missing.");
        }

        // Purge existing data
        await Promise.all([
          supabase.from("bill_items").delete().neq("id", 0),
          supabase.from("bills").delete().neq("id", 0),
          supabase.from("prescriptions").delete().neq("id", 0),
          supabase.from("settings").delete().neq("id", "0"),
          supabase.from("users").delete().neq("id", 0)
        ]);

        // Bulk insert restored tables
        if (tables.settings && tables.settings.length > 0) {
          await supabase.from("settings").insert(tables.settings);
        }
        if (tables.users && tables.users.length > 0) {
          await supabase.from("users").insert(tables.users);
        }
        if (tables.bills && tables.bills.length > 0) {
          await supabase.from("bills").insert(tables.bills);
        }
        if (tables.bill_items && tables.bill_items.length > 0) {
          await supabase.from("bill_items").insert(tables.bill_items);
        }
        if (tables.prescriptions && tables.prescriptions.length > 0) {
          await supabase.from("prescriptions").insert(tables.prescriptions);
        }

        setSuccess("Database tables fully restored and synchronized successfully!");
        onRestoreSuccess();
      } catch (err: any) {
        setError(err.message || "Invalid backup JSON structure or Cloud restore failure.");
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="bg-white border border-gray-200 p-6 shadow-sm rounded-lg text-left">
      
      {/* Header Panel */}
      <div className="border-b border-gray-200 pb-4 mb-6">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center space-x-2">
          <Database className="w-5 h-5 text-blue-800" />
          <span>Local Clinical Database Administration</span>
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">Maintain, back up, and recover clinical databases for 100% offline uptime</p>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-4 mb-5 text-xs rounded-r-md flex items-start space-x-2.5">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 mb-5 text-xs rounded-lg flex items-start space-x-2.5">
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Export Module */}
        <div className="border border-gray-250 rounded-lg p-5 flex flex-col justify-between space-y-5 bg-gray-50/20 hover:border-gray-300 transition-all shadow-sm">
          <div>
            <div className="flex items-center space-x-2.5 mb-3">
              <div className="bg-blue-50 text-blue-800 p-2.5 rounded-lg border border-blue-100/50">
                <HardDriveDownload className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-gray-900 text-sm">Download Clinical Backup</h3>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Consolidates settings, user logins, procedure bills, treatment lists, and prescribing ledger records into a single structured offline backup file. 
            </p>
            <div className="mt-3.5 text-[10px] font-mono text-gray-400 bg-gray-100/60 p-1.5 px-2.5 rounded border border-gray-200/50 w-fit">
              Filename: RK_Backup_YYYY-MM-DD.json
            </div>
          </div>

          <button
            onClick={handleExportBackup}
            disabled={exporting}
            className="w-full bg-blue-800 hover:bg-blue-900 text-white font-bold py-2.5 px-4 rounded-md text-xs uppercase tracking-wider flex items-center justify-center space-x-2 disabled:bg-gray-400 cursor-pointer shadow-md transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{exporting ? "Compiling backup..." : "Export Database JSON"}</span>
          </button>
        </div>

        {/* Import Module */}
        <div className="border border-gray-250 rounded-lg p-5 flex flex-col justify-between space-y-5 bg-gray-50/20 hover:border-gray-300 transition-all shadow-sm">
          <div>
            <div className="flex items-center space-x-2.5 mb-3">
              <div className="bg-amber-50 text-amber-700 p-2.5 rounded-lg border border-amber-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-gray-900 text-sm">Restore from Backup</h3>
            </div>
            <p className="text-xs text-amber-900 bg-amber-50/50 p-4 border border-amber-100 rounded-md font-sans leading-relaxed">
              <strong>CRITICAL WARNING:</strong> This action will permanently delete and overwrite all current patient records, invoices, and clinical settings. Keep a fresh export before restoring.
            </p>
          </div>

          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 font-bold py-2.5 px-4 rounded-md text-xs uppercase tracking-wider flex items-center justify-center space-x-2 disabled:bg-gray-100 cursor-pointer shadow-sm transition-all"
            >
              <Upload className="w-4 h-4 text-gray-500" />
              <span>{importing ? "Overwriting tables..." : "Upload & Restore JSON"}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Database Diagnostic and File System status strip */}
      <div className="border-t border-gray-200 mt-8 pt-5 text-xs text-gray-500 font-mono">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Diagnostic Cloud Status</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-gray-50 p-3 rounded border border-gray-150 flex items-center space-x-2">
            <Cloud className="w-4 h-4 text-blue-700 shrink-0" />
            <div>
              <div className="text-[9px] text-gray-400 font-bold">DATABASE CLOUD PROVIDER</div>
              <div className="text-[10px] text-gray-800 font-semibold truncate">Supabase Cloud Engine</div>
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded border border-gray-150 flex items-center space-x-2">
            <Database className="w-4 h-4 text-emerald-700 shrink-0" />
            <div>
              <div className="text-[9px] text-gray-400 font-bold">ACTIVE REGION/SERVICE</div>
              <div className="text-[10px] text-gray-800 font-semibold">PostgreSQL Web API</div>
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded border border-gray-150 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-blue-800 shrink-0" />
            <div>
              <div className="text-[9px] text-gray-400 font-bold">AUTHENTICATION</div>
              <div className="text-[10px] text-gray-800 font-semibold">Supabase Auth / Local Fallback</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
