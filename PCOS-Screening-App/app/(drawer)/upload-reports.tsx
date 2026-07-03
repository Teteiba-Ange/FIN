import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, SafeAreaView, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import apiService from "../../context/apiService";

const TEAL = "#1f7a7a";
const TEAL_LIGHT = "#e6f4f4";

type UploadedFile = {
  id: string;
  uri: string;
  name: string;
  size: string;
  type: string;
  status: "uploading" | "done" | "uploaded" | "error";
  serverId?: string;
  uploadedAt?: string;
};

const REPORT_TYPES = [
  { id: "hormone", label: "Hormone Panel", icon: "🧬", description: "FSH, LH, Estrogen, Progesterone" },
  { id: "glucose", label: "Glucose / Insulin", icon: "🩸", description: "Fasting glucose, HbA1c, Insulin levels" },
  { id: "thyroid", label: "Thyroid Panel", icon: "🦋", description: "TSH, T3, T4" },
  { id: "ultrasound", label: "Ultrasound Report", icon: "🔬", description: "Ovarian scan results" },
  { id: "other", label: "Other Lab Results", icon: "📄", description: "Any other clinical results" },
];

const UploadReports = () => {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handlePickDocument = async () => {
    if (!selectedType) {
      Alert.alert("Select Report Type", "Please select a report type before uploading.");
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        multiple: false,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      const newFile: UploadedFile = {
        id: Date.now().toString(),
        uri: asset.uri || "",
        name: asset.name || `report-${Date.now()}`,
        size: formatBytes(asset.size ?? 0),
        type: selectedType,
        status: "uploading",
      };

      setUploadedFiles((prev) => [...prev, newFile]);

      // Simulate upload delay
      setTimeout(() => {
        setUploadedFiles((prev) =>
          prev.map((f) => (f.id === newFile.id ? { ...f, status: "done" } : f))
        );
      }, 1500);
    } catch {
      Alert.alert("Error", "Could not pick the document. Please try again.");
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmit = async () => {
    if (uploadedFiles.length === 0) {
      Alert.alert("No Files", "Please upload at least one report before submitting.");
      return;
    }

    const stillUploading = uploadedFiles.some((f) => f.status === "uploading");
    if (stillUploading) {
      Alert.alert("Please Wait", "Some files are still uploading.");
      return;
    }

    setIsSubmitting(true);

    try {
      const results = await Promise.all(
        uploadedFiles.map(async (file) => {
          if (file.status !== "done" || !file.uri) {
            return { ...file, status: "error" };
          }

          const response = await apiService.uploadReport(file.uri, file.type);
          return {
            ...file,
            status: "uploaded",
            serverId: response.reportId,
            uploadedAt: response.uploadedAt,
          };
        })
      );

      setUploadedFiles(results);

      Alert.alert(
        "Reports Submitted! 🎉",
        "Your lab reports have been uploaded. Your risk assessment will be updated shortly.",
        [{ text: "Done", onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error("Upload error:", error);
      Alert.alert("Upload failed", error?.message || "Unable to submit reports. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Reports</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoIcon}>💡</Text>
          <Text style={styles.infoText}>
            Upload your latest lab results for a more accurate PCOS risk score and personalized wellness plan.
          </Text>
        </View>

        {/* Step 1 — Select Report Type */}
        <Text style={styles.stepLabel}>STEP 1 — SELECT REPORT TYPE</Text>
        <View style={styles.card}>
          {REPORT_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.reportTypeRow,
                selectedType === type.id && styles.reportTypeRowActive,
              ]}
              onPress={() => setSelectedType(type.id)}
            >
              <Text style={styles.reportTypeIcon}>{type.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.reportTypeLabel,
                    selectedType === type.id && styles.reportTypeLabelActive,
                  ]}
                >
                  {type.label}
                </Text>
                <Text style={styles.reportTypeDesc}>{type.description}</Text>
              </View>
              <View
                style={[
                  styles.radioOuter,
                  selectedType === type.id && styles.radioOuterActive,
                ]}
              >
                {selectedType === type.id && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Step 2 — Upload File */}
        <Text style={styles.stepLabel}>STEP 2 — UPLOAD FILE</Text>
        <TouchableOpacity
          style={[
            styles.dropZone,
            selectedType && styles.dropZoneActive,
          ]}
          onPress={handlePickDocument}
          activeOpacity={0.75}
        >
          <Text style={styles.dropZoneIcon}>📂</Text>
          <Text style={styles.dropZoneTitle}>
            {selectedType ? "Tap to Select File" : "Select a report type first"}
          </Text>
          <Text style={styles.dropZoneSubtitle}>PDF, JPG, or PNG • Max 10 MB</Text>
        </TouchableOpacity>

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <>
            <Text style={styles.stepLabel}>UPLOADED FILES</Text>
            <View style={styles.card}>
              {uploadedFiles.map((file) => (
                <View key={file.id} style={styles.fileRow}>
                  <Text style={styles.fileIcon}>
                    {file.status === "done" ? "✅" : file.status === "error" ? "❌" : "⏳"}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text style={styles.fileMeta}>
                      {REPORT_TYPES.find((r) => r.id === file.type)?.label} • {file.size}
                    </Text>
                    {file.status === "uploading" && (
                      <View style={styles.progressBar}>
                        <View style={styles.progressFill} />
                      </View>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => removeFile(file.id)}>
                    <Text style={styles.removeIcon}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Accepted Formats Note */}
        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>📋 Accepted Formats</Text>
          <Text style={styles.noteText}>• PDF lab reports from your healthcare provider</Text>
          <Text style={styles.noteText}>• JPEG or PNG scans / photos of paper reports</Text>
          <Text style={styles.noteText}>• Maximum file size: 10 MB per file</Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (uploadedFiles.length === 0 || isSubmitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting || uploadedFiles.length === 0}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              Submit Reports ({uploadedFiles.filter((f) => f.status === "done").length})
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
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

  // Info banner
  infoBanner: {
    flexDirection: "row", gap: 10, backgroundColor: TEAL_LIGHT,
    borderRadius: 12, padding: 14, marginBottom: 20, alignItems: "flex-start",
  },
  infoIcon: { fontSize: 18 },
  infoText: { flex: 1, fontSize: 13, color: "#374151", lineHeight: 19 },

  // Step labels
  stepLabel: {
    fontSize: 11, fontWeight: "700", color: "#9ca3af",
    letterSpacing: 0.8, marginBottom: 10, marginTop: 6,
  },

  // Card
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 4,
    marginBottom: 20, shadowColor: "#000",
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },

  // Report type rows
  reportTypeRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 12, marginBottom: 2,
  },
  reportTypeRowActive: { backgroundColor: TEAL_LIGHT },
  reportTypeIcon: { fontSize: 22 },
  reportTypeLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  reportTypeLabelActive: { color: TEAL },
  reportTypeDesc: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: "#d1d5db",
    justifyContent: "center", alignItems: "center",
  },
  radioOuterActive: { borderColor: TEAL },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: TEAL },

  // Drop zone
  dropZone: {
    borderWidth: 2, borderColor: "#e5e7eb", borderStyle: "dashed",
    borderRadius: 14, padding: 30, alignItems: "center",
    marginBottom: 20, backgroundColor: "#fafafa",
  },
  dropZoneActive: { borderColor: TEAL, backgroundColor: TEAL_LIGHT },
  dropZoneIcon: { fontSize: 36, marginBottom: 10 },
  dropZoneTitle: { fontSize: 15, fontWeight: "700", color: "#374151", marginBottom: 4 },
  dropZoneSubtitle: { fontSize: 12, color: "#9ca3af" },

  // File rows
  fileRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  fileIcon: { fontSize: 20 },
  fileName: { fontSize: 13, fontWeight: "600", color: "#1a1a1a" },
  fileMeta: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  progressBar: {
    height: 4, backgroundColor: "#e5e7eb", borderRadius: 2, marginTop: 6,
  },
  progressFill: {
    width: "60%", height: 4, backgroundColor: TEAL, borderRadius: 2,
  },
  removeIcon: { fontSize: 16, color: "#9ca3af", padding: 4 },

  // Note box
  noteBox: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    marginBottom: 24, borderLeftWidth: 4, borderLeftColor: TEAL,
  },
  noteTitle: { fontSize: 13, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  noteText: { fontSize: 12, color: "#6b7280", lineHeight: 20 },

  // Buttons
  submitButton: {
    backgroundColor: TEAL, borderRadius: 12,
    paddingVertical: 15, alignItems: "center",
  },
  submitButtonDisabled: { backgroundColor: "#a7c4c4" },
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancelButton: {
    borderRadius: 12, paddingVertical: 14, alignItems: "center",
    marginTop: 10, borderWidth: 1, borderColor: "#e5e7eb",
  },
  cancelButtonText: { color: "#6b7280", fontSize: 15, fontWeight: "600" },
});

export default UploadReports;