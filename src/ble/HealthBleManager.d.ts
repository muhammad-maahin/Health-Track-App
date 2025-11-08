import { BleManager } from 'react-native-ble-plx';

export interface ScanDevice {
  id: string;
  name: string;
  rssi: number | null;
  isConnectable: boolean;
  isConnecting?: boolean;
}

export interface HealthData {
  heartRate?: number;
  spo2?: number;
  timestamp?: number;
}

interface HealthBleManagerCallbacks {
  onHeartRateUpdate?: ((heartRate: number) => void) | null;
  onSpO2Update?: ((spo2: number) => void) | null;
  onStatusUpdate?: ((status: string) => void) | null;
}

declare class HealthBleManager {
  manager: BleManager;
  device: any | null;
  isConnectedFlag: boolean;

  constructor();
  
  setListeners(callbacks?: HealthBleManagerCallbacks): void;
  requestPermissions(): Promise<boolean>;
  startScan(onDeviceFound: (device: ScanDevice) => void): Promise<void>;
  stopScan(): Promise<void>;
  connectToDevice(device: ScanDevice): Promise<boolean>;
  disconnect(): Promise<void>;
  reconnect(): Promise<boolean>;
  isConnected(): Promise<boolean>;
  subscribe(
    onData: (data: HealthData) => void,
    onStatus: (status: string) => void
  ): Promise<void>;
  unsubscribe(): Promise<void>;
  destroy(): void;
}

declare const bleManager: HealthBleManager;
export default bleManager;
