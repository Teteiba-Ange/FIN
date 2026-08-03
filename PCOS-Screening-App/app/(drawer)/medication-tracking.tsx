// app/(drawer)/medication-tracker.tsx
// FR-13: Medication and Supplement Tracking
// Users can log medications/supplements and the system records adherence over time.

import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, Alert, Modal,
  FlatList, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TEAL      = "#1f7a7a";
const TEAL_LIGHT= "#e6f4f4";
const TEAL_DARK = "#155555";
const GREEN     = "#22c55e";
const ORANGE    = "#f59e0b";
const RED       = "#ef4444";
const PINK      = "#ec4899";

// ─── Types ────────────────────────────────────────────────────────────────────
type FrequencyType = "Daily" | "Twice Daily" | "Weekly" | "As needed";
type CategoryType  = "Medication" | "Supplement" | "Hormonal" | "Vitamin";

interface Medication {
  id:         string;
  name:       string;
  dose:       string;
  frequency:  FrequencyType;
  category:   CategoryType;
  startDate:  string;
  notes:      string;
  active:     boolean;
  color:      string;
}

interface AdherenceLog {
  id:           string;
  medicationId: string;
  date:         string;          // ISO date string YYYY-MM-DD
  taken:        boolean;
  takenAt?:     string;          // time taken
}

const STORAGE_KEYS = {
  MEDICATIONS: "pmos_medications",
  ADHERENCE:   "pmos_adherence_logs",
};

const CATEGORY_COLORS: Record<CategoryType, string> = {
  Medication: TEAL,
  Supplement: GREEN,
  Hormonal:   PINK,
  Vitamin:    ORANGE,
};

const CATEGORY_ICONS: Record<CategoryType, string> = {
  Medication: "💊",
  Supplement: "🌿",
  Hormonal:   "🔬",
  Vitamin:    "🍊",
};

const FREQUENCIES: FrequencyType[]  = ["Daily", "Twice Daily", "Weekly", "As needed"];
const CATEGORIES:  CategoryType[]   = ["Medication", "Supplement", "Hormonal", "Vitamin"];

const PRESET_MEDICATIONS = [
  { name: "Metformin",        dose: "500mg",  category: "Medication" as CategoryType, frequency: "Twice Daily" as FrequencyType },
  { name: "Inositol",         dose: "2000mg", category: "Supplement" as CategoryType, frequency: "Daily" as FrequencyType },
  { name: "Vitamin D3",       dose: "2000IU", category: "Vitamin"    as CategoryType, frequency: "Daily" as FrequencyType },
  { name: "Spearmint Tea",    dose: "1 cup",  category: "Supplement" as CategoryType, frequency: "Twice Daily" as FrequencyType },
  { name: "Birth Control Pill", dose: "1 pill", category: "Hormonal" as CategoryType, frequency: "Daily" as FrequencyType },
  { name: "Omega-3",          dose: "1000mg", category: "Vitamin"    as CategoryType, frequency: "Daily" as FrequencyType },
];

// ─── Storage helpers ──────────────────────────────────────────────────────────
const loadMedications   = async (): Promise<Medication[]>   =>
  JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.MEDICATIONS)) ?? "[]");

const saveMedications   = async (data: Medication[])        =>
  AsyncStorage.setItem(STORAGE_KEYS.MEDICATIONS, JSON.stringify(data));

const loadAdherence     = async (): Promise<AdherenceLog[]> =>
  JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.ADHERENCE)) ?? "[]");

const saveAdherence     = async (data: AdherenceLog[])      =>
  AsyncStorage.setItem(STORAGE_KEYS.ADHERENCE, JSON.stringify(data));

const todayStr = () => new Date().toISOString().split("T")[0];

