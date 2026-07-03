import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import React, { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/authContext";

const TEAL = "#1f7a7a";
const TEAL_LIGHT = "#e6f4f4";
const BLUSH_PINK = "#f43f5e";
const PINK_LIGHT = "#fff1f2";

const PCOS_UPDATES = [
  {
    id: 1,
    tag: "RESEARCH UPDATE 🔬",
    title: "Genetic Biomarkers Discovered",
    detail: "Researchers find new correlations between metabolic profiles and direct luteal phase lengths.",
  },
  {
    id: 2,
    tag: "CLINICAL INSIGHT 🧬",
    title: "Inositol vs Metformin Meta-Study",
    detail: "New data shows combined low-dose therapies reduce hyperandrogenism tracking indicators by 14%.",
  },
  {
    id: 3,
    tag: "DIET & HORMONES 🥑",
    title: "Spearmint Tea Efficacy",
    detail: "Two daily cups are clinically linked to minor anti-androgenic compound moderation.",
  }
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const firstName = user?.fullName?.split(" ")[0] || "there";

  // State controls
  const [isNewUser, setIsNewUser] = useState(true); 
  const [activeTab, setActiveTab] = useState("about"); // 'about' | 'research' | 'usage'
  const [currentUpdateIndex, setCurrentUpdateIndex] = useState(0);
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [steps, setSteps] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Auto-rotating Card Loop (Changes every 2 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentUpdateIndex((prevIndex) => (prevIndex + 1) % PCOS_UPDATES.length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const handleLogWater = () => {
    if (waterGlasses >= 8) {
      Alert.alert("Goal Met! 🎉", "Hydration goals achieved for today, gorgeous! 💧");
      return;
    }
    setWaterGlasses(prev => prev + 1);
  };

  const handleSyncDevice = () => {
    if (isSyncing) return;
    setIsSyncing(true);

    setTimeout(() => {
      setIsSyncing(false);
      setSteps(3420);
      Alert.alert("Sync Successful ✨", "Latest fitness and lifestyle metrics imported beautifully.");
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Header Greeting with Logo Integration */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleGroup}>
            <Image source={require("../../assets/logo.png")} style={styles.miniLogo} resizeMode="contain" />
            <View>
              <Text style={styles.greetingSub}>Welcome to PMOS Wellness,</Text>
              <Text style={styles.greetingTitle}>{firstName}! ✨</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.profileBadge}>
            <Text style={styles.profileBadgeText}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Rotating Updates Card */}
        <Text style={styles.sectionTitle}>Latest Health Briefings</Text>
        <View style={styles.rotatingCard}>
          <View style={styles.rotatingCardHeader}>
            <Text style={styles.rotatingTag}>{PCOS_UPDATES[currentUpdateIndex].tag}</Text>
            <View style={styles.dotContainer}>
              {PCOS_UPDATES.map((_, idx) => (
                <View 
                  key={idx} 
                  style={[styles.indicatorDot, idx === currentUpdateIndex && styles.activeDot]} 
                />
              ))}
            </View>
          </View>
          <Text style={styles.rotatingTitleText}>{PCOS_UPDATES[currentUpdateIndex].title}</Text>
          <Text style={styles.rotatingDetailText}>{PCOS_UPDATES[currentUpdateIndex].detail}</Text>
        </View>

        {/* Brand-New Onboarding Kickstart Panel */}
        {isNewUser && (
          <View style={styles.welcomeMilestoneCard}>
            <View style={styles.milestoneFlexRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.milestoneTag}>GETTING STARTED</Text>
                <Text style={styles.milestoneTitle}>Let's calibrate your wellness space ✨</Text>
                <Text style={styles.milestoneSubtitle}>
                  Complete your short evaluation profile to unlock personal symptom mapping strategies.
                </Text>
              </View>
              <Image source={require("../../assets/lady.png")} style={styles.milestoneImage} resizeMode="contain" />
            </View>
            
            <View style={styles.progressTrackBar}>
              <View style={styles.progressFillActive} />
            </View>
            <Text style={styles.progressTextSummary}>1 of 3 steps completed</Text>

            <TouchableOpacity 
              style={styles.milestoneCTAButton}
              onPress={() => {
                setIsNewUser(false); 
                router.push("/assess");
              }}
            >
              <Text style={styles.milestoneCTAButtonText}>Setup My Health Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Daily Tip Card */}
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>💡 Daily Wellness Nugget</Text>
          <Text style={styles.tipText}>
            Adding magnesium-rich foods like spinach or almonds to your breakfast can help regulate insulin sensitivity today.
          </Text>
        </View>

        {/* Fully Interactive Micro-Trackers */}
        <Text style={styles.sectionTitle}>Your Quick Logs</Text>
        <View style={styles.trackersGrid}>
          <View style={styles.trackerCard}>
            <Text style={styles.trackerIcon}>💧</Text>
            <Text style={styles.trackerTitle}>Water Intake</Text>
            <Text style={styles.trackerProgress}>{waterGlasses} / 8 Glasses</Text>
            <TouchableOpacity style={styles.plusButton} onPress={handleLogWater}>
              <Text style={styles.plusButtonText}>+ Log Glass</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.trackerCard}>
            <Text style={styles.trackerIcon}>🏃‍♀️</Text>
            <Text style={styles.trackerTitle}>Activity Steps</Text>
            <Text style={styles.trackerProgress}>{steps.toLocaleString()} / 8k steps</Text>
            <TouchableOpacity 
              style={[styles.plusButton, { backgroundColor: "#fff", borderWidth: 1, borderColor: TEAL }]}
              onPress={handleSyncDevice}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={TEAL} />
              ) : (
                <Text style={[styles.plusButtonText, { color: TEAL }]}>Sync Device</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Daily Wellness Actions Horizontal Swiper */}
        <Text style={styles.sectionTitle}>Track Key Metrics</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.horizontalSwiper}
          contentContainerStyle={styles.swiperInnerContainer}
        >
          <ActionItem icon="😊" label="Mood State" description="Log emotional baseline" />
          <ActionItem icon="🧬" label="Symptom Check" description="Acne, cramps, or bloating" />
          <ActionItem icon="💊" label="Supplements" description="Inositol, Vitamins, Zinc" />
          <ActionItem icon="😴" label="Sleep Quality" description="Log resting duration" />
        </ScrollView>

        {/* Community Engagement Banner */}
        <View style={styles.communityBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.communityTitle}>PMOS Circles Community 🌸</Text>
            <Text style={styles.communitySub}>Join 12k+ women discussing specialized recipes today.</Text>
          </View>
          <Text style={{ fontSize: 24 }}>💬</Text>
        </View>

        {/* Recommended Knowledge Hub */}
        {/* Recommended Knowledge Hub */}
        <View style={styles.recommendRow}>
          <Text style={styles.sectionTitle}>Tailored Insights For You</Text>
          <TouchableOpacity 
            onPress={() => Alert.alert("Coming Soon! 🌸", "We are curating more personalized medical and lifestyle insights for your feed.")}
          >
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recommendCard}>
          <Text style={styles.tag}>NUTRITION</Text>
          <Text style={styles.recommendTitle}>Managing Metabolic Profiles via Low-GI Diets</Text>
          <Text style={styles.recommendSub}>Learn how steady-release carbohydrates control insulin spikes.</Text>
        </View>

        {/* --- REPOSITIONED DISCOVERY HUB (Now directly below the nutrition card layout) --- */}
        <View style={styles.discoveryContainer}>
          <Text style={styles.discoveryHeaderTitle}>Explore PMOS Spaces</Text>
          
          {/* Tab Selector Buttons */}
          <View style={styles.tabBar}>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === "about" && styles.tabButtonActive]} 
              onPress={() => setActiveTab("about")}
            >
              <Text style={[styles.tabButtonText, activeTab === "about" && styles.tabButtonTextActive]}>About Us</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabButton, activeTab === "research" && styles.tabButtonActive]} 
              onPress={() => setActiveTab("research")}
            >
              <Text style={[styles.tabButtonText, activeTab === "research" && styles.tabButtonTextActive]}>Research</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabButton, activeTab === "usage" && styles.tabButtonActive]} 
              onPress={() => setActiveTab("usage")}
            >
              <Text style={[styles.tabButtonText, activeTab === "usage" && styles.tabButtonTextActive]}>How & Where</Text>
            </TouchableOpacity>
          </View>

          {/* Dynamic Informative Content Switcher */}
          <View style={styles.tabContentArea}>
            {activeTab === "about" && (
              <View style={styles.infoBlock}>
                <Text style={styles.infoTitle}>Your Hormonal Companion 🌸</Text>
                <Text style={styles.infoBody}>
                  PMOS Wellness is designed to empower women navigating complex metabolic, reproductive, and cycle variances. We offer smart screening tracking tools to help you identify triggers and reclaim balance smoothly.
                </Text>
              </View>
            )}

            {activeTab === "research" && (
              <View style={styles.infoBlock}>
                <Text style={styles.infoTitle}>What Clinical Studies Say 🔬</Text>
                <Text style={styles.infoBody}>
                  Current clinical evidence highlights that PCOS/PMOS is a systemic endocrine variant rooted heavily in insulin resistance and chronic low-grade inflammation. Managing specific glycemic loads and micronutrient variables helps stabilize luteal health patterns.
                </Text>
              </View>
            )}

            {activeTab === "usage" && (
              <View style={styles.infoBlock}>
                <Text style={styles.infoTitle}>Everywhere & Anytime Continuity 📍</Text>
                <Text style={styles.infoBody}>
                  <Text style={{fontWeight: '700'}}>When:</Text> Log daily upon waking up and right before sleep for pristine trends.{"\n"}
                  <Text style={{fontWeight: '700'}}>Where:</Text> Your secure profile and core database calculations operate securely on your smartphone for anytime offline tracking support.
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const ActionItem = ({ icon, label, description }: { icon: string; label: string; description: string }) => (
  <TouchableOpacity style={styles.actionItemContainer}>
    <Text style={styles.actionIcon}>{icon}</Text>
    <Text style={styles.actionLabel}>{label}</Text>
    <Text style={styles.actionDesc}>{description}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fdf8f7" }, 
  scrollContent: { padding: 16 },

  headerRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: 24,
    marginTop: 10 
  },
  headerTitleGroup: { flexDirection: "row", alignItems: "center", gap: 10 },
  miniLogo: { width: 42, height: 42, borderRadius: 10 },
  greetingSub: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  greetingTitle: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  profileBadge: { backgroundColor: "#fff", padding: 10, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  profileBadgeText: { fontSize: 18 },

  // Discovery Hub Container Layout
  discoveryContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    marginTop: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#fce7f3",
    shadowColor: "#f43f5e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1
  },
  discoveryHeaderTitle: { fontSize: 15, fontWeight: "800", color: "#1e293b", marginBottom: 12 },
  tabBar: { flexDirection: "row", backgroundColor: "#f8fafc", padding: 4, borderRadius: 12, gap: 4 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  tabButtonActive: { backgroundColor: TEAL },
  tabButtonText: { fontSize: 12, fontWeight: "700", color: "#64748b" },
  tabButtonTextActive: { color: "#ffffff" },
  tabContentArea: { marginTop: 14 },
  infoBlock: { paddingHorizontal: 4 },
  infoTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 6 },
  infoBody: { fontSize: 12, color: "#475569", lineHeight: 18 },

  // Onboarding Layout
  welcomeMilestoneCard: { backgroundColor: "#1e293b", borderRadius: 20, padding: 18, marginBottom: 24 },
  milestoneFlexRow: { flexDirection: "row", alignItems: "center" },
  milestoneImage: { width: 85, height: 85, borderRadius: 12 },
  milestoneTag: { color: "#38bdf8", fontSize: 9, fontWeight: "800", letterSpacing: 1, marginBottom: 4 },
  milestoneTitle: { color: "#ffffff", fontSize: 17, fontWeight: "800", lineHeight: 22 },
  milestoneSubtitle: { color: "#94a3b8", fontSize: 12, marginTop: 4, lineHeight: 16 },
  progressTrackBar: { height: 6, backgroundColor: "#334155", borderRadius: 3, marginTop: 14, overflow: "hidden" },
  progressFillActive: { width: "33%", height: "100%", backgroundColor: BLUSH_PINK, borderRadius: 3 },
  progressTextSummary: { color: "#64748b", fontSize: 11, fontWeight: "600", marginTop: 6 },
  milestoneCTAButton: { backgroundColor: TEAL, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 14 },
  milestoneCTAButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },

  // Rotating Card Styling Layout
  rotatingCard: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#fce7f3", borderRadius: 16, padding: 16, marginBottom: 24 },
  rotatingCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  rotatingTag: { fontSize: 9, color: BLUSH_PINK, fontWeight: "800", letterSpacing: 0.5, backgroundColor: PINK_LIGHT, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  dotContainer: { flexDirection: "row", gap: 4 },
  indicatorDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#cbd5e1" },
  activeDot: { backgroundColor: BLUSH_PINK, width: 14 },
  rotatingTitleText: { fontSize: 14, fontWeight: "700", color: "#1e293b", marginBottom: 4 },
  rotatingDetailText: { fontSize: 12, color: "#64748b", lineHeight: 16 },

  tipCard: { backgroundColor: TEAL_LIGHT, padding: 16, borderRadius: 16, marginBottom: 24 },
  tipTitle: { fontSize: 14, fontWeight: "700", color: TEAL, marginBottom: 4 },
  tipText: { fontSize: 13, color: "#334155", lineHeight: 18 },

  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#1e293b", marginBottom: 12 },

  trackersGrid: { flexDirection: "row", gap: 12, marginBottom: 24 },
  trackerCard: { flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#f1f5f9", justifyContent: "space-between" },
  trackerIcon: { fontSize: 24, marginBottom: 4 },
  trackerTitle: { fontSize: 14, fontWeight: "700", color: "#334155" },
  trackerProgress: { fontSize: 12, color: "#64748b", marginTop: 2, marginBottom: 12 },
  plusButton: { backgroundColor: TEAL, paddingVertical: 8, borderRadius: 8, alignItems: "center", height: 34, justifyContent: "center" },
  plusButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  horizontalSwiper: { marginHorizontal: -16, paddingLeft: 16, marginBottom: 24 },
  swiperInnerContainer: { paddingRight: 32, gap: 12 },
  actionItemContainer: { backgroundColor: "#fff", width: 135, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#f1f5f9" },
  actionIcon: { fontSize: 24, marginBottom: 6 },
  actionLabel: { fontSize: 13, fontWeight: "700", color: "#1e293b" },
  actionDesc: { fontSize: 11, color: "#64748b", marginTop: 4, lineHeight: 14 },

  communityBanner: { flexDirection: "row", alignItems: "center", backgroundColor: PINK_LIGHT, padding: 16, borderRadius: 16, marginBottom: 24 },
  communityTitle: { fontSize: 14, fontWeight: "700", color: "#9f1239" },
  communitySub: { fontSize: 12, color: "#be123c", marginTop: 2 },

  recommendRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  viewAll: { color: TEAL, fontSize: 13, fontWeight: "600" },
  recommendCard: { backgroundColor: "#fff", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#f1f5f9" },
  tag: { color: TEAL, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  recommendTitle: { fontSize: 14, fontWeight: "700", marginTop: 6, color: "#1e293b" },
  recommendSub: { fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 16 },
});