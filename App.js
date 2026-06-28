import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StatusBar, StyleSheet, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import LoginScreen from './src/screens/LoginScreen';
import OTPScreen from './src/screens/OTPScreen';
import MainTabs from './src/navigation/MainTabs';
import AttendanceScreen from './src/screens/AttendanceScreen';
import HandoverScreen from './src/screens/HandoverScreen';
import ChecklistScreen from './src/screens/ChecklistScreen';
import ChecklistFormScreen from './src/screens/ChecklistFormScreen';
import ChecklistSummaryScreen from './src/screens/ChecklistSummaryScreen';
import ChecklistDetailsScreen from './src/screens/ChecklistDetailsScreen';
import {colors} from './src/theme';

const Stack = createNativeStackNavigator();
const TOKEN_KEY = '@vtstaff_jwt_token';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Login');

  useEffect(() => {
    AsyncStorage.getItem(TOKEN_KEY)
      .then(token => {
        if (token) {
          setInitialRoute('Main');
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
            contentStyle: {backgroundColor: colors.background},
          }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="OTP" component={OTPScreen} />
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Attendance" component={AttendanceScreen} />
          <Stack.Screen name="Handover" component={HandoverScreen} />
          <Stack.Screen name="Checklist" component={ChecklistScreen} />
          <Stack.Screen name="ChecklistForm" component={ChecklistFormScreen} />
          <Stack.Screen name="ChecklistSummary" component={ChecklistSummaryScreen} />
          <Stack.Screen name="ChecklistDetails" component={ChecklistDetailsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
