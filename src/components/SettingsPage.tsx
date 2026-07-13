import React, { useState, useEffect } from "react";
import { Save, Lock, Settings, Phone, ShieldCheck, Mail, CheckCircle, AlertTriangle, KeyRound, Building, ClipboardList, Cpu, Printer, Server, Activity, Power, Layers, RefreshCw } from "lucide-react";
import { ClinicSettings, User } from "../types";
import { supabase } from "../supabaseClient";
import { getPrintBridgeSettings, savePrintBridgeSettings } from "../services/printBridgeConfig";
import { printBridge } from "../services/printBridge";

interface SettingsPageProps {
  settings: ClinicSettings;
  user: User;
  onSettingsUpdate: (updated: ClinicSettings) => void;
  onUserUpdate: (updated: User) => void;
}

export default function SettingsPage({ settings, user, onSettingsUpdate, onUserUpdate }: SettingsPageProps) {
  // Clinic Details State
  const [clinicName, setClinicName] = useState(settings.clinic_name);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [receiptFooter, setReceiptFooter] = useState(settings.receipt_footer);
  const [whatsappTemplate, setWhatsappTemplate] = useState(settings.whatsapp_message_template);

  // Print Bridge Configuration State
  const [bridgeIP, setBridgeIP] = useState("192.168.1.50");
  const [bridgePort, setBridgePort] = useState<number>(3001);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<string>("Disconnected");
  const [bridgeStatusColor, setBridgeStatusColor] = useState<string>("text-amber-500");

  useEffect(() => {
    const loadBridgeSettings = async () => {
      const config = getPrintBridgeSettings();
      setBridgeIP(config.ipAddress);
      setBridgePort(config.port);
      try {
        const isOnline = await printBridge.testConnection();
        setBridgeStatus(isOnline ? "Online" : "Offline");
        setBridgeStatusColor(isOnline ? "text-emerald-500 font-bold animate-pulse" : "text-amber-500 font-semibold");
      } catch (err) {
        setBridgeStatus("Offline");
        setBridgeStatusColor("text-amber-500 font-semibold");
      }
    };
    loadBridgeSettings();
  }, []);

  const handleTestBridgeConnection = async () => {
    setTestingConnection(true);
    setConnectionTestResult(null);
    try {
      // Temporarily save to test configuration
      savePrintBridgeSettings({ ipAddress: bridgeIP, port: bridgePort });
      const isOnline = await printBridge.testConnection();
      if (isOnline) {
        setBridgeStatus("Online");
        setBridgeStatusColor("text-emerald-500 font-bold animate-pulse");
        setConnectionTestResult({
          success: true,
          message: `Connection Successful! Reached Print Bridge at http://${bridgeIP}:${bridgePort}`
        });
      } else {
        setBridgeStatus("Offline");
        setBridgeStatusColor("text-amber-500 font-semibold");
        setConnectionTestResult({
          success: false,
          message: `Unreachable! No active Print Bridge found at http://${bridgeIP}:${bridgePort}. Ensure the Windows service is running and connected to the same local network.`
        });
      }
    } catch (err: any) {
      setConnectionTestResult({
        success: false,
        message: `Connection failed: ${err.message}`
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveBridgeConfig = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      savePrintBridgeSettings({ ipAddress: bridgeIP, port: bridgePort });
      alert("Print Bridge configurations saved successfully!");
      const updateStatus = async () => {
        const isOnline = await printBridge.testConnection();
        setBridgeStatus(isOnline ? "Online" : "Offline");
        setBridgeStatusColor(isOnline ? "text-emerald-500 font-bold animate-pulse" : "text-amber-500 font-semibold");
      };
      updateStatus();
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    }
  };

  const handleTriggerTestPrint = async () => {
    try {
      savePrintBridgeSettings({ ipAddress: bridgeIP, port: bridgePort });
      const dummyReceipt = {
        clinic: settings.clinic_name + " (TEST PAGE)",
        patient: "TEST PATIENT",
        billNo: "TX-0000",
        date: "2026-07-11 16:30",
        items: [{ name: "Standard Teeth Cleaning", amount: 1500 }],
        subtotal: 1500,
        discount: 0,
        tax: 0,
        grandTotal: 1500,
        paymentMethod: "CASH",
        footer: "Test print command sent successfully! Check your thermal printer."
      };
      await printBridge.print(dummyReceipt);
      alert("Test print command sent successfully! Check your thermal printer.");
    } catch (err: any) {
      alert(`Printing failed: ${err.message || err}`);
    }
  };

  // Security State
  const [newUsername, setNewUsername] = useState(user.username);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Status indicators
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Handle clinic settings save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    setSettingsError(null);
    setSettingsSuccess(null);

    try {
      const updatedValues = {
        clinic_name: clinicName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        receipt_footer: receiptFooter.trim(),
        whatsapp_message_template: whatsappTemplate.trim()
      };

      const targetId = settings.id || "config";

      const { data, error: err } = await supabase
        .from("settings")
        .update(updatedValues)
        .eq("id", targetId)
        .select();

      if (err) {
        throw new Error(err.message);
      }

      setSettingsSuccess("Clinic profile settings saved successfully to cloud!");
      // If direct single row was returned, pass it, otherwise fallback to values
      const updatedRecord = (data && data.length > 0) ? data[0] : { id: targetId, ...updatedValues };
      onSettingsUpdate(updatedRecord);
    } catch (err: any) {
      setSettingsError(err.message || "Failed to save profile settings to cloud database.");
    } finally {
      setSettingsLoading(false);
    }
  };

  // Handle password and username update
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newUsername.trim()) {
      setPasswordError("Username cannot be empty.");
      return;
    }

    if (!currentPassword) {
      setPasswordError("Please enter your current password to authorize changes.");
      return;
    }

    const isChangingPassword = Boolean(newPassword);

    if (isChangingPassword) {
      if (newPassword !== confirmPassword) {
        setPasswordError("New passwords do not match.");
        return;
      }

      if (newPassword.length < 4) {
        setPasswordError("New password must be at least 4 characters long.");
        return;
      }
    }

    setPasswordLoading(true);

    try {
      // 1. Verify current password
      const { data: usersData, error: verifyErr } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .eq("password", currentPassword);

      if (verifyErr) {
        throw new Error(verifyErr.message);
      }

      if (!usersData || usersData.length === 0) {
        setPasswordError("Incorrect current password. Authorization failed.");
        return;
      }

      // 2. Prepare update values
      const updateValues: any = {
        username: newUsername.trim()
      };

      if (isChangingPassword) {
        updateValues.password = newPassword;
      }

      // 3. Update the database record
      const { data: updatedUsers, error: updateErr } = await supabase
        .from("users")
        .update(updateValues)
        .eq("id", user.id)
        .select();

      if (updateErr) {
        throw new Error(updateErr.message);
      }

      setPasswordSuccess("Operator credentials saved successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Propagate user changes up
      const updatedUser = (updatedUsers && updatedUsers.length > 0) ? updatedUsers[0] : { ...user, ...updateValues };
      onUserUpdate(updatedUser);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update security credentials.");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Clinic Settings Profile Form */}
      <div className="lg:col-span-2 bg-white border border-gray-200 p-6 shadow-sm rounded-lg">
        
        <div className="border-b border-gray-200 pb-4 mb-5">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center space-x-2">
            <Building className="w-5 h-5 text-blue-800" />
            <span>Clinic Profile & Configurations</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Customize print letterheads, receipts, and messaging parameters</p>
        </div>

        {settingsError && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-4 mb-5 text-xs rounded-r-md">
            {settingsError}
          </div>
        )}

        {settingsSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 mb-5 text-xs rounded-lg flex items-center space-x-2">
            <span className="bg-emerald-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold">✓</span>
            <span className="font-semibold">{settingsSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Clinic / Doctor Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="e.g. RK Dental Clinic"
                className="w-full bg-white border border-gray-300 px-3 py-2 text-sm text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all font-sans"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Telephone / Phone Line <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Phone className="w-4 h-4 text-gray-400" />
                </span>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full bg-white border border-gray-300 pl-10 pr-3 py-2 text-sm text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all font-sans"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Clinic Address (Prints on thermal receipts & prescriptions) <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter full physical address"
              className="w-full bg-white border border-gray-300 p-3 text-sm text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all font-sans leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Thermal Receipt Footer message <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              placeholder="e.g. Thank you for your visit! Keep smiling."
              className="w-full bg-white border border-gray-300 px-3 py-2 text-sm text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all font-sans"
            />
          </div>

          <div className="border-t border-gray-200 pt-4 mt-6">
            <div className="mb-2.5">
              <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                WhatsApp message template
              </label>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                Customize the text copy dispatched to patients on WhatsApp. Use variables to dynamically inject values:
                <span className="inline-flex gap-1.5 ml-1 flex-wrap">
                  <code className="bg-gray-150 text-gray-800 px-1 py-0.2 rounded font-mono font-bold">{`{patient_name}`}</code>
                  <code className="bg-gray-150 text-gray-800 px-1 py-0.2 rounded font-mono font-bold">{`{clinic_name}`}</code>
                  <code className="bg-gray-150 text-gray-800 px-1 py-0.2 rounded font-mono font-bold">{`{medicines_text}`}</code>
                  <code className="bg-gray-150 text-gray-800 px-1 py-0.2 rounded font-mono font-bold">{`{notes}`}</code>
                </span>
              </p>
            </div>
            <textarea
              rows={6}
              value={whatsappTemplate}
              onChange={(e) => setWhatsappTemplate(e.target.value)}
              placeholder="Enter WhatsApp template"
              className="w-full bg-white border border-gray-300 p-3 text-xs text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all font-mono leading-relaxed shadow-inner"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={settingsLoading}
              className="bg-blue-800 hover:bg-blue-900 text-white font-bold py-2.5 px-6 rounded-md text-xs tracking-wider uppercase flex items-center justify-center space-x-2 disabled:bg-gray-400 cursor-pointer shadow-md transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{settingsLoading ? "Saving Profile..." : "Save Clinic Profile"}</span>
            </button>
          </div>

        </form>

      </div>

      {/* Security Credentials Password Manager */}
      <div className="lg:col-span-1 bg-white border border-gray-200 p-6 shadow-sm rounded-lg flex flex-col justify-between">
        <div>
          <div className="border-b border-gray-200 pb-4 mb-5">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center space-x-2">
              <KeyRound className="w-5 h-5 text-blue-800" />
              <span>Security Settings</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Manage operator password and access credentials</p>
          </div>

          {passwordError && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-4 mb-5 text-xs rounded-r-md">
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 mb-5 text-xs rounded-lg flex items-center space-x-2">
              <span className="bg-emerald-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold">✓</span>
              <span className="font-semibold">{passwordSuccess}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Operator Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="e.g. RK Dental Clinic"
                className="w-full bg-white border border-gray-300 px-3 py-2 text-sm text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all font-sans"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Current Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-gray-300 px-3 py-2 text-sm text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                New Password (leave blank to keep unchanged)
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter at least 4 characters"
                className="w-full bg-white border border-gray-300 px-3 py-2 text-sm text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                required={Boolean(newPassword)}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full bg-white border border-gray-300 px-3 py-2 text-sm text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full bg-blue-800 hover:bg-blue-900 text-white font-bold py-2.5 px-4 rounded-md text-xs tracking-wider uppercase flex items-center justify-center space-x-2 disabled:bg-gray-400 cursor-pointer shadow-md transition-all"
              >
                <Lock className="w-4 h-4" />
                <span>{passwordLoading ? "Updating..." : "Save Credentials"}</span>
              </button>
            </div>

          </form>
        </div>

        <div className="mt-8 pt-4 border-t border-gray-100 flex items-start space-x-2 text-[10px] text-gray-400 font-mono">
          <ShieldCheck className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
          <span>Passwords are updated securely and directly on the local database server. Please note down and safe-keep your new keys.</span>
        </div>
      </div>

      {/* ---------------- PRINT BRIDGE CONFIGURATION PANEL ---------------- */}
      <div className="lg:col-span-3 bg-white border border-gray-200 p-6 shadow-sm rounded-lg mt-6">
        <div className="border-b border-gray-200 pb-4 mb-5">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center space-x-2">
            <Server className="w-5 h-5 text-blue-800" />
            <span>Windows Print Bridge Configuration</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure and test connectivity to the Local Print Bridge running on the clinic Windows PC.
          </p>
        </div>

        <form onSubmit={handleSaveBridgeConfig} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column: Connection Setup */}
            <div className="space-y-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 border-b border-gray-150 pb-2">
                <Server className="w-4 h-4 text-gray-500" />
                <span>Connection Configuration</span>
              </h3>

              <div className="bg-white p-3.5 rounded-lg border border-gray-200 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Print Bridge IP Address
                    </label>
                    <input
                      type="text"
                      value={bridgeIP}
                      onChange={(e) => setBridgeIP(e.target.value)}
                      placeholder="e.g. 192.168.1.50"
                      className="w-full bg-white border border-gray-300 px-2 py-1.5 text-xs font-mono text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      TCP Port
                    </label>
                    <input
                      type="number"
                      value={bridgePort}
                      onChange={(e) => setBridgePort(parseInt(e.target.value) || 3001)}
                      placeholder="3001"
                      className="w-full bg-white border border-gray-300 px-2 py-1.5 text-xs font-mono text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-800/10 focus:border-blue-800 rounded-md transition-all"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestBridgeConnection}
                  disabled={testingConnection}
                  className="w-full bg-gray-100 hover:bg-gray-200 border border-gray-250 text-gray-700 font-bold text-xs py-2 px-3 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:bg-gray-50 disabled:text-gray-450"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? "animate-spin text-blue-700" : ""}`} />
                  <span>{testingConnection ? "Pinging Print Bridge host..." : "Test Bridge Connection"}</span>
                </button>
              </div>

              {/* Status and feedback block */}
              <div className="bg-white p-3 rounded-lg border border-gray-150 flex items-center justify-between text-xs font-mono">
                <span className="text-gray-400">BRIDGE STATUS:</span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${bridgeStatus === "Online" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                  <span className={bridgeStatusColor}>{bridgeStatus.toUpperCase()}</span>
                </div>
              </div>

              {connectionTestResult && (
                <div className={`p-3 rounded-lg text-xs leading-relaxed font-mono ${
                  connectionTestResult.success 
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-800" 
                    : "bg-red-50 border border-red-200 text-red-800"
                }`}>
                  <span className="font-bold">{connectionTestResult.success ? "SUCCESS: " : "ERROR: "}</span>
                  <span>{connectionTestResult.message}</span>
                </div>
              )}
            </div>

            {/* Right Column: Thermal Layout Parameters */}
            <div className="space-y-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100 flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 border-b border-gray-150 pb-2">
                  <Layers className="w-4 h-4 text-gray-500" />
                  <span>Integration Details</span>
                </h3>

                <div className="text-xs text-gray-600 leading-relaxed space-y-2">
                  <p>
                    The iPad dental app converts bill and prescription data into raw JSON records and relays them to the Print Bridge running on port <strong>{bridgePort}</strong> of the host Windows PC.
                  </p>
                  <p>
                    Ensure that:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-gray-500">
                    <li>The Windows Local Print Bridge software is actively running.</li>
                    <li>Both the iPad and the Windows PC are connected to the same local network subnet.</li>
                    <li>Firewalls on the Windows PC permit incoming requests on port {bridgePort}.</li>
                  </ul>
                </div>
              </div>

              {/* Action operations */}
              <div className="border-t border-gray-150 pt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleTriggerTestPrint}
                  className="bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-900 font-extrabold text-xs py-2.5 px-4 rounded-lg flex-1 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  <Activity className="w-4 h-4" />
                  <span>Send Test Page</span>
                </button>
                <button
                  type="submit"
                  className="bg-blue-800 hover:bg-blue-900 text-white border border-blue-900 font-extrabold text-xs py-2.5 px-6 rounded-lg flex-1 cursor-pointer transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Settings</span>
                </button>
              </div>
            </div>

          </div>
        </form>
      </div>

    </div>
  );
}
