import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

export function useDeviceInfo() {
  const [deviceName, setDeviceName] = useState<string>('Unknown Device');

  useEffect(() => {
    const getDeviceName = async () => {
      try {
        if (Platform.OS === 'web') {
          // For web, use browser info
          const userAgent = navigator.userAgent;
          let browserName = 'Web Browser';
          
          if (userAgent.includes('Chrome')) browserName = 'Chrome Browser';
          else if (userAgent.includes('Firefox')) browserName = 'Firefox Browser';
          else if (userAgent.includes('Safari')) browserName = 'Safari Browser';
          
          setDeviceName(browserName);
        } else {
          // For mobile devices
          const name = Device.deviceName || `${Device.brand} ${Device.modelName}`;
          setDeviceName(name);
        }
      } catch (error) {
        console.error('Error getting device info:', error);
        setDeviceName(`${Platform.OS} Device`);
      }
    };

    getDeviceName();
  }, []);

  return { deviceName };
}