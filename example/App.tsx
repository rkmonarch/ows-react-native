/**
 * AgentPayMobile — Root App (Light Theme)
 * // This enables the OWS + Stripe MPP on Solana mobile demo
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { OwsProvider } from '../src/components/OwsProvider';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { PolicySetupScreen } from './screens/PolicySetupScreen';
import { AgentDemoScreen } from './screens/AgentDemoScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { C } from './theme';

const Tab = createBottomTabNavigator();
const BACKEND_URL = 'http://localhost:3001';

export default function App() {
  return (
    <SafeAreaProvider>
      <OwsProvider backendUrl={BACKEND_URL}>
        <NavigationContainer
          theme={{
            dark: false,
            colors: {
              primary: C.primary,
              background: C.bg,
              card: C.surface,
              text: C.textPrimary,
              border: C.border,
              notification: C.success,
            },
            fonts: {
              regular: { fontFamily: 'System', fontWeight: '400' },
              medium: { fontFamily: 'System', fontWeight: '500' },
              bold: { fontFamily: 'System', fontWeight: '700' },
              heavy: { fontFamily: 'System', fontWeight: '900' },
            },
          }}
        >
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: true,
              headerStyle: {
                backgroundColor: C.surface,
                shadowColor: C.shadow,
                elevation: 0,
              },
              headerTitleStyle: { color: C.textPrimary, fontWeight: '600', fontSize: 17 },
              headerShadowVisible: true,
              tabBarStyle: {
                backgroundColor: C.surface,
                borderTopColor: C.border,
                borderTopWidth: 1,
                height: 84,
                paddingBottom: 28,
                paddingTop: 8,
              },
              tabBarActiveTintColor: C.primary,
              tabBarInactiveTintColor: C.textMuted,
              tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
              tabBarIcon: ({ focused, color, size }) => {
                const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
                  Setup: focused ? 'wallet' : 'wallet-outline',
                  Dashboard: focused ? 'grid' : 'grid-outline',
                  Policies: focused ? 'shield-checkmark' : 'shield-checkmark-outline',
                  Agent: focused ? 'flash' : 'flash-outline',
                  History: focused ? 'receipt' : 'receipt-outline',
                };
                return <Ionicons name={icons[route.name] ?? 'ellipse-outline'} size={size - 2} color={color} />;
              },
            })}
          >
            <Tab.Screen name="Setup" component={OnboardingScreen} options={{ title: 'Setup' }} />
            <Tab.Screen name="Dashboard" component={DashboardScreen} />
            <Tab.Screen name="Policies" component={PolicySetupScreen} />
            <Tab.Screen name="Agent" component={AgentDemoScreen} options={{ title: 'Agent Demo' }} />
            <Tab.Screen name="History" component={HistoryScreen} />
          </Tab.Navigator>
        </NavigationContainer>
        <StatusBar style="dark" />
      </OwsProvider>
    </SafeAreaProvider>
  );
}
