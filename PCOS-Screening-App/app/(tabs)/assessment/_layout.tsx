import { Stack } from "expo-router";
import { AssessmentProvider } from "../../../context/assessmentContext";

export default function AssessmentLayout() {
  return (
    <AssessmentProvider>
      <Stack>
        <Stack.Screen name="step1" options={{ title: "Step 1" }} />
        <Stack.Screen name="step2" options={{ title: "Step 2" }} />
        <Stack.Screen name="step3" options={{ title: "Step 3" }} />
        <Stack.Screen name="step4" options={{ title: "Step 4" }} />
        <Stack.Screen name="result" options={{ title: "Result" }} />
      </Stack>
    </AssessmentProvider>
  );
}