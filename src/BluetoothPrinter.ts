/**
 * BluetoothPrinter.ts
 * Reusable Web Bluetooth ESC/POS Hardware Connector & Encoding Utility
 */

declare global {
  interface Navigator {
    bluetooth?: any;
  }
}

type BluetoothDevice = any;
type BluetoothRemoteGATTServer = any;
type BluetoothRemoteGATTCharacteristic = any;

export class BluetoothPrinter {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  // Standard UUIDs for ESC/POS Bluetooth printers (serial profile / common write characteristics)
  private static PRINTER_SERVICE_UUIDS = [
    "000018f0-0000-1000-8000-00805f9b34fb", // Common BLE printer service
    "00001101-0000-1000-8000-00805f9b34fb"  // SPP (Serial Port Profile) UUID
  ];

  private static WRITE_CHARACTERISTIC_UUIDS = [
    "00002af1-0000-1000-8000-00805f9b34fb", // Custom / standard print write channel
    "00004953-5343-fe7d-4158-646562696c65", // Micro-printer write uuid
    "beb5483e-36e1-4688-b7f5-ea07361b26a8"  // General custom GATT writes
  ];

  isConnected(): boolean {
    return Boolean(this.device && this.device.gatt?.connected && this.characteristic);
  }

  getDeviceName(): string {
    return this.device?.name || "Disconnected";
  }