// ─── Add Medication Modal ─────────────────────────────────────────────────────
const AddMedicationModal = ({
  visible, onClose, onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave:  (med: Omit<Medication, "id" | "active" | "color">) => void;
}) => {
  const [name,      setName]      = useState("");
  const [dose,      setDose]      = useState("");
  const [frequency, setFrequency] = useState<FrequencyType>("Daily");
  const [category,  setCategory]  = useState<CategoryType>("Supplement");
  const [notes,     setNotes]     = useState("");

  const reset = () => {
    setName(""); setDose(""); setFrequency("Daily");
    setCategory("Supplement"); setNotes("");
  };

  const handleSave = () => {
    if (!name.trim() || !dose.trim()) {
      Alert.alert("Required", "Please enter a medication name and dose.");
      return;
    }
    onSave({ name: name.trim(), dose: dose.trim(), frequency, category,
             startDate: todayStr(), notes: notes.trim() });
    reset();
    onClose();
  };

  const applyPreset = (p: typeof PRESET_MEDICATIONS[0]) => {
    setName(p.name); setDose(p.dose);
    setCategory(p.category); setFrequency(p.frequency);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={modal.safe}>
        <View style={modal.header}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Text style={modal.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={modal.title}>Add Medication</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={modal.save}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={modal.body}>
          {/* Quick presets */}
          <Text style={modal.sectionLabel}>QUICK ADD</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {PRESET_MEDICATIONS.map((p) => (
              <TouchableOpacity key={p.name} style={modal.preset} onPress={() => applyPreset(p)}>
                <Text style={modal.presetIcon}>{CATEGORY_ICONS[p.category]}</Text>
                <Text style={modal.presetName}>{p.name}</Text>
                <Text style={modal.presetDose}>{p.dose}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={modal.sectionLabel}>DETAILS</Text>

          <Text style={modal.label}>Medication / Supplement Name *</Text>
          <TextInput
            style={modal.input} value={name} onChangeText={setName}
            placeholder="e.g. Metformin" placeholderTextColor="#9ca3af"
          />

          <Text style={modal.label}>Dose *</Text>
          <TextInput
            style={modal.input} value={dose} onChangeText={setDose}
            placeholder="e.g. 500mg or 1 tablet" placeholderTextColor="#9ca3af"
          />

          <Text style={modal.label}>Category</Text>
          <View style={modal.chipRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[modal.chip, category === c && { backgroundColor: CATEGORY_COLORS[c], borderColor: CATEGORY_COLORS[c] }]}
                onPress={() => setCategory(c)}
              >
                <Text style={[modal.chipText, category === c && { color: "#fff" }]}>
                  {CATEGORY_ICONS[c]} {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={modal.label}>Frequency</Text>
          <View style={modal.chipRow}>
            {FREQUENCIES.map((f) => (
              <TouchableOpacity
                key={f}
                style={[modal.chip, frequency === f && { backgroundColor: TEAL, borderColor: TEAL }]}
                onPress={() => setFrequency(f)}
              >
                <Text style={[modal.chipText, frequency === f && { color: "#fff" }]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={modal.label}>Notes (optional)</Text>
          <TextInput
            style={[modal.input, { height: 80, textAlignVertical: "top" }]}
            value={notes} onChangeText={setNotes} multiline
            placeholder="e.g. Take with food" placeholderTextColor="#9ca3af"
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const modal = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#f5f7fa" },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                 padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  title:       { fontSize: 16, fontWeight: "700", color: "#1a1a1a" },
  cancel:      { fontSize: 15, color: "#6b7280" },
  save:        { fontSize: 15, color: TEAL, fontWeight: "700" },
  body:        { padding: 16 },
  sectionLabel:{ fontSize: 11, fontWeight: "700", color: "#9ca3af", letterSpacing: 0.8, marginBottom: 10 },
  label:       { fontSize: 13, color: "#6b7280", marginBottom: 6, marginTop: 14 },
  input:       { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb",
                 borderRadius: 10, padding: 12, fontSize: 14, color: "#1a1a1a" },
  chipRow:     { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                 borderWidth: 1.5, borderColor: "#e5e7eb", backgroundColor: "#fff" },
  chipText:    { fontSize: 13, color: "#374151", fontWeight: "600" },
  preset:      { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginRight: 10,
                 alignItems: "center", width: 100, borderWidth: 1, borderColor: "#e5e7eb" },
  presetIcon:  { fontSize: 22, marginBottom: 4 },
  presetName:  { fontSize: 11, fontWeight: "700", color: "#1a1a1a", textAlign: "center" },
  presetDose:  { fontSize: 10, color: "#9ca3af", marginTop: 2 },
});

// ─── Adherence Ring ───────────────────────────────────────────────────────────
const AdherenceRing = ({ pct }: { pct: number }) => {
  const color = pct >= 80 ? GREEN : pct >= 50 ? ORANGE : RED;
  return (
    <View style={{ alignItems: "center" }}>
      <View style={[ring.outer, { borderColor: color }]}>
        <Text style={[ring.pct, { color }]}>{pct}%</Text>
      </View>
      <Text style={ring.label}>7-day adherence</Text>
    </View>
  );
};
const ring = StyleSheet.create({
  outer: { width: 64, height: 64, borderRadius: 32, borderWidth: 4,
           justifyContent: "center", alignItems: "center" },
  pct:   { fontSize: 16, fontWeight: "800" },
  label: { fontSize: 10, color: "#9ca3af", marginTop: 4 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MedicationTrackerScreen() {
  const router = useRouter();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [adherence,   setAdherence]   = useState<AdherenceLog[]>([]);
  const [showModal,   setShowModal]   = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState<"today" | "history">("today");

  useEffect(() => {
    (async () => {
      const [meds, logs] = await Promise.all([loadMedications(), loadAdherence()]);
      setMedications(meds);
      setAdherence(logs);
      setLoading(false);
    })();
  }, []);

  // ── Add medication ──────────────────────────────────────────────────────────
  const handleAdd = async (data: Omit<Medication, "id" | "active" | "color">) => {
    const newMed: Medication = {
      ...data,
      id:     Date.now().toString(),
      active: true,
      color:  CATEGORY_COLORS[data.category],
    };
    const updated = [newMed, ...medications];
    setMedications(updated);
    await saveMedications(updated);
  };

  // ── Mark taken / untaken ────────────────────────────────────────────────────
  const handleToggleTaken = async (medId: string) => {
    const today   = todayStr();
    const existing = adherence.find((l) => l.medicationId === medId && l.date === today);
    let updated: AdherenceLog[];

    if (existing) {
      // Toggle off
      updated = adherence.filter((l) => !(l.medicationId === medId && l.date === today));
    } else {
      // Mark taken
      const log: AdherenceLog = {
        id:           Date.now().toString(),
        medicationId: medId,
        date:         today,
        taken:        true,
        takenAt:      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      updated = [...adherence, log];
    }
    setAdherence(updated);
    await saveAdherence(updated);
  };

  // ── Delete medication ───────────────────────────────────────────────────────
  const handleDelete = (medId: string) => {
    Alert.alert("Remove Medication", "Remove this from your tracker?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          const updated = medications.filter((m) => m.id !== medId);
          setMedications(updated);
          await saveMedications(updated);
        },
      },
    ]);
  };

  // ── Adherence % for a medication (last 7 days) ──────────────────────────────
  const getAdherencePct = (medId: string): number => {
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i);
      return d.toISOString().split("T")[0];
    });
    const taken = last7.filter((d) =>
      adherence.some((l) => l.medicationId === medId && l.date === d && l.taken)
    ).length;
    return Math.round((taken / 7) * 100);
  };

  const today      = todayStr();
  const activeMeds = medications.filter((m) => m.active);
  const takenToday = (medId: string) =>
    adherence.some((l) => l.medicationId === medId && l.date === today && l.taken);

  const totalToday = activeMeds.length;
  const doneToday  = activeMeds.filter((m) => takenToday(m.id)).length;

  // ── Last 7 days history ─────────────────────────────────────────────────────
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return d.toISOString().split("T")[0];
  }).reverse();

  if (loading) {
    return (
      <SafeAreaView style={s.centered}>
        <ActivityIndicator size="large" color={TEAL} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Medication Tracker</Text>
          <Text style={s.headerSub}>FR-13 · Adherence monitoring</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowModal(true)}>
          <Text style={s.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Progress banner */}
      <View style={s.progressBanner}>
        <View style={{ flex: 1 }}>
          <Text style={s.progressTitle}>
            {doneToday === totalToday && totalToday > 0
              ? "All done for today! 🎉"
              : `${doneToday} of ${totalToday} taken today`}
          </Text>
          <Text style={s.progressSub}>
            {totalToday === 0 ? "Add your first medication below" : "Tap a card to mark as taken"}
          </Text>
        </View>
        <View style={s.progressCircle}>
          <Text style={s.progressPct}>
            {totalToday === 0 ? "—" : `${Math.round((doneToday / totalToday) * 100)}%`}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(["today", "history"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {tab === "today" ? "Today" : "7-Day History"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {activeTab === "today" ? (
          <>
            {activeMeds.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyIcon}>💊</Text>
                <Text style={s.emptyTitle}>No medications yet</Text>
                <Text style={s.emptySub}>
                  Add your medications and supplements to start tracking daily adherence
                </Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => setShowModal(true)}>
                  <Text style={s.emptyBtnText}>Add First Medication</Text>
                </TouchableOpacity>
              </View>
            ) : (
              activeMeds.map((med) => {
                const taken = takenToday(med.id);
                const pct   = getAdherencePct(med.id);
                return (
                  <TouchableOpacity
                    key={med.id}
                    style={[s.medCard, taken && s.medCardTaken]}
                    onPress={() => handleToggleTaken(med.id)}
                    onLongPress={() => handleDelete(med.id)}
                  >
                    <View style={[s.medColorBar, { backgroundColor: med.color }]} />
                    <View style={{ flex: 1, paddingLeft: 14 }}>
                      <View style={s.medTopRow}>
                        <Text style={s.medIcon}>{CATEGORY_ICONS[med.category]}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={s.medName}>{med.name}</Text>
                          <Text style={s.medDose}>{med.dose} · {med.frequency}</Text>
                        </View>
                        <AdherenceRing pct={pct} />
                      </View>
                      {med.notes ? <Text style={s.medNotes}>{med.notes}</Text> : null}
                      <View style={s.medFooter}>
                        <View style={[s.takenBadge, { backgroundColor: taken ? GREEN + "22" : "#f3f4f6" }]}>
                          <Text style={[s.takenBadgeText, { color: taken ? GREEN : "#9ca3af" }]}>
                            {taken ? "✓ Taken today" : "Not taken yet"}
                          </Text>
                        </View>
                        <Text style={s.holdHint}>Hold to remove</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        ) : (
          /* 7-day history grid */
          <>
            <Text style={s.sectionLabel}>ADHERENCE OVER LAST 7 DAYS</Text>
            {activeMeds.length === 0 ? (
              <Text style={{ color: "#9ca3af", textAlign: "center", marginTop: 20 }}>
                No medications to show
              </Text>
            ) : (
              <View style={s.historyCard}>
                {/* Day headers */}
                <View style={s.historyHeaderRow}>
                  <Text style={[s.historyCell, s.historyMedName]} />
                  {last7Days.map((d) => (
                    <Text key={d} style={s.historyDayLabel}>
                      {new Date(d).toLocaleDateString("en", { weekday: "narrow" })}
                    </Text>
                  ))}
                </View>

                {activeMeds.map((med) => (
                  <View key={med.id} style={s.historyRow}>
                    <Text style={s.historyMedName} numberOfLines={1}>{med.name}</Text>
                    {last7Days.map((d) => {
                      const wasTaken = adherence.some(
                        (l) => l.medicationId === med.id && l.date === d && l.taken
                      );
                      return (
                        <View
                          key={d}
                          style={[
                            s.historyDot,
                            { backgroundColor: wasTaken ? GREEN : d === today ? "#e5e7eb" : "#f9fafb" },
                          ]}
                        >
                          {wasTaken && <Text style={{ fontSize: 10 }}>✓</Text>}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}

            {/* Overall adherence summary */}
            <Text style={[s.sectionLabel, { marginTop: 20 }]}>OVERALL ADHERENCE</Text>
            {activeMeds.map((med) => {
              const pct = getAdherencePct(med.id);
              return (
                <View key={med.id} style={s.adherenceSummaryRow}>
                  <Text style={s.adherenceMedName}>
                    {CATEGORY_ICONS[med.category]} {med.name}
                  </Text>
                  <View style={s.adherenceBarBg}>
                    <View style={[s.adherenceBarFill, {
                      width: `${pct}%` as any,
                      backgroundColor: pct >= 80 ? GREEN : pct >= 50 ? ORANGE : RED,
                    }]} />
                  </View>
                  <Text style={[s.adherencePct, {
                    color: pct >= 80 ? GREEN : pct >= 50 ? ORANGE : RED
                  }]}>{pct}%</Text>
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <AddMedicationModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleAdd}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5f7fa" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: TEAL_DARK,
  },
  backBtn:     { width: 36, justifyContent: "center" },
  backIcon:    { fontSize: 22, color: "#fff", fontWeight: "700" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },
  headerSub:   { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 },
  addBtn:      { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 14,
                 paddingVertical: 7, borderRadius: 8, borderWidth: 1,
                 borderColor: "rgba(255,255,255,0.3)" },
  addBtnText:  { color: "#fff", fontWeight: "700", fontSize: 13 },

  progressBanner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: TEAL, paddingHorizontal: 20, paddingVertical: 16,
  },
  progressTitle: { fontSize: 16, fontWeight: "800", color: "#fff" },
  progressSub:   { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  progressCircle:{ width: 56, height: 56, borderRadius: 28,
                   backgroundColor: "rgba(255,255,255,0.2)",
                   justifyContent: "center", alignItems: "center" },
  progressPct:   { fontSize: 16, fontWeight: "900", color: "#fff" },

  tabRow:        { flexDirection: "row", backgroundColor: "#fff",
                   borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tab:           { flex: 1, paddingVertical: 13, alignItems: "center" },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: TEAL },
  tabText:       { fontSize: 14, color: "#9ca3af", fontWeight: "600" },
  tabTextActive: { color: TEAL },

  container:  { padding: 16 },
  sectionLabel:{ fontSize: 11, fontWeight: "700", color: "#9ca3af",
                letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },

  medCard: {
    flexDirection: "row", backgroundColor: "#fff", borderRadius: 16,
    marginBottom: 12, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  medCardTaken:  { opacity: 0.75 },
  medColorBar:   { width: 6 },
  medTopRow:     { flexDirection: "row", alignItems: "flex-start",
                   paddingTop: 14, paddingRight: 14, paddingBottom: 6 },
  medIcon:       { fontSize: 24, marginRight: 10, marginTop: 2 },
  medName:       { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  medDose:       { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  medNotes:      { fontSize: 12, color: "#6b7280", fontStyle: "italic",
                   paddingBottom: 8, paddingRight: 14 },
  medFooter:     { flexDirection: "row", justifyContent: "space-between",
                   alignItems: "center", paddingBottom: 12, paddingRight: 14 },
  takenBadge:    { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  takenBadgeText:{ fontSize: 12, fontWeight: "700" },
  holdHint:      { fontSize: 10, color: "#d1d5db" },

  emptyBox:    { alignItems: "center", paddingVertical: 60 },
  emptyIcon:   { fontSize: 52, marginBottom: 16 },
  emptyTitle:  { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  emptySub:    { fontSize: 14, color: "#9ca3af", textAlign: "center",
                 paddingHorizontal: 30, marginBottom: 24, lineHeight: 21 },
  emptyBtn:    { backgroundColor: TEAL, paddingHorizontal: 28,
                 paddingVertical: 13, borderRadius: 12 },
  emptyBtnText:{ color: "#fff", fontWeight: "700", fontSize: 15 },

  historyCard:      { backgroundColor: "#fff", borderRadius: 16, padding: 16,
                      shadowColor: "#000", shadowOpacity: 0.04, elevation: 1 },
  historyHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  historyRow:       { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  historyCell:      { flex: 1 },
  historyMedName:   { flex: 1, fontSize: 12, fontWeight: "600", color: "#374151" },
  historyDayLabel:  { width: 28, textAlign: "center", fontSize: 11,
                      color: "#9ca3af", fontWeight: "700" },
  historyDot:       { width: 28, height: 28, borderRadius: 14,
                      justifyContent: "center", alignItems: "center" },

  adherenceSummaryRow:{ flexDirection: "row", alignItems: "center",
                        marginBottom: 10, gap: 10 },
  adherenceMedName:   { fontSize: 13, fontWeight: "600", color: "#374151", width: 130 },
  adherenceBarBg:     { flex: 1, height: 8, backgroundColor: "#f3f4f6",
                        borderRadius: 4, overflow: "hidden" },
  adherenceBarFill:   { height: 8, borderRadius: 4 },
  adherencePct:       { fontSize: 12, fontWeight: "700", width: 36, textAlign: "right" },
});