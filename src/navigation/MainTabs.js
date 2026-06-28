import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import DashboardScreen from '../screens/DashboardScreen';
import ActivityScreen from '../screens/ActivityScreen';
import ProfileScreen from '../screens/ProfileScreen';
import {colors, fontFamily} from '../theme';

const Tab = createBottomTabNavigator();

const icons = {
  Home: 'view-dashboard-outline',
  Activity: 'clipboard-text-clock-outline',
  Profile: 'account-circle-outline',
};

function TabIcon({routeName, color, size}) {
  return (
    <MaterialCommunityIcons
      name={icons[routeName]}
      color={color}
      size={size + 2}
    />
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#8A999F',
        tabBarLabelStyle: {
          fontFamily: fontFamily.medium,
          fontSize: 11,
          marginBottom: 6,
        },
        tabBarStyle: {
          height: 72,
          paddingTop: 7,
          borderTopWidth: 0,
          backgroundColor: colors.surface,
          elevation: 12,
          shadowColor: '#183541',
          shadowOpacity: 0.08,
          shadowOffset: {width: 0, height: -4},
          shadowRadius: 10,
        },
        // Navigation requires a render callback here; the rendered component is stable.
        // eslint-disable-next-line react/no-unstable-nested-components
        tabBarIcon: props => <TabIcon routeName={route.name} {...props} />,
      })}>
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