  /**
   * Prompts user to pair Bluetooth Thermal Printer
   */
  async connect(): Promise<boolean> {
    if (this.isConnected()) return true;

    try {
      if (!navigator.bluetooth) {
        throw new Error("Web Bluetooth API is not supported on this browser or device. (Note: iOS/iPadOS requires Bluefy browser or WebBLE for Web Bluetooth support).");
      }

      console.log("Requesting Bluetooth device...");
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          ...BluetoothPrinter.PRINTER_SERVICE_UUIDS,
          "0000180a-0000-1000-8000-00805f9b34fb" // Device info service
        ]
      });

      if (!this.device) {
        throw new Error("No printer selected.");
      }

      console.log(`Connecting to GATT server on ${this.device.name}...`);
      this.server = await this.device.gatt!.connect();

      // Find primary service and valid write characteristic
      const services = await this.server.getPrimaryServices();
      console.log("Discovered primary services:", services.map(s => s.uuid));

      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          console.log(`Service ${service.uuid} characteristics:`, characteristics.map(c => c.uuid));
          
          for (const char of characteristics) {
            // Find characteristic that supports write or writeWithoutResponse
            if (char.properties.write || char.properties.writeWithoutResponse) {
              this.characteristic = char;
              console.log(`Matched writable characteristic: ${char.uuid}`);
              break;
            }
          }
        } catch (err) {
          console.warn(`Could not query characteristics of service ${service.uuid}:`, err);
        }
        if (this.characteristic) break;
      }

      if (!this.characteristic) {
        throw new Error("Could not find a writable GATT printer characteristic channel.");
      }

      console.log("Bluetooth Thermal Printer fully connected!");
      return true;
    } catch (err: any) {
      console.error("Bluetooth printer connection failed:", err);
      this.disconnect();
      throw err;
    }
  }

  disconnect() {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.server = null;
    this.characteristic = null;
    console.log("Bluetooth printer disconnected.");
  }

  /**
   * Helper to write raw byte stream in chunks to handle MTU size limitations
   */
  async writeRaw(bytes: Uint8Array): Promise<void> {
    if (!this.characteristic) {
      throw new Error("Printer is not connected.");
    }

    const maxChunkSize = 20; // 20-byte standard Bluetooth MTU safe ceiling
    for (let i = 0; i < bytes.length; i += maxChunkSize) {
      const chunk = bytes.slice(i, i + maxChunkSize);
      await this.characteristic.writeValue(chunk);
    }
  }

  /**
   * Generates complete ESC/POS receipt stream and sends it to paired device
   */
  async printReceipt(bill: any, settings: any): Promise<void> {
    if (!this.isConnected()) {
      await this.connect();
    }

    const encoder = new TextEncoder();
    const builder: number[] = [];

    // --- ESC/POS COMMAND HELPER UTILITIES ---
    const init = () => builder.push(0x1B, 0x40); // ESC @ (Initialize)
    const alignCenter = () => builder.push(0x1B, 0x61, 1); // Align center
    const alignLeft = () => builder.push(0x1B, 0x61, 0); // Align left
    const alignRight = () => builder.push(0x1B, 0x61, 2); // Align right
    const doubleWidthOn = () => builder.push(0x1B, 0x0E); // Shift Out (Double width)
    const doubleWidthOff = () => builder.push(0x14); // Device Control 4 (Normal width)
    const boldOn = () => builder.push(0x1B, 0x45, 1); // ESC E 1 (Bold)
    const boldOff = () => builder.push(0x1B, 0x45, 0); // ESC E 0 (Normal font)
    const lineFeed = (n = 1) => {
      for (let i = 0; i < n; i++) builder.push(0x0A);
    };
    const printText = (str: string) => {
      const encoded = encoder.encode(str);
      for (let i = 0; i < encoded.length; i++) {
        builder.push(encoded[i]);
      }
    };
    const printLine = (str: string) => {
      printText(str);
      lineFeed();
    };
    const drawDivider = () => {
      printLine("--------------------------------"); // 32 characters for 80mm roll standard spacing
    };

    // --- PRINT PIPELINE STREAM ASSEMBLY ---
    init();
    
    // Clinic Header
    alignCenter();
    boldOn();
    doubleWidthOn();
    printLine(settings.clinic_name);
    doubleWidthOff();
    boldOff();
    
    // Clinic Details
    printLine(settings.address);
    printLine(`Phone: ${settings.phone}`);
    drawDivider();

    // Patient and Invoice details
    alignLeft();
    printLine(`BILL NO: ${bill.bill_number}`);
    printLine(`DATE: ${bill.date}  TIME: ${bill.time}`);
    printLine(`PATIENT: ${bill.patient_name}`);
    printLine(`MOBILE: ${bill.patient_mobile || "N/A"}`);
    drawDivider();

    // Treatments Ledger (Standardized Column Alignment)
    boldOn();
    printLine("Treatment Description       Price");
    boldOff();
    drawDivider();

    const items = bill.items || bill.bill_items || [];
    items.forEach((item: any) => {
      const name = item.treatment_name || "Dental Checkup";
      const amtStr = Number(item.amount || 0).toFixed(2);
      
      // Compute 32 character padding
      // Item name gets truncated if too long, or fits nicely
      let leftPart = name;
      if (leftPart.length > 20) {
        leftPart = leftPart.substring(0, 17) + "...";
      }
      const spaceCount = 32 - leftPart.length - amtStr.length;
      const spaces = " ".repeat(Math.max(1, spaceCount));
      printLine(`${leftPart}${spaces}${amtStr}`);
    });
    drawDivider();

    // Totals Block
    alignRight();
    boldOn();
    printLine(`TOTAL DUE: INR ${Number(bill.grand_total).toFixed(2)}`);
    boldOff();
    printLine(`PAYMENT METHOD: ${bill.payment_method}`);
    lineFeed(1);

    // Footer Block
    alignCenter();
    printLine(settings.receipt_footer);
    lineFeed(4); // Generous margin for feeding sheet before manual/auto cutting

    // Paper Cut Command (\x1D\x56\x41\x00)
    builder.push(0x1D, 0x56, 0x41, 0x00);

    // Write to Bluetooth Character Stream
    const rawBytes = new Uint8Array(builder);
    await this.writeRaw(rawBytes);
    console.log("ESC/POS billing data written to bluetooth characteristic successfully!");
  }

  /**
   * Print Prescription Rx Stream directly to bluetooth printer
   */
  async printPrescription(prescription: any, settings: any): Promise<void> {
    if (!this.isConnected()) {
      await this.connect();
    }

    const encoder = new TextEncoder();
    const builder: number[] = [];

    const init = () => builder.push(0x1B, 0x40);
    const alignCenter = () => builder.push(0x1B, 0x61, 1);
    const alignLeft = () => builder.push(0x1B, 0x61, 0);
    const alignRight = () => builder.push(0x1B, 0x61, 2);
    const doubleWidthOn = () => builder.push(0x1B, 0x0E);
    const doubleWidthOff = () => builder.push(0x14);
    const boldOn = () => builder.push(0x1B, 0x45, 1);
    const boldOff = () => builder.push(0x1B, 0x45, 0);
    const lineFeed = (n = 1) => {
      for (let i = 0; i < n; i++) builder.push(0x0A);
    };
    const printText = (str: string) => {
      const encoded = encoder.encode(str);
      for (let i = 0; i < encoded.length; i++) builder.push(encoded[i]);
    };
    const printLine = (str: string) => {
      printText(str);
      lineFeed();
    };
    const drawDivider = () => {
      printLine("--------------------------------");
    };

    init();

    // Clinic Header
    alignCenter();
    boldOn();
    doubleWidthOn();
    printLine(settings.clinic_name);
    doubleWidthOff();
    boldOff();
    printLine(settings.address);
    printLine(`Phone: ${settings.phone}`);
    drawDivider();

    // Rx Header
    boldOn();
    printLine("PRESCRIPTION RX");
    boldOff();
    drawDivider();

    // Patient Details
    alignLeft();
    printLine(`PATIENT: ${prescription.patient_name}`);
    printLine(`MOBILE: ${prescription.patient_mobile || "N/A"}`);
    printLine(`DATE: ${prescription.date}`);
    drawDivider();

    // Clinical Findings
    if (prescription.doctor_notes) {
      boldOn();
      printLine("DIAGNOSIS / CLINICAL NOTES:");
      boldOff();
      printLine(prescription.doctor_notes);
      drawDivider();
    }

    // Medicine Headers and layout
    boldOn();
    printLine("MEDICINES PRESCRIBED:");
    boldOff();
    lineFeed(1);

    const meds = Array.isArray(prescription.medicines) 
      ? prescription.medicines 
      : (typeof prescription.medicines === 'string' ? JSON.parse(prescription.medicines) : []);

    meds.forEach((m: any, index: number) => {
      boldOn();
      printLine(`${index + 1}. ${m.name}`);
      boldOff();
      
      const details = [
        m.dosage ? `Dosage: ${m.dosage}` : "",
        m.frequency ? `Freq: ${m.frequency}` : "",
        m.duration ? `Days: ${m.duration}` : ""
      ].filter(Boolean).join(" | ");
      
      if (details) {
        printLine(`   ${details}`);
      }
      if (m.instructions) {
        printLine(`   Inst: ${m.instructions}`);
      }
      lineFeed(1);
    });

    drawDivider();
    
    // Signature lines
    lineFeed(1);
    alignRight();
    printLine("______________________");
    printLine("Authorized Signature ");
    lineFeed(4);

    // Paper Cut Command
    builder.push(0x1D, 0x56, 0x41, 0x00);

    const rawBytes = new Uint8Array(builder);
    await this.writeRaw(rawBytes);
    console.log("ESC/POS prescription data printed successfully!");
  }
}

// Global Singleton Instance
export const bluetoothPrinter = new BluetoothPrinter();
