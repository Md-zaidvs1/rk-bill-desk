import React, { useState, useEffect, useRef } from "react";
import { Printer, Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, FileText, Receipt, Check, Clock } from "lucide-react";
import { Bill, ClinicSettings } from "../types";
import { supabase } from "../supabaseClient";

export default function PrintReceiver() {
  const [pairingCode, setPairingCode] = useState<string>("");
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");
  const [activeJob, setActiveJob] = useState<Bill | null>(null);
  const [jobHistory, setJobHistory] = useState<Bill[]>([]);
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Real-time clock matching clinic dashboard style
  useEffect(() => {
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

  // Fetch clinic settings so printed receipts have correct headers
  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .eq("id", "config")
        .single();

      if (error) throw error;
      if (data) setSettings(data);
    } catch (err) {
      console.error("Error loading clinic profile settings on mobile print receiver:", err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Generate a random 4-digit code once on mount
  useEffect(() => {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    setPairingCode(code);
  }, []);

  // Set up SSE connection when pairing code is ready
  useEffect(() => {
    if (!pairingCode) return;

    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      setConnectionStatus("connecting");
      setErrorMsg(null);

      const url = `/api/print-stream?code=${pairingCode}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnectionStatus("connected");
      };

      es.onerror = (e) => {
        console.error("SSE Connection failed:", e);
        setConnectionStatus("error");
        setErrorMsg("Failed to connect to clinic printing server. Retrying...");
        es.close();
        
        // Attempt auto-reconnect after 5 seconds
        setTimeout(() => {
          if (connectionStatus !== "connected") {
            connectSSE();
          }
        }, 5000);
      };

      es.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "init") {
            console.log("SSE Receiver initialized successfully with pairing code:", message.code);
            setConnectionStatus("connected");
          } else if (message.type === "print" && message.payload) {
            const billData: Bill = message.payload;
            console.log("Incoming print job received:", billData);
            
            // Set active job and trigger print
            setActiveJob(billData);
            
            // Add to history list
            setJobHistory(prev => [billData, ...prev.slice(0, 9)]);
          }
        } catch (err) {
          console.error("Failed to parse incoming SSE message:", err);
        }
      };
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [pairingCode]);

  // Trigger window.print() whenever activeJob is populated
  useEffect(() => {
    if (!activeJob) return;

    // Small delay to ensure the DOM is fully updated before print panel displays
    const timer = setTimeout(() => {
      window.print();
    }, 400);

    return () => clearTimeout(timer);
  }, [activeJob]);

  const handleManualPrint = (job: Bill) => {
    setActiveJob(job);
  };

  const handleReconnect = () => {
    if (!pairingCode) return;
    setConnectionStatus("connecting");
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/print-stream?code=${pairingCode}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnectionStatus("connected");
      setErrorMsg(null);
    };

    es.onerror = () => {
      setConnectionStatus("error");
      setErrorMsg("Failed to connect to clinic printing server.");
      es.close();
    };

    es.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "init") {
          setConnectionStatus("connected");
        } else if (message.type === "print" && message.payload) {
          const billData: Bill = message.payload;
          setActiveJob(billData);
          setJobHistory(prev => [billData, ...prev.slice(0, 9)]);
        }
      } catch (err) {
        console.error("Failed to parse incoming SSE message:", err);
      }
    };
  };

  // Default placeholder values if settings are not loaded yet
  const displayClinicName = settings?.clinic_name || "RK Dental Suite";
  const displayAddress = settings?.address || "Registered Clinic Location";
  const displayPhone = settings?.phone || "Clinic Helpline";
  const displayFooter = settings?.receipt_footer || "Thank you for trusting us with your dental health!";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans select-none antialiased flex flex-col justify-between">
      
      {/* Standalone Header (Hidden when printing) */}
      <header className="no-print bg-zinc-900 border-b border-zinc-850 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-2">
              <span>Wireless Mobile Print Node</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                connectionStatus === "connected" ? "bg-emerald-500/20 text-emerald-400" :
                connectionStatus === "connecting" ? "bg-amber-500/20 text-amber-400 animate-pulse" :
                "bg-red-500/20 text-red-400"
              }`}>
                {connectionStatus}
              </span>
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Serving: {displayClinicName}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-zinc-400 text-xs bg-zinc-950/60 px-3.5 py-1.5 rounded-md border border-zinc-800 flex items-center space-x-2">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-mono">{currentTime}</span>
          </div>
          <button
            onClick={handleReconnect}
            className="bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-200 p-2 rounded-lg cursor-pointer transition-colors"
            title="Force reconnect SSE socket stream"
          >
            <RefreshCw className={`w-4 h-4 ${connectionStatus === "connecting" ? "animate-spin text-amber-400" : ""}`} />
          </button>
        </div>
      </header>

      {/* Main pairing panel (Hidden when printing) */}
      <main className="no-print flex-1 max-w-4xl w-full mx-auto px-5 py-8 flex flex-col md:flex-row items-stretch gap-6 justify-center">
        
        {/* Left Side: Pairing Display Card */}
        <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
          {/* Status glow decoration */}
          <div className={`absolute top-0 left-0 right-0 h-1.5 ${
            connectionStatus === "connected" ? "bg-emerald-500" :
            connectionStatus === "connecting" ? "bg-amber-500 animate-pulse" :
            "bg-red-500"
          }`}></div>

          <div className="mb-4">
            {connectionStatus === "connected" ? (
              <div className="bg-emerald-500/10 text-emerald-400 p-4 rounded-full border border-emerald-500/25">
                <Wifi className="w-8 h-8" />
              </div>
            ) : connectionStatus === "connecting" ? (
              <div className="bg-amber-500/10 text-amber-400 p-4 rounded-full border border-amber-500/25 animate-pulse">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              <div className="bg-red-500/10 text-red-400 p-4 rounded-full border border-red-500/25">
                <WifiOff className="w-8 h-8" />
              </div>
            )}
          </div>

          <h2 className="text-lg font-bold text-white tracking-tight">Wireless Printer Pairing</h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm leading-relaxed">
            Type the 4-digit mobile pairing code below into the clinic iPad/Desktop Billing Desk to link this device.
          </p>

          {/* pairing numeric digits code card */}
          <div className="mt-6 bg-zinc-950 border border-zinc-800/80 rounded-2xl px-8 py-5 flex items-center justify-center space-x-3.5 shadow-inner">
            {pairingCode ? (
              pairingCode.split("").map((digit, index) => (
                <span
                  key={index}
                  className="w-14 h-16 bg-zinc-900 border border-zinc-700/60 rounded-xl flex items-center justify-center font-mono text-3xl font-black text-white shadow-md select-all"
                >
                  {digit}
                </span>
              ))
            ) : (
              <span className="text-zinc-500 font-mono text-lg animate-pulse">GENERATING...</span>
            )}
          </div>

          {errorMsg && (
            <div className="mt-5 bg-red-950/40 border border-red-900/45 rounded-lg p-3.5 flex items-start space-x-2.5 text-left text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {connectionStatus === "connected" && (
            <div className="mt-5 bg-emerald-950/40 border border-emerald-900/40 rounded-lg p-3 flex items-center space-x-2 text-xs text-emerald-300">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Receiver Node fully linked. Waiting for print jobs...</span>
            </div>
          )}
        </div>

        {/* Right Side: Log of Received Receipts */}
        <div className="w-full md:w-96 bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col shadow-lg">
          <div className="border-b border-zinc-800 pb-3 mb-4">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-zinc-500" />
              <span>Active Node Print Log</span>
            </h3>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Tap any receipt in the history to trigger a manual physical reprint.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[350px] pr-1">
            {jobHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-600">
                <Receipt className="w-8 h-8 text-zinc-700 mb-2 stroke-1" />
                <span className="text-xs font-semibold">No print transactions yet</span>
                <span className="text-[10px] mt-0.5">Broadcasted invoices will appear here in real-time.</span>
              </div>
            ) : (
              jobHistory.map((job, idx) => (
                <div
                  key={idx}
                  onClick={() => handleManualPrint(job)}
                  className="bg-zinc-950 border border-zinc-850 hover:border-blue-500 rounded-lg p-3 flex items-center justify-between cursor-pointer transition-all hover:bg-zinc-900"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-mono text-[11px] font-bold text-zinc-200">{job.bill_number}</span>
                      {activeJob?.id === job.id && (
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full inline-block animate-ping"></span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5 font-bold truncate">
                      {job.patient_name}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {job.date} {job.time}
                    </p>
                  </div>
                  <div className="text-right pl-3 shrink-0">
                    <span className="text-xs font-mono font-bold text-zinc-300 block">
                      ₹{job.grand_total}
                    </span>
                    <button
                      type="button"
                      className="mt-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-2 py-0.5 rounded text-[9px] uppercase border border-zinc-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-2.5 h-2.5" />
                      <span>Print</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Standalone Footer (Hidden when printing) */}
      <footer className="no-print bg-zinc-900 border-t border-zinc-850 px-6 py-3 text-[10px] text-zinc-500 font-mono flex flex-col sm:flex-row justify-between items-center shrink-0">
        <div>RK Mobile Printing Engine © 2026 | Standalone Receiver Node</div>
        <div className="mt-1 sm:mt-0 flex items-center space-x-1">
          <Printer className="w-3.5 h-3.5 text-zinc-500" />
          <span>Active Pairing Session Code: {pairingCode}</span>
        </div>
      </footer>

      {/* 
        This is the absolute critical section!
        When printing is active, everything else has class 'no-print' and is hidden.
        Only #thermal-receipt-print-area is displayed.
      */}
      {activeJob && (
        <div id="thermal-receipt-print-area" className="hidden" style={{ fontFamily: "system-ui, -apple-system, sans-serif", width: "80mm", padding: "0 5mm", color: "#000000", boxSizing: "border-box" }}>
          {/* Centered Clinic Name (Main Header) instead of TICKET */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "14px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px", margin: "10px 0 2px 0" }}>
              {displayClinicName}
            </div>
            {displayAddress && (
              <div style={{ fontSize: "10px", color: "#374151", whiteSpace: "pre-line", lineHeight: "1.3" }}>
                {displayAddress}
              </div>
            )}
            {displayPhone && (
              <div style={{ fontSize: "10px", color: "#374151", marginTop: "2px" }}>
                Ph: {displayPhone}
              </div>
            )}
          </div>

          <div style={{ borderTop: "1.2px dotted #000000", margin: "6px 0" }}></div>

          {/* Subheaders: Date (Left), Invoice (Right, no folio word), Patient details */}
          <div style={{ fontSize: "11px", lineHeight: "1.4" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Date: {activeJob.date} {activeJob.time}</span>
              <span style={{ fontWeight: "bold" }}>{activeJob.bill_number}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
              <span>Patient: {activeJob.patient_name?.toUpperCase()}</span>
              {activeJob.patient_mobile && <span>Ph: {activeJob.patient_mobile}</span>}
            </div>
          </div>

          <div style={{ borderTop: "1.2px dotted #000000", margin: "6px 0" }}></div>

          {/* Column Headers */}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: "bold" }}>
            <span>PROCEDURE</span>
            <span>AMOUNT</span>
          </div>

          <div style={{ borderTop: "1.2px dotted #000000", margin: "6px 0" }}></div>

          {/* Items list (Redesigned with larger readable fonts) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {(activeJob.items || activeJob.bill_items || []).map((item: any, idx: number) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", lineHeight: "1.3" }}>
                <span style={{ textAlign: "left", paddingRight: "8px", maxWidth: "70%" }}>{item.treatment_name || "Dental Treatment"}</span>
                <span style={{ textAlign: "right", fontWeight: "bold", whiteSpace: "nowrap" }}>{Number(item.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1.2px dotted #000000", margin: "6px 0" }}></div>

          {/* Totals block */}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "bold" }}>
            <span>GRAND TOTAL</span>
            <span>₹ {Number(activeJob.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          <div style={{ borderTop: "1.2px dotted #000000", margin: "6px 0" }}></div>

          {/* Payment Method */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
            <span>Payment Mode</span>
            <span style={{ border: "1px solid #000000", padding: "1px 5px", fontWeight: "bold" }}>{(activeJob.payment_method || "CASH").toUpperCase()}</span>
          </div>

          <div style={{ borderTop: "1.2px dotted #000000", margin: "8px 0" }}></div>

          {/* Centered footer */}
          <div style={{ textAlign: "center", fontSize: "12px", fontWeight: "bold" }}>
            THANK YOU FOR YOUR VISIT!
          </div>
          <div style={{ textAlign: "center", fontSize: "11px", marginTop: "2px" }}>
            Keep smiling.
          </div>

          {/* Barcode representation */}
          <div style={{ margin: "12px 0 3px 0", textAlign: "center", fontSize: "18px", letterSpacing: "1px", lineHeight: "1.0", color: "#000000" }}>
            |||||||||||||||||||||||||||||
          </div>
          <div style={{ textAlign: "center", fontSize: "10px", letterSpacing: "0.5px" }}>
            {activeJob.bill_number}
          </div>
        </div>
      )}

    </div>
  );
}
