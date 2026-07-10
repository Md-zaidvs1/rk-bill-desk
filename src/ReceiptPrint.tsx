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
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // Outer border for official medical form styling
      doc.setDrawColor(30, 64, 175); // Deep Blue
      doc.setLineWidth(1.0);
      doc.rect(8, 8, 194, 281, "S");

      // Letterhead clinic header (Left side)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(30, 64, 175); // Deep Blue (#1E40AF)
      doc.text(settings.clinic_name.toUpperCase(), 18, 24);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128); // Slate gray

      // Split address into multiple lines
      const addressLines = doc.splitTextToSize(settings.address, 110);
      doc.text(addressLines, 18, 30);
      
      const addressHeight = addressLines.length * 4;
      doc.text(`Contact Phone: ${settings.phone}`, 18, 32 + addressHeight);

      // Invoice metadata (Right side)
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(55, 65, 81);
      doc.text("INVOICE / RECEIPT", 145, 24);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(75, 85, 99);
      doc.text(`Invoice No: ${bill.bill_number}`, 145, 30);
      doc.text(`Date      : ${bill.date}`, 145, 35);
      doc.text(`Time      : ${bill.time}`, 145, 40);

      // Divider line
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.line(18, 46 + addressHeight, 192, 46 + addressHeight);

      // Patient Details Block
      const patientY = 52 + addressHeight;
      doc.setFillColor(243, 244, 246);
      doc.rect(18, patientY, 174, 18, "F");
      doc.setDrawColor(229, 231, 235);
      doc.rect(18, patientY, 174, 18, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      doc.text("Patient Name :", 24, patientY + 7);
      doc.text("Patient Phone:", 24, patientY + 13);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 24, 39);
      doc.text(bill.patient_name, 54, patientY + 7);
      doc.setFont("helvetica", "normal");
      doc.text(bill.patient_mobile || "N/A", 54, patientY + 13);

      let startY = patientY + 28;

      // Table Header for treatments
      doc.setFillColor(30, 64, 175);
      doc.rect(18, startY, 174, 8, "F");
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("#", 22, startY + 5.5);
      doc.text("Dental Treatment / Clinical Procedure Description", 30, startY + 5.5);
      doc.text("Amount (INR)", 186, startY + 5.5, { align: "right" });
      
      startY += 8;

      // Draw Items
      doc.setFont("helvetica", "normal");
      doc.setTextColor(31, 41, 55);
      
      const billItems = bill.items || bill.bill_items || [];
      billItems.forEach((item: any, i: number) => {
        // Alternate raw table background shading
        if (i % 2 === 1) {
          doc.setFillColor(249, 250, 251);
          doc.rect(18, startY, 174, 8, "F");
        }
        // Draw bottom border for item row
        doc.setDrawColor(243, 244, 246);
        doc.line(18, startY + 8, 192, startY + 8);

        doc.text(String(i + 1), 22, startY + 5.5);
        doc.text(item.treatment_name || "Dental Treatment", 30, startY + 5.5);
        doc.text(Number(item.amount || 0).toFixed(2), 186, startY + 5.5, { align: "right" });
        
        startY += 8;
      });

      // Grand Total calculations block
      startY += 4;
      doc.setDrawColor(209, 213, 219);
      doc.line(18, startY, 192, startY);
      
      startY += 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(75, 85, 99);
      doc.text(`Payment Method: ${bill.payment_method}`, 18, startY + 5);
      
      doc.setFontSize(12);
      doc.setTextColor(30, 64, 175); // Deep Blue
      doc.text(`Grand Total: INR ${Number(bill.grand_total).toFixed(2)}`, 192, startY + 5, { align: "right" });

      // Signature & Doctor Stamp at bottom
      const pageHeight = doc.internal.pageSize.height;
      doc.setDrawColor(229, 231, 235);
      doc.line(18, pageHeight - 38, 192, pageHeight - 38);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      doc.text("Dr. V. Radhakrishnan BDS., D.Endo.", 192, pageHeight - 28, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(107, 114, 128);
      doc.text("Registered Dental Surgeon", 192, pageHeight - 23, { align: "right" });
      doc.text("Authorized Signature & Seal", 192, pageHeight - 18, { align: "right" });

      // Receipt custom Footer
      if (settings.receipt_footer) {
        doc.text(settings.receipt_footer, 18, pageHeight - 23);
      } else {
        doc.text("Thank you for choosing us for your dental healthcare!", 18, pageHeight - 23);
      }

      doc.save(`Invoice_${bill.bill_number}.pdf`);
      setStatusMessage("A4 Invoice PDF downloaded successfully to your iPad!");
      setStatusType("success");
    } catch (err: any) {
      console.error(err);
      setStatusMessage("Failed to generate offline A4 PDF file.");
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
