import { TravelPlayer } from "@/components/player/travel-player";
import { getLibraryState } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const state = await getLibraryState(false);
  return <TravelPlayer initialState={state} />;
}
