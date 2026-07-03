import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, SafeAreaView, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/authContext";

const TEAL = "#1f7a7a";
const TEAL_LIGHT = "#e6f4f4";

type ProfileForm = {
  fullName: string;
  email: string;
  age: string;
  weight: string;
  height: string;
  avgCycleLength: string;
  lastPeriod: string;
  cycleRegularity: "Regular" | "Irregular";
  medicalBackground: string;
};

const EditProfile = () => {
  const router = useRouter();
  const { user, updateProfile } = useAuth();

  const [form, setForm] = useState<ProfileForm>({
    fullName: user?.fullName || "",
    email: user?.email || "",
    age: user?.age?.toString() || "",
    weight: user?.weight?.toString() || "",
    height: user?.height?.toString() || "",
    avgCycleLength: "34",
    lastPeriod: "Not tracked",
    cycleRegularity: "Regular",
    medicalBackground: user?.fullName
      ? "No medical background provided"
      : "",
  });

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      fullName: user.fullName || "",
      email: user.email || "",
      age: user.age?.toString() || "",
      weight: user.weight?.toString() || "",
      height: user.height?.toString() || "",
    }));
  }, [user]);

  const [errors, setErrors] = useState<Partial<ProfileForm>>({});

  const update = (key: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const validate = () => {
    const newErrors: Partial<ProfileForm> = {};
    if (!form.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!form.email.includes("@")) newErrors.email = "Enter a valid email";
    if (!form.age || isNaN(Number(form.age))) newErrors.age = "Enter a valid age";
    if (!form.weight || isNaN(Number(form.weight))) newErrors.weight = "Enter a valid weight";
    if (!form.height || isNaN(Number(form.height))) newErrors.height = "Enter a valid height";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    try {
      await updateProfile({
        fullName: form.fullName,
        age: form.age,
        weight: form.weight,
        height: form.height,
      });
      Alert.alert("Profile Updated", "Your profile has been saved successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert("Save Failed", error.message || "Unable to save profile.");
    }
  };

  const Field = ({
    label,
    fieldKey,
    placeholder,
    keyboardType = "default",
    multiline = false,
  }: {
    label: string;
    fieldKey: keyof ProfileForm;
    placeholder: string;
    keyboardType?: any;
    multiline?: boolean;
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={form[fieldKey]}
        onChangeText={(v) => update(fieldKey, v)}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        placeholderTextColor="#aaa"
        editable={fieldKey !== "email"}
        style={[
          styles.input,
          multiline && styles.textArea,
          fieldKey === "email" && styles.disabledInput,
          !!errors[fieldKey] && styles.inputError,
        ]}
      />
      {!!errors[fieldKey] && (
        <Text style={styles.errorText}>{errors[fieldKey]}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT INFORMATION</Text>
          <View style={styles.card}>
            <Field label="Full Name" fieldKey="fullName" placeholder="Jane Doe" />
            <Field
              label="Email Address"
              fieldKey="email"
              placeholder="jane@example.com"
              keyboardType="email-address"
            />
          </View>
        </View>

        {/* Physical Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PHYSICAL METRICS</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Field label="Age (yrs)" fieldKey="age" placeholder="28" keyboardType="numeric" />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Field label="Weight (kg)" fieldKey="weight" placeholder="64" keyboardType="numeric" />
              </View>
            </View>
            <Field label="Height (cm)" fieldKey="height" placeholder="168" keyboardType="numeric" />
          </View>
        </View>

        {/* Menstrual History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MENSTRUAL HISTORY</Text>
          <View style={styles.card}>
            {/* Cycle Regularity Toggle */}
            <Text style={styles.label}>Cycle Regularity</Text>
            <View style={styles.toggleRow}>
              {(["Regular", "Irregular"] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.toggleOption,
                    form.cycleRegularity === option && styles.toggleOptionActive,
                  ]}
                  onPress={() => update("cycleRegularity", option)}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      form.cycleRegularity === option && styles.toggleTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Field
              label="Avg Cycle Length (days)"
              fieldKey="avgCycleLength"
              placeholder="34"
              keyboardType="numeric"
            />
            <Field
              label="Last Period Date"
              fieldKey="lastPeriod"
              placeholder="e.g. Oct 12, 2023"
            />
          </View>
        </View>

        {/* Medical Background */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MEDICAL BACKGROUND</Text>
          <View style={styles.card}>
            <Field
              label="Medical Notes"
              fieldKey="medicalBackground"
              placeholder="Describe any relevant medical history..."
              multiline
            />
          </View>
        </View>

        {/* Buttons */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5f7fa" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  backButton: { width: 40, height: 40, justifyContent: "center" },
  backIcon: { fontSize: 22, color: TEAL, fontWeight: "700" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1a1a1a" },
  container: { padding: 16 },
  section: { marginBottom: 6 },
  sectionTitle: {
    fontSize: 11, fontWeight: "700", color: "#9ca3af",
    letterSpacing: 0.8, marginBottom: 10, marginTop: 14,
  },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  fieldGroup: { marginBottom: 12 },
  label: { fontSize: 13, color: "#6b7280", marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10,
    padding: 12, fontSize: 14, color: "#1a1a1a", backgroundColor: "#fff",
  },
  disabledInput: {
    backgroundColor: "#f4f4f5",
    color: "#6b7280",
  },
  textArea: { height: 100, textAlignVertical: "top" },
  inputError: { borderColor: "#ef4444" },
  errorText: { fontSize: 12, color: "#ef4444", marginTop: 4 },
  row: { flexDirection: "row" },

  // Cycle toggle
  toggleRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  toggleOption: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: "#e5e7eb",
    alignItems: "center", backgroundColor: "#fff",
  },
  toggleOptionActive: { backgroundColor: TEAL_LIGHT, borderColor: TEAL },
  toggleText: { fontSize: 14, fontWeight: "600", color: "#6b7280" },
  toggleTextActive: { color: TEAL },

  // Buttons
  saveButton: {
    backgroundColor: TEAL, borderRadius: 12,
    paddingVertical: 15, alignItems: "center", marginTop: 24,
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancelButton: {
    borderRadius: 12, paddingVertical: 14,
    alignItems: "center", marginTop: 10,
    borderWidth: 1, borderColor: "#e5e7eb",
  },
  cancelButtonText: { color: "#6b7280", fontSize: 15, fontWeight: "600" },
});

export default EditProfile;