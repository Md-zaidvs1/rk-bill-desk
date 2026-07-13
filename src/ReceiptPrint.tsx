import React, { useState, useEffect } from "react";
import { Printer, X, Receipt, Download, Check, RefreshCw, AlertCircle, Server } from "lucide-react";
import { Bill, ClinicSettings } from "./types";
import { printBridge, generateThermalPDF } from "./services/printBridge";
import { getPrintBridgeSettings } from "./services/printBridgeConfig";
import jsPDF from "jspdf";

interface ReceiptPrintProps {
  bill: Bill;
  settings: ClinicSettings;
  onClose: () => void;
}

export default function ReceiptPrint({ bill, settings, onClose }: ReceiptPrintProps) {
  const [printing, setPrinting] = useState(false);
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [bridgeAddress, setBridgeAddress] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"success" | "error" | "info" | null>(null);

  const checkBridgeStatus = async () => {
    const config = getPrintBridgeSettings();
    setBridgeAddress(`${config.ipAddress}:${config.port}`);
    try {
      const online = await printBridge.testConnection();
      setBridgeConnected(online);
    } catch {
      setBridgeConnected(false);
    }
  };

  // Sync bridge status on mount
  useEffect(() => {
    checkBridgeStatus();
  }, []);

  const handleConnectPrinter = async () => {
    setStatusMessage("Pinging Print Bridge host...");
    setStatusType("info");
    const config = getPrintBridgeSettings();
    try {
      const online = await printBridge.testConnection();
      setBridgeConnected(online);
      if (online) {
        setStatusMessage(`Print Bridge at ${config.ipAddress}:${config.port} is reachable!`);
        setStatusType("success");
      } else {
        setStatusMessage("Print Bridge Offline");
        setStatusType("error");
      }
    } catch {
      setBridgeConnected(false);
      setStatusMessage("Connection Failed");
      setStatusType("error");
    }
  };

  const handlePrintThermal = async () => {
    setPrinting(true);
    setStatusType("info");
    setStatusMessage("Connecting to Print Bridge...");
    
    // Smooth readable transition through states
    await new Promise(resolve => setTimeout(resolve, 800));
    
    setStatusMessage("Printing...");
    await new Promise(resolve => setTimeout(resolve, 600));

    try {
      await printBridge.printBill(bill, settings);
      setBridgeConnected(true);
      setStatusMessage("Printed Successfully");
      setStatusType("success");
    } catch (err: any) {
      // Receives exactly "Print Bridge Offline", "Printer Offline", or "Connection Failed"
      setStatusMessage(err.message || "Connection Failed");
      setStatusType("error");
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadPDF = () => {
    try {
      const receiptData = printBridge.getBillReceiptData(bill, settings);
      const doc = generateThermalPDF(receiptData);
      doc.save(`Invoice_${bill.bill_number}.pdf`);
      setStatusMessage("80mm Thermal Receipt PDF downloaded successfully!");
      setStatusType("success");
    } catch (err: any) {
      console.error(err);
      setStatusMessage("Failed to generate offline 80mm thermal PDF file.");
      setStatusType("error");
    }
  };

  const items = bill.items || bill.bill_items || [];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-md">
      <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 shadow-2xl rounded-xl flex flex-col max-h-[94vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Banner */}
        <div className="bg-zinc-950 border-b border-zinc-850 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <Receipt className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold text-zinc-300 font-mono tracking-wider uppercase">80mm ESC/POS Printer Workspace</span>
          </div>
          <button 
            onClick={onClose} 
            className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer p-1.5 rounded-full hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Dashboard Panel */}
        <div className="bg-zinc-950 border-b border-zinc-850 px-5 py-3 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          
          {/* Print Bridge status display */}
          <div className="flex items-center space-x-2">
            <Server className={`w-4 h-4 ${bridgeConnected ? "text-emerald-500 animate-pulse" : "text-zinc-500"}`} />
            <div className="font-mono text-zinc-400">
              PRINT BRIDGE:{" "}
              <span className={`font-bold ${bridgeConnected ? "text-emerald-400" : "text-amber-500"}`}>
                {bridgeAddress ? bridgeAddress : "LOADING..."} ({bridgeConnected ? "ONLINE" : "OFFLINE"})
              </span>
            </div>
          </div>

          {/* Action to test connection */}
          <button
            onClick={handleConnectPrinter}
            className="bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-bold px-3 py-1.5 rounded text-[10px] uppercase tracking-wider flex items-center space-x-1 border border-zinc-750 cursor-pointer self-start sm:self-auto shrink-0 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Test Connection</span>
          </button>
        </div>

        {/* Workspace Alerts Block */}
        {statusMessage && (
          <div className={`px-5 py-2.5 text-xs font-mono shrink-0 flex items-center justify-between gap-4 ${
            statusType === "success" ? "bg-emerald-950/40 border-b border-emerald-900/60 text-emerald-300" :
            statusType === "error" ? "bg-red-950/40 border-b border-red-900/60 text-red-300" :
            "bg-blue-950/40 border-b border-blue-900/60 text-blue-300"
          }`}>
            <div className="flex items-start space-x-2">
              {statusType === "success" && <Check className="w-4 h-4 mt-0.5 shrink-0" />}
              {statusType === "error" && <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              {statusType === "info" && <RefreshCw className="w-4 h-4 mt-0.5 shrink-0 animate-spin" />}
              <span>{statusMessage}</span>
            </div>
            {statusType === "error" && (
              <button
                onClick={handlePrintThermal}
                className="bg-red-900/65 hover:bg-red-800 text-red-100 font-bold px-2 py-1 rounded text-[10px] uppercase border border-red-750 shrink-0 cursor-pointer transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Receipt Container View Workspace */}
        <div className="p-6 bg-zinc-950 overflow-y-auto flex-1 flex flex-col items-center justify-start scrollbar-thin">
          
          {/* Simulated Paper Plate */}
          <div className="relative bg-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-zinc-300/60 rounded-sm my-2 shrink-0">
            
            {/* Edge tearing effect decorations */}
            <div className="absolute top-[-3px] left-0 right-0 h-[3px] bg-[linear-gradient(135deg,_#09090b_2px,_transparent_0),_linear-gradient(-135deg,_#09090b_2px,_transparent_0)] bg-[size:4px_4px] pointer-events-none z-10"></div>

            <div 
              className="w-[80mm] max-w-full bg-white text-black font-mono text-[11px] leading-relaxed select-text p-6"
              style={{ fontFamily: "'Courier New', Courier, monospace", boxSizing: "border-box" }}
            >
              {/* Header block */}
              <div className="text-center">
                <div className="text-[13px] font-bold tracking-tight uppercase leading-snug">{settings.clinic_name}</div>
                <div className="text-[10px] leading-snug mt-1 whitespace-pre-line">{settings.address}</div>
                <div className="text-[10px] leading-snug font-semibold mt-1">Mobile: {settings.phone}</div>
              </div>

              <div className="border-t border-dashed border-black my-2.5"></div>

              {/* Bill Details */}
              <div className="space-y-0.5 text-[10.5px]">
                <div><span className="font-bold">Bill No:</span> {bill.bill_number}</div>
                <div><span className="font-bold">Date:</span> {bill.date}</div>
                <div><span className="font-bold">Time:</span> {bill.time}</div>
              </div>

              {/* Patient */}
              <div className="mt-2.5 text-[10.5px]">
                <div className="font-bold text-zinc-500 uppercase text-[9px] tracking-wider">Patient Details:</div>
                <div className="font-bold text-black mt-0.5">{bill.patient_name}</div>
                <div className="text-black font-semibold">Mob: {bill.patient_mobile || "N/A"}</div>
              </div>

              <div className="border-t border-dashed border-black my-2.5"></div>

              {/* Table Header */}
              <div className="flex justify-between text-[11px] font-bold border-b border-dashed border-black pb-1 mb-1.5">
                <span className="w-[70%] text-left">Treatment</span>
                <span className="w-[30%] text-right">Amt</span>
              </div>

              {/* Items list */}
              <div className="space-y-1.5">
                {items.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-end justify-between w-full text-[11px] leading-snug">
                    <span className="w-[70%] break-words text-left pr-2">{item.treatment_name || "Dental Checkup"}</span>
                    <span className="w-[30%] text-right font-bold shrink-0">{Number(item.amount || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-black my-2.5"></div>

              {/* Totals block */}
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between font-bold text-[12px] py-0.5">
                  <span>Grand Total:</span>
                  <span>INR {Number(bill.grand_total).toFixed(2)}</span>
                </div>
                <div className="py-0.5">
                  <span>Payment Method: </span>
                  <span className="font-bold uppercase text-zinc-800">{bill.payment_method}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-black my-2.5"></div>

              {/* Footer text */}
              <div className="text-center text-[10px] whitespace-pre-line leading-relaxed italic mt-1">
                {settings.receipt_footer}
              </div>

              <div className="border-t border-dashed border-black mt-3"></div>

            </div>

            <div className="absolute bottom-[-3px] left-0 right-0 h-[3px] bg-[linear-gradient(45deg,_#09090b_2px,_transparent_0),_linear-gradient(-45deg,_#09090b_2px,_transparent_0)] bg-[size:4px_4px] pointer-events-none z-10"></div>
          </div>

        </div>

        {/* Action Controls */}
        <div className="bg-zinc-950 border-t border-zinc-850 p-4 flex gap-2 shrink-0">
          <button
            onClick={handlePrintThermal}
            disabled={printing}
            className={`flex-1 font-mono py-2.5 px-4 text-xs font-bold flex items-center justify-center space-x-2 cursor-pointer rounded-lg shadow-md transition-all border ${
              printing 
                ? "bg-zinc-850 text-zinc-500 border-zinc-800 cursor-not-allowed" 
                : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/20"
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>{printing ? "PRINTING..." : "PRINT THERMAL SLIP"}</span>
          </button>
          
          <button
            onClick={handleDownloadPDF}
            className="bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-zinc-350 font-mono py-2.5 px-4 text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer rounded-lg shadow-sm transition-all"
          >
            <Download className="w-4 h-4 text-zinc-400" />
            <span>DOWNLOAD PDF</span>
          </button>
          
          <button
            onClick={onClose}
            className="bg-zinc-900 hover:bg-zinc-850 text-zinc-400 font-mono py-2.5 px-4 text-xs font-semibold rounded-lg cursor-pointer transition-all border border-zinc-850"
          >
            CLOSE
          </button>
        </div>

      </div>
    </div>
  );
}
