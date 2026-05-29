import { TravelPlayer } from "@/components/player/travel-player";
import { isCmsDisabled } from "@/lib/cloudflare-mode";
import { getDemoLibraryState } from "@/lib/demo-state";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (isCmsDisabled()) {
    return <TravelPlayer initialState={getDemoLibraryState()} />;
  }

  const { getLibraryState } = await import("@/lib/db");
  const state = await getLibraryState(false);
  return <TravelPlayer initialState={state} />;
}
