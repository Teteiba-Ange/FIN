import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const TEAL = "#1f7a7a";

interface Session {
  id: number;
  exercise: string;
  duration: string;
  date: string;
}

export default function HistoryScreen() {
  const [sessions] = useState<Session[]>([
    {
      id: 1,
      exercise: "Box Breathing",
      duration: "5 Minutes",
      date: "Today",
    },
    {
      id: 2,
      exercise: "4-7-8 Relaxation",
      duration: "4 Minutes",
      date: "Yesterday",
    },
    {
      id: 3,
      exercise: "Calm Breathing",
      duration: "3 Minutes",
      date: "2 Days Ago",
    },
  ]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>
        Mindfulness History
      </Text>

      <Text style={styles.subtitle}>
        Review your completed breathing sessions.
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
      >
        {sessions.map((session) => (
          <View
            key={session.id}
            style={styles.card}
          >
            <Text style={styles.exercise}>
              🧘 {session.exercise}
            </Text>

            <Text style={styles.detail}>
              Duration: {session.duration}
            </Text>

            <Text style={styles.date}>
              {session.date}
            </Text>
          </View>
        ))}

        {sessions.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              No Sessions Yet
            </Text>

            <Text style={styles.emptyText}>
              Complete your first breathing
              exercise to see your history.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 8,
  },

  subtitle: {
    color: "#64748b",
    marginBottom: 25,
    lineHeight: 22,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    marginBottom: 15,
    elevation: 2,
  },

  exercise: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },

  detail: {
    marginTop: 8,
    color: "#475569",
    fontSize: 15,
  },

  date: {
    marginTop: 10,
    color: TEAL,
    fontWeight: "600",
  },

  empty: {
    marginTop: 60,
    alignItems: "center",
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },

  emptyText: {
    marginTop: 10,
    textAlign: "center",
    color: "#64748b",
    lineHeight: 22,
  },
});