import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from "react-native";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../context/authContext";

type LoginProps = {
  navigation?: any;
};

const Login = ({ navigation }: LoginProps) => {
  const router = useRouter();
  const { login, loading, socialAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing Fields", "Please enter both email and password");
      return;
    }

    try {
      setLoginLoading(true);

      // Call login from context — this should store the token/user internally
      await login(email.trim().toLowerCase(), password);

      // Navigate to the authenticated home tab after successful login
      router.replace("/profile");
    } catch (error: any) {
      console.log("Login error:", error); // helps debug

      // Show whatever error the server returned
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Invalid email or password. Please try again.";

      Alert.alert("Login Failed", message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoginLoading(true);
      await socialAuth("google", "login");
      router.replace("/profile");
    } catch (error) {
      Alert.alert("Google Login Failed", "Please try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    try {
      setLoginLoading(true);
      await socialAuth("facebook", "login");
      router.replace("/profile");
    } catch (error) {
      Alert.alert("Facebook Login Failed", "Please try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1f7a7a" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      {/* App Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require("../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Title */}
      <Text style={styles.title}>Welcome Back</Text>

      {/* Subtitle */}
      <Text style={styles.subtitle}>
        Your journey to hormonal harmony continues here.
      </Text>

      {/* Form Card */}
      <View style={styles.card}>
        {/* Email */}
        <Text style={styles.label}>Email Address</Text>
        <View style={styles.inputRow}>
          <Text style={styles.inputIcon}>✉️</Text>
          <TextInput
            placeholder="name@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            placeholderTextColor="#aaa"
          />
        </View>

        {/* Password */}
        <View style={styles.passwordHeader}>
          <Text style={styles.label}>Password</Text>
          <TouchableOpacity>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.inputRow}>
          <Text style={styles.inputIcon}>🔒</Text>
          <TextInput
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            style={[styles.input, { flex: 1 }]}
            placeholderTextColor="#aaa"
            autoCorrect={false}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.eyeIcon}>{showPassword ? "🙈" : "👁️"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Login Button */}
      <TouchableOpacity
        style={[styles.button, loginLoading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loginLoading}
        activeOpacity={0.8}
      >
        {loginLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Login →</Text>
        )}
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Social Buttons */}
      <View style={styles.socialRow}>
        <TouchableOpacity style={styles.socialButton} onPress={handleGoogleLogin}>
          <Text style={styles.googleText}>G</Text>
          <Text style={styles.socialButtonText}>Google</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.socialButton} onPress={handleFacebookLogin}>
          <Text style={styles.facebookText}>f</Text>
          <Text style={styles.socialButtonText}>Facebook</Text>
        </TouchableOpacity>
      </View>

      {/* Sign Up Link */}
      <Text style={styles.signupText}>
        Don't have an account?{" "}
        <Text
          style={styles.signupLink}
          onPress={() => router.push("/signup")}
        >
          Sign Up
        </Text>
      </Text>
    </ScrollView>
  </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f0f4f8",
  },
  container: {
    flexGrow: 1,
    backgroundColor: "#f0f4f8",
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: "center",
  },

  // Logo
  logoContainer: {
    marginTop: 60,
    marginBottom: 20,
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  logo: {
    width: 48,
    height: 48,
  },

  // Title / subtitle
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 10,
  },

  // Card
  card: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },

  // Labels
  label: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 6,
    marginTop: 8,
  },
  passwordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  forgotText: {
    fontSize: 13,
    color: "#1f7a7a",
    fontWeight: "600",
  },

  // Input rows
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#fff",
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  eyeIcon: {
    fontSize: 16,
    marginLeft: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#1a1a1a",
    paddingVertical: 10,
  },

  // Login Button
  button: {
    width: "100%",
    backgroundColor: "#1f7a7a",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f7fa",
  },

  // Divider
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e5e7eb",
  },
  dividerText: {
    fontSize: 11,
    color: "#9ca3af",
    marginHorizontal: 10,
    letterSpacing: 0.5,
  },

  // Social buttons
  socialRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginBottom: 28,
  },
  socialButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: "#fff",
    gap: 8,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  googleText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EA4335",
  },
  facebookText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1877F2",
  },

  // Sign up link
  signupText: {
    fontSize: 14,
    color: "#6b7280",
  },
  signupLink: {
    color: "#1f7a7a",
    fontWeight: "700",
  },
});

export default Login;