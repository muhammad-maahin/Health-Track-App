// screens/SettingsScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import FooterNavigation from '../components/FooterNavigation';

export default function SettingsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  const toggleNotifications = () => setNotificationsEnabled(prev => !prev);
  const toggleAlerts = () => setAlertsEnabled(prev => !prev);

  const handleSaveChanges = () => {
    Alert.alert('Settings Saved', 'Your preferences have been updated.');
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Enable Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: '#ccc', true: '#10b981' }}
            />
          </View>
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Enable Alerts</Text>
            <Switch
              value={alertsEnabled}
              onValueChange={toggleAlerts}
              trackColor={{ false: '#ccc', true: '#ef4444' }}
            />
          </View>
        </View>

        {/* Info / Help */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Info & Help</Text>
          <View style={styles.optionRow}>
            <Icon name="information" size={20} color="#0ea5a0" />
            <Text style={styles.optionLabel}>About App</Text>
          </View>
          <View style={styles.optionRow}>
            <Icon name="help-circle" size={20} color="#0ea5a0" />
            <Text style={styles.optionLabel}>Help & Support</Text>
          </View>
        </View>

        {/* Save Changes Button */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveChanges}>
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} /> {/* Spacer for footer */}
      </ScrollView>

      {/* Footer Navigation */}
      <FooterNavigation activeScreen="Settings" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { flex: 1 },
  header: { padding: 16, paddingTop: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  section: { marginHorizontal: 16, marginBottom: 24, backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#1f2937' },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  optionLabel: { fontSize: 14, color: '#4b5563' },
  saveBtn: { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#0ea5a0', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
