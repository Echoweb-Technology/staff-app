/**
 * VT Staff - React Native CLI (no Expo)
 * Navigation: Login -> OTP -> Home
 */

import React, { useEffect, useState, useRef } from 'react';
import { StatusBar, View, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen from './src/screens/LoginScreen';
import OTPScreen from './src/screens/OTPScreen';
import HomeScreen from './src/screens/HomeScreen';
import StartDutyScreen from './src/screens/StartDutyScreen';
import EndDutyScreen from './src/screens/EndDutyScreen';
import AddFuelScreen from './src/screens/AddFuelScreen';

// Update components & services
import DeviceInfo from 'react-native-device-info';
import { checkAppVersion } from './src/services/appApi';
import UpdateModal from './src/components/UpdateModal';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Login');

  const [updateVisible, setUpdateVisible] = useState(false);
  const [updateData, setUpdateData] = useState(null);

  const appState = useRef(AppState.currentState);

  useEffect(() => {
    async function initializeApp() {
      try {
        // Check Token for routing
        const token = await AsyncStorage.getItem('@vtstaff_jwt_token');
        if (token) {
          setInitialRoute('Home');
        }

        // Check for updates
        await performUpdateCheck();
      } catch (error) {
        console.error('Failed to initialize app', error);
      } finally {
        setIsLoading(false);
      }
    }

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        performUpdateCheck();
      }
      appState.current = nextAppState;
    });

    initializeApp();

    return () => {
      subscription.remove();
    };
  }, []);

  const performUpdateCheck = async () => {
    try {
      const upData = await checkAppVersion();
      if (upData) {
        const currentBuild = parseInt(DeviceInfo.getBuildNumber(), 10);
        if (upData.version_code > currentBuild) {
          setUpdateData(upData);
          setUpdateVisible(true);
        }
      }
    } catch (e) {
      console.log('Update check failed', e);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#34C759" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerStyle: { backgroundColor: '#f5f5f5' },
            headerTitleStyle: { fontWeight: '600', color: '#333' },
          }}
        >
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: 'Login' }}
          />
          <Stack.Screen
            name="OTP"
            component={OTPScreen}
            options={{ title: 'Verify OTP' }}
          />
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="StartDuty"
            component={StartDutyScreen}
            options={{ title: 'Start Duty' }}
          />
          <Stack.Screen
            name="EndDuty"
            component={EndDutyScreen}
            options={{ title: 'End Duty' }}
          />
          <Stack.Screen
            name="AddFuel"
            component={AddFuelScreen}
            options={{ title: 'Add Fuel / ईंधन भरें' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <UpdateModal
        visible={updateVisible}
        updateData={updateData}
        onDismiss={() => setUpdateVisible(false)}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
