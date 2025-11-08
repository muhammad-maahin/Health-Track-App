// components/FooterNavigation.tsx
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';

type FooterNavigationProps = {
  activeScreen: 'ScanConnect' | 'LiveDashboard' | 'Settings';
};

export default function FooterNavigation({ activeScreen }: FooterNavigationProps) {
  const navigation = useNavigation<any>();

  const navItems = [
    {
      id: 'ScanConnect',
      label: 'Scan',
      icon: 'bluetooth',
      screen: 'ScanConnect'
    },
    {
      id: 'LiveDashboard', 
      label: 'Dashboard',
      icon: 'view-dashboard',
      screen: 'LiveDashboard'
    },
    {
      id: 'Settings',
      label: 'Settings', 
      icon: 'cog',
      screen: 'Settings'
    }
  ];

  const handleNavigation = (screen: string) => {
    if (screen !== activeScreen) {
      navigation.navigate(screen);
    }
  };

  return (
    <View style={styles.container}>
      {navItems.map((item) => {
        const isActive = item.id === activeScreen;
        return (
          <TouchableOpacity
            key={item.id}
            style={styles.navItem}
            onPress={() => handleNavigation(item.screen)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, isActive && styles.activeIconContainer]}>
              <Icon
                name={item.icon}
                size={24}
                color={isActive ? '#0ea5a0' : '#666'}
              />
            </View>
            <Text style={[styles.label, isActive && styles.activeLabel]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 70,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e6e6e6',
    paddingBottom: 8,
    paddingTop: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 4,
  },
  activeIconContainer: {
    // Optional: add background circle for active state
  },
  label: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeLabel: {
    color: '#0ea5a0',
    fontWeight: '600',
  },
});