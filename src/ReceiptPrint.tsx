import React, { useState } from "react";
import { Printer, X, Receipt, Download, Bluetooth, Check, RefreshCw, AlertCircle } from "lucide-react";
import { Bill, ClinicSettings } from "./types";
import { bluetoothPrinter } from "./BluetoothPrinter";
import jsPDF from "jspdf";

interface ReceiptPrintProps {
  bill: Bill;
  settings: ClinicSettings;
  onClose: () => void;
}

export default function ReceiptPrint({ bill, settings, onClose }: ReceiptPrintProps) {
  const [printing, setPrinting] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(bluetoothPrinter.isConnected());
  const [printerName, setPrinterName] = useState(bluetoothPrinter.getDeviceName());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"success" | "error" | "info" | null>(null);

  // Re-sync bluetooth connection state from global singleton
  const updatePrinterState = () => {
    setPrinterConnected(bluetoothPrinter.isConnected());
    setPrinterName(bluetoothPrinter.getDeviceName());
  };

  const handleConnectPrinter = async () => {
    setStatusMessage("Searching for ESC/POS Bluetooth printers...");
    setStatusType("info");
    try {
      const success = await bluetoothPrinter.connect();
      updatePrinterState();
      if (success) {
        setStatusMessage(`Successfully paired with: ${bluetoothPrinter.getDeviceName()}`);
        setStatusType("success");
      }
    } catch (err: any) {
      updatePrinterState();
      setStatusMessage(err.message || "Failed to establish Bluetooth connection.");
      setStatusType("error");
    }
  };

  const handlePrintBT = async () => {
    setPrinting(true);
    setStatusMessage("Sending layout formatting bytes to Bluetooth characteristic...");
    setStatusType("info");
    try {
      await bluetoothPrinter.printReceipt(bill, settings);
      setStatusMessage("Receipt printed successfully!");
      setStatusType("success");
    } catch (err: any) {
      setStatusMessage(err.message || "Printing failed. Make sure printer is powered on and within Bluetooth range.");
      setStatusType("error");
    } finally {
      setPrinting(false);
      updatePrinterState();
    }
  };

  const handleDownloadPDF = () => {
    try {
      const pageWidth = 80;
      const printableWidth = 72;
      const leftMargin = 4;
      const rightMargin = 76;
      
      const tempDoc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [80, 1000]
      });
      
      tempDoc.setFont("courier", "normal");
      let y = 10;
      
      // Clinic Header
      tempDoc.setFontSize(12);
      y += 6;
      
      // Address
      tempDoc.setFontSize(8);
      const addrLines = tempDoc.splitTextToSize(settings.address, printableWidth);
      y += addrLines.length * 4;
      
      // Phone
      y += 4;
      // Divider
      y += 4;
      // Metadata
      y += 12;
      // Patient
      const patientNameLines = tempDoc.splitTextToSize(bill.patient_name, printableWidth);
      y += patientNameLines.length * 4 + 4;
      // Patient Mobile
      const mob = bill.patient_mobile || "N/A";
      const patientMobileLines = tempDoc.splitTextToSize(mob, printableWidth);
      y += patientMobileLines.length * 4 + 4;
      // Divider
      y += 4;
      // Treatment Header
      y += 5;
      // Divider
      y += 4;
      
      // Items
      const items = bill.items || bill.bill_items || [];
      items.forEach((item: any) => {
        const lines = tempDoc.splitTextToSize(item.treatment_name || "Dental treatment", 48);
        y += lines.length * 4.5;
      });
      
      // Divider
      y += 4;
      // Grand Total
      y += 6;
      // Payment Method
      y += 4;
      // Divider
      y += 4;
      
      // Footer
      const footerLines = tempDoc.splitTextToSize(settings.receipt_footer, printableWidth);
      y += footerLines.length * 4;
      // Divider end
      y += 4;
      
      const finalHeight = y + 12;
      
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pageWidth, finalHeight]
      });
      
      doc.setFont("courier", "normal");
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      
      let currentY = 10;
      
      // Clinic Name
      doc.setFont("courier", "bold");
      doc.setFontSize(12);
      doc.text(settings.clinic_name.toUpperCase(), 40, currentY, { align: "center" });
      currentY += 6;
      
      // Address
      doc.setFont("courier", "normal");
      doc.setFontSize(8);
      addrLines.forEach((line: string) => {
        doc.text(line, 40, currentY, { align: "center" });
        currentY += 4;
      });
      
      // Phone
      doc.text(`Mobile: ${settings.phone}`, 40, currentY, { align: "center" });
      currentY += 4;
      
      // Divider
      doc.text("-".repeat(36), 40, currentY, { align: "center" });
      currentY += 4;
      
      // Bill Metadata
      doc.text(`Bill No: ${bill.bill_number}`, leftMargin, currentY);
      currentY += 4;
      doc.text(`Date: ${bill.date}`, leftMargin, currentY);
      currentY += 4;
      doc.text(`Time: ${bill.time}`, leftMargin, currentY);
      currentY += 4;
      
      // Patient
      doc.setFont("courier", "bold");
      doc.text("Patient:", leftMargin, currentY);
      currentY += 4;
      doc.setFont("courier", "normal");
      patientNameLines.forEach((line: string) => {
        doc.text(line, leftMargin, currentY);
        currentY += 4;
      });
      
      // Mobile
      currentY += 1;
      doc.setFont("courier", "bold");
      doc.text("Mobile:", leftMargin, currentY);
      currentY += 4;
      doc.setFont("courier", "normal");
      patientMobileLines.forEach((line: string) => {
        doc.text(line, leftMargin, currentY);
        currentY += 4;
      });
      
      // Divider
      doc.text("-".repeat(36), 40, currentY, { align: "center" });
      currentY += 4;
      
      // Table Headers
      doc.setFont("courier", "bold");
      doc.text("Treatment", leftMargin, currentY);
      doc.text("Amt", rightMargin, currentY, { align: "right" });
      currentY += 4;
      
      // Divider
      doc.setFont("courier", "normal");
      doc.text("-".repeat(36), 40, currentY, { align: "center" });
      currentY += 4;
      
      // Items
      items.forEach((item: any) => {
        const desc = item.treatment_name || "Dental Procedure";
        const lines = doc.splitTextToSize(desc, 48);
        lines.forEach((line: string, index: number) => {
          doc.text(line, leftMargin, currentY);
          if (index === lines.length - 1) {
            doc.text(Number(item.amount || 0).toFixed(2), rightMargin, currentY, { align: "right" });
          }
          currentY += 4.5;
        });
      });
      
      // Divider
      doc.text("-".repeat(36), 40, currentY, { align: "center" });
      currentY += 4;
      
      // Grand Total
      doc.setFont("courier", "bold");
      doc.setFontSize(9);
      doc.text("Grand Total:", leftMargin, currentY);
      doc.text(Number(bill.grand_total).toFixed(2), rightMargin, currentY, { align: "right" });
      currentY += 6;
      
      // Payment Method
      doc.setFont("courier", "normal");
      doc.setFontSize(8);
      doc.text("Payment: ", leftMargin, currentY);
      doc.setFont("courier", "bold");
      doc.text(bill.payment_method, leftMargin + 18, currentY);
      currentY += 4;
      
      // Divider
      doc.setFont("courier", "normal");
      doc.text("-".repeat(36), 40, currentY, { align: "center" });
      currentY += 4;
      
      // Footer Thank You
      footerLines.forEach((line: string) => {
        doc.text(line, 40, currentY, { align: "center" });
        currentY += 4;
      });
      
      // Divider at the end
      doc.text("-".repeat(36), 40, currentY, { align: "center" });
      currentY += 4;
      
      doc.save(`Receipt_${bill.bill_number}.pdf`);
      setStatusMessage("PDF Receipt downloaded successfully to your iPad!");
      setStatusType("success");
    } catch (err: any) {
      setStatusMessage("Failed to generate offline PDF file.");
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
            <span className="text-xs font-bold text-zinc-300 font-mono tracking-wider uppercase">Bluetooth 80mm ESC/POS Workspace</span>
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
          
          {/* Printer status display */}
          <div className="flex items-center space-x-2">
            <Bluetooth className={`w-4 h-4 ${printerConnected ? "text-blue-500 animate-pulse" : "text-zinc-500"}`} />
            <div className="font-mono text-zinc-400">
              PRINTER:{" "}
              <span className={`font-bold ${printerConnected ? "text-emerald-400" : "text-amber-500"}`}>
                {printerConnected ? printerName : "DISCONNECTED (iPad BT Standard)"}
              </span>
            </div>
          </div>

          {/* Action to connect */}
          <button
            onClick={handleConnectPrinter}
            className="bg-blue-800 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded text-[10px] uppercase tracking-wider flex items-center space-x-1 border border-blue-600/30 cursor-pointer self-start sm:self-auto shrink-0 transition-colors"
          >
            <Bluetooth className="w-3 h-3" />
            <span>Pair Printer</span>
          </button>
        </div>

        {/* Workspace Alerts Block */}
        {statusMessage && (
          <div className={`px-5 py-2.5 text-xs font-mono shrink-0 flex items-start space-x-2 ${
            statusType === "success" ? "bg-emerald-950/40 border-b border-emerald-900/60 text-emerald-300" :
            statusType === "error" ? "bg-red-950/40 border-b border-red-900/60 text-red-300" :
            "bg-blue-950/40 border-b border-blue-900/60 text-blue-300"
          }`}>
            {statusType === "success" && <Check className="w-4 h-4 mt-0.5 shrink-0" />}
            {statusType === "error" && <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            {statusType === "info" && <RefreshCw className="w-4 h-4 mt-0.5 shrink-0 animate-spin" />}
            <span>{statusMessage}</span>
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
            onClick={handlePrintBT}
            disabled={printing}
            className={`flex-1 font-mono py-2.5 px-4 text-xs font-bold flex items-center justify-center space-x-2 cursor-pointer rounded-lg shadow-md transition-all border ${
              printerConnected 
                ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/20" 
                : "bg-blue-800 hover:bg-blue-700 text-white border-blue-600/30"
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>{printing ? "PRINTING (ESC/POS)..." : "BLUETOOTH ESC/POS PRINT"}</span>
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
