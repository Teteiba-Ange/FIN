import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

const TEAL = "#1f7a7a";

interface Props {
  emoji: string;
  title: string;
  description: string;
  inhale: number;
  hold: number;
  exhale: number;
  onPress: () => void;
}

export default function ExerciseCard({
  emoji,
  title,
  description,
  inhale,
  hold,
  exhale,
  onPress,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.emoji}>{emoji}</Text>

      <Text style={styles.title}>{title}</Text>

      <Text style={styles.description}>
        {description}
      </Text>

      <View style={styles.row}>
        <Text style={styles.step}>
          Inhale {inhale}s
        </Text>

        {hold > 0 && (
          <Text style={styles.step}>
            Hold {hold}s
          </Text>
        )}

        <Text style={styles.step}>
          Exhale {exhale}s
        </Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
      >
        <Text style={styles.buttonText}>
          Start Session
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    elevation: 2,
  },

  emoji: {
    fontSize: 42,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 8,
    color: "#0f172a",
  },

  description: {
    color: "#64748b",
    marginTop: 8,
    lineHeight: 22,
  },

  row: {
    marginTop: 14,
  },

  step: {
    color: TEAL,
    fontWeight: "600",
    marginBottom: 4,
  },

  button: {
    backgroundColor: TEAL,
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});