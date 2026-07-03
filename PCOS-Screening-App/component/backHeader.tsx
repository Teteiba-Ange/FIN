import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

const TEAL = "#1f7a7a";

const BackHeader = ({ title }: { title: string }) => {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>

      <Text style={styles.headerTitle}>{title}</Text>

      <View style={{ width: 40 }} />
    </View>
  );
};

export default BackHeader;

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: { width: 40, height: 40, justifyContent: "center" },
  backIcon: { fontSize: 22, color: TEAL, fontWeight: "700" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1a1a1a" },
});