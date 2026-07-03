import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  SafeAreaView,
} from "react-native";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../context/authContext";

type SignupProps = {
  navigation?: any; // Pass navigation prop if handling external navigator configurations
};

const Signup = ({ navigation }: SignupProps) => {
  const { signup, socialAuth } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleCreateAccount = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert("Missing Fields", "Please fill out all fields.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return;
    }

    try {
      await signup(email.trim().toLowerCase(), password, name.trim());
      router.replace("/profile");
    } catch (error: any) {
      Alert.alert("Signup Failed", error.message || "Unable to create account.");
    }
  };

  const handleGoogleSignup = async () => {
    try {
      await socialAuth("google", "signup");
      router.replace("/profile");
    } catch (error) {
      Alert.alert("Google Signup Failed", "Please try again.");
    }
  };

  const handleFacebookSignup = async () => {
    try {
      await socialAuth("facebook", "signup");
      router.replace("/profile");
    } catch (error) {
      Alert.alert("Facebook Signup Failed", "Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      {/* Target Welcome Image */}
      <Image
        source={require("../assets/lady.png")}
        style={styles.image}
        resizeMode="cover"
      />

      {/* Brand Title Match */}
      <Text style={styles.title}>Join PMOS Wellness</Text>

      {/* Subtitle Message */}
      <Text style={styles.subtitle}>
        Begin your journey to hormonal balance with personalized insights and care
      </Text>

      {/* Entry Form Container */}
      <View style={styles.form}>
        {/* Full Name field */}
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          placeholder="Jane Doe"
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholderTextColor="#94a3b8"
        />

        {/* Email Address field */}
        <Text style={styles.label}>Email Address</Text>
        <TextInput
          placeholder="jane@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
          placeholderTextColor="#94a3b8"
        />

        {/* Password Entry field */}
        <Text style={styles.label}>Password</Text>
        <TextInput
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          placeholderTextColor="#94a3b8"
        />

        {/* Confirm Password Entry field */}
        <Text style={styles.label}>Confirm Password</Text>
        <TextInput
          placeholder="••••••••"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          style={styles.input}
          placeholderTextColor="#94a3b8"
        />
      </View>

      {/* Core Form Submit CTA Button */}
      <TouchableOpacity style={styles.button} onPress={handleCreateAccount}>
        <Text style={styles.buttonText}>Create Account →</Text>
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR SIGN UP WITH</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Social Signup Buttons */}
      <View style={styles.socialRow}>
        <TouchableOpacity style={styles.socialButton} onPress={handleGoogleSignup}>
          <Text style={styles.googleText}>G</Text>
          <Text style={styles.socialButtonText}>Google</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.socialButton} onPress={handleFacebookSignup}>
          <Text style={styles.facebookText}>f</Text>
          <Text style={styles.socialButtonText}>Facebook</Text>
        </TouchableOpacity>
      </View>

      {/* Deep-linking navigation swap across routes */}
      <Text style={styles.loginText}>
        Already have an account?{" "}
        <Text
          style={styles.loginLink}
          onPress={() => router.push("/login")}
        >
          Login
        </Text>
      </Text>
    </ScrollView>
  </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff", // Pure crisp white palette shift applied
  },
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: "#ffffff", // Pure crisp white palette shift applied
  },
  image: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    color: "#1e293b",
    marginBottom: 6,
  },
  subtitle: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  form: {
    marginTop: 5,
  },
  label: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  button: {
    marginTop: 30,
    backgroundColor: "#1f7a7a",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#1f7a7a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    marginBottom: 16,
    width: "100%",
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  dividerText: {
    marginHorizontal: 12,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  socialButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginHorizontal: 4,
  },
  socialButtonText: {
    marginLeft: 8,
    fontWeight: "700",
    color: "#334155",
  },
  googleText: {
    color: "#f97316",
    fontWeight: "800",
    fontSize: 16,
  },
  facebookText: {
    color: "#2563eb",
    fontWeight: "800",
    fontSize: 16,
  },
  loginText: {
    textAlign: "center",
    marginTop: 20,
    color: "#64748b",
    fontSize: 14,
  },
  loginLink: {
    color: "#1f7a7a",
    fontWeight: "700",
  },
});

export default Signup;