import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import OnboardingFlow from "@/components/OnboardingFlow";

export default function DisorderSelection() {
  const { updateDisorders, updateUser } = useAuth();
  const navigate = useNavigate();
  async function handleComplete(profile) {
    await updateDisorders(profile.selectedChallenges);
    updateUser({
      onboardingCompleted: true,
      tagProfile: profile.tagProfile,
      enabledModules: profile.enabledModules,
      onboardingResponses: profile.answersByQuestionId,
      onboardingVersion: "adaptive-v2",
      selectedChallenges: profile.selectedChallenges,
    });

    setTimeout(() => navigate("/", { replace: true }), 700);
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-6">
      <OnboardingFlow onComplete={handleComplete} />
    </div>
  );
}
