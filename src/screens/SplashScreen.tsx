import React, { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

type RootStackParamList = {
  Splash: undefined;
  ScanConnect: undefined; // ✅ FIXED: Changed from DeviceScan
};

type SplashScreenProp = NativeStackNavigationProp<RootStackParamList, 'Splash'>;

const SplashScreen = () => {
  const navigation = useNavigation<SplashScreenProp>();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('ScanConnect'); // ✅ FIXED: Changed from DeviceScan
    }, 3000); // 3 seconds

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <LinearGradient
      colors={['#0B1220', '#0E2A1F']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1220" />

      <View style={styles.content}>
        <Image
          source={require('../../assets/HealthTrack-BLE-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>HealthTrack BLE</Text>
        <Text style={styles.tagline}>Track health. Live better</Text>

        <ActivityIndicator size="large" color="#00FFB3" style={styles.loader} />
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 150, height: 150, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFF', marginTop: 10 },
  tagline: { fontSize: 16, color: '#B0B0B0', marginBottom: 30 },
  loader: { marginTop: 20 },
});

export default SplashScreen;