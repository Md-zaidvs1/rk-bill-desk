import { getPrintBridgeSettings } from "./printBridgeConfig";
import { Bill, ClinicSettings, Prescription } from "../types";
import jsPDF from "jspdf";

export interface ReceiptData {
  clinic: string;
  address?: string;
  phone?: string;
  patient: string;
  patientMobile?: string;
  billNo: string;
  date: string;
  items: Array<{ name: string; amount: number; instructions?: string }>;
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paymentMethod: string;
  footer: string;
}

/**
 * Standard PDF Generator for 80mm Thermal Receipt PDFs
 */
export function generateThermalPDF(receiptData: ReceiptData): jsPDF {
  let estimatedHeight = 15; // padding top and bottom

  const docTest = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });
  docTest.setFont("courier", "normal");
  docTest.setFontSize(9);
  
  const leftMargin = 5;
  const contentWidth = 70; // 80 - 10

  // 1. Clinic Name
  const clinicLines = docTest.splitTextToSize(receiptData.clinic.toUpperCase(), contentWidth);
  estimatedHeight += clinicLines.length * 4.5;

  // 2. Address & Phone
  if (receiptData.address) {
    const addrLines = docTest.splitTextToSize(receiptData.address, contentWidth);
    estimatedHeight += addrLines.length * 4;
  }
  if (receiptData.phone) {
    estimatedHeight += 5;
  }

  // Divider
  estimatedHeight += 5;

  // 3. Metadata (Bill No, Date)
  estimatedHeight += 12; // 3 lines of metadata

  // Patient Info
  estimatedHeight += 12; // Title + Patient Name + Mobile

  // Divider
  estimatedHeight += 5;

  // 4. Items Headers
  estimatedHeight += 6;

  // Items
  receiptData.items.forEach((item) => {
    const itemLines = docTest.splitTextToSize(item.name, contentWidth - 18); // save some width for amount
    estimatedHeight += Math.max(itemLines.length * 4, 5);
    if (item.instructions) {
      const instLines = docTest.splitTextToSize(item.instructions, contentWidth);
      estimatedHeight += instLines.length * 3.5;
    }
  });

  // Divider
  estimatedHeight += 5;

  // 5. Totals block
  if (receiptData.grandTotal > 0) {
    estimatedHeight += 12; // Grand Total, Payment Method
  } else {
    estimatedHeight += 8; // Mode/Notes
  }

  // Divider
  estimatedHeight += 5;

  // 6. Footer
  if (receiptData.footer) {
    const footerLines = docTest.splitTextToSize(receiptData.footer, contentWidth);
    estimatedHeight += footerLines.length * 4;
  }

  // Final total height with extra padding safety
  const finalHeight = Math.max(estimatedHeight + 10, 110);

  // Create the actual 80mm PDF
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, finalHeight]
  });

  // Now, render everything
  let y = 8;
  
  // Outer decorative border
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.rect(2, 2, 76, finalHeight - 4, "S");

  // Clinic Header
  doc.setFont("courier", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  
  clinicLines.forEach((line: string) => {
    const textWidth = doc.getTextWidth(line);
    doc.text(line, (80 - textWidth) / 2, y);
    y += 4.5;
  });

  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);

  if (receiptData.address) {
    const addrLines = doc.splitTextToSize(receiptData.address, contentWidth);
    addrLines.forEach((line: string) => {
      const textWidth = doc.getTextWidth(line);
      doc.text(line, (80 - textWidth) / 2, y);
      y += 3.5;
    });
  }

  if (receiptData.phone) {
    const phoneStr = `Mobile: ${receiptData.phone}`;
    const textWidth = doc.getTextWidth(phoneStr);
    doc.text(phoneStr, (80 - textWidth) / 2, y);
    y += 4;
  }

  // Divider
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(leftMargin, y, 80 - leftMargin, y);
  y += 4;

  // Bill Metadata
  doc.setFont("courier", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  
  doc.text(`Bill No: ${receiptData.billNo}`, leftMargin, y);
  y += 4;
  
  // Date and Time split or unified
  doc.text(`Date   : ${receiptData.date}`, leftMargin, y);
  y += 4.5;

  // Patient Info
  doc.setFont("courier", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("PATIENT DETAILS:", leftMargin, y);
  y += 3.5;

  doc.setFont("courier", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(receiptData.patient, leftMargin, y);
  y += 4;

  if (receiptData.patientMobile) {
    doc.setFont("courier", "normal");
    doc.setFontSize(8.5);
    doc.text(`Mob: ${receiptData.patientMobile}`, leftMargin, y);
    y += 4;
  }

  // Divider
  doc.setLineWidth(0.1);
  doc.line(leftMargin, y, 80 - leftMargin, y);
  y += 4;

  // Table Headers
  doc.setFont("courier", "bold");
  doc.setFontSize(8.5);
  doc.text("Treatment / Procedure", leftMargin, y);
  const amtHeader = "Amt";
  doc.text(amtHeader, 80 - leftMargin - doc.getTextWidth(amtHeader), y);
  y += 3.5;

  // Divider
  doc.line(leftMargin, y, 80 - leftMargin, y);
  y += 3.5;

  // Render Items
  doc.setFont("courier", "normal");
  doc.setFontSize(8.5);

  receiptData.items.forEach((item) => {
    const amountStr = receiptData.grandTotal > 0 ? Number(item.amount || 0).toFixed(2) : "";
    const amountWidth = doc.getTextWidth(amountStr);
    
    // Split item name
    const maxItemNameWidth = amountStr ? contentWidth - 14 : contentWidth;
    const itemLines = doc.splitTextToSize(item.name, maxItemNameWidth);
    
    itemLines.forEach((line: string, idx: number) => {
      doc.text(line, leftMargin, y);
      if (idx === 0 && amountStr) {
        doc.text(amountStr, 80 - leftMargin - amountWidth, y);
      }
      y += 4;
    });

    if (item.instructions) {
      doc.setFont("courier", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      const instLines = doc.splitTextToSize(item.instructions, contentWidth);
      instLines.forEach((line: string) => {
        doc.text(line, leftMargin, y);
        y += 3.5;
      });
      doc.setFont("courier", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
    }
  });

  // Divider
  y += 1;
  doc.line(leftMargin, y, 80 - leftMargin, y);
  y += 4;

  // Totals
  if (receiptData.grandTotal > 0) {
    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.text("Grand Total:", leftMargin, y);
    const totalStr = `INR ${Number(receiptData.grandTotal).toFixed(2)}`;
    doc.text(totalStr, 80 - leftMargin - doc.getTextWidth(totalStr), y);
    y += 4.5;

    doc.setFont("courier", "normal");
    doc.setFontSize(8.5);
    doc.text(`Payment Mode: ${receiptData.paymentMethod}`, leftMargin, y);
    y += 4.5;
  } else {
    // This is a prescription or something similar with no total charges
    doc.setFont("courier", "normal");
    doc.setFontSize(8.5);
    doc.text(`Notes: ${receiptData.paymentMethod}`, leftMargin, y);
    y += 4.5;
  }

  // Divider
  doc.line(leftMargin, y, 80 - leftMargin, y);
  y += 4.5;

  // Footer
  if (receiptData.footer) {
    doc.setFont("courier", "italic");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const footerLines = doc.splitTextToSize(receiptData.footer, contentWidth);
    footerLines.forEach((line: string) => {
      const textWidth = doc.getTextWidth(line);
      doc.text(line, (80 - textWidth) / 2, y);
      y += 3.5;
    });
  }

  return doc;
}

export class PrintBridgeService {
  /**
   * Sends receipt JSON to the Windows Local Print Bridge
   */
  async print(receiptData: ReceiptData): Promise<void> {
    const config = getPrintBridgeSettings();
    const url = `http://${config.ipAddress}:${config.port}/print`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ receipt: receiptData }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 503 || response.status === 502 || response.status === 504) {
          throw new Error("Printer Offline");
        }
        throw new Error(`Connection Failed`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === "AbortError") {
        throw new Error("Connection Failed");
      }

      // If we failed to fetch completely (Network Error), the print bridge itself is likely offline
      if (err.message && (err.message.includes("Failed to fetch") || err.message.includes("network error") || err.message.includes("Load failed"))) {
        throw new Error("Print Bridge Offline");
      }

      // Preserve existing recognized error messages, default to Connection Failed
      const errMsg = err.message || "";
      if (errMsg === "Printer Offline" || errMsg === "Print Bridge Offline" || errMsg === "Connection Failed") {
        throw err;
      }
      throw new Error("Connection Failed");
    }
  }

  /**
   * Helper to format a bill object into standardized ReceiptData
   */
  getBillReceiptData(bill: Bill, settings: ClinicSettings): ReceiptData {
    const items = bill.items || bill.bill_items || [];
    return {
      clinic: settings.clinic_name,
      address: settings.address,
      phone: settings.phone,
      patient: bill.patient_name,
      patientMobile: bill.patient_mobile || undefined,
      billNo: bill.bill_number,
      date: `${bill.date} ${bill.time}`,
      items: items.map((item) => ({
        name: item.treatment_name || "Dental Treatment",
        amount: Number(item.amount || 0),
      })),
      subtotal: Number(bill.grand_total),
      discount: 0,
      tax: 0,
      grandTotal: Number(bill.grand_total),
      paymentMethod: bill.payment_method,
      footer: settings.receipt_footer || "Thank You",
    };
  }

  /**
   * Helper to format a prescription object into standardized ReceiptData
   */
  getPrescriptionReceiptData(prescription: Prescription, settings: ClinicSettings): ReceiptData {
    const medicinesList = (prescription.medicines || []).map((m) => ({
      name: `${m.name} (${m.dosage || ""})`,
      amount: 0,
      instructions: `${m.frequency} - ${m.duration} [${m.instructions || ""}]`,
    }));

    return {
      clinic: settings.clinic_name + " - PRESCRIPTION",
      address: settings.address,
      phone: settings.phone,
      patient: prescription.patient_name,
      patientMobile: undefined,
      billNo: `RX-${prescription.id}`,
      date: prescription.date,
      items: medicinesList,
      subtotal: 0,
      discount: 0,
      tax: 0,
      grandTotal: 0,
      paymentMethod: prescription.doctor_notes || "N/A",
      footer: settings.receipt_footer || "Thank You",
    };
  }

  /**
   * Helper to format a bill object and print it
   */
  async printBill(bill: Bill, settings: ClinicSettings): Promise<void> {
    const receiptData = this.getBillReceiptData(bill, settings);
    return this.print(receiptData);
  }

  /**
   * Helper to format a prescription and print it
   */
  async printPrescription(prescription: Prescription, settings: ClinicSettings): Promise<void> {
    const receiptData = this.getPrescriptionReceiptData(prescription, settings);
    return this.print(receiptData);
  }

  /**
   * Tests connection with the print bridge via an OPTIONS or quick GET request
   */
  async testConnection(): Promise<boolean> {
    const config = getPrintBridgeSettings();
    const url = `http://${config.ipAddress}:${config.port}/print`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(url, {
        method: "OPTIONS",
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeoutId);
      return res !== null;
    } catch {
      return false;
    }
  }
}

export const printBridge = new PrintBridgeService();
export default printBridge;
