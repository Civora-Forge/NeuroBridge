import ComingSoon from "@/components/ComingSoon";
import { Ear } from "lucide-react";
export default function APDPage() {
    return (<ComingSoon title="APD" subtitle="SoundClear" description="Real-time speech-to-text, background noise filter simulator, auditory training exercises, and visual communication aids." color="bg-mode-apd" icon={<Ear className="w-12 h-12 text-primary-foreground"/>}/>);
}
