import { BentoBuilder } from "@/components/BentoBuilder";
import { publicConfig } from "@/lib/config";

export default function HomePage() {
  return <BentoBuilder config={publicConfig} />;
}
