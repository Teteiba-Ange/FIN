import { useState } from "react";
import { AssessmentProvider, useAssessment } from "../../context/assessmentContext";
import Step1 from "./assessment/step1";
import Step2 from "./assessment/step2";
import Step3 from "./assessment/step3";
import Step4 from "./assessment/step4";
import Results from "./assessment/result";

function AssessmentFlow() {
  const [step, setStep] = useState<number | "result">(1);
  const { data } = useAssessment();

  const handleNextStep = (nextStep: number | "result") => {
    setStep(nextStep);
  };

  const handleRestart = () => {
    setStep(1);
  };

  return (
    <>
      {step === 1 && <Step1 onNext={() => handleNextStep(2)} />}
      {step === 2 && <Step2 onNext={() => handleNextStep(3)} />}
      {step === 3 && <Step3 onNext={() => handleNextStep(4)} />}
      {step === 4 && <Step4 onNext={() => handleNextStep("result")} />}
      {step === "result" && <Results onRestart={handleRestart} />}
    </>
  );
}

export default function AssessmentTab() {
  return <AssessmentFlow />;
}
