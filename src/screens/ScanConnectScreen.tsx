// ScanConnectScreen.tsx - FINAL 100% WORKING VERSION
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import bleManager, { ScanDevice } from "../ble/HealthBleManager";
import FooterNavigation from "../components/FooterNavigation";

export default function ScanConnectScreen() {
  const navigation = useNavigation();
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<ScanDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Ready to scan');
  const [refreshing, setRefreshing] = useState(false);
  const [scanTimeout, setScanTimeout] = useState<number | null>(null);
  
  const scanTimeoutDuration = 20000; // 20 seconds scan timeout

  useEffect(() => {
    console.log('*** INITIALIZING SCANCONNECT SCREEN ***');
    // Using singleton BleManager instance

    // Check if we're already connected on mount
    checkConnectionStatus();

    return () => {
      console.log('*** CLEANING UP SCANCONNECT SCREEN ***');
      // Cleanup on unmount
      if (scanTimeout) {
        clearTimeout(scanTimeout);
      }
      bleManager.destroy();
    };
  }, []);

  const checkConnectionStatus = async () => {
    try {
      console.log('Checking existing connection...');
      const isConnected = await bleManager.isConnected();
      if (isConnected) {
        console.log('Already connected to device');
        setConnectedDevice('connected-device');
        setConnectionStatus('Already connected to HealthTrack');
      } else {
        console.log('No existing connection found');
      }
    } catch (error) {
      console.log('Connection check failed:', error);
    }
  };

  const startScan = async () => {
    try {
      console.log('*** STARTING SCAN PROCESS ***');

      // Clear previous devices and start fresh
      setDevices([]);
      setScanning(true);
      setConnectionStatus('Preparing to scan...');

      // Set scan timeout
      const timeout = setTimeout(() => {
        console.log('Scan timeout reached');
        stopScan();
        if (devices.length === 0) {
          setConnectionStatus('No devices found - try again');
          Alert.alert(
            'Scan Complete',
            'No HealthTrack devices found nearby.\n\nMake sure your ESP32 device is:\n• Powered on\n• Running the Arduino code\n• Within 10 meters of your phone'
          );
        } else {
          setConnectionStatus(`Found ${devices.length} device(s)`);
        }
      }, scanTimeoutDuration);

  setScanTimeout(timeout as unknown as number);

      // Start actual BLE scanning with the final HealthBleManager
      await bleManager.startScan((device: ScanDevice) => {
        console.log('*** DEVICE FOUND CALLBACK ***', device);

        const newDevice: ScanDevice = {
          id: device.id,
          name: device.name,
          rssi: device.rssi || null,
          isConnectable: true,
          isConnecting: false,
        };

        console.log('Adding device to list:', newDevice);

        // Update devices list (avoid duplicates)
        setDevices(prevDevices => {
          const existingIndex = prevDevices.findIndex(d => d.id === device.id);
          if (existingIndex >= 0) {
            // Update existing device (RSSI might change)
            const updated = [...prevDevices];
            updated[existingIndex] = { ...updated[existingIndex], rssi: device.rssi };
            console.log('Updated existing device RSSI');
            return updated;
          } else {
            // Add new device
            console.log('Added new device to list');
            return [...prevDevices, newDevice];
          }
        });

        // Update status
        setConnectionStatus(`Found ${device.name}`);
      });

      setConnectionStatus('Scanning for HealthTrack devices...');
      console.log('Scan started successfully');

    } catch (error) {
      console.error('*** SCAN ERROR ***', error);
      setScanning(false);
      setConnectionStatus('Scan failed');

      let errorMessage = 'Failed to scan for devices.';
      const err = error as any;
      if (err?.message?.includes('Bluetooth')) {
        errorMessage = 'Please enable Bluetooth and try again.';
      } else if (err?.message?.includes('permission')) {
        errorMessage = 'Bluetooth permissions are required. Please grant permissions and try again.';
      }

      Alert.alert('Scan Error', errorMessage);
    }
  };

  const stopScan = async () => {
    try {
      console.log('*** STOPPING SCAN ***');
      await bleManager.stopScan();
      setScanning(false);

      if (scanTimeout) {
        clearTimeout(scanTimeout);
        setScanTimeout(null);
      }

      setConnectionStatus(
        devices.length > 0
          ? `Found ${devices.length} device(s)`
          : 'Scan stopped'
      );

      console.log('Scan stopped successfully');
    } catch (error) {
      console.error('Stop scan error:', error);
      setScanning(false);
    }
  };

  const connectToDevice = async (device: ScanDevice) => {
    console.log(`*** ATTEMPTING CONNECTION TO: ${device.id} (${device.name}) ***`);

    // Update device connecting state
    setDevices(prevDevices =>
      prevDevices.map(d => ({
        ...d,
        isConnecting: d.id === device.id
      }))
    );

    setIsConnecting(true);
    setConnectionStatus('Connecting to device...');

    try {
      // Stop scanning if active
      if (scanning) {
        console.log('Stopping scan before connection...');
        await stopScan();
      }

      // Attempt connection using the singleton BleManager
      console.log('Calling connectToDevice...');
      const success = await bleManager.connectToDevice(device);

      if (success) {
        console.log('*** CONNECTION SUCCESSFUL ***');
        setConnectedDevice(device.id);
        setConnectionStatus(`Successfully connected to ${device.name}`);
        setIsConnecting(false);

        // Reset device states
        setDevices(prevDevices =>
          prevDevices.map(d => ({
            ...d,
            isConnecting: false
          }))
        );

        // Show success message and navigate
        Alert.alert(
          'Connection Successful!',
          `Your HealthTrack device (${device.name}) is now connected and ready for monitoring.`,
          [
            {
              text: 'Go to Dashboard',
              onPress: () => {
                console.log('Navigating to LiveDashboard...');
                navigation.navigate('LiveDashboard' as never);
              }
            }
          ]
        );

      } else {
        throw new Error('Connection failed - device did not respond');
      }

    } catch (error: any) {
      console.error('*** CONNECTION FAILED ***', error);
      setIsConnecting(false);
      setConnectionStatus('Connection failed');

      // Reset device states
      setDevices(prevDevices =>
        prevDevices.map(d => ({
          ...d,
          isConnecting: false
        }))
      );

      let errorMessage = 'Could not connect to the device.';
      if (error.message.includes('service not found')) {
        errorMessage = 'Device found but HealthTrack service not available. Make sure your ESP32 is running the correct Arduino code.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Connection timed out. Make sure the device is powered on and nearby.';
      }

      Alert.alert(
        'Connection Failed',
        `${errorMessage}\n\nPlease try:\n• Move closer to the device\n• Check if device is powered on\n• Restart the device and try again`
      );
    }
  };


  const disconnectDevice = async () => {
    try {
      console.log('*** DISCONNECTING DEVICE ***');
      await bleManager.disconnect();
      setConnectedDevice(null);
      setConnectionStatus('Device disconnected');

      Alert.alert('Disconnected', 'Device has been disconnected successfully.');
    } catch (error) {
      console.error('Disconnect error:', error);
      Alert.alert('Disconnect Error', 'Failed to disconnect device');
    }
  };

  const handleRefresh = async () => {
    console.log('*** REFRESHING SCREEN ***');
    setRefreshing(true);

    // Stop any ongoing scan
    if (scanning) {
      await stopScan();
    }

    // Clear devices and reset state
    setDevices([]);
    setConnectionStatus('Ready to scan');

    // Check connection status
    await checkConnectionStatus();

    setTimeout(() => setRefreshing(false), 1000);
  };

  const goToLiveDashboard = () => {
    if (connectedDevice) {
      console.log('Navigating to Dashboard...');
      navigation.navigate('LiveDashboard' as never);
    } else {
      Alert.alert(
        'No Device Connected',
        'Please connect to a HealthTrack device first.'
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Icon name="heart-pulse" size={32} color="#0ea5a0" />
        </View>
        <Text style={styles.title}>Device Scanner</Text>
        <TouchableOpacity
          style={styles.reloadBtn}
          onPress={handleRefresh}
          disabled={scanning || isConnecting}
        >
          <Icon name="reload" size={22} />
        </TouchableOpacity>
      </View>

      {/* Status Card */}
      <View style={styles.statusCard}>
        <Icon
          name={connectedDevice ? "bluetooth-connect" : "bluetooth"}
          size={24}
          color={connectedDevice ? "#10b981" : "#6b7280"}
        />
        <Text style={styles.statusText}>{connectionStatus}</Text>
        {connectedDevice && (
          <TouchableOpacity style={styles.dashboardBtn} onPress={goToLiveDashboard}>
            <Icon name="monitor-dashboard" size={16} color="#fff" />
            <Text style={styles.dashboardBtnText}>Dashboard</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Scan controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.scanBtn, scanning && styles.scanBtnActive]}
          onPress={() => (scanning ? stopScan() : startScan())}
          disabled={isConnecting}
        >
          {scanning ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.scanText}>Scanning...</Text>
            </>
          ) : (
            <>
              <Icon name="radar" size={16} color="#fff" />
              <Text style={styles.scanText}>Scan for HealthTrack</Text>
            </>
          )}
        </TouchableOpacity>

        {connectedDevice && (
          <TouchableOpacity
            style={styles.disconnectBtn}
            onPress={disconnectDevice}
            disabled={isConnecting}
          >
            <Icon name="bluetooth-off" size={16} color="#fff" />
            <Text style={styles.disconnectText}>Disconnect</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructionsCard}>
        <Text style={styles.instructionsTitle}>Setup Instructions</Text>
        <Text style={styles.instructionsText}>
          1. Power on your ESP32-S3 HealthTrack sensor{'\n'}
          2. Ensure the Arduino code is running properly{'\n'}
          3. Keep the sensor within 10 meters of your phone{'\n'}
          4. Tap "Scan for HealthTrack" to discover devices{'\n'}
          5. Connect to your device from the list below{'\n'}
          6. Navigate to Dashboard to start health monitoring
        </Text>
      </View>

      {/* Device list */}
      <View style={styles.listContainer}>
        <Text style={styles.listTitle}>
          Discovered Devices {devices.length > 0 && `(${devices.length})`}
        </Text>
        <FlatList
          data={devices}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#0ea5a0']}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon
                name={scanning ? "bluetooth" : "bluetooth-off"}
                size={48}
                color={scanning ? "#0ea5a0" : "#d1d5db"}
              />
              <Text style={styles.emptyText}>
                {scanning ? 'Searching for HealthTrack devices...' : 'No devices found'}
              </Text>
              <Text style={styles.emptySubText}>
                {!scanning && 'Tap scan to search for your HealthTrack sensor'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isConnected = connectedDevice === item.id;
            const isConnectingThis = item.isConnecting;

            return (
              <View style={[styles.deviceRow, isConnected && styles.deviceRowConnected]}>
                <View style={styles.deviceInfo}>
                  <View style={styles.deviceHeader}>
                    <Icon name="bluetooth" size={20} color="#0ea5a0" />
                    <Text style={styles.deviceName}>{item.name}</Text>
                  </View>
                  <Text style={styles.deviceId}>Device ID: {item.id.substring(0, 17)}...</Text>
                  <Text style={styles.rssiText}>
                    Signal Strength: {item.rssi ? `${item.rssi} dBm` : "Unknown"}
                  </Text>
                </View>

                <View style={styles.deviceActions}>
                  {!isConnected ? (
                    <TouchableOpacity
                      style={[styles.connectBtn, isConnectingThis && styles.connectBtnDisabled]}
                      onPress={() => connectToDevice(item)}   // ✅ pass whole device
                      disabled={isConnectingThis || isConnecting}
                    >
                      {isConnectingThis ? (
                        <>
                          <ActivityIndicator size="small" color="#fff" />
                          <Text style={styles.connectText}>Connecting...</Text>
                        </>
                      ) : (
                        <>
                          <Icon name="bluetooth-connect" size={16} color="#fff" />
                          <Text style={styles.connectText}>Connect</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.connectedBadge}>
                      <Icon name="check-circle" size={18} color="#fff" />
                      <Text style={styles.connectedText}>Connected</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      </View>

      {/* Footer Navigation */}
      <FooterNavigation activeScreen="ScanConnect" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc"
  },
  header: {
    height: 84,
    paddingHorizontal: 16,
    paddingTop: 18,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e6e6e6",
    backgroundColor: "#fff",
  },
  logoContainer: {
    width: 44,
    height: 44,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    color: '#1f2937'
  },
  reloadBtn: {
    padding: 8,
    borderRadius: 8,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  dashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0ea5a0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dashboardBtnText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '600',
    fontSize: 12,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  scanBtn: {
    flex: 1,
    backgroundColor: "#0ea5a0",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  scanBtnActive: {
    backgroundColor: "#059e95"
  },
  scanText: {
    color: "#fff",
    marginLeft: 8,
    fontWeight: "600"
  },
  disconnectBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  disconnectText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 4,
  },
  instructionsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0ea5a0',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1f2937',
  },
  instructionsText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1f2937',
  },
  deviceRow: {
    flexDirection: "row",
    padding: 16,
    marginVertical: 4,
    backgroundColor: "#fff",
    borderRadius: 12,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  deviceRowConnected: {
    borderColor: '#10b981',
    borderWidth: 1,
    backgroundColor: '#f0fdf4',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
    color: '#1f2937',
  },
  deviceId: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  rssiText: {
    fontSize: 12,
    color: "#9ca3af"
  },
  deviceActions: {
    alignItems: "flex-end"
  },
  connectBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  connectBtnDisabled: {
    backgroundColor: "#9ca3af",
  },
  connectText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 4,
  },
  connectedBadge: {
    backgroundColor: "#10b981",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  connectedText: {
    color: "#fff",
    marginLeft: 4,
    fontWeight: "600",
    fontSize: 12,
  },
  empty: {
    padding: 32,
    alignItems: "center",
    justifyContent: 'center',
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubText: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
});