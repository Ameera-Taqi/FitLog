import { Tabs } from "expo-router";
import { View } from "react-native";
import type { ReactElement } from "react";
import { theme } from "@/lib/theme";
import { DumbbellIcon, HomeIcon, PlusIcon, UserIcon, type IconProps } from "@/components/icons";

function TabIcon({ Glyph, focused }: { Glyph: (p: IconProps) => ReactElement; focused: boolean }) {
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
      <Glyph size={20} color={focused ? theme.colors.brand : theme.colors.ink400} strokeWidth={2} />
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
        options={{ title: "Dashboard", tabBarIcon: ({ focused }) => <TabIcon Glyph={HomeIcon} focused={focused} /> }}
      />
      <Tabs.Screen
        name="workouts"
        options={{ title: "Workouts", tabBarIcon: ({ focused }) => <TabIcon Glyph={DumbbellIcon} focused={focused} /> }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="new"
        options={{ title: "Log", tabBarIcon: ({ focused }) => <TabIcon Glyph={PlusIcon} focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ focused }) => <TabIcon Glyph={UserIcon} focused={focused} /> }}
      />
    </Tabs>
  );
}
