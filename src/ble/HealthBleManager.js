// src/ble/HealthBleManager.js
import { BleManager } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { PermissionsAndroid, Platform } from 'react-native';

// UUIDs (keep your values)
const SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
const HEART_RATE_UUID = '87654321-4321-4321-4321-cba987654321';
const SPO2_UUID = '11111111-2222-3333-4444-555555555555';
const STATUS_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const TARGET_DEVICE_NAME = 'HealthTR';

class HealthBleManager {
  constructor() {
    this.manager = new BleManager();
    this.device = null;
    this.heartRateSubscription = null;
    this.spo2Subscription = null;
    this.statusSubscription = null;
    this.isConnectedFlag = false;

    // UI callbacks (set by screens)
    this.onHeartRateUpdate = null;
    this.onSpO2Update = null;
    this.onStatusUpdate = null;
  }

  // Allow screens to register callbacks
  setListeners({ onHeartRateUpdate = null, onSpO2Update = null, onStatusUpdate = null } = {}) {
    this.onHeartRateUpdate = onHeartRateUpdate;
    this.onSpO2Update = onSpO2Update;
    this.onStatusUpdate = onStatusUpdate;
  }

  // Permissions
  async requestPermissions() {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];
        const granted = await PermissionsAndroid.requestMultiple(permissions);
        return Object.values(granted).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
      } else {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true;
  }

  // Start scanning (keeps existing API)
  async startScan(onDeviceFound, onScanComplete) {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.log('❌ Permission denied for BLE scan');
      if (onScanComplete) onScanComplete(false);
      return;
    }

    console.log('🔍 Starting BLE scan...');
    this.device = null;

    this.manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('❌ Scan error:', error);
        this.manager.stopDeviceScan();
        if (onScanComplete) onScanComplete(false);
        return;
      }
      const deviceName = device?.name || device?.localName || 'Unknown Device';
      console.log(`📡 Found device: ${deviceName} [${device.id}]`);

      if (deviceName && deviceName.toLowerCase().includes(TARGET_DEVICE_NAME.toLowerCase())) {
        console.log('🎯 FOUND TARGET DEVICE:', deviceName);
        this.manager.stopDeviceScan();
        this.device = device;
        if (onDeviceFound) onDeviceFound(device);
        if (onScanComplete) onScanComplete(true);
      }
    });

    // Safety timeout
    setTimeout(() => {
      if (!this.device) {
        this.manager.stopDeviceScan();
        if (onScanComplete) onScanComplete(false);
        console.log('⏹️ Scan timeout - stopped.');
      }
    }, 10000);
  }

  stopScan() {
    console.log('⏹️ Stopping BLE scan (manual)...');
    this.manager.stopDeviceScan();
  }

  // Connect to a device (by id or device object)
  async connectToDevice(deviceOrId) {
    try {
      const deviceId = typeof deviceOrId === 'string' ? deviceOrId : deviceOrId?.id;
      const deviceName = typeof deviceOrId === 'string' ? 'Unknown' : deviceOrId?.name || 'Unknown';

      if (!deviceId) throw new Error('Device ID is missing!');

      console.log(`🔗 Connecting to ${deviceName} [${deviceId}] ...`);
      this.device = await this.manager.connectToDevice(deviceId);

      console.log('✅ Discovering services & characteristics...');
      await this.device.discoverAllServicesAndCharacteristics();
      const services = await this.device.services();

      const healthService = services.find(
        (s) =>
          s.uuid.toLowerCase().includes('12345678') ||
          s.uuid.toLowerCase() === SERVICE_UUID.toLowerCase()
      );

      if (!healthService) throw new Error('HealthTrack service not found');
      console.log('✅ Found HealthTrack service!');

      const characteristics = await healthService.characteristics();

      // Helper for decoding values
      const decodeValue = (characteristic) => {
        if (!characteristic?.value) return null;
        const buffer = Buffer.from(characteristic.value, 'base64');
        const strVal = buffer.toString('utf-8').trim();
        const numVal = parseInt(strVal, 10);
        return isNaN(numVal) ? strVal : numVal;
      };

      // Clean previous subscriptions if any
      if (this.heartRateSubscription) { try { this.heartRateSubscription.remove(); } catch (e) {} }
      if (this.spo2Subscription) { try { this.spo2Subscription.remove(); } catch (e) {} }
      if (this.statusSubscription) { try { this.statusSubscription.remove(); } catch (e) {} }

      // Heart Rate characteristic
      const heartRateChar = characteristics.find(
        (c) => c.uuid.toLowerCase() === HEART_RATE_UUID.toLowerCase()
      );
      if (heartRateChar) {
        console.log('📡 Subscribing to Heart Rate...');
        this.heartRateSubscription = heartRateChar.monitor((error, characteristic) => {
          if (error) {
            console.error('Heart Rate subscription error:', error);
            return;
          }
          if (characteristic?.value) {
            const val = decodeValue(characteristic);
            console.log('❤️ Heart Rate:', val);
            if (typeof this.onHeartRateUpdate === 'function') this.onHeartRateUpdate(val);
          }
        });
      }

      // SpO2 characteristic
      const spo2Char = characteristics.find(
        (c) => c.uuid.toLowerCase() === SPO2_UUID.toLowerCase()
      );
      if (spo2Char) {
        console.log('📡 Subscribing to SpO2...');
        this.spo2Subscription = spo2Char.monitor((error, characteristic) => {
          if (error) {
            console.error('SpO2 subscription error:', error);
            return;
          }
          if (characteristic?.value) {
            const val = decodeValue(characteristic);
            console.log('🫁 SpO2:', val);
            if (typeof this.onSpO2Update === 'function') this.onSpO2Update(val);
          }
        });
      }

      // Status characteristic
      const statusChar = characteristics.find(
        (c) => c.uuid.toLowerCase() === STATUS_UUID.toLowerCase()
      );
      if (statusChar) {
        console.log('📡 Subscribing to Status...');
        this.statusSubscription = statusChar.monitor((error, characteristic) => {
          if (error) {
            console.error('Status subscription error:', error);
            return;
          }
          if (characteristic?.value) {
            const val = Buffer.from(characteristic.value, 'base64').toString('utf-8').trim();
            console.log('📶 Status:', val);
            if (typeof this.onStatusUpdate === 'function') this.onStatusUpdate(val);
          }
        });
      }

      this.isConnectedFlag = true;
      console.log('✅ Successfully connected to device.');
      return true;
    } catch (error) {
      console.error('❌ Connection error:', error);
      this.isConnectedFlag = false;
      return false;
    }
  }

  // Convenience method expected by your screens: "reconnect"
  async reconnect() {
    // If we already have device object (from a previous scan), try reconnecting to it.
    try {
      if (this.device && this.device.id) {
        return await this.connectToDevice(this.device.id);
      }

      // Otherwise, try to find a currently connected device with the service UUID
      try {
        const connected = await this.manager.connectedDevices([SERVICE_UUID]);
        if (connected && connected.length > 0) {
          this.device = connected[0];
          console.log('♻️ Found already-connected device via manager.connectedDevices');
          return await this.connectToDevice(this.device.id);
        }
      } catch (err) {
        // Not fatal; continue
      }

      return false;
    } catch (e) {
      console.error('reconnect failed:', e);
      return false;
    }
  }

  // subscribe(onData, onStatus) — compatibility with your LiveDashboardScreen
  async subscribe(onData, onStatus) {
    // onData expected to be (dataObj) where dataObj may contain heartRate, spo2
    // onStatus expected to be (statusString)
    // We'll set local listeners to forward to these callbacks, and rely on existing characteristic monitors to call them.
    this.setListeners({
      onHeartRateUpdate: (val) => {
        if (typeof onData === 'function') {
          onData({ heartRate: val, timestamp: Date.now() });
        }
      },
      onSpO2Update: (val) => {
        if (typeof onData === 'function') {
          onData({ spo2: val, timestamp: Date.now() });
        }
      },
      onStatusUpdate: (statusVal) => {
        if (typeof onStatus === 'function') onStatus(statusVal);
      },
    });

    // If already connected and characteristic monitors are not set (rare), ensure connectToDevice is called to set up monitors.
    // But do not force a connection here; assume caller connected or used reconnect().
    return true;
  }

  // Unsubscribe: remove monitors and listeners
  async unsubscribe() {
    try {
      if (this.heartRateSubscription && typeof this.heartRateSubscription.remove === 'function') {
        try { this.heartRateSubscription.remove(); } catch (e) {}
      }
      if (this.spo2Subscription && typeof this.spo2Subscription.remove === 'function') {
        try { this.spo2Subscription.remove(); } catch (e) {}
      }
      if (this.statusSubscription && typeof this.statusSubscription.remove === 'function') {
        try { this.statusSubscription.remove(); } catch (e) {}
      }
      this.heartRateSubscription = null;
      this.spo2Subscription = null;
      this.statusSubscription = null;

      // Reset callbacks
      this.setListeners({ onHeartRateUpdate: null, onSpO2Update: null, onStatusUpdate: null });

      console.log('🔕 Unsubscribed from characteristics.');
      return true;
    } catch (error) {
      console.error('unsubscribe error:', error);
      return false;
    }
  }

  // Disconnect device (compatibility)
  async disconnect() {
    return this.disconnectDevice();
  }

  async disconnectDevice() {
    try {
      if (this.device) {
        console.log('🔌 Disconnecting...');
        if (this.heartRateSubscription && typeof this.heartRateSubscription.remove === 'function') {
          try { this.heartRateSubscription.remove(); } catch (e) {}
        }
        if (this.spo2Subscription && typeof this.spo2Subscription.remove === 'function') {
          try { this.spo2Subscription.remove(); } catch (e) {}
        }
        if (this.statusSubscription && typeof this.statusSubscription.remove === 'function') {
          try { this.statusSubscription.remove(); } catch (e) {}
        }

        // cancel connection
        await this.manager.cancelDeviceConnection(this.device.id).catch(() => {});
        this.device = null;
        this.isConnectedFlag = false;
        console.log('⏹️ Disconnected.');
      }
      return true;
    } catch (error) {
      console.error('disconnectDevice error:', error);
      return false;
    }
  }

  // destroy: cleanup BLE manager and subscriptions (compatibility)
  destroy() {
    try {
      this.unsubscribe();
      // Optionally stop scanning
      try { this.manager.stopDeviceScan(); } catch (e) {}
      // Do not call manager.destroy() here (react-native-ble-plx doesn't expose destroy) — just null out state
      this.device = null;
      this.isConnectedFlag = false;
      console.log('🧹 HealthBleManager destroyed (state reset).');
    } catch (error) {
      console.error('destroy error:', error);
    }
  }

  // Check connection
  async checkIsConnected() {
    try {
      if (this.device && this.device.id) {
        const connected = await this.manager.isDeviceConnected(this.device.id);
        this.isConnectedFlag = connected;
        return connected;
      }
      return false;
    } catch (error) {
      console.error('checkIsConnected error:', error);
      this.isConnectedFlag = false;
      return false;
    }
  }

  async isConnected() {
    return this.checkIsConnected();
  }

  getDevice() {
    return this.device;
  }
}

// Export a singleton so screens share the same manager & connection
const singleton = new HealthBleManager();
export default singleton;
