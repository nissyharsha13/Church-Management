import { Film, Image as ImageIcon, MonitorPlay as Youtube } from "lucide-react";
import type { MediaItem } from "../types";

export function MediaIcon({ item, className = "h-4 w-4" }: { item?: Pick<MediaItem, "source" | "kind">; className?: string }) {
  if (item?.source === "youtube") return <Youtube className={`${className} text-red-500`} />;
  if (item?.kind === "image") return <ImageIcon className={`${className} text-emerald-600`} />;
  return <Film className={`${className} text-emerald-600`} />;
}
