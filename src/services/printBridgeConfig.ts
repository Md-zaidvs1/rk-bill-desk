export interface PrintBridgeConfig {
  ipAddress: string;
  port: number;
}

export const defaultPrintBridgeConfig: PrintBridgeConfig = {
  ipAddress: "192.168.1.50",
  port: 3001,
};

export function getPrintBridgeSettings(): PrintBridgeConfig {
  if (typeof window === "undefined") {
    return { ...defaultPrintBridgeConfig };
  }
  const stored = localStorage.getItem("printBridgeConfig");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed.ipAddress === "string" && typeof parsed.port === "number") {
        return parsed;
      }
    } catch (e) {
      console.warn("Failed to parse print bridge config, using defaults:", e);
    }
  }
  return { ...defaultPrintBridgeConfig };
}

export function savePrintBridgeSettings(config: PrintBridgeConfig): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("printBridgeConfig", JSON.stringify(config));
  }
}
