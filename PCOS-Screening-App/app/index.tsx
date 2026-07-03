import React, { useEffect } from "react";
import { View, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/authContext";

export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/profile");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1f7a7a" />
      </View>
    );
  }

  if (user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.push("/signup")}> 
        <Image
          source={require("../assets/logo1.png")}
          style={styles.logo}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginTop: 250,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 120,
    height: 120,
  },
});

