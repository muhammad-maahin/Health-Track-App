// screens/LiveDashboardScreen.tsx - FINAL VERSION
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import bleManager from '../ble/HealthBleManager';
import FooterNavigation from '../components/FooterNavigation';

const { width: screenWidth } = Dimensions.get('window');

type HealthData = {
  heartRate: number;
  spo2: number;
  timestamp: number;
};

export default function LiveDashboardScreen() {
  // Navigation
  const navigation = useNavigation();

  // Health metrics state
  const [currentHeartRate, setCurrentHeartRate] = useState<number>(0);
  const [currentSpO2, setCurrentSpO2] = useState<number>(0);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Checking connection...');
  
  // Chart data state
  const [heartRateHistory, setHeartRateHistory] = useState<number[]>([]);
  const [spo2History, setSpo2History] = useState<number[]>([]);
  const [timeLabels, setTimeLabels] = useState<string[]>([]);
  
  // BLE state
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  // Debug: capture raw BLE data for troubleshooting
  const [rawDataLog, setRawDataLog] = useState<string[]>([]);

  // Setup cleanup on unmount
  useEffect(() => {
    // Check initial connection
    checkConnectionStatus();
    
    return () => {
      cleanup();
    };
  }, []);

  // Check connection when screen focuses (but don't auto-connect)
  useFocusEffect(
    React.useCallback(() => {
      checkConnectionStatus();
      
      return () => {
        // Don't disconnect when screen loses focus - let user control this
        // The connection should persist across screen changes
      };
    }, [])
  );

  const cleanup = async () => {
    try {
      setIsMonitoring(false);
      setIsSubscribed(false);
      
      // Unsubscribe using singleton
      await bleManager.unsubscribe();
      // Don't auto-disconnect - let user control this
      bleManager.destroy();
    } catch (error) {
      console.log('Cleanup error:', error);
    }
  };

  const checkConnectionStatus = async () => {
    try {
      // Check if we're already connected
      const connected = await bleManager.isConnected();
      setIsConnected(connected);
      
      if (connected) {
        setConnectionStatus('Connected to HealthTrack');
        // If connected but not monitoring, offer to start
        if (!isMonitoring) {
          setConnectionStatus('Connected - Ready to monitor');
        }
      } else {
        setConnectionStatus('Not connected');
        setIsMonitoring(false);
        setIsSubscribed(false);
      }
    } catch (error) {
      console.log('Connection check failed:', error);
      setIsConnected(false);
      setConnectionStatus('Connection check failed');
    }
  };

  const connectToDevice = async () => {
    try {
      setConnectionStatus('Connecting to device...');
      
      // Check if already connected first
      const alreadyConnected = await bleManager.isConnected();
      if (alreadyConnected) {
        setIsConnected(true);
        setConnectionStatus('Already connected');
        return;
      }

      // Try to connect using the existing connection from ScanConnect screen
      // First check if we have a saved/paired device
      const connected = await bleManager.reconnect();
      
      if (connected) {
        setIsConnected(true);
        setConnectionStatus('Connected successfully');
      } else {
        // If no saved connection, redirect to scan screen
        setConnectionStatus('No saved device found');
        Alert.alert(
          'No Device Found',
          'Please use the scanner to find and connect to your HealthTrack device first.',
          [
            {
              text: 'Go to Scanner',
              onPress: () => navigation.navigate('ScanConnect' as never)
            },
            { text: 'Cancel' }
          ]
        );
      }

    } catch (error) {
      console.error('Connection error:', error);
      setConnectionStatus('Connection failed');
      setIsConnected(false);
      
      Alert.alert(
        'Connection Failed', 
        'Could not connect to your HealthTrack device. Please try using the scanner.',
        [
          {
            text: 'Go to Scanner',
            onPress: () => navigation.navigate('ScanConnect' as never)
          },
          { text: 'Retry', onPress: connectToDevice },
          { text: 'Cancel' }
        ]
      );
    }
  };

  const startMonitoring = async () => {
    if (!isConnected) {
      Alert.alert('No Device Connected', 'Please connect to your HealthTrack sensor first.');
      return;
    }

    // If already subscribed, don't subscribe again
    if (isSubscribed) {
      setIsMonitoring(true);
      setConnectionStatus('Monitoring active');
      return;
    }

    try {
      setIsMonitoring(true);
      setConnectionStatus('Starting monitoring...');

      // Subscribe to health data
      await bleManager.subscribe(
        (data) => {
          // Handle incoming health data
          console.log('Received health data:', data);

          // Save last 10 raw entries for debug display
          setRawDataLog(prev => {
            const updated = [...prev, JSON.stringify(data)];
            if (updated.length > 10) updated.shift();
            return updated;
          });

          if (data.heartRate !== undefined && data.heartRate > 0) {
            setCurrentHeartRate(data.heartRate);
            updateHeartRateHistory(data.heartRate);
          }

          if (data.spo2 !== undefined && data.spo2 > 0) {
            setCurrentSpO2(data.spo2);
            updateSpO2History(data.spo2);
          }

          // Update status based on data quality (guard undefined)
          if (
            data.heartRate !== undefined &&
            data.spo2 !== undefined &&
            data.heartRate > 0 &&
            data.spo2 > 0
          ) {
            setConnectionStatus('Monitoring - Receiving data');
          }
        },
        (status) => {
          // Handle status messages from device
          console.log('Device status:', status);
          
          if (status) {
            switch (status) {
              case 'NO_FINGER':
                setConnectionStatus('Place finger on sensor');
                break;
              case 'STABILIZING':
                setConnectionStatus('Stabilizing reading...');
                break;
              case 'CALCULATING':
                setConnectionStatus('Calculating values...');
                break;
              case 'OK':
                setConnectionStatus('Monitoring active');
                break;
              case 'WEAK_SIGNAL':
                setConnectionStatus('Weak signal - press firmly');
                break;
              case 'POOR_SIGNAL':
                setConnectionStatus('Poor signal - check placement');
                break;
              default:
                if (status.includes('error') || status.includes('failed')) {
                  setConnectionStatus('Device error');
                }
                break;
            }
          }
        }
      );

      setIsSubscribed(true);
      setConnectionStatus('Monitoring started - Place finger on sensor');

    } catch (error) {
      console.error('Start monitoring error:', error);
      setIsMonitoring(false);
      setConnectionStatus('Failed to start monitoring');
      
      Alert.alert(
        'Monitoring Error', 
        'Failed to start monitoring. Please check your device connection.',
        [
          { text: 'Retry', onPress: startMonitoring },
          { text: 'Cancel' }
        ]
      );
    }
  };

  const stopMonitoring = async () => {
    try {
      setIsMonitoring(false);
      
      if (isSubscribed) {
        await bleManager.unsubscribe();
        setIsSubscribed(false);
      }
      
      // Reset current readings
      setCurrentHeartRate(0);
      setCurrentSpO2(0);
      
      setConnectionStatus(isConnected ? 'Connected - Stopped monitoring' : 'Disconnected');
      
    } catch (error) {
      console.error('Stop monitoring error:', error);
      setConnectionStatus('Error stopping monitoring');
    }
  };

  const disconnectDevice = async () => {
    try {
      // Stop monitoring first
      if (isMonitoring) {
        await stopMonitoring();
      }

      // Disconnect device
      await bleManager.disconnect();

      // Reset states
      setIsConnected(false);
      setIsSubscribed(false);
      setConnectionStatus('Disconnected');
      
      // Clear readings
      setCurrentHeartRate(0);
      setCurrentSpO2(0);
      setHeartRateHistory([]);
      setSpo2History([]);
      setTimeLabels([]);
      
    } catch (error) {
      console.error('Disconnect error:', error);
      Alert.alert('Disconnect Error', 'Error disconnecting from device');
    }
  };

  const updateHeartRateHistory = (newRate: number) => {
    setHeartRateHistory(prev => {
      const updated = [...prev, newRate];
      if (updated.length > 20) updated.shift(); // Keep last 20 readings
      return updated;
    });
    updateTimeLabels();
  };

  const updateSpO2History = (newSpO2: number) => {
    setSpo2History(prev => {
      const updated = [...prev, newSpO2];
      if (updated.length > 20) updated.shift(); // Keep last 20 readings
      return updated;
    });
  };

  const updateTimeLabels = () => {
    setTimeLabels(prev => {
      const now = new Date();
      const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
      const updated = [...prev, timeStr];
      if (updated.length > 20) updated.shift();
      return updated;
    });
  };

  const getHealthStatus = () => {
    if (!isConnected) return { status: 'Disconnected', color: '#6b7280' };
    if (!isMonitoring) return { status: 'Connected', color: '#0ea5a0' };
    if (currentHeartRate === 0 && currentSpO2 === 0) return { status: 'Monitoring', color: '#f59e0b' };
    
    // Simple health assessment
    const normalHR = currentHeartRate >= 60 && currentHeartRate <= 100;
    const normalSpO2 = currentSpO2 >= 95;
    
    if (normalHR && normalSpO2) return { status: 'Normal', color: '#10b981' };
    if (!normalSpO2) return { status: 'Low SpO2', color: '#ef4444' };
    if (!normalHR) return { status: currentHeartRate > 100 ? 'High HR' : 'Low HR', color: '#f59e0b' };
    
    return { status: 'Monitoring', color: '#0ea5a0' };
  };

  const goToScanScreen = () => {
    navigation.navigate('ScanConnect' as never);
  };

  const healthStatus = getHealthStatus();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Icon name="heart-pulse" size={28} color="#0ea5a0" />
            <Text style={styles.title}>Health Monitor</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: healthStatus.color }]}>
            <Text style={styles.statusText}>{healthStatus.status}</Text>
          </View>
        </View>

        {/* Connection Status */}
        <View style={styles.connectionCard}>
          <Icon name="bluetooth" size={20} color={isConnected ? "#10b981" : "#6b7280"} />
          <Text style={styles.connectionText}>{connectionStatus}</Text>
          
          {!isConnected ? (
            <TouchableOpacity style={styles.connectBtn} onPress={connectToDevice}>
              <Icon name="bluetooth-connect" size={16} color="#fff" />
              <Text style={styles.connectBtnText}>Connect</Text>
            </TouchableOpacity>
          ) : !isMonitoring ? (
            <TouchableOpacity style={styles.startBtn} onPress={startMonitoring}>
              <Icon name="play" size={16} color="#fff" />
              <Text style={styles.startBtnText}>Start</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.stopBtn} onPress={stopMonitoring}>
              <Icon name="stop" size={16} color="#fff" />
              <Text style={styles.stopBtnText}>Stop</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Connection Management */}
        <View style={styles.connectionManagement}>
          {!isConnected && (
            <View style={styles.alternativeConnect}>
              <Text style={styles.alternativeText}>Need to connect to your HealthTrack device?</Text>
              <TouchableOpacity style={styles.scanBtn} onPress={goToScanScreen}>
                <Icon name="radar" size={16} color="#0ea5a0" />
                <Text style={styles.scanBtnText}>Device Scanner</Text>
              </TouchableOpacity>
            </View>
          )}

          {isConnected && (
            <View style={styles.connectedActions}>
              <TouchableOpacity style={styles.disconnectBtn} onPress={disconnectDevice}>
                <Icon name="bluetooth-off" size={16} color="#fff" />
                <Text style={styles.disconnectBtnText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Current Readings */}
        <View style={styles.metricsContainer}>
          <View style={styles.metricCard}>
            <Icon name="heart" size={32} color="#ef4444" />
            <Text style={styles.metricValue}>{currentHeartRate || '--'}</Text>
            <Text style={styles.metricLabel}>BPM</Text>
            <Text style={styles.metricSubLabel}>Heart Rate</Text>
          </View>

          <View style={styles.metricCard}>
            <Icon name="water-percent" size={32} color="#3b82f6" />
            <Text style={styles.metricValue}>{currentSpO2 || '--'}</Text>
            <Text style={styles.metricLabel}>%</Text>
            <Text style={styles.metricSubLabel}>Blood Oxygen</Text>
          </View>
        </View>

        {/* Heart Rate History */}
        {heartRateHistory.length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Heart Rate Trend</Text>
            <LineChart
              data={{
                labels: timeLabels.slice(-6),
                datasets: [{ data: heartRateHistory.slice(-20) }]
              }}
              width={screenWidth - 32}
              height={200}
              yAxisSuffix=" BPM"
              chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff', 
                backgroundGradientTo: '#ffffff',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                strokeWidth: 2,
                propsForDots: { r: '3' },
              }}
              style={styles.chart}
            />
          </View>
        )}

        {/* SpO2 History */}
        {spo2History.length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Blood Oxygen Trend</Text>
            <LineChart
              data={{
                labels: timeLabels.slice(-6),
                datasets: [{ data: spo2History.slice(-20) }]
              }}
              width={screenWidth - 32}
              height={200}
              yAxisSuffix="%"
              chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff', 
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                strokeWidth: 2,
                propsForDots: { r: '3' },
              }}
              style={styles.chart}
            />
          </View>
        )}

        {/* Health Tips */}
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Health Tips</Text>
          <View style={styles.tipItem}>
            <Text style={styles.tipText}>• Normal Heart Rate: 60-100 BPM</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipText}>• Normal SpO2: 95-100%</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipText}>• Stay still during measurement</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipText}>• Ensure good finger placement on sensor</Text>
          </View>
        </View>

        {/* Debug Data Log */}
        {rawDataLog.length > 0 && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>Raw BLE Data (last {rawDataLog.length})</Text>
            {rawDataLog.map((entry, index) => (
              <View key={index}>
                <Text style={styles.debugText}>{entry}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Footer Navigation */}
      <FooterNavigation activeScreen="LiveDashboard" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 8,
    color: '#1f2937',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  connectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  connectionText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0ea5a0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  connectBtnText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '600',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  startBtnText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '600',
  },
  stopBtn: {
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  stopBtnText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '600',
  },
  connectionManagement: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  alternativeConnect: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  alternativeText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
    textAlign: 'center',
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0ea5a0',
  },
  scanBtnText: {
    color: '#0ea5a0',
    marginLeft: 4,
    fontWeight: '600',
  },
  connectedActions: {
    alignItems: 'center',
    padding: 8,
  },
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  disconnectBtnText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '600',
  },
  metricsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: '700',
    marginTop: 8,
    color: '#1f2937',
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  metricSubLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  chartContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1f2937',
  },
  chart: {
    borderRadius: 12,
  },
  tipsContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1f2937',
  },
  tipItem: {
    marginBottom: 4,
  },
  tipText: {
    fontSize: 14,
    color: '#4b5563',
  },
  debugContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
  },
  debugTitle: {
    color: '#facc15',
    fontWeight: '700',
    marginBottom: 6,
  },
  debugText: {
    color: '#f9fafb',
    fontSize: 12,
    marginBottom: 2,
  },
});