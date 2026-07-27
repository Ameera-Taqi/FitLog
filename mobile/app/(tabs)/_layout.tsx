import { Tabs } from "expo-router";
import { Text } from "react-native";
import { theme } from "@/lib/theme";

function Icon({ emoji, color }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 20, opacity: color === theme.colors.brand ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brand,
        tabBarInactiveTintColor: theme.colors.ink400,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.ink100,
          height: 88,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Workouts", tabBarIcon: ({ color }) => <Icon emoji="📋" color={color} /> }}
      />
      <Tabs.Screen
        name="new"
        options={{ title: "Log", tabBarIcon: ({ color }) => <Icon emoji="➕" color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color }) => <Icon emoji="👤" color={color} /> }}
      />
    </Tabs>
  );
}
