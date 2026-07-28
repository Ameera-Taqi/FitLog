import { useCallback, useMemo, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import { Workout, WorkoutSchedule, typeMeta } from "@/lib/types";

type ScheduleRow = WorkoutSchedule & { workouts: Workout | null };

export function CalendarPanel() {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [library, setLibrary] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: sch }, { data: lib }] = await Promise.all([
      supabase
        .from("workout_schedules")
        .select("*, workouts(*)")
        .gte("scheduled_date", start)
        .lte("scheduled_date", end)
        .order("scheduled_date", { ascending: true }),
      supabase.from("workouts").select("*").order("updated_at", { ascending: false }).limit(200),
    ]);
    setSchedules((sch as ScheduleRow[]) ?? []);
    setLibrary((lib as Workout[]) ?? []);
    setLoading(false);
  }, [start, end]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>();
    for (const s of schedules) {
      const list = map.get(s.scheduled_date) ?? [];
      list.push(s);
      map.set(s.scheduled_date, list);
    }
    return map;
  }, [schedules]);

  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const existingForDay = selected ? byDate.get(selected) ?? [] : [];
  const draftScheduled = draftIds
    .map((id) => library.find((w) => w.id === id))
    .filter((w): w is Workout => Boolean(w));
  const draftSet = new Set(draftIds);

  function openDay(dateStr: string) {
    setSelected(dateStr);
    setDraftIds((byDate.get(dateStr) ?? []).map((s) => s.workout_id));
  }

  function closeDay() {
    setSelected(null);
    setDraftIds([]);
  }

  function toggleDraft(workoutId: string) {
    setDraftIds((cur) =>
      cur.includes(workoutId) ? cur.filter((id) => id !== workoutId) : [...cur, workoutId],
    );
  }

  async function saveDay() {
    if (!selected) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setSaving(false);
      return;
    }

    const existingIds = new Set(existingForDay.map((s) => s.workout_id));
    const nextIds = new Set(draftIds);
    const toAdd = draftIds.filter((id) => !existingIds.has(id));
    const toRemove = existingForDay.filter((s) => !nextIds.has(s.workout_id));

    try {
      if (toRemove.length) {
        const { error } = await supabase.from("workout_schedules").delete().in("id", toRemove.map((s) => s.id));
        if (error) throw error;
      }
      if (toAdd.length) {
        const { error } = await supabase.from("workout_schedules").insert(
          toAdd.map((workout_id) => ({ user_id: uid, workout_id, scheduled_date: selected })),
        );
        if (error) throw error;
      }
      const { data: refreshed } = await supabase
        .from("workout_schedules")
        .select("*, workouts(*)")
        .eq("scheduled_date", selected);
      setSchedules((cur) => [
        ...cur.filter((s) => s.scheduled_date !== selected),
        ...((refreshed as ScheduleRow[]) ?? []),
      ]);
      closeDay();
    } catch (err: any) {
      Alert.alert("Couldn't save", err?.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={s.card}>
        <View style={s.monthRow}>
          <TouchableOpacity onPress={() => setCursor(new Date(year, month - 1, 1))} style={s.navBtn}>
            <Text style={s.navText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity onPress={() => setCursor(new Date(year, month + 1, 1))} style={s.navBtn}>
            <Text style={s.navText}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={s.weekHead}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <Text key={d} style={s.weekHeadText}>{d}</Text>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.brand} style={{ marginVertical: 40 }} />
        ) : (
          <View style={s.grid}>
            {cells.map((day, i) => {
              if (day == null) return <View key={`e-${i}`} style={s.dayCell} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const items = byDate.get(dateStr) ?? [];
              const isToday = dateStr === todayStr;
              const reviewId = items[0]?.workout_id;
              return (
                <View key={dateStr} style={s.dayCell}>
                  <TouchableOpacity
                    style={[s.dayBtn, isToday && s.dayToday]}
                    onPress={() => openDay(dateStr)}
                    activeOpacity={0.85}
                  >
                    {items.length > 0 && reviewId ? (
                      <TouchableOpacity
                        style={s.reviewLabelWrap}
                        onPress={() => router.push(`/workout/${reviewId}`)}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <Text style={[s.reviewLabel, isToday && s.reviewLabelToday]} numberOfLines={1}>
                          Review
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    <Text style={[s.dayNum, isToday && s.dayNumToday]}>{day}</Text>
                    <View style={s.dots}>
                      {items.slice(0, 3).map((x) => (
                        <View key={x.id} style={s.dot} />
                      ))}
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <Modal visible={Boolean(selected)} animationType="slide" transparent onRequestClose={closeDay}>
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={closeDay}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>
              {selected
                ? new Date(selected + "T12:00:00").toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })
                : ""}
            </Text>

            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ paddingBottom: 12 }}>
              <Text style={s.section}>Scheduled</Text>
              {draftScheduled.length === 0 ? (
                <Text style={s.muted}>Nothing scheduled yet.</Text>
              ) : (
                draftScheduled.map((w) => (
                  <View key={w.id} style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle}>{w.name}</Text>
                      <Text style={s.rowMeta}>{typeMeta(w.workout_type).label}</Text>
                    </View>
                    <TouchableOpacity onPress={() => router.push(`/workout/${w.id}`)}>
                      <Text style={s.assign}>Review</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => toggleDraft(w.id)}>
                      <Text style={s.remove}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <Text style={[s.section, { marginTop: 18 }]}>Your workouts</Text>
              {library.length === 0 ? (
                <Text style={s.muted}>Create a workout first, then assign it here.</Text>
              ) : library.filter((w) => !draftSet.has(w.id)).length === 0 ? (
                <Text style={s.muted}>All workouts are scheduled for this day.</Text>
              ) : (
                library
                  .filter((w) => !draftSet.has(w.id))
                  .map((w) => (
                    <TouchableOpacity
                      key={w.id}
                      style={s.row}
                      onPress={() => toggleDraft(w.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowTitle}>{w.name}</Text>
                        <Text style={s.rowMeta}>{typeMeta(w.workout_type).label}</Text>
                      </View>
                      <Text style={s.assign}>Assign</Text>
                    </TouchableOpacity>
                  ))
              )}
            </ScrollView>

            <View style={s.footer}>
              <TouchableOpacity style={s.saveBtn} onPress={saveDay} disabled={saving}>
                <Text style={s.saveText}>{saving ? "Saving…" : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 12, marginTop: 8, backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg, padding: 14, ...theme.shadow,
  },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  navBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  navText: { fontSize: 22, fontWeight: "700", color: theme.colors.ink700 },
  monthLabel: { fontSize: 17, fontWeight: "800", color: theme.colors.ink900 },
  weekHead: { flexDirection: "row" },
  weekHeadText: {
    flex: 1, textAlign: "center", fontSize: 10, fontWeight: "700",
    color: theme.colors.ink400, textTransform: "uppercase",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  dayCell: { width: "14.2857%", aspectRatio: 1, padding: 2 },
  dayBtn: {
    flex: 1, borderRadius: 14, backgroundColor: theme.colors.surface2,
    alignItems: "center", justifyContent: "center", position: "relative",
  },
  dayToday: { backgroundColor: "rgba(255,107,78,0.18)", borderWidth: 1, borderColor: "rgba(255,107,78,0.45)" },
  dayNum: { fontWeight: "700", color: theme.colors.ink800, fontSize: 15 },
  dayNumToday: { color: theme.colors.brand },
  reviewLabelWrap: {
    position: "absolute",
    top: 8,
    left: 2,
    right: 2,
    zIndex: 2,
  },
  reviewLabel: {
    textAlign: "center",
    fontSize: 8,
    fontWeight: "700",
    color: theme.colors.brand,
  },
  reviewLabelToday: {
    color: theme.colors.brand,
  },
  dots: { flexDirection: "row", gap: 3, position: "absolute", bottom: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: theme.colors.brand },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28, maxHeight: "80%",
  },
  sheetHandle: {
    alignSelf: "center", width: 40, height: 4, borderRadius: 2,
    backgroundColor: theme.colors.ink200, marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.ink900, marginBottom: 12 },
  section: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", color: theme.colors.ink400, marginBottom: 8 },
  muted: { color: theme.colors.ink500, fontSize: 14, marginBottom: 8 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: theme.colors.surface2, borderRadius: theme.radius.md,
    padding: 12, marginBottom: 8,
  },
  rowTitle: { fontWeight: "700", color: theme.colors.ink900, fontSize: 15 },
  rowMeta: { color: theme.colors.ink500, fontSize: 12, marginTop: 2 },
  assign: { color: theme.colors.brand, fontWeight: "800", fontSize: 12 },
  remove: { color: "#f87171", fontWeight: "700", fontSize: 12 },
  footer: { paddingTop: 8 },
  saveBtn: {
    backgroundColor: theme.colors.brand, borderRadius: theme.radius.full,
    paddingVertical: 14, alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
