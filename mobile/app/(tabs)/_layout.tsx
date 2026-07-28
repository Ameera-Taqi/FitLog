import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { theme } from "@/lib/theme";

function Icon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? "rgba(255,107,78,0.18)" : "transparent",
      }}
    >
      <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>
    </View>
  );
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
          borderTopColor: theme.colors.ink200,
          height: 88,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ focused }) => <Icon emoji="🏠" focused={focused} /> }}
      />
      <Tabs.Screen
        name="workouts"
        options={{ title: "Workouts", tabBarIcon: ({ focused }) => <Icon emoji="🏋️" focused={focused} /> }}
      />
      <Tabs.Screen
        name="new"
        options={{ title: "Log", tabBarIcon: ({ focused }) => <Icon emoji="＋" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ focused }) => <Icon emoji="👤" focused={focused} /> }}
      />
    </Tabs>
  );
}
